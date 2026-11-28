import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import Razorpay from 'razorpay';
import { createServer as createViteServer } from 'vite';
import { db, SEED_SETTINGS, StoredUser } from './server/db';
import {
  AuthenticatedRequest,
  checkRateLimit,
  clearRateLimit,
  extractBearerToken,
  generateRecoveryKey,
  generateShortResetCode,
  hashPassword,
  maskEmail,
  requireAdmin,
  requireAuth,
  signToken,
  timingSafeCompare,
  verifyPassword,
  verifyToken,
} from './server/auth';
import { calculateFareEstimate } from './server/pricing';
import {
  dispatchBookingStatusEmail,
  dispatchEnquiryStatusEmail,
  dispatchNewBookingEmails,
  dispatchNewEnquiryAdminEmail,
  hashAdminActionToken,
  sendPasswordResetOtpEmail,
} from './server/email';
import {
  Booking,
  BookingStatus,
  Driver,
  Enquiry,
  FeaturedDestination,
  FleetGroup,
  GalleryCategory,
  GalleryItem,
  PackageType,
  PaymentRecord,
  PricingConfig,
  Review,
  ServiceStatus,
  TravelPackage,
  TravelService,
  TripType,
  Vehicle,
  VehicleCategory,
  WebsiteSettings,
} from './src/types';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const TEST_ORDER_HMAC_SECRET = crypto.randomBytes(32).toString('hex');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

async function runEmailSafely<T>(promise: Promise<T>, timeoutMs = 5000): Promise<T | null> {
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
  } catch (err) {
    console.warn('[Email] Non-blocking dispatch error:', (err as Error).message);
    return null;
  }
}

const inFlightActionDecisions = new Set<string>();

function resolveRequestBaseUrl(req: Request): string {
  const rawProto = asString(req.headers['x-forwarded-proto'], 16).split(',')[0].trim().toLowerCase();
  const proto = rawProto === 'http' || rawProto === 'https' ? rawProto : req.protocol === 'https' ? 'https' : 'http';
  const rawHost = (asString(req.headers['x-forwarded-host'], 160) || asString(req.get('host'), 160))
    .split(',')[0]
    .trim();
  if (rawHost && /^[a-zA-Z0-9.-]+(:\d{1,5})?$/.test(rawHost)) {
    return `${proto}://${rawHost}`;
  }
  const appUrl = process.env.APP_URL?.trim();
  if (appUrl && appUrl !== 'MY_APP_URL') {
    try {
      const parsed = new URL(appUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return `${parsed.protocol}//${parsed.host}`;
      }
    } catch {
      // ignore invalid APP_URL
    }
  }
  return `http://localhost:${PORT}`;
}

function asString(val: unknown, maxLen = 400): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function asNumber(val: unknown, fallback = 0): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function normalizePhoneDigits(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function toPublicUser(user: StoredUser) {
  const {
    passwordHash: _p,
    recoveryPinHash,
    resetTokenHash: _rt,
    resetTokenExpiresAt: _re,
    ...rest
  } = user;
  return {
    ...rest,
    hasRecoveryPin: Boolean(recoveryPinHash),
  };
}

function sanitizeAssetUrl(val: unknown, fallback: string): string {
  const str = asString(val, 400);
  if (!str) return fallback;
  if (str.startsWith('/assets/') || str.startsWith('/uploads/') || str.startsWith('/src/')) {
    return str;
  }
  try {
    const parsed = new URL(str);
    if (parsed.protocol === 'https:') return str;
  } catch {
    // invalid URL
  }
  return fallback;
}

function sanitizeSocialUrl(val: unknown): string {
  const str = asString(val, 300);
  if (!str) return '';
  try {
    const parsed = new URL(str);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return str;
  } catch {
    // invalid URL
  }
  return '';
}

function isDateOverlap(
  startA: string,
  endA: string,
  timeA: string,
  tripTypeA: TripType,
  startB: string,
  endB: string,
  timeB: string,
  tripTypeB: TripType
): boolean {
  const sA = startA;
  const eA = endA && endA >= startA ? endA : startA;
  const sB = startB;
  const eB = endB && endB >= startB ? endB : startB;

  if (sA > eB || sB > eA) return false;

  // If both are single-day short trips (Airport Transfer or Local Rental) on the exact same single day,
  // allow bookings that are at least 5 hours apart.
  if (
    sA === eA &&
    sB === eB &&
    sA === sB &&
    (tripTypeA === 'Airport Transfer' || tripTypeA === 'Local Rental') &&
    (tripTypeB === 'Airport Transfer' || tripTypeB === 'Local Rental')
  ) {
    const [hA = 9, mA = 0] = (timeA || '09:00').split(':').map(Number);
    const [hB = 9, mB = 0] = (timeB || '09:00').split(':').map(Number);
    const minsA = hA * 60 + mA;
    const minsB = hB * 60 + mB;
    return Math.abs(minsA - minsB) < 300;
  }

  return true;
}

function hasVehicleBookingConflict(
  bookings: Booking[],
  vehicleId: string,
  journeyDate: string,
  returnDate: string | undefined,
  journeyTime: string,
  tripType: TripType,
  excludeBookingId?: string
): Booking | undefined {
  return bookings.find((b) => {
    if (b.id === excludeBookingId) return false;
    if (b.vehicleId !== vehicleId) return false;
    if (b.bookingStatus === 'Cancelled' || b.bookingStatus === 'Rejected') return false;
    return isDateOverlap(
      b.journeyDate,
      b.returnDate || b.journeyDate,
      b.journeyTime,
      b.tripType,
      journeyDate,
      returnDate || journeyDate,
      journeyTime,
      tripType
    );
  });
}

async function startServer() {
  await db.init();
  const app = express();
  app.use(express.json({ limit: '6mb' }));
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      storage: db.isMongoConnected() ? 'mongodb' : 'local-persistent',
      razorpayConfigured: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
      resendConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
    });
  });

  // Public runtime client config (reads env vars at runtime so no API keys need to be baked into Git)
  app.get('/api/config/public', (_req: Request, res: Response) => {
    const mapsApiKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ||
      process.env.GOOGLE_MAPS_API_KEY?.trim() ||
      '';
    const mapsMapId =
      process.env.VITE_GOOGLE_MAPS_MAP_ID?.trim() ||
      process.env.GOOGLE_MAPS_MAP_ID?.trim() ||
      'DEMO_MAP_ID';
    res.json({ mapsApiKey, mapsMapId });
  });

  // ── Public Fleet & Pricing Routes ───────────────────────────────────────────

  app.get('/api/categories', async (_req: Request, res: Response) => {
    const [vehicles, pricing] = await Promise.all([db.getAll('vehicles'), db.getPricing()]);
    const activeVehicles = vehicles.filter((v) => v.status !== 'Inactive');

    const categoryMeta: Record<VehicleCategory, { fleetGroup: FleetGroup; subtitle: string }> = {
      Cars: { fleetGroup: 'Car', subtitle: '4-Seater Executive & City Sedans' },
      SUVs: { fleetGroup: 'Car', subtitle: '6–7 Seater Family & Highway MPVs' },
      'Premium Cars': { fleetGroup: 'Car', subtitle: 'Chauffeur-Driven Luxury Saloons' },
      'Tempo Travellers': { fleetGroup: 'Bus', subtitle: '12–17 Seater Group Travel Vans' },
      'Mini Buses': { fleetGroup: 'Bus', subtitle: '20–28 Seater Corporate & Event Coaches' },
      'Luxury Buses': { fleetGroup: 'Bus', subtitle: '40–45 Seater Multi-Axle AC Coaches' },
      'Large Passenger Buses': { fleetGroup: 'Bus', subtitle: '49–55 Seater Institutional & Charter Coaches' },
    };

    const categories = (Object.keys(categoryMeta) as VehicleCategory[])
      .map((cat) => {
        const list = activeVehicles.filter((v) => v.category === cat);
        if (list.length === 0) return null;
        const rule = pricing.rules.find((r) => r.category === cat);
        return {
          category: cat,
          fleetGroup: categoryMeta[cat].fleetGroup,
          subtitle: categoryMeta[cat].subtitle,
          count: list.length,
          availableCount: list.filter((v) => v.status === 'Available').length,
          startingPerKm: rule?.perKmRate ?? 0,
          startingHalfDay: rule?.halfDayRate ?? 0,
          startingPerDayBus: rule?.perDayBusRate ?? 0,
          sampleImage: list[0]?.images[0] ?? '',
        };
      })
      .filter(Boolean);

    res.json({ categories });
  });

  app.get('/api/vehicles', async (req: Request, res: Response) => {
    const [vehicles, drivers, pricing] = await Promise.all([
      db.getAll('vehicles'),
      db.getAll('drivers'),
      db.getPricing(),
    ]);

    const fleetGroup = asString(req.query.fleetGroup, 20);
    const category = asString(req.query.category, 60);
    const ac = asString(req.query.ac, 10);
    const minCapacity = asNumber(req.query.minCapacity, 0);
    const maxPrice = asNumber(req.query.maxPrice, 0);
    const availableOnly = asString(req.query.availableOnly, 10) === 'true';
    const search = asString(req.query.search, 80).toLowerCase();

    const filtered = vehicles
      .filter((v) => v.status !== 'Inactive')
      .filter((v) => !fleetGroup || v.fleetGroup === fleetGroup)
      .filter((v) => !category || v.category === category)
      .filter((v) => !ac || (ac === 'true' ? v.ac : !v.ac))
      .filter((v) => v.seatingCapacity >= minCapacity)
      .filter((v) => !availableOnly || v.status === 'Available')
      .filter((v) => {
        if (!search) return true;
        return (
          v.name.toLowerCase().includes(search) ||
          v.model.toLowerCase().includes(search) ||
          v.category.toLowerCase().includes(search)
        );
      })
      .map((v) => {
        const rule = pricing.rules.find((r) => r.category === v.category);
        const perKmRate = v.customPerKmRate ?? rule?.perKmRate ?? 15;
        const startingHalfDay = rule?.halfDayRate ?? 1500;
        const driver = drivers.find((d) => d.id === v.assignedDriverId);
        return {
          ...v,
          perKmRate,
          startingHalfDay,
          perDayBusRate: v.customPerDayRate ?? rule?.perDayBusRate ?? 0,
          driverInfo: driver
            ? {
                id: driver.id,
                name: driver.name,
                experienceYears: driver.experienceYears,
                languages: driver.languages,
              }
            : null,
        };
      })
      .filter((v) => !maxPrice || v.perKmRate <= maxPrice);

    res.json({ vehicles: filtered });
  });

  app.get('/api/vehicles/available', async (req: Request, res: Response) => {
    const [vehicles, bookings, drivers, pricing] = await Promise.all([
      db.getAll('vehicles'),
      db.getAll('bookings'),
      db.getAll('drivers'),
      db.getPricing(),
    ]);

    const category = asString(req.query.category, 60);
    const fleetGroup = asString(req.query.fleetGroup, 20);
    const passengerCount = Math.max(1, asNumber(req.query.passengers, 1));
    const journeyDate = asString(req.query.journeyDate, 20);
    const returnDate = asString(req.query.returnDate, 20) || undefined;
    const journeyTime = asString(req.query.journeyTime, 10) || '09:00';
    const tripType = (asString(req.query.tripType, 30) || 'One Way') as TripType;
    const distanceKm = Math.max(15, asNumber(req.query.distanceKm, 45));

    const results = vehicles
      .filter((v) => v.status === 'Available')
      .filter((v) => !category || category === 'All' || v.category === category)
      .filter((v) => !fleetGroup || v.fleetGroup === fleetGroup)
      .filter((v) => v.seatingCapacity >= passengerCount)
      .map((v) => {
        const conflict = journeyDate
          ? hasVehicleBookingConflict(bookings, v.id, journeyDate, returnDate, journeyTime, tripType)
          : undefined;
        const fareEstimate = calculateFareEstimate({
          vehicle: v,
          pricing,
          tripType,
          distanceKm,
          journeyDate: journeyDate || new Date().toISOString().slice(0, 10),
          journeyTime,
          returnDate,
        });
        const driver = drivers.find((d) => d.id === v.assignedDriverId);
        return {
          ...v,
          isAvailableForDates: !conflict,
          conflictNote: conflict ? `Reserved on ${conflict.journeyDate}` : null,
          fareEstimate,
          driverInfo: driver
            ? {
                id: driver.id,
                name: driver.name,
                experienceYears: driver.experienceYears,
                languages: driver.languages,
              }
            : null,
        };
      });

    res.json({ vehicles: results });
  });

  app.get('/api/pricing', async (_req: Request, res: Response) => {
    const pricing = await db.getPricing();
    res.json({ pricing });
  });

  app.get('/api/settings', async (_req: Request, res: Response) => {
    const settings = await db.getSettings();
    res.json({ settings });
  });

  app.get('/api/gallery', async (_req: Request, res: Response) => {
    const gallery = await db.getAll('gallery');
    const sorted = [...gallery].sort((a, b) => {
      if (Boolean(a.featured) !== Boolean(b.featured)) {
        return a.featured ? -1 : 1;
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
    res.json({ gallery: sorted });
  });

  app.get('/api/services', async (_req: Request, res: Response) => {
    const services = await db.getAll('services');
    const visible = services
      .filter((s) => s.status !== 'Archived')
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'Active' ? -1 : 1;
        return a.num.localeCompare(b.num, undefined, { numeric: true });
      });
    res.json({ services: visible });
  });

  app.get('/api/destinations', async (_req: Request, res: Response) => {
    const destinations = await db.getAll('destinations');
    const visible = destinations
      .filter((d) => d.active)
      .sort((a, b) => {
        if (Boolean(a.featured) !== Boolean(b.featured)) return a.featured ? -1 : 1;
        return a.createdAt.localeCompare(b.createdAt);
      });
    res.json({ destinations: visible });
  });

  app.get('/api/packages', async (_req: Request, res: Response) => {
    const packages = await db.getAll('packages');
    const visible = packages
      .filter((p) => p.active)
      .sort((a, b) => {
        if (Boolean(a.featured) !== Boolean(b.featured)) return a.featured ? -1 : 1;
        return a.createdAt.localeCompare(b.createdAt);
      });
    res.json({ packages: visible });
  });

  app.post('/api/pricing/estimate', async (req: Request, res: Response) => {
    const vehicleId = asString(req.body.vehicleId, 60);
    const tripType = (asString(req.body.tripType, 30) || 'One Way') as TripType;
    const distanceKm = Math.max(10, asNumber(req.body.distanceKm, 40));
    const journeyDate = asString(req.body.journeyDate, 20) || new Date().toISOString().slice(0, 10);
    const journeyTime = asString(req.body.journeyTime, 10) || '09:00';
    const returnDate = asString(req.body.returnDate, 20) || undefined;
    const localPackageHours = asNumber(req.body.localPackageHours, 8);

    const [vehicles, pricing] = await Promise.all([db.getAll('vehicles'), db.getPricing()]);
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) {
      res.status(404).json({ error: 'Selected vehicle not found' });
      return;
    }

    const estimate = calculateFareEstimate({
      vehicle,
      pricing,
      tripType,
      distanceKm,
      journeyDate,
      journeyTime,
      returnDate,
      localPackageHours,
    });

    res.json({ estimate });
  });

  app.get('/api/reviews', async (_req: Request, res: Response) => {
    const reviews = await db.getAll('reviews');
    res.json({ reviews: reviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  });

  app.post('/api/reviews', async (req: Request, res: Response) => {
    const customerName = asString(req.body.customerName, 80);
    const roleOrCity = asString(req.body.roleOrCity, 80);
    const companyOrTrip = asString(req.body.companyOrTrip, 100);
    const vehicleCategory = (asString(req.body.vehicleCategory, 60) || 'Cars') as VehicleCategory;
    const rating = Math.min(5, Math.max(1, asNumber(req.body.rating, 5)));
    const comment = asString(req.body.comment, 600);

    if (!customerName || !comment) {
      res.status(400).json({ error: 'Name and review comment are required' });
      return;
    }

    const review: Review = {
      id: `rev-${Date.now()}`,
      customerName,
      roleOrCity: roleOrCity || 'Verified Customer',
      companyOrTrip: companyOrTrip || 'Private Charter',
      vehicleCategory,
      rating,
      comment,
      verified: true,
      createdAt: new Date().toISOString(),
    };
    await db.insertOne('reviews', review);
    res.status(201).json({ review });
  });

  app.post('/api/enquiries', async (req: Request, res: Response) => {
    const name = asString(req.body.name, 80);
    const email = asString(req.body.email, 120);
    const phone = asString(req.body.phone, 30);
    const subject = asString(req.body.subject, 120);
    const message = asString(req.body.message, 1000);
    const source = (asString(req.body.source, 30) || 'Contact Form') as Enquiry['source'];
    const bookingCode = asString(req.body.bookingCode, 40) || undefined;

    if (!name || !phone || !message) {
      res.status(400).json({ error: 'Name, mobile number, and message are required' });
      return;
    }

    const enquiry: Enquiry = {
      id: `enq-${Date.now()}`,
      name,
      email: email || 'not-provided@vizagjagantravels.com',
      phone,
      subject: subject || 'Travel Fleet Enquiry',
      message,
      source,
      bookingCode,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    };
    await db.insertOne('enquiries', enquiry);
    await runEmailSafely(dispatchNewEnquiryAdminEmail(enquiry.id, resolveRequestBaseUrl(req)));
    res.status(201).json({ enquiry, message: 'Enquiry received. Our dispatch team will reach out shortly.' });
  });

  // ── Authentication Routes ──────────────────────────────────────────────────

  app.get('/api/auth/admin/status', async (_req: Request, res: Response) => {
    const creds = await db.getAll('adminCredentials');
    const envPasscodeConfigured = Boolean(process.env.ADMIN_PASSCODE?.trim());
    res.json({
      setupRequired: !envPasscodeConfigured && creds.length === 0,
      envPasscodeConfigured,
      hasClaimedAdmin: creds.length > 0,
      maskedAdminEmail: creds.length > 0 ? maskEmail(creds[0].email) : null,
    });
  });

  app.post('/api/auth/admin/setup', async (req: Request, res: Response) => {
    const rl = checkRateLimit(`admin-setup:${req.ip}`, 6);
    if (!rl.allowed) {
      res.status(429).json({ error: `Too many setup attempts. Try again in ${rl.retryAfterSeconds}s.` });
      return;
    }

    if (process.env.ADMIN_PASSCODE?.trim()) {
      res.status(403).json({ error: 'Admin passcode is managed by environment configuration.' });
      return;
    }
    const existing = await db.getAll('adminCredentials');
    if (existing.length > 0) {
      res.status(409).json({ error: 'Admin account is already claimed. Please sign in.' });
      return;
    }

    const email = asString(req.body.email, 120).toLowerCase();
    const name = asString(req.body.name, 80) || 'Fleet Administrator';
    const password = asString(req.body.password, 100);
    const customRecoveryKey = asString(req.body.recoveryKey, 64);

    if (!email || !email.includes('@') || password.length < 6) {
      res.status(400).json({ error: 'Valid admin email and password (min 6 characters) are required.' });
      return;
    }
    if (customRecoveryKey && customRecoveryKey.length < 6) {
      res.status(400).json({ error: 'Custom recovery key must be at least 6 characters.' });
      return;
    }

    const recoveryKey = customRecoveryKey || generateRecoveryKey('VJT');
    const [passwordHash, recoveryCodeHash] = await Promise.all([
      hashPassword(password),
      hashPassword(recoveryKey),
    ]);

    const now = new Date().toISOString();
    const adminRec = {
      id: `adm-${Date.now()}`,
      email,
      name,
      passwordHash,
      recoveryCodeHash,
      adminEmailMigrated: true,
      createdAt: now,
      updatedAt: now,
    };
    await db.insertOne('adminCredentials', adminRec);
    clearRateLimit(`admin-setup:${req.ip}`);

    const token = signToken({
      userId: adminRec.id,
      email: adminRec.email,
      name: adminRec.name,
      role: 'admin',
    });

    res.status(201).json({
      token,
      recoveryKey,
      user: {
        id: adminRec.id,
        email: adminRec.email,
        name: adminRec.name,
        phone: '',
        role: 'admin',
        createdAt: adminRec.createdAt,
      },
    });
  });

  app.post('/api/auth/admin/login', async (req: Request, res: Response) => {
    const email = asString(req.body.email, 120).toLowerCase();
    const password = asString(req.body.password, 100);
    const rlKey = `admin-login:${req.ip}:${email || 'env'}`;
    const rl = checkRateLimit(rlKey, 8);
    if (!rl.allowed) {
      res.status(429).json({ error: `Too many login attempts. Try again in ${rl.retryAfterSeconds}s.` });
      return;
    }

    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    if (envPasscode) {
      if (!password || !timingSafeCompare(password, envPasscode)) {
        res.status(401).json({ error: 'Invalid administrator credentials' });
        return;
      }
      clearRateLimit(rlKey);
      const adminEmail = email || 'jagantravelsvizag@gmail.com';
      const token = signToken({
        userId: 'adm-env',
        email: adminEmail,
        name: 'Fleet Administrator',
        role: 'admin',
      });
      res.json({
        token,
        user: {
          id: 'adm-env',
          email: adminEmail,
          name: 'Fleet Administrator',
          phone: '',
          role: 'admin',
          createdAt: new Date().toISOString(),
        },
      });
      return;
    }

    const creds = await db.getAll('adminCredentials');
    if (creds.length === 0) {
      res.status(400).json({ error: 'Admin access has not been initialized yet. Complete first-run setup.' });
      return;
    }

    const matched = email ? creds.find((c) => c.email === email) : creds[0];
    if (!matched || !password || !(await verifyPassword(password, matched.passwordHash))) {
      res.status(401).json({ error: 'Invalid administrator email or password' });
      return;
    }

    clearRateLimit(rlKey);
    const token = signToken({
      userId: matched.id,
      email: matched.email,
      name: matched.name,
      role: 'admin',
    });

    res.json({
      token,
      user: {
        id: matched.id,
        email: matched.email,
        name: matched.name,
        phone: '',
        role: 'admin',
        createdAt: matched.createdAt,
      },
    });
  });

  app.post('/api/auth/admin/forgot-password/request-code', async (req: Request, res: Response) => {
    const email = asString(req.body.email, 120).toLowerCase();
    const rl = checkRateLimit(`admin-forgot-req:${req.ip}`, 5);
    if (!rl.allowed) {
      res.status(429).json({ error: `Too many requests. Try again in ${rl.retryAfterSeconds}s.` });
      return;
    }
    if (process.env.ADMIN_PASSCODE?.trim()) {
      res.status(400).json({
        error: 'Admin access is controlled by ADMIN_PASSCODE in server environment variables.',
      });
      return;
    }
    if (!process.env.RESEND_API_KEY?.trim()) {
      res.status(503).json({
        error: 'Email OTP service is not configured yet. Please use your Admin Recovery Key instead.',
      });
      return;
    }
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Please enter the administrator email address.' });
      return;
    }

    const creds = await db.getAll('adminCredentials');
    const matched = creds.find((c) => c.email === email);
    if (matched) {
      const code = generateShortResetCode();
      const resetTokenHash = await hashPassword(code);
      const resetTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await db.updateOneById('adminCredentials', matched.id, {
        resetTokenHash,
        resetTokenExpiresAt,
      });
      const sent = await sendPasswordResetOtpEmail({
        to: matched.email,
        name: matched.name,
        code,
        role: 'admin',
      });
      if (!sent.sent) {
        res.status(502).json({
          error: sent.error || 'Could not deliver verification email. Use Admin Recovery Key instead.',
        });
        return;
      }
    }

    res.json({
      message: 'If that matches the registered administrator account, a 6-character reset code has been emailed.',
    });
  });

  app.post('/api/auth/admin/forgot-password', async (req: Request, res: Response) => {
    const email = asString(req.body.email, 120).toLowerCase();
    const verificationType = (asString(req.body.verificationType, 20) || 'recovery_key') as
      | 'recovery_key'
      | 'email_otp';
    const recoveryProof = asString(req.body.recoveryKeyOrPasscode, 120);
    const resetCode = asString(req.body.resetCode, 20).toUpperCase();
    const newPassword = asString(req.body.newPassword, 100);
    const rlKey = `admin-forgot:${req.ip}`;
    const rl = checkRateLimit(rlKey, 6);
    if (!rl.allowed) {
      res.status(429).json({ error: `Too many reset attempts. Try again in ${rl.retryAfterSeconds}s.` });
      return;
    }

    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    if (envPasscode) {
      res.status(400).json({
        error:
          'Admin access is controlled by the server ADMIN_PASSCODE configuration. Update ADMIN_PASSCODE in your environment settings to rotate it.',
      });
      return;
    }

    if (!email || !email.includes('@') || newPassword.length < 6) {
      res.status(400).json({
        error: 'Admin email and new password (min 6 characters) are required.',
      });
      return;
    }

    const creds = await db.getAll('adminCredentials');
    const matched = creds.find((c) => c.email === email);
    if (!matched) {
      res.status(401).json({
        error: 'Invalid admin email or verification code.',
      });
      return;
    }

    let proofValid = false;
    if (verificationType === 'email_otp') {
      if (
        resetCode &&
        matched.resetTokenHash &&
        matched.resetTokenExpiresAt &&
        new Date(matched.resetTokenExpiresAt).getTime() > Date.now()
      ) {
        proofValid = await verifyPassword(resetCode, matched.resetTokenHash);
      }
      if (!proofValid) {
        res.status(401).json({ error: 'Invalid or expired email verification code.' });
        return;
      }
    } else {
      if (!recoveryProof || !matched.recoveryCodeHash) {
        res.status(401).json({
          error: 'Invalid admin email or recovery key. Contact your deployment owner if no recovery key was saved.',
        });
        return;
      }
      proofValid =
        (await verifyPassword(recoveryProof, matched.recoveryCodeHash)) ||
        (await verifyPassword(recoveryProof.toUpperCase(), matched.recoveryCodeHash));

      if (!proofValid) {
        res.status(401).json({ error: 'Invalid admin email or recovery key.' });
        return;
      }
    }

    const passwordHash = await hashPassword(newPassword);
    await db.updateOneById('adminCredentials', matched.id, {
      passwordHash,
      resetTokenHash: undefined,
      resetTokenExpiresAt: undefined,
      updatedAt: new Date().toISOString(),
    });
    clearRateLimit(rlKey);

    res.json({
      message: 'Administrator password reset successfully. You can now sign in with your new password.',
    });
  });

  app.get('/api/auth/admin/credentials', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const creds = await db.getAll('adminCredentials');
    const envPasscodeConfigured = Boolean(process.env.ADMIN_PASSCODE?.trim());
    const cred = creds.find((c) => c.id === req.user!.userId) || creds[0] || null;
    res.json({
      credentials: {
        id: cred?.id || req.user!.userId,
        email: cred?.email || req.user!.email,
        name: cred?.name || req.user!.name,
        envPasscodeConfigured,
        hasClaimedAdmin: Boolean(cred),
        hasRecoveryKey: Boolean(cred?.recoveryCodeHash),
        createdAt: cred?.createdAt || new Date().toISOString(),
        updatedAt: cred?.updatedAt || cred?.createdAt || null,
      },
    });
  });

  app.post('/api/auth/admin/change-credentials', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const envPasscodeConfigured = Boolean(process.env.ADMIN_PASSCODE?.trim());
    if (envPasscodeConfigured) {
      res.status(400).json({
        error:
          'Admin access is currently locked to server ADMIN_PASSCODE. Clear ADMIN_PASSCODE to manage email & password credentials in the database.',
      });
      return;
    }

    const creds = await db.getAll('adminCredentials');
    const cred = creds.find((c) => c.id === req.user!.userId) || creds[0];
    if (!cred) {
      res.status(404).json({ error: 'Claimed admin credential record not found.' });
      return;
    }

    const currentPassword = asString(req.body.currentPassword, 100);
    if (!currentPassword || !(await verifyPassword(currentPassword, cred.passwordHash))) {
      res.status(401).json({ error: 'Current admin password is incorrect.' });
      return;
    }

    const nextName = asString(req.body.name, 80);
    const nextEmail = asString(req.body.email, 120).toLowerCase();
    const newPassword = asString(req.body.newPassword, 100);
    const regenerateRecoveryKey = Boolean(req.body.regenerateRecoveryKey);

    if (nextEmail && !nextEmail.includes('@')) {
      res.status(400).json({ error: 'Please provide a valid administrator email address.' });
      return;
    }
    if (newPassword && newPassword.length < 6) {
      res.status(400).json({ error: 'New admin password must be at least 6 characters.' });
      return;
    }

    const patch: {
      name?: string;
      email?: string;
      passwordHash?: string;
      recoveryCodeHash?: string;
      adminEmailMigrated?: boolean;
      updatedAt: string;
    } = {
      adminEmailMigrated: true,
      updatedAt: new Date().toISOString(),
    };
    if (nextName) patch.name = nextName;
    if (nextEmail) patch.email = nextEmail;
    if (newPassword) patch.passwordHash = await hashPassword(newPassword);

    let generatedKey: string | undefined;
    if (regenerateRecoveryKey) {
      generatedKey = generateRecoveryKey('VJT');
      patch.recoveryCodeHash = await hashPassword(generatedKey);
    }

    const updated = await db.updateOneById('adminCredentials', cred.id, patch);
    if (!updated) {
      res.status(404).json({ error: 'Failed to update admin credentials.' });
      return;
    }

    const token = signToken({
      userId: updated.id,
      email: updated.email,
      name: updated.name,
      role: 'admin',
    });

    res.json({
      token,
      newRecoveryKey: generatedKey,
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        phone: '',
        role: 'admin',
        createdAt: updated.createdAt,
      },
      credentials: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        envPasscodeConfigured: false,
        hasClaimedAdmin: true,
        hasRecoveryKey: Boolean(updated.recoveryCodeHash),
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt || updated.createdAt,
      },
    });
  });

  app.post('/api/auth/register', async (req: Request, res: Response) => {
    const rl = checkRateLimit(`register:${req.ip}`, 10);
    if (!rl.allowed) {
      res.status(429).json({ error: `Too many registration attempts. Try again in ${rl.retryAfterSeconds}s.` });
      return;
    }

    const name = asString(req.body.name, 80);
    const email = asString(req.body.email, 120).toLowerCase();
    const phone = asString(req.body.phone, 30);
    const password = asString(req.body.password, 100);
    const recoveryPin = asString(req.body.recoveryPin, 24);

    if (!name || !email.includes('@') || !phone || password.length < 6) {
      res.status(400).json({ error: 'Name, valid email, mobile number, and password (6+ chars) are required.' });
      return;
    }
    if (recoveryPin && recoveryPin.length < 4) {
      res.status(400).json({ error: 'Recovery PIN must be at least 4 characters.' });
      return;
    }

    const users = await db.getAll('users');
    if (users.some((u) => u.email === email)) {
      res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
      return;
    }

    const [passwordHash, recoveryPinHash] = await Promise.all([
      hashPassword(password),
      recoveryPin ? hashPassword(recoveryPin) : Promise.resolve(undefined),
    ]);

    const user: StoredUser = {
      id: `usr-${Date.now()}`,
      name,
      email,
      phone,
      address: asString(req.body.address, 200),
      role: 'customer',
      passwordHash,
      ...(recoveryPinHash ? { recoveryPinHash } : {}),
      createdAt: new Date().toISOString(),
    };
    await db.insertOne('users', user);

    const token = signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: 'customer',
    });

    res.status(201).json({ token, user: toPublicUser(user) });
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const email = asString(req.body.email, 120).toLowerCase();
    const password = asString(req.body.password, 100);
    const rlKey = `login:${req.ip}:${email}`;
    const rl = checkRateLimit(rlKey, 10);
    if (!rl.allowed) {
      res.status(429).json({ error: `Too many login attempts. Try again in ${rl.retryAfterSeconds}s.` });
      return;
    }

    const users = await db.getAll('users');
    const user = users.find((u) => u.email === email);
    if (!user || !password || !(await verifyPassword(password, user.passwordHash))) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    clearRateLimit(rlKey);
    const token = signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: 'customer',
    });

    res.json({ token, user: toPublicUser(user) });
  });

  app.post('/api/auth/forgot-password/request-code', async (req: Request, res: Response) => {
    const email = asString(req.body.email, 120).toLowerCase();
    const rl = checkRateLimit(`forgot-req:${req.ip}:${email || 'none'}`, 5);
    if (!rl.allowed) {
      res.status(429).json({ error: `Too many requests. Try again in ${rl.retryAfterSeconds}s.` });
      return;
    }
    if (!process.env.RESEND_API_KEY?.trim()) {
      res.status(503).json({
        error: 'Email OTP service is not configured yet. Please verify with Recovery PIN, Booking ID, or Desk Code.',
      });
      return;
    }
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Please enter a valid registered email address.' });
      return;
    }

    const users = await db.getAll('users');
    const user = users.find((u) => u.email === email);
    if (user) {
      const code = generateShortResetCode();
      const resetTokenHash = await hashPassword(code);
      const resetTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await db.updateOneById('users', user.id, {
        resetTokenHash,
        resetTokenExpiresAt,
      });
      const sent = await sendPasswordResetOtpEmail({
        to: user.email,
        name: user.name,
        code,
        role: 'customer',
      });
      if (!sent.sent) {
        res.status(502).json({
          error:
            sent.error ||
            'Could not send email verification code. Please try Recovery PIN, Booking ID, or Desk Code.',
        });
        return;
      }
    }

    res.json({
      message:
        'If an account exists for that email address, a 6-character verification code has been sent (valid for 15 minutes).',
    });
  });

  app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
    const email = asString(req.body.email, 120).toLowerCase();
    const verificationType = asString(req.body.verificationType, 20) as
      | 'email_otp'
      | 'pin'
      | 'reset_code'
      | 'booking';
    const newPassword = asString(req.body.newPassword, 100);

    const rlKey = `forgot:${req.ip}:${email || 'none'}`;
    const rl = checkRateLimit(rlKey, 8);
    if (!rl.allowed) {
      res.status(429).json({ error: `Too many password reset attempts. Try again in ${rl.retryAfterSeconds}s.` });
      return;
    }

    if (!email || !email.includes('@') || newPassword.length < 6) {
      res.status(400).json({ error: 'Registered email and a new password (min 6 characters) are required.' });
      return;
    }

    const users = await db.getAll('users');
    const user = users.find((u) => u.email === email);
    if (!user) {
      res.status(400).json({
        error: 'Unable to verify account details. Check your email or verification details and try again.',
      });
      return;
    }

    let verified = false;
    if (verificationType === 'pin') {
      const recoveryPin = asString(req.body.recoveryPin, 24);
      if (recoveryPin && user.recoveryPinHash) {
        verified = await verifyPassword(recoveryPin, user.recoveryPinHash);
      }
    } else if (verificationType === 'reset_code' || verificationType === 'email_otp') {
      const resetCode = asString(req.body.resetCode, 20).toUpperCase();
      if (
        resetCode &&
        user.resetTokenHash &&
        user.resetTokenExpiresAt &&
        new Date(user.resetTokenExpiresAt).getTime() > Date.now()
      ) {
        verified = await verifyPassword(resetCode, user.resetTokenHash);
      }
    } else if (verificationType === 'booking') {
      const phone = normalizePhoneDigits(asString(req.body.phone, 30));
      const bookingCode = asString(req.body.bookingCode, 40).toUpperCase();
      const userDigits = normalizePhoneDigits(user.phone);
      if (phone.length >= 8 && bookingCode && phone === userDigits) {
        const bookings = await db.getAll('bookings');
        verified = bookings.some(
          (b) =>
            b.customerEmail.toLowerCase() === email &&
            b.bookingCode.toUpperCase() === bookingCode &&
            normalizePhoneDigits(b.customerPhone) === phone
        );
      }
    } else {
      res.status(400).json({ error: 'Invalid verification method selected.' });
      return;
    }

    if (!verified) {
      res.status(401).json({
        error:
          verificationType === 'email_otp'
            ? 'Invalid or expired Email OTP code. Click Send Code to Email to request a fresh code.'
            : verificationType === 'pin'
            ? 'Email or Recovery PIN did not match. Try Email OTP, Booking ID, or Desk Code.'
            : verificationType === 'reset_code'
            ? 'Invalid or expired Dispatch Reset Code. Request a new code from our 24/7 desk.'
            : 'Email, registered mobile number, and Booking Reference ID did not match our records.',
      });
      return;
    }

    const passwordHash = await hashPassword(newPassword);
    await db.updateOneById('users', user.id, {
      passwordHash,
      resetTokenHash: undefined,
      resetTokenExpiresAt: undefined,
    });
    clearRateLimit(rlKey);

    res.json({
      message: 'Password updated successfully. You can now sign in with your new password.',
    });
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (req.user!.role === 'admin') {
      res.json({
        user: {
          id: req.user!.userId,
          email: req.user!.email,
          name: req.user!.name,
          phone: '',
          role: 'admin',
          createdAt: new Date().toISOString(),
        },
      });
      return;
    }
    const users = await db.getAll('users');
    const user = users.find((u) => u.id === req.user!.userId);
    if (!user) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    res.json({ user: toPublicUser(user) });
  });

  app.patch('/api/auth/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (req.user!.role !== 'customer') {
      res.status(403).json({ error: 'Customer profile endpoint' });
      return;
    }

    const users = await db.getAll('users');
    const currentUser = users.find((u) => u.id === req.user!.userId);
    if (!currentUser) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    const name = asString(req.body.name, 80);
    const phone = asString(req.body.phone, 30);
    const hasAddress = typeof req.body.address === 'string';
    const address = asString(req.body.address, 200);
    const recoveryPin = asString(req.body.recoveryPin, 24);
    const currentPassword = asString(req.body.currentPassword, 100);
    const newPassword = asString(req.body.newPassword, 100);

    const patch: Partial<StoredUser> = {};
    if (name) patch.name = name;
    if (phone) patch.phone = phone;
    if (hasAddress) patch.address = address;

    if (recoveryPin) {
      if (recoveryPin.length < 4) {
        res.status(400).json({ error: 'Recovery PIN must be at least 4 characters.' });
        return;
      }
      patch.recoveryPinHash = await hashPassword(recoveryPin);
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        res.status(400).json({ error: 'New password must be at least 6 characters.' });
        return;
      }
      if (!currentPassword || !(await verifyPassword(currentPassword, currentUser.passwordHash))) {
        res.status(401).json({ error: 'Current password is incorrect.' });
        return;
      }
      patch.passwordHash = await hashPassword(newPassword);
    }

    const updated = await db.updateOneById('users', req.user!.userId, patch);
    if (!updated) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    res.json({ user: toPublicUser(updated) });
  });

  // ── Booking & Payment Routes ───────────────────────────────────────────────

  app.post('/api/bookings', async (req: Request, res: Response) => {
    const token = extractBearerToken(req);
    const authUser = token ? verifyToken(token) : null;

    const vehicleId = asString(req.body.vehicleId, 60);
    const customerName = asString(req.body.customerName, 80);
    const customerEmail = asString(req.body.customerEmail, 120).toLowerCase();
    const customerPhone = asString(req.body.customerPhone, 30);
    const pickupLocation = asString(req.body.pickupLocation, 240);
    const dropLocation = asString(req.body.dropLocation, 240);
    const journeyDate = asString(req.body.journeyDate, 20);
    const journeyTime = asString(req.body.journeyTime, 10) || '09:00';
    const returnDate = asString(req.body.returnDate, 20) || undefined;
    const passengerCount = Math.max(1, asNumber(req.body.passengerCount, 1));
    const tripType = (asString(req.body.tripType, 30) || 'One Way') as TripType;
    const estimatedDistanceKm = Math.max(10, asNumber(req.body.estimatedDistanceKm, 45));
    const estimatedDurationText = asString(req.body.estimatedDurationText, 50) || '1 hr 15 mins';
    const paymentMode = (asString(req.body.paymentMode, 20) || 'Pay Later') as Booking['paymentMode'];
    const notes = asString(req.body.notes, 400);

    if (!vehicleId || !customerName || !customerEmail || !customerPhone || !pickupLocation || !dropLocation || !journeyDate) {
      res.status(400).json({ error: 'All trip and customer contact details are required.' });
      return;
    }

    const [vehicles, bookings, drivers, pricing, settings] = await Promise.all([
      db.getAll('vehicles'),
      db.getAll('bookings'),
      db.getAll('drivers'),
      db.getPricing(),
      db.getSettings(),
    ]);

    if (settings.maintenanceMode && authUser?.role !== 'admin') {
      res.status(503).json({
        error: settings.maintenanceMessage || 'Online bookings are temporarily paused for maintenance.',
      });
      return;
    }

    if (!settings.allowGuestBooking && !authUser) {
      res.status(401).json({ error: 'Please sign in to your customer account before submitting a booking.' });
      return;
    }

    if (!settings.allowOnlinePayment && (paymentMode === 'Advance' || paymentMode === 'Full')) {
      res.status(400).json({ error: 'Online pre-payment is currently unavailable. Please use Submit Booking Request.' });
      return;
    }

    if (!settings.allowPayLater && paymentMode === 'Pay Later') {
      res.status(400).json({ error: 'Online advance or full payment is required for instant booking confirmation.' });
      return;
    }

    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) {
      res.status(404).json({ error: 'Selected vehicle was not found.' });
      return;
    }
    if (vehicle.status !== 'Available') {
      res.status(409).json({ error: `${vehicle.name} is currently ${vehicle.status} and cannot be booked.` });
      return;
    }
    if (passengerCount > vehicle.seatingCapacity) {
      res.status(400).json({
        error: `${vehicle.name} seats up to ${vehicle.seatingCapacity} passengers (${passengerCount} requested).`,
      });
      return;
    }

    const conflict = hasVehicleBookingConflict(
      bookings,
      vehicle.id,
      journeyDate,
      returnDate,
      journeyTime,
      tripType
    );
    if (conflict) {
      res.status(409).json({
        error: `${vehicle.name} is already reserved for ${conflict.journeyDate}. Please pick another vehicle or date.`,
      });
      return;
    }

    const fareEstimate = calculateFareEstimate({
      vehicle,
      pricing,
      tripType,
      distanceKm: estimatedDistanceKm,
      journeyDate,
      journeyTime,
      returnDate,
      localPackageHours: asNumber(req.body.localPackageHours, 8),
    });

    const assignedDriver = drivers.find((d) => d.id === vehicle.assignedDriverId && d.available);
    const codeSuffix = String(1100 + bookings.length + Math.floor(Math.random() * 80));
    const prefix = (settings.bookingCodePrefix || 'VF').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) || 'VF';
    const bookingCode = `${prefix}-${new Date().getFullYear()}-${codeSuffix}`;
    const now = new Date().toISOString();

    const booking: Booking = {
      id: `bkg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      bookingCode,
      customerId: authUser?.userId,
      customerName,
      customerEmail,
      customerPhone,
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      vehicleCategory: vehicle.category,
      driverId: assignedDriver?.id,
      driverName: assignedDriver?.name,
      driverPhone: assignedDriver?.phone,
      pickupLocation,
      dropLocation,
      pickupLat: typeof req.body.pickupLat === 'number' ? req.body.pickupLat : undefined,
      pickupLng: typeof req.body.pickupLng === 'number' ? req.body.pickupLng : undefined,
      dropLat: typeof req.body.dropLat === 'number' ? req.body.dropLat : undefined,
      dropLng: typeof req.body.dropLng === 'number' ? req.body.dropLng : undefined,
      journeyDate,
      journeyTime,
      returnDate,
      passengerCount,
      tripType,
      estimatedDistanceKm,
      estimatedDurationText,
      fareEstimate,
      totalFare: fareEstimate.totalEstimatedFare,
      paidAmount: 0,
      paymentStatus: 'Unpaid',
      bookingStatus: 'Pending',
      paymentMode,
      notes,
      createdAt: now,
      updatedAt: now,
    };

    await db.insertOne('bookings', booking);

    if (paymentMode === 'Pay Later') {
      await runEmailSafely(dispatchNewBookingEmails(booking.id, resolveRequestBaseUrl(req)));
    }

    res.status(201).json({
      booking,
      notification: `Booking request ${booking.bookingCode} created. Confirmation & invoice dispatched.`,
    });
  });

  app.get('/api/bookings/my', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const bookings = await db.getAll('bookings');
    const userEmail = req.user!.email.toLowerCase();
    const mine = bookings
      .filter((b) => b.customerId === req.user!.userId || b.customerEmail.toLowerCase() === userEmail)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ bookings: mine });
  });

  app.get('/api/bookings/lookup', async (req: Request, res: Response) => {
    const bookingCode = asString(req.query.bookingCode, 40).toUpperCase();
    const contact = asString(req.query.contact, 120).toLowerCase();
    if (!bookingCode || !contact) {
      res.status(400).json({ error: 'Booking ID and registered email or mobile number are required.' });
      return;
    }
    const bookings = await db.getAll('bookings');
    const booking = bookings.find(
      (b) =>
        b.bookingCode.toUpperCase() === bookingCode &&
        (b.customerEmail.toLowerCase() === contact ||
          b.customerPhone.replace(/\s+/g, '').endsWith(contact.replace(/\s+/g, '').slice(-8)))
    );
    if (!booking) {
      res.status(404).json({ error: 'No matching booking found for that Booking ID and contact.' });
      return;
    }
    res.json({ booking });
  });

  app.post('/api/bookings/:id/cancel-request', async (req: Request, res: Response) => {
    const id = asString(req.params.id, 80);
    const reason = asString(req.body.reason, 400) || 'Customer requested cancellation';
    const token = extractBearerToken(req);
    const authUser = token ? verifyToken(token) : null;
    const verifyEmail = asString(req.body.email, 120).toLowerCase();

    const bookings = await db.getAll('bookings');
    const booking = bookings.find((b) => b.id === id);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    const ownsViaJwt =
      authUser &&
      (authUser.role === 'admin' ||
        booking.customerId === authUser.userId ||
        booking.customerEmail.toLowerCase() === authUser.email.toLowerCase());
    const ownsViaEmail = verifyEmail && booking.customerEmail.toLowerCase() === verifyEmail;

    if (!ownsViaJwt && !ownsViaEmail) {
      res.status(403).json({ error: 'Not authorized to cancel this booking' });
      return;
    }

    if (booking.bookingStatus === 'Cancelled' || booking.bookingStatus === 'Completed') {
      res.status(400).json({ error: `Cannot request cancellation for a ${booking.bookingStatus} booking.` });
      return;
    }

    const updated = await db.updateOneById('bookings', id, {
      bookingStatus: 'Cancellation Requested',
      cancellationReason: reason,
      updatedAt: new Date().toISOString(),
    });
    res.json({ booking: updated });
  });

  app.get('/api/payments/my', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const payments = await db.getAll('payments');
    const userEmail = req.user!.email.toLowerCase();
    const mine = payments
      .filter((p) => p.customerEmail.toLowerCase() === userEmail)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ payments: mine });
  });

  // Razorpay Order Creation & Signature Verification
  app.post('/api/payments/razorpay/order', async (req: Request, res: Response) => {
    const bookingId = asString(req.body.bookingId, 80);
    const paymentType = (asString(req.body.paymentType, 20) || 'Advance') as 'Advance' | 'Full';

    const [bookings, vehicles] = await Promise.all([db.getAll('bookings'), db.getAll('vehicles')]);
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    const vehicle = vehicles.find((v) => v.id === booking.vehicleId);
    if (!vehicle || vehicle.status !== 'Available') {
      res.status(409).json({ error: 'Vehicle is no longer available for confirmation.' });
      return;
    }

    const conflict = hasVehicleBookingConflict(
      bookings,
      booking.vehicleId,
      booking.journeyDate,
      booking.returnDate,
      booking.journeyTime,
      booking.tripType,
      booking.id
    );
    if (conflict) {
      res.status(409).json({ error: 'Date conflict detected with another active booking. Cannot proceed.' });
      return;
    }

    const remaining = Math.max(0, booking.totalFare - booking.paidAmount);
    const amountInr =
      paymentType === 'Full'
        ? remaining
        : Math.min(remaining, Math.max(100, booking.fareEstimate.advancePayable - booking.paidAmount || booking.fareEstimate.advancePayable));

    if (amountInr <= 0) {
      res.status(400).json({ error: 'Booking balance is already settled.' });
      return;
    }

    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

    if (keyId && keySecret) {
      try {
        const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
        const order = await rzp.orders.create({
          amount: Math.round(amountInr * 100),
          currency: 'INR',
          receipt: booking.bookingCode,
          notes: {
            bookingId: booking.id,
            bookingCode: booking.bookingCode,
            paymentType,
          },
        });
        res.json({
          mode: 'live_razorpay',
          keyId,
          orderId: order.id,
          amountInr,
          amountPaise: order.amount,
          currency: 'INR',
          bookingCode: booking.bookingCode,
          customerName: booking.customerName,
          customerEmail: booking.customerEmail,
          customerPhone: booking.customerPhone,
        });
        return;
      } catch (err) {
        res.status(502).json({ error: `Razorpay order error: ${(err as Error).message}` });
        return;
      }
    }

    // Signed Sandbox/Test Checkout Order when Razorpay API keys are not set in env
    const orderId = `order_vf_${Date.now()}`;
    const testSignatureToken = crypto
      .createHmac('sha256', TEST_ORDER_HMAC_SECRET)
      .update(`${orderId}|${booking.id}|${amountInr}`)
      .digest('hex');

    res.json({
      mode: 'test_checkout',
      orderId,
      testSignatureToken,
      amountInr,
      amountPaise: Math.round(amountInr * 100),
      currency: 'INR',
      bookingCode: booking.bookingCode,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone,
    });
  });

  app.post('/api/payments/razorpay/verify', async (req: Request, res: Response) => {
    const bookingId = asString(req.body.bookingId, 80);
    const paymentType = (asString(req.body.paymentType, 20) || 'Advance') as 'Advance' | 'Full';
    const orderId = asString(req.body.razorpay_order_id, 100);
    const paymentId = asString(req.body.razorpay_payment_id, 100);
    const signature = asString(req.body.razorpay_signature, 200);
    const amountInr = asNumber(req.body.amountInr, 0);
    const testSignatureToken = asString(req.body.testSignatureToken, 200);

    const bookings = await db.getAll('bookings');
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
    let isVerified = false;
    let gateway: PaymentRecord['gateway'] = 'Razorpay Test';

    if (keySecret && signature && !testSignatureToken) {
      const expected = crypto
        .createHmac('sha256', keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
      isVerified = timingSafeCompare(expected, signature);
      gateway = 'Razorpay';
    } else if (testSignatureToken) {
      const expectedTest = crypto
        .createHmac('sha256', TEST_ORDER_HMAC_SECRET)
        .update(`${orderId}|${booking.id}|${amountInr}`)
        .digest('hex');
      isVerified = timingSafeCompare(expectedTest, testSignatureToken);
      gateway = 'Razorpay Test';
    }

    if (!isVerified) {
      res.status(400).json({ error: 'Payment signature verification failed.' });
      return;
    }

    // Re-check double booking conflict right before confirming
    const conflict = hasVehicleBookingConflict(
      bookings,
      booking.vehicleId,
      booking.journeyDate,
      booking.returnDate,
      booking.journeyTime,
      booking.tripType,
      booking.id
    );
    if (conflict) {
      res.status(409).json({ error: 'Vehicle availability changed during checkout. Payment aborted.' });
      return;
    }

    const finalPaymentId = paymentId || `pay_vf_${Date.now()}`;
    const paymentRecord: PaymentRecord = {
      id: `pay-${Date.now()}`,
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      amount: amountInr,
      paymentType,
      gateway,
      razorpayOrderId: orderId,
      razorpayPaymentId: finalPaymentId,
      status: 'Captured',
      createdAt: new Date().toISOString(),
    };
    await db.insertOne('payments', paymentRecord);

    const newPaidAmount = booking.paidAmount + amountInr;
    const newPaymentStatus = newPaidAmount >= booking.totalFare ? 'Fully Paid' : 'Advance Paid';
    const nextBookingStatus: BookingStatus = booking.driverId ? 'Driver Assigned' : 'Confirmed';

    const updatedBooking = await db.updateOneById('bookings', booking.id, {
      paidAmount: newPaidAmount,
      paymentStatus: newPaymentStatus,
      bookingStatus: nextBookingStatus,
      paymentMode: paymentType,
      updatedAt: new Date().toISOString(),
    });

    await runEmailSafely(dispatchNewBookingEmails(booking.id, resolveRequestBaseUrl(req)));

    res.json({
      verified: true,
      payment: paymentRecord,
      booking: updatedBooking,
    });
  });

  // ── Admin Dashboard Protected Routes ───────────────────────────────────────

  app.get('/api/admin/overview', requireAdmin, async (_req: Request, res: Response) => {
    const [vehicles, drivers, bookings, payments, enquiries] = await Promise.all([
      db.getAll('vehicles'),
      db.getAll('drivers'),
      db.getAll('bookings'),
      db.getAll('payments'),
      db.getAll('enquiries'),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const activeVehicles = vehicles.filter((v) => v.status !== 'Inactive');
    const availableVehicles = activeVehicles.filter((v) => v.status === 'Available').length;
    const bookedTodayIds = new Set(
      bookings
        .filter(
          (b) =>
            b.bookingStatus !== 'Cancelled' &&
            b.bookingStatus !== 'Rejected' &&
            b.journeyDate <= today &&
            (b.returnDate || b.journeyDate) >= today
        )
        .map((b) => b.vehicleId)
    );
    const bookedVehicles = Math.max(
      activeVehicles.filter((v) => v.status === 'Booked').length,
      bookedTodayIds.size
    );

    const todaysTrips = bookings.filter(
      (b) => b.journeyDate === today && b.bookingStatus !== 'Cancelled' && b.bookingStatus !== 'Rejected'
    ).length;

    const upcomingTrips = bookings.filter(
      (b) => b.journeyDate >= today && ['Confirmed', 'Driver Assigned', 'Pending'].includes(b.bookingStatus)
    ).length;

    const totalRevenue = payments
      .filter((p) => p.status === 'Captured')
      .reduce((acc, p) => acc + p.amount - (p.refundAmount || 0), 0);

    const pendingEnquiries = enquiries.filter((e) => e.status === 'Pending').length;

    res.json({
      kpis: {
        totalVehicles: activeVehicles.length,
        availableVehicles,
        bookedVehicles,
        totalDrivers: drivers.length,
        totalBookings: bookings.length,
        todaysTrips,
        upcomingTrips,
        totalRevenue,
        pendingEnquiries,
      },
    });
  });

  // Fleet CRUD
  app.get('/api/admin/vehicles', requireAdmin, async (_req: Request, res: Response) => {
    const vehicles = await db.getAll('vehicles');
    res.json({ vehicles });
  });

  app.post('/api/admin/vehicles', requireAdmin, async (req: Request, res: Response) => {
    const name = asString(req.body.name, 100);
    const model = asString(req.body.model, 100);
    const registrationNumber = asString(req.body.registrationNumber, 40);
    const category = asString(req.body.category, 60) as VehicleCategory;
    const fleetGroup: FleetGroup = ['Cars', 'SUVs', 'Premium Cars'].includes(category) ? 'Car' : 'Bus';

    if (!name || !model || !registrationNumber || !category) {
      res.status(400).json({ error: 'Vehicle name, model, registration number, and category are required.' });
      return;
    }

    const defaultImg =
      fleetGroup === 'Car'
        ? '/src/assets/images/fleet_executive_sedan_1795608170835.jpg'
        : '/src/assets/images/fleet_luxury_coach_1795608171806.jpg';

    const images = Array.isArray(req.body.images) && req.body.images.length > 0
      ? req.body.images.filter((img: unknown) => typeof img === 'string' && (img.startsWith('/uploads/') || img.startsWith('/src/') || img.startsWith('https://')))
      : [defaultImg];

    const vehicle: Vehicle = {
      id: `veh-${Date.now()}`,
      name,
      model,
      registrationNumber,
      category,
      fleetGroup,
      seatingCapacity: Math.max(2, asNumber(req.body.seatingCapacity, 4)),
      luggageCapacity: Math.max(1, asNumber(req.body.luggageCapacity, 3)),
      ac: req.body.ac !== false,
      transmission: req.body.transmission === 'Manual' ? 'Manual' : 'Automatic',
      fuelType: (asString(req.body.fuelType, 20) || 'Diesel') as Vehicle['fuelType'],
      status: (asString(req.body.status, 20) || 'Available') as Vehicle['status'],
      images: images.length > 0 ? images : [defaultImg],
      features: Array.isArray(req.body.features) ? req.body.features : ['Air Conditioning', 'GPS Tracking', 'First-Aid Kit'],
      services: Array.isArray(req.body.services) ? req.body.services : ['Local City Travel', 'Outstation Trips', 'Corporate Transportation'],
      assignedDriverId: asString(req.body.assignedDriverId, 60) || undefined,
      description: asString(req.body.description, 500) || 'Company-owned inspected passenger vehicle.',
      terms: ['Tolls & parking at actuals', 'Standard outstation minimum km billing applies'],
      customPerKmRate: req.body.customPerKmRate ? asNumber(req.body.customPerKmRate) : undefined,
      customPerDayRate: req.body.customPerDayRate ? asNumber(req.body.customPerDayRate) : undefined,
      createdAt: new Date().toISOString(),
    };

    await db.insertOne('vehicles', vehicle);
    res.status(201).json({ vehicle });
  });

  app.patch('/api/admin/vehicles/:id', requireAdmin, async (req: Request, res: Response) => {
    const id = asString(req.params.id, 60);
    const patch: Partial<Vehicle> = {};
    if (req.body.name) patch.name = asString(req.body.name, 100);
    if (req.body.model) patch.model = asString(req.body.model, 100);
    if (req.body.registrationNumber) patch.registrationNumber = asString(req.body.registrationNumber, 40);
    if (req.body.category) {
      patch.category = asString(req.body.category, 60) as VehicleCategory;
      patch.fleetGroup = ['Cars', 'SUVs', 'Premium Cars'].includes(patch.category) ? 'Car' : 'Bus';
    }
    if (typeof req.body.seatingCapacity !== 'undefined') patch.seatingCapacity = Math.max(2, asNumber(req.body.seatingCapacity, 4));
    if (typeof req.body.luggageCapacity !== 'undefined') patch.luggageCapacity = Math.max(1, asNumber(req.body.luggageCapacity, 2));
    if (typeof req.body.ac === 'boolean') patch.ac = req.body.ac;
    if (req.body.status) patch.status = asString(req.body.status, 30) as Vehicle['status'];
    if (req.body.assignedDriverId !== undefined) patch.assignedDriverId = asString(req.body.assignedDriverId, 60) || undefined;
    if (req.body.description) patch.description = asString(req.body.description, 500);
    if (Array.isArray(req.body.images) && req.body.images.length > 0) {
      patch.images = req.body.images.filter(
        (img: unknown) => typeof img === 'string' && (img.startsWith('/uploads/') || img.startsWith('/src/') || img.startsWith('https://'))
      );
    }
    if (req.body.customPerKmRate !== undefined) {
      patch.customPerKmRate = req.body.customPerKmRate ? asNumber(req.body.customPerKmRate) : undefined;
    }
    if (req.body.customPerDayRate !== undefined) {
      patch.customPerDayRate = req.body.customPerDayRate ? asNumber(req.body.customPerDayRate) : undefined;
    }

    const updated = await db.updateOneById('vehicles', id, patch);
    if (!updated) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }
    res.json({ vehicle: updated });
  });

  app.delete('/api/admin/vehicles/:id', requireAdmin, async (req: Request, res: Response) => {
    const id = asString(req.params.id, 60);
    const deleted = await db.deleteOneById('vehicles', id);
    if (!deleted) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }
    res.json({ deleted: true });
  });

  // Safe Image Upload
  app.post('/api/admin/upload', requireAdmin, async (req: Request, res: Response) => {
    const dataUrl = asString(req.body.dataUrl, 4_500_000);
    const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) {
      res.status(400).json({ error: 'Invalid image format. Allowed: PNG, JPG, WEBP.' });
      return;
    }
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 3 * 1024 * 1024) {
      res.status(400).json({ error: 'Image size must be under 3MB.' });
      return;
    }

    const safeName = `fleet-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const resolved = path.resolve(UPLOADS_DIR, safeName);
    if (!resolved.startsWith(UPLOADS_DIR + path.sep)) {
      res.status(400).json({ error: 'Invalid upload path' });
      return;
    }

    fs.writeFileSync(resolved, buffer);
    res.status(201).json({ url: `/uploads/${safeName}` });
  });

  // Driver CRUD
  app.get('/api/admin/drivers', requireAdmin, async (_req: Request, res: Response) => {
    const [drivers, bookings] = await Promise.all([db.getAll('drivers'), db.getAll('bookings')]);
    const enriched = drivers.map((d) => ({
      ...d,
      tripCount: bookings.filter((b) => b.driverId === d.id && b.bookingStatus !== 'Cancelled').length,
    }));
    res.json({ drivers: enriched });
  });

  app.post('/api/admin/drivers', requireAdmin, async (req: Request, res: Response) => {
    const name = asString(req.body.name, 80);
    const phone = asString(req.body.phone, 30);
    const licenseNumber = asString(req.body.licenseNumber, 50);
    const licenseExpiry = asString(req.body.licenseExpiry, 20) || '2030-12-31';

    if (!name || !phone || !licenseNumber) {
      res.status(400).json({ error: 'Driver name, phone, and license number are required.' });
      return;
    }

    const driver: Driver = {
      id: `drv-${Date.now()}`,
      name,
      phone,
      email: asString(req.body.email, 120) || 'driver@vizagjagantravels.com',
      licenseNumber,
      licenseExpiry,
      experienceYears: Math.max(1, asNumber(req.body.experienceYears, 5)),
      languages: Array.isArray(req.body.languages) ? req.body.languages : ['English', 'Hindi'],
      available: req.body.available !== false,
      assignedVehicleId: asString(req.body.assignedVehicleId, 60) || undefined,
      status: (asString(req.body.status, 20) || 'Active') as Driver['status'],
      createdAt: new Date().toISOString(),
    };
    await db.insertOne('drivers', driver);
    res.status(201).json({ driver });
  });

  app.patch('/api/admin/drivers/:id', requireAdmin, async (req: Request, res: Response) => {
    const id = asString(req.params.id, 60);
    const patch: Partial<Driver> = {};
    if (req.body.name) patch.name = asString(req.body.name, 80);
    if (req.body.phone) patch.phone = asString(req.body.phone, 30);
    if (req.body.email) patch.email = asString(req.body.email, 120);
    if (req.body.licenseNumber) patch.licenseNumber = asString(req.body.licenseNumber, 50);
    if (req.body.licenseExpiry) patch.licenseExpiry = asString(req.body.licenseExpiry, 20);
    if (typeof req.body.experienceYears !== 'undefined') patch.experienceYears = Math.max(1, asNumber(req.body.experienceYears, 5));
    if (typeof req.body.available === 'boolean') patch.available = req.body.available;
    if (req.body.status) patch.status = asString(req.body.status, 20) as Driver['status'];
    if (req.body.assignedVehicleId !== undefined) patch.assignedVehicleId = asString(req.body.assignedVehicleId, 60) || undefined;

    const updated = await db.updateOneById('drivers', id, patch);
    if (!updated) {
      res.status(404).json({ error: 'Driver not found' });
      return;
    }
    res.json({ driver: updated });
  });

  app.delete('/api/admin/drivers/:id', requireAdmin, async (req: Request, res: Response) => {
    const id = asString(req.params.id, 60);
    const deleted = await db.deleteOneById('drivers', id);
    if (!deleted) {
      res.status(404).json({ error: 'Driver not found' });
      return;
    }
    res.json({ deleted: true });
  });

  // Booking Management
  app.get('/api/admin/bookings', requireAdmin, async (_req: Request, res: Response) => {
    const bookings = await db.getAll('bookings');
    res.json({ bookings: bookings.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  });

  app.patch('/api/admin/bookings/:id', requireAdmin, async (req: Request, res: Response) => {
    const id = asString(req.params.id, 80);
    const [bookings, vehicles, drivers] = await Promise.all([
      db.getAll('bookings'),
      db.getAll('vehicles'),
      db.getAll('drivers'),
    ]);
    const existing = bookings.find((b) => b.id === id);
    if (!existing) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    const patch: Partial<Booking> = { updatedAt: new Date().toISOString() };

    if (req.body.vehicleId && req.body.vehicleId !== existing.vehicleId) {
      const targetVeh = vehicles.find((v) => v.id === asString(req.body.vehicleId, 60));
      if (!targetVeh) {
        res.status(404).json({ error: 'Assigned vehicle not found' });
        return;
      }
      const conflict = hasVehicleBookingConflict(
        bookings,
        targetVeh.id,
        existing.journeyDate,
        existing.returnDate,
        existing.journeyTime,
        existing.tripType,
        existing.id
      );
      if (conflict) {
        res.status(409).json({ error: `${targetVeh.name} has an overlapping booking (${conflict.bookingCode}).` });
        return;
      }
      patch.vehicleId = targetVeh.id;
      patch.vehicleName = targetVeh.name;
      patch.vehicleCategory = targetVeh.category;
    }

    if (req.body.driverId !== undefined) {
      const drvId = asString(req.body.driverId, 60);
      if (drvId) {
        const drv = drivers.find((d) => d.id === drvId);
        if (drv) {
          patch.driverId = drv.id;
          patch.driverName = drv.name;
          patch.driverPhone = drv.phone;
        }
      } else {
        patch.driverId = undefined;
        patch.driverName = undefined;
        patch.driverPhone = undefined;
      }
    }

    if (req.body.bookingStatus) {
      const nextStatus = asString(req.body.bookingStatus, 40) as BookingStatus;
      if (['Confirmed', 'Driver Assigned', 'In Progress'].includes(nextStatus)) {
        const conflict = hasVehicleBookingConflict(
          bookings,
          patch.vehicleId || existing.vehicleId,
          existing.journeyDate,
          existing.returnDate,
          existing.journeyTime,
          existing.tripType,
          existing.id
        );
        if (conflict) {
          res.status(409).json({ error: `Cannot confirm: conflict with ${conflict.bookingCode}.` });
          return;
        }
      }
      patch.bookingStatus = nextStatus;
    }

    if (req.body.pickupLocation) patch.pickupLocation = asString(req.body.pickupLocation, 240);
    if (req.body.journeyDate) patch.journeyDate = asString(req.body.journeyDate, 20);
    if (req.body.journeyTime) patch.journeyTime = asString(req.body.journeyTime, 10);
    if (typeof req.body.totalFare === 'number' && req.body.totalFare > 0) {
      patch.totalFare = Math.round(req.body.totalFare);
    }

    const updated = await db.updateOneById('bookings', id, patch);
    if (
      updated &&
      req.body.bookingStatus &&
      updated.bookingStatus !== existing.bookingStatus
    ) {
      if (updated.bookingStatus !== 'Pending') {
        const actor = (req as AuthenticatedRequest).user;
        await db.consumeAdminActionTokensForTarget('booking', updated.id, {
          usedByEmail: actor?.email,
          usedByRole: actor?.role,
          decisionResult: `dashboard:${updated.bookingStatus}`,
        });
      }
      if (
        (['Confirmed', 'Driver Assigned', 'Rejected', 'Cancelled'] as BookingStatus[]).includes(
          updated.bookingStatus
        )
      ) {
        await runEmailSafely(
          dispatchBookingStatusEmail(updated.id, updated.bookingStatus, {
            notifyAdminWithInvoice: updated.bookingStatus === 'Confirmed',
          })
        );
      }
    }
    res.json({ booking: updated });
  });

  // Pricing Management
  app.put('/api/admin/pricing', requireAdmin, async (req: Request, res: Response) => {
    const incoming = req.body.pricing as PricingConfig;
    if (!incoming || !Array.isArray(incoming.rules) || !incoming.additionalCharges) {
      res.status(400).json({ error: 'Invalid pricing configuration payload' });
      return;
    }
    const saved = await db.savePricing(incoming);
    res.json({ pricing: saved });
  });

  // Website Settings Management
  app.put('/api/admin/settings', requireAdmin, async (req: Request, res: Response) => {
    const raw = req.body.settings as Partial<WebsiteSettings> | undefined;
    if (!raw || typeof raw !== 'object') {
      res.status(400).json({ error: 'Invalid website settings payload' });
      return;
    }

    const current = await db.getSettings();
    const companyName = asString(raw.companyName, 80) || current.companyName;
    const prefixClean = (asString(raw.bookingCodePrefix, 8) || current.bookingCodePrefix)
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 6);

    const allowedCtaTargets = new Set(['fleet', 'booking', 'services', 'destinations']);
    const sanitizedSlides = Array.isArray(raw.heroSlides)
      ? raw.heroSlides
          .slice(0, 8)
          .map((sl, idx) => ({
            id: asString(sl?.id, 40) || `slide-${idx + 1}`,
            eyebrow: asString(sl?.eyebrow, 120) || current.tagline,
            headline: asString(sl?.headline, 140) || current.heroHeadline,
            subheading: asString(sl?.subheading, 240) || current.heroSubheading,
            imageUrl: sanitizeAssetUrl(sl?.imageUrl, current.heroBannerUrl),
            ctaLabel: asString(sl?.ctaLabel, 40) || undefined,
            ctaTarget: allowedCtaTargets.has(String(sl?.ctaTarget))
              ? (sl.ctaTarget as 'fleet' | 'booking' | 'services' | 'destinations')
              : undefined,
          }))
          .filter((sl) => Boolean(sl.headline && sl.imageUrl))
      : current.heroSlides;

    const rawAutoplay = Number(raw.heroAutoplaySeconds);
    const heroAutoplaySeconds = Number.isFinite(rawAutoplay)
      ? Math.max(0, Math.min(20, Math.round(rawAutoplay)))
      : current.heroAutoplaySeconds;

    const sanitized: WebsiteSettings = {
      companyName,
      tagline: asString(raw.tagline, 140) || current.tagline,
      logoUrl: sanitizeAssetUrl(raw.logoUrl, current.logoUrl),
      establishedYear: asString(raw.establishedYear, 30) || current.establishedYear,
      footerDescription: asString(raw.footerDescription, 320) || current.footerDescription,
      footerPermitsLine: asString(raw.footerPermitsLine, 160) || current.footerPermitsLine,

      heroHeadline: asString(raw.heroHeadline, 140) || current.heroHeadline,
      heroSubheading: asString(raw.heroSubheading, 240) || current.heroSubheading,
      heroBannerUrl: sanitizeAssetUrl(raw.heroBannerUrl, current.heroBannerUrl),
      heroAutoplaySeconds,
      heroSlides: sanitizedSlides.length > 0 ? sanitizedSlides : current.heroSlides,
      whyChooseTitle: asString(raw.whyChooseTitle, 120) || current.whyChooseTitle,
      whyChooseDescription: asString(raw.whyChooseDescription, 500) || current.whyChooseDescription,
      onTimeMetric: asString(raw.onTimeMetric, 20) || current.onTimeMetric,
      ownedFleetMetric: asString(raw.ownedFleetMetric, 20) || current.ownedFleetMetric,

      defaultPickupAddress: asString(raw.defaultPickupAddress, 200) || current.defaultPickupAddress,
      defaultPickupLat: asNumber(raw.defaultPickupLat, current.defaultPickupLat),
      defaultPickupLng: asNumber(raw.defaultPickupLng, current.defaultPickupLng),
      defaultDropAddress: asString(raw.defaultDropAddress, 200) || current.defaultDropAddress,
      defaultDropLat: asNumber(raw.defaultDropLat, current.defaultDropLat),
      defaultDropLng: asNumber(raw.defaultDropLng, current.defaultDropLng),
      businessAddress: asString(raw.businessAddress, 240) || current.businessAddress,
      depotLat: asNumber(raw.depotLat, current.depotLat),
      depotLng: asNumber(raw.depotLng, current.depotLng),

      supportPhone: asString(raw.supportPhone, 30) || current.supportPhone,
      supportEmail: asString(raw.supportEmail, 120) || current.supportEmail,
      whatsappNumber: (asString(raw.whatsappNumber, 24) || current.whatsappNumber).replace(/[^\d]/g, '') || current.whatsappNumber,
      whatsappDefaultMessage: asString(raw.whatsappDefaultMessage, 200) || current.whatsappDefaultMessage,
      workingHours: asString(raw.workingHours, 80) || current.workingHours,

      bookingCodePrefix: prefixClean || 'VF',
      allowOnlinePayment:
        typeof raw.allowOnlinePayment === 'boolean' ? raw.allowOnlinePayment : current.allowOnlinePayment,
      allowPayLater: typeof raw.allowPayLater === 'boolean' ? raw.allowPayLater : current.allowPayLater,
      allowGuestBooking: typeof raw.allowGuestBooking === 'boolean' ? raw.allowGuestBooking : current.allowGuestBooking,
      showWhatsAppWidget: typeof raw.showWhatsAppWidget === 'boolean' ? raw.showWhatsAppWidget : current.showWhatsAppWidget,
      maintenanceMode: typeof raw.maintenanceMode === 'boolean' ? raw.maintenanceMode : current.maintenanceMode,
      maintenanceMessage: asString(raw.maintenanceMessage, 300) || current.maintenanceMessage,
      gstNumber: asString(raw.gstNumber, 30).toUpperCase(),
      invoiceFooterNote: asString(raw.invoiceFooterNote, 200) || current.invoiceFooterNote,

      seoTitle: asString(raw.seoTitle, 120) || current.seoTitle,
      seoDescription: asString(raw.seoDescription, 320) || current.seoDescription,
      facebookUrl: sanitizeSocialUrl(raw.facebookUrl),
      instagramUrl: sanitizeSocialUrl(raw.instagramUrl),
      youtubeUrl: sanitizeSocialUrl(raw.youtubeUrl),
      twitterUrl: sanitizeSocialUrl(raw.twitterUrl),
      updatedAt: new Date().toISOString(),
    };

    const saved = await db.saveSettings(sanitized);
    res.json({ settings: saved });
  });

  app.post('/api/admin/settings/reset', requireAdmin, async (_req: Request, res: Response) => {
    const saved = await db.saveSettings(SEED_SETTINGS);
    res.json({ settings: saved });
  });

  // Gallery Management
  app.post('/api/admin/gallery', requireAdmin, async (req: Request, res: Response) => {
    const allowedCategories: GalleryCategory[] = [
      'Fleet Showcase',
      'Airport & Corporate',
      'Weddings & Events',
      'Outstation & Tours',
      'Coach Interiors',
    ];
    const title = asString(req.body.title, 100);
    const caption = asString(req.body.caption, 280);
    const routeOrContext = asString(req.body.routeOrContext, 120) || 'Vizag Jagan Travels Fleet';
    const rawCat = asString(req.body.category, 60) as GalleryCategory;
    const category: GalleryCategory = allowedCategories.includes(rawCat) ? rawCat : 'Fleet Showcase';
    const imageUrl = sanitizeAssetUrl(req.body.imageUrl, '');

    if (!title || !caption || !imageUrl) {
      res.status(400).json({ error: 'Title, photo URL/upload, and caption are required.' });
      return;
    }

    const allowedVehCats: VehicleCategory[] = [
      'Cars',
      'SUVs',
      'Premium Cars',
      'Tempo Travellers',
      'Mini Buses',
      'Luxury Buses',
      'Large Passenger Buses',
    ];
    const rawRec = asString(req.body.recommendedCategory, 60) as VehicleCategory;
    const recommendedCategory = allowedVehCats.includes(rawRec) ? rawRec : undefined;

    const item: GalleryItem = {
      id: `gal-${Date.now()}`,
      title,
      category,
      imageUrl,
      caption,
      routeOrContext,
      recommendedCategory,
      featured: Boolean(req.body.featured),
      createdAt: new Date().toISOString(),
    };
    await db.insertOne('gallery', item);
    res.status(201).json({ item });
  });

  app.delete('/api/admin/gallery/:id', requireAdmin, async (req: Request, res: Response) => {
    const id = asString(req.params.id, 60);
    const deleted = await db.deleteOneById('gallery', id);
    if (!deleted) {
      res.status(404).json({ error: 'Gallery item not found' });
      return;
    }
    res.json({ deleted: true });
  });

  // Services & Upcoming Services Management
  app.get('/api/admin/services', requireAdmin, async (_req: Request, res: Response) => {
    const services = await db.getAll('services');
    res.json({
      services: [...services].sort((a, b) => a.num.localeCompare(b.num, undefined, { numeric: true })),
    });
  });

  app.post('/api/admin/services', requireAdmin, async (req: Request, res: Response) => {
    const title = asString(req.body.title, 100);
    const tagline = asString(req.body.tagline, 140) || 'Company-Owned Fleet Dispatch';
    const desc = asString(req.body.desc, 500);
    const rawStatus = asString(req.body.status, 20) as ServiceStatus;
    const status: ServiceStatus = ['Active', 'Upcoming', 'Archived'].includes(rawStatus) ? rawStatus : 'Upcoming';
    const launchWindow = asString(req.body.launchWindow, 60) || undefined;

    if (!title || !desc) {
      res.status(400).json({ error: 'Service title and description are required.' });
      return;
    }

    const allowedVehCats: VehicleCategory[] = [
      'Cars',
      'SUVs',
      'Premium Cars',
      'Tempo Travellers',
      'Mini Buses',
      'Luxury Buses',
      'Large Passenger Buses',
    ];
    const rawCat = asString(req.body.defaultCategory, 60) as VehicleCategory;
    const defaultCategory: VehicleCategory = allowedVehCats.includes(rawCat) ? rawCat : 'SUVs';

    const allowedTrips: TripType[] = ['One Way', 'Round Trip', 'Local Rental', 'Airport Transfer'];
    const rawTrip = asString(req.body.tripType, 30) as TripType;
    const tripType: TripType = allowedTrips.includes(rawTrip) ? rawTrip : 'Round Trip';

    const allowedGalCats: GalleryCategory[] = [
      'Fleet Showcase',
      'Airport & Corporate',
      'Weddings & Events',
      'Outstation & Tours',
      'Coach Interiors',
    ];
    const rawGalCat = asString(req.body.galleryCategory, 60) as GalleryCategory;
    const galleryCategory: GalleryCategory = allowedGalCats.includes(rawGalCat) ? rawGalCat : 'Fleet Showcase';

    const existing = await db.getAll('services');
    const nextNum = asString(req.body.num, 6) || String(existing.length + 1).padStart(2, '0');
    const highlights = Array.isArray(req.body.highlights)
      ? req.body.highlights.map((h: unknown) => asString(h, 160)).filter(Boolean).slice(0, 6)
      : [];

    const service: TravelService = {
      id: `srv-${Date.now()}`,
      num: nextNum,
      title,
      tagline,
      desc,
      status,
      launchWindow: status === 'Upcoming' ? launchWindow || 'Launching Soon' : undefined,
      tripType,
      defaultCategory,
      defaultPassengers: Math.max(1, Math.min(55, asNumber(req.body.defaultPassengers, 4))),
      passengerRange: asString(req.body.passengerRange, 60) || '1–45 Passengers',
      idealFleet: asString(req.body.idealFleet, 100) || defaultCategory,
      imageUrl: sanitizeAssetUrl(req.body.imageUrl, '/src/assets/images/service_ev_fleet_upcoming_1795613750837.jpg'),
      galleryCategory,
      highlights: highlights.length > 0 ? highlights : ['Direct Vizag Jagan Travels fleet dispatch'],
      createdAt: new Date().toISOString(),
    };

    await db.insertOne('services', service);
    res.status(201).json({ service });
  });

  app.patch('/api/admin/services/:id', requireAdmin, async (req: Request, res: Response) => {
    const id = asString(req.params.id, 60);
    const patch: Partial<TravelService> = {};
    if (req.body.title) patch.title = asString(req.body.title, 100);
    if (req.body.tagline) patch.tagline = asString(req.body.tagline, 140);
    if (req.body.desc) patch.desc = asString(req.body.desc, 500);
    if (req.body.status && ['Active', 'Upcoming', 'Archived'].includes(String(req.body.status))) {
      patch.status = req.body.status as ServiceStatus;
    }
    if (req.body.launchWindow !== undefined) {
      patch.launchWindow = asString(req.body.launchWindow, 60) || undefined;
    }
    if (req.body.passengerRange) patch.passengerRange = asString(req.body.passengerRange, 60);
    if (req.body.idealFleet) patch.idealFleet = asString(req.body.idealFleet, 100);
    if (req.body.imageUrl) patch.imageUrl = sanitizeAssetUrl(req.body.imageUrl, '/src/assets/images/service_ev_fleet_upcoming_1795613750837.jpg');

    const updated = await db.updateOneById('services', id, patch);
    if (!updated) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }
    res.json({ service: updated });
  });

  app.delete('/api/admin/services/:id', requireAdmin, async (req: Request, res: Response) => {
    const id = asString(req.params.id, 60);
    const deleted = await db.deleteOneById('services', id);
    if (!deleted) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }
    res.json({ deleted: true });
  });

  // Featured Destinations Management
  app.get('/api/admin/destinations', requireAdmin, async (_req: Request, res: Response) => {
    const destinations = await db.getAll('destinations');
    res.json({ destinations });
  });

  app.post('/api/admin/destinations', requireAdmin, async (req: Request, res: Response) => {
    const name = asString(req.body.name, 100);
    const region = asString(req.body.region, 100) || 'Andhra Pradesh';
    const dropAddress = asString(req.body.dropAddress, 200) || name;
    const description = asString(req.body.description, 450);

    if (!name || !description) {
      res.status(400).json({ error: 'Destination name and description are required.' });
      return;
    }

    const allowedVehCats: VehicleCategory[] = [
      'Cars',
      'SUVs',
      'Premium Cars',
      'Tempo Travellers',
      'Mini Buses',
      'Luxury Buses',
      'Large Passenger Buses',
    ];
    const rawCat = asString(req.body.recommendedCategory, 60) as VehicleCategory;
    const recommendedCategory: VehicleCategory = allowedVehCats.includes(rawCat) ? rawCat : 'SUVs';

    const allowedTrips: TripType[] = ['One Way', 'Round Trip', 'Local Rental', 'Airport Transfer'];
    const rawTrip = asString(req.body.recommendedTripType, 30) as TripType;
    const recommendedTripType: TripType = allowedTrips.includes(rawTrip) ? rawTrip : 'Round Trip';

    const highlights = Array.isArray(req.body.highlights)
      ? req.body.highlights.map((h: unknown) => asString(h, 160)).filter(Boolean).slice(0, 5)
      : [];

    const dest: FeaturedDestination = {
      id: `dest-${Date.now()}`,
      name,
      region,
      routeSummary: asString(req.body.routeSummary, 160) || `Visakhapatnam → ${name}`,
      distanceKm: Math.max(10, asNumber(req.body.distanceKm, 120)),
      durationText: asString(req.body.durationText, 60) || '3 hrs drive',
      dropAddress,
      dropLat: asNumber(req.body.dropLat, 17.7212),
      dropLng: asNumber(req.body.dropLng, 83.2245),
      recommendedCategory,
      recommendedTripType,
      recommendedPassengers: Math.max(1, Math.min(55, asNumber(req.body.recommendedPassengers, 6))),
      startingEstimateLabel: asString(req.body.startingEstimateLabel, 80) || 'Transparent Category Tariff',
      imageUrl: sanitizeAssetUrl(req.body.imageUrl, '/src/assets/images/dest_araku_valley_1795613749816.jpg'),
      description,
      highlights: highlights.length > 0 ? highlights : ['Direct Vizag Jagan Travels fleet transfer'],
      featured: req.body.featured !== false,
      active: req.body.active !== false,
      createdAt: new Date().toISOString(),
    };

    await db.insertOne('destinations', dest);
    res.status(201).json({ destination: dest });
  });

  app.patch('/api/admin/destinations/:id', requireAdmin, async (req: Request, res: Response) => {
    const id = asString(req.params.id, 60);
    const patch: Partial<FeaturedDestination> = {};
    if (req.body.name) patch.name = asString(req.body.name, 100);
    if (req.body.region) patch.region = asString(req.body.region, 100);
    if (req.body.routeSummary) patch.routeSummary = asString(req.body.routeSummary, 160);
    if (typeof req.body.distanceKm !== 'undefined') patch.distanceKm = Math.max(10, asNumber(req.body.distanceKm, 120));
    if (req.body.durationText) patch.durationText = asString(req.body.durationText, 60);
    if (req.body.startingEstimateLabel) patch.startingEstimateLabel = asString(req.body.startingEstimateLabel, 80);
    if (req.body.description) patch.description = asString(req.body.description, 450);
    if (typeof req.body.featured === 'boolean') patch.featured = req.body.featured;
    if (typeof req.body.active === 'boolean') patch.active = req.body.active;
    if (req.body.imageUrl) {
      patch.imageUrl = sanitizeAssetUrl(req.body.imageUrl, '/src/assets/images/dest_araku_valley_1795613749816.jpg');
    }

    const updated = await db.updateOneById('destinations', id, patch);
    if (!updated) {
      res.status(404).json({ error: 'Destination not found' });
      return;
    }
    res.json({ destination: updated });
  });

  app.delete('/api/admin/destinations/:id', requireAdmin, async (req: Request, res: Response) => {
    const id = asString(req.params.id, 60);
    const deleted = await db.deleteOneById('destinations', id);
    if (!deleted) {
      res.status(404).json({ error: 'Destination not found' });
      return;
    }
    res.json({ deleted: true });
  });

  // Travel Packages Management
  app.get('/api/admin/packages', requireAdmin, async (_req: Request, res: Response) => {
    const packages = await db.getAll('packages');
    res.json({ packages: [...packages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) });
  });

  app.post('/api/admin/packages', requireAdmin, async (req: Request, res: Response) => {
    const title = asString(req.body.title, 120);
    const subtitle = asString(req.body.subtitle, 180) || 'Custom Visakhapatnam Fleet Itinerary';
    const dropAddress = asString(req.body.dropAddress, 200) || title;
    if (!title) {
      res.status(400).json({ error: 'Package title is required.' });
      return;
    }

    const allowedPackageTypes: PackageType[] = [
      'City & Sightseeing',
      'Hill Station & Nature',
      'Pilgrimage Tour',
      'Weekend & Coastal',
      'Corporate & Group',
    ];
    const rawType = asString(req.body.packageType, 60) as PackageType;
    const packageType: PackageType = allowedPackageTypes.includes(rawType) ? rawType : 'City & Sightseeing';

    const allowedVehCats: VehicleCategory[] = [
      'Cars',
      'SUVs',
      'Premium Cars',
      'Tempo Travellers',
      'Mini Buses',
      'Luxury Buses',
      'Large Passenger Buses',
    ];
    const rawCat = asString(req.body.recommendedCategory, 60) as VehicleCategory;
    const recommendedCategory: VehicleCategory = allowedVehCats.includes(rawCat) ? rawCat : 'SUVs';

    const allowedTrips: TripType[] = ['One Way', 'Round Trip', 'Local Rental', 'Airport Transfer'];
    const rawTrip = asString(req.body.recommendedTripType, 30) as TripType;
    const recommendedTripType: TripType = allowedTrips.includes(rawTrip) ? rawTrip : 'Round Trip';

    const inclusions = Array.isArray(req.body.inclusions)
      ? req.body.inclusions.map((i: unknown) => asString(i, 160)).filter(Boolean).slice(0, 6)
      : [];
    const itineraryHighlights = Array.isArray(req.body.itineraryHighlights)
      ? req.body.itineraryHighlights.map((h: unknown) => asString(h, 160)).filter(Boolean).slice(0, 6)
      : [];

    const pkg: TravelPackage = {
      id: `pkg-${Date.now()}`,
      title,
      subtitle,
      packageType,
      durationLabel: asString(req.body.durationLabel, 60) || '1 Day Package',
      distanceKm: Math.max(20, asNumber(req.body.distanceKm, 120)),
      dropAddress,
      dropLat: asNumber(req.body.dropLat, 17.7212),
      dropLng: asNumber(req.body.dropLng, 83.2245),
      recommendedCategory,
      recommendedTripType,
      passengerCount: Math.max(1, Math.min(55, asNumber(req.body.passengerCount, 4))),
      packagePriceInr: Math.max(500, asNumber(req.body.packagePriceInr, 3500)),
      priceUnitLabel: asString(req.body.priceUnitLabel, 80) || `${recommendedCategory} Package`,
      imageUrl: sanitizeAssetUrl(req.body.imageUrl, '/src/assets/images/dest_araku_valley_1795613749816.jpg'),
      inclusions: inclusions.length > 0 ? inclusions : ['Company-owned AC vehicle & verified chauffeur'],
      itineraryHighlights: itineraryHighlights.length > 0 ? itineraryHighlights : [subtitle],
      featured: req.body.featured !== false,
      active: req.body.active !== false,
      createdAt: new Date().toISOString(),
    };

    await db.insertOne('packages', pkg);
    res.status(201).json({ package: pkg });
  });

  app.patch('/api/admin/packages/:id', requireAdmin, async (req: Request, res: Response) => {
    const id = asString(req.params.id, 60);
    const patch: Partial<TravelPackage> = {};
    if (req.body.title) patch.title = asString(req.body.title, 120);
    if (req.body.subtitle) patch.subtitle = asString(req.body.subtitle, 180);
    if (req.body.durationLabel) patch.durationLabel = asString(req.body.durationLabel, 60);
    if (typeof req.body.packagePriceInr !== 'undefined') {
      patch.packagePriceInr = Math.max(500, asNumber(req.body.packagePriceInr, 3500));
    }
    if (typeof req.body.featured === 'boolean') patch.featured = req.body.featured;
    if (typeof req.body.active === 'boolean') patch.active = req.body.active;
    if (req.body.imageUrl) {
      patch.imageUrl = sanitizeAssetUrl(req.body.imageUrl, '/src/assets/images/dest_araku_valley_1795613749816.jpg');
    }

    const updated = await db.updateOneById('packages', id, patch);
    if (!updated) {
      res.status(404).json({ error: 'Package not found' });
      return;
    }
    res.json({ package: updated });
  });

  app.delete('/api/admin/packages/:id', requireAdmin, async (req: Request, res: Response) => {
    const id = asString(req.params.id, 60);
    const deleted = await db.deleteOneById('packages', id);
    if (!deleted) {
      res.status(404).json({ error: 'Package not found' });
      return;
    }
    res.json({ deleted: true });
  });

  // Customer Directory
  app.get('/api/admin/customers', requireAdmin, async (_req: Request, res: Response) => {
    const [users, bookings] = await Promise.all([db.getAll('users'), db.getAll('bookings')]);
    const customerMap: Record<
      string,
      {
        id: string;
        name: string;
        email: string;
        phone: string;
        bookingsCount: number;
        totalSpent: number;
        lastTripDate: string;
        isRegistered: boolean;
        hasRecoveryPin: boolean;
      }
    > = {};

    for (const u of users) {
      customerMap[u.email.toLowerCase()] = {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        bookingsCount: 0,
        totalSpent: 0,
        lastTripDate: u.createdAt.slice(0, 10),
        isRegistered: true,
        hasRecoveryPin: Boolean(u.recoveryPinHash),
      };
    }

    for (const b of bookings) {
      const key = b.customerEmail.toLowerCase();
      if (!customerMap[key]) {
        customerMap[key] = {
          id: b.customerId || `guest-${key}`,
          name: b.customerName,
          email: b.customerEmail,
          phone: b.customerPhone,
          bookingsCount: 0,
          totalSpent: 0,
          lastTripDate: b.journeyDate,
          isRegistered: false,
          hasRecoveryPin: false,
        };
      }
      customerMap[key].bookingsCount += 1;
      customerMap[key].totalSpent += b.paidAmount;
      if (b.journeyDate > customerMap[key].lastTripDate) {
        customerMap[key].lastTripDate = b.journeyDate;
      }
    }

    res.json({ customers: Object.values(customerMap) });
  });

  app.post('/api/admin/customers/:id/reset-code', requireAdmin, async (req: Request, res: Response) => {
    const id = asString(req.params.id, 80);
    const users = await db.getAll('users');
    const user = users.find((u) => u.id === id);
    if (!user) {
      res.status(404).json({ error: 'Registered customer account not found' });
      return;
    }

    const resetCode = generateShortResetCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const resetTokenHash = await hashPassword(resetCode);

    await db.updateOneById('users', user.id, {
      resetTokenHash,
      resetTokenExpiresAt: expiresAt,
    });

    res.json({
      resetCode,
      expiresAt,
      customerName: user.name,
      customerEmail: user.email,
    });
  });

  // Payments & Refunds
  app.get('/api/admin/payments', requireAdmin, async (_req: Request, res: Response) => {
    const payments = await db.getAll('payments');
    res.json({ payments: payments.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  });

  app.post('/api/admin/payments/:id/refund', requireAdmin, async (req: Request, res: Response) => {
    const id = asString(req.params.id, 80);
    const payments = await db.getAll('payments');
    const payment = payments.find((p) => p.id === id);
    if (!payment) {
      res.status(404).json({ error: 'Payment record not found' });
      return;
    }

    const refundAmount = Math.min(payment.amount, Math.max(1, asNumber(req.body.refundAmount, payment.amount)));
    const refundNote = asString(req.body.refundNote, 200) || 'Refund processed by Admin';

    const updatedPayment = await db.updateOneById('payments', id, {
      status: 'Refunded',
      refundAmount,
      refundNote,
    });

    await db.updateOneById('bookings', payment.bookingId, {
      paymentStatus: 'Refunded',
      updatedAt: new Date().toISOString(),
    });

    res.json({ payment: updatedPayment });
  });

  // Enquiries Management
  app.get('/api/admin/enquiries', requireAdmin, async (_req: Request, res: Response) => {
    const enquiries = await db.getAll('enquiries');
    res.json({ enquiries: enquiries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  });

  app.patch('/api/admin/enquiries/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const id = asString(req.params.id, 60);
    const status = asString(req.body.status, 30) as Enquiry['status'];
    const allowedStatuses: Enquiry['status'][] = ['Pending', 'Confirmed', 'Rejected', 'Responded', 'Resolved'];
    if (!allowedStatuses.includes(status)) {
      res.status(400).json({ error: 'Invalid enquiry status' });
      return;
    }

    const existingList = await db.getAll('enquiries');
    const existing = existingList.find((e) => e.id === id);
    if (!existing) {
      res.status(404).json({ error: 'Enquiry not found' });
      return;
    }

    const updated = await db.updateOneById('enquiries', id, {
      status,
      updatedAt: new Date().toISOString(),
    });
    if (updated && status !== existing.status) {
      if (status !== 'Pending') {
        await db.consumeAdminActionTokensForTarget('enquiry', updated.id, {
          usedByEmail: req.user?.email,
          usedByRole: req.user?.role,
          decisionResult: `dashboard:${status}`,
        });
      }
      if (status === 'Confirmed' || status === 'Rejected' || status === 'Responded' || status === 'Resolved') {
        await runEmailSafely(dispatchEnquiryStatusEmail(updated.id, status));
      }
    }
    res.json({ enquiry: updated });
  });

  // Single-use expiring Email Action Links (Admin-verified approval/rejection)
  app.get('/api/admin/action-links/check', async (req: Request, res: Response) => {
    const rawToken = asString(req.query.token, 160);
    if (!/^[a-f0-9]{32,128}$/i.test(rawToken)) {
      res.status(400).json({ status: 'invalid', message: 'Invalid action link token.' });
      return;
    }
    const tokenHash = hashAdminActionToken(rawToken);
    const tokens = await db.getAll('adminActionTokens');
    const record = tokens.find((t) => t.tokenHash === tokenHash);
    if (!record) {
      res.status(404).json({ status: 'invalid', message: 'Action link not found.' });
      return;
    }
    if (record.usedAt) {
      res.json({
        status: 'used',
        targetType: record.targetType,
        action: record.action,
        message: 'This decision link has already been used.',
      });
      return;
    }
    if (Date.now() > Date.parse(record.expiresAt)) {
      res.json({
        status: 'expired',
        targetType: record.targetType,
        action: record.action,
        message: 'This action link has expired (48-hour limit).',
      });
      return;
    }
    res.json({
      status: 'ready',
      targetType: record.targetType,
      action: record.action,
      expiresAt: record.expiresAt,
      message: 'Administrator sign-in required to review and execute this action.',
    });
  });

  app.get('/api/admin/action-links/preview', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const rawToken = asString(req.query.token, 160);
    if (!/^[a-f0-9]{32,128}$/i.test(rawToken)) {
      res.status(400).json({ error: 'Invalid action token format.' });
      return;
    }
    const tokenHash = hashAdminActionToken(rawToken);
    const tokens = await db.getAll('adminActionTokens');
    const record = tokens.find((t) => t.tokenHash === tokenHash);
    if (!record) {
      res.status(404).json({ error: 'Action link was not found.' });
      return;
    }

    const isExpired = Date.now() > Date.parse(record.expiresAt);
    const isUsed = Boolean(record.usedAt);

    if (record.targetType === 'booking') {
      const bookings = await db.getAll('bookings');
      const booking = bookings.find((b) => b.id === record.targetId);
      if (!booking) {
        res.status(404).json({ error: 'Associated booking no longer exists.' });
        return;
      }
      const alreadyProcessed = isUsed || booking.bookingStatus !== 'Pending';
      let conflictError: string | null = null;
      if (!alreadyProcessed && record.action === 'confirm') {
        const conflict = hasVehicleBookingConflict(
          bookings,
          booking.vehicleId,
          booking.journeyDate,
          booking.returnDate,
          booking.journeyTime,
          booking.tripType,
          booking.id
        );
        if (conflict) {
          conflictError = `Vehicle already reserved by overlapping booking ${conflict.bookingCode}.`;
        }
      }
      res.json({
        targetType: 'booking',
        action: record.action,
        expiresAt: record.expiresAt,
        isExpired,
        isUsed,
        alreadyProcessed,
        decisionResult: record.decisionResult,
        usedByEmail: record.usedByEmail,
        conflictError,
        booking,
      });
      return;
    }

    const enquiries = await db.getAll('enquiries');
    const enquiry = enquiries.find((e) => e.id === record.targetId);
    if (!enquiry) {
      res.status(404).json({ error: 'Associated enquiry no longer exists.' });
      return;
    }
    const alreadyProcessed = isUsed || enquiry.status !== 'Pending';
    res.json({
      targetType: 'enquiry',
      action: record.action,
      expiresAt: record.expiresAt,
      isExpired,
      isUsed,
      alreadyProcessed,
      decisionResult: record.decisionResult,
      usedByEmail: record.usedByEmail,
      enquiry,
    });
  });

  app.post('/api/admin/action-links/execute', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const rl = checkRateLimit(`admin-action-exec:${req.ip}`, 30);
    if (!rl.allowed) {
      res.status(429).json({ error: `Too many requests. Try again in ${rl.retryAfterSeconds}s.` });
      return;
    }

    const rawToken = asString(req.body.token, 160);
    if (!/^[a-f0-9]{32,128}$/i.test(rawToken)) {
      res.status(400).json({ error: 'Invalid action token format.' });
      return;
    }

    const tokenHash = hashAdminActionToken(rawToken);
    const tokens = await db.getAll('adminActionTokens');
    const record = tokens.find((t) => t.tokenHash === tokenHash);
    if (!record) {
      res.status(404).json({ error: 'Action link was not found.' });
      return;
    }
    if (record.usedAt) {
      res.status(409).json({ error: 'This action link has already been used. Duplicate action blocked.' });
      return;
    }
    if (Date.now() > Date.parse(record.expiresAt)) {
      res.status(410).json({ error: 'This action link has expired.' });
      return;
    }

    const lockKey = `${record.targetType}:${record.targetId}`;
    if (inFlightActionDecisions.has(lockKey)) {
      res.status(409).json({ error: 'Another decision for this record is already in progress.' });
      return;
    }
    inFlightActionDecisions.add(lockKey);

    try {
      if (record.targetType === 'booking') {
        const bookings = await db.getAll('bookings');
        const booking = bookings.find((b) => b.id === record.targetId);
        if (!booking) {
          res.status(404).json({ error: 'Booking not found.' });
          return;
        }
        if (booking.bookingStatus !== 'Pending') {
          await db.consumeAdminActionTokensForTarget('booking', booking.id, {
            usedByEmail: req.user?.email,
            usedByRole: req.user?.role,
            decisionResult: `already:${booking.bookingStatus}`,
          });
          res.status(409).json({
            error: `Booking #${booking.bookingCode} is already ${booking.bookingStatus}. Duplicate approvals/rejections are blocked.`,
          });
          return;
        }

        const nextStatus: BookingStatus = record.action === 'confirm' ? 'Confirmed' : 'Rejected';
        if (nextStatus === 'Confirmed') {
          const conflict = hasVehicleBookingConflict(
            bookings,
            booking.vehicleId,
            booking.journeyDate,
            booking.returnDate,
            booking.journeyTime,
            booking.tripType,
            booking.id
          );
          if (conflict) {
            res.status(409).json({
              error: `Cannot confirm booking: vehicle overlaps with ${conflict.bookingCode}.`,
            });
            return;
          }
        }

        const updatedBooking = await db.updateOneById('bookings', booking.id, {
          bookingStatus: nextStatus,
          updatedAt: new Date().toISOString(),
        });

        await db.consumeAdminActionTokensForTarget('booking', booking.id, {
          usedByEmail: req.user?.email,
          usedByRole: req.user?.role,
          decisionResult: `email-action:${nextStatus}`,
        });

        const emailStatus = await runEmailSafely(
          dispatchBookingStatusEmail(booking.id, nextStatus, {
            notifyAdminWithInvoice: nextStatus === 'Confirmed',
          })
        );

        res.json({
          executed: true,
          targetType: 'booking',
          action: record.action,
          booking: updatedBooking,
          emailStatus,
          message:
            nextStatus === 'Confirmed'
              ? `Booking #${booking.bookingCode} confirmed. Status update and PDF invoice dispatched.`
              : `Booking #${booking.bookingCode} rejected. Status update email dispatched to customer.`,
        });
        return;
      }

      // Enquiry action execution
      const enquiries = await db.getAll('enquiries');
      const enquiry = enquiries.find((e) => e.id === record.targetId);
      if (!enquiry) {
        res.status(404).json({ error: 'Enquiry not found.' });
        return;
      }
      if (enquiry.status !== 'Pending') {
        await db.consumeAdminActionTokensForTarget('enquiry', enquiry.id, {
          usedByEmail: req.user?.email,
          usedByRole: req.user?.role,
          decisionResult: `already:${enquiry.status}`,
        });
        res.status(409).json({
          error: `Enquiry is already marked as ${enquiry.status}. Duplicate actions are blocked.`,
        });
        return;
      }

      const nextStatus: Enquiry['status'] = record.action === 'confirm' ? 'Confirmed' : 'Rejected';
      const updatedEnquiry = await db.updateOneById('enquiries', enquiry.id, {
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      });

      await db.consumeAdminActionTokensForTarget('enquiry', enquiry.id, {
        usedByEmail: req.user?.email,
        usedByRole: req.user?.role,
        decisionResult: `email-action:${nextStatus}`,
      });

      const emailStatus = await runEmailSafely(dispatchEnquiryStatusEmail(enquiry.id, nextStatus));

      res.json({
        executed: true,
        targetType: 'enquiry',
        action: record.action,
        enquiry: updatedEnquiry,
        emailStatus,
        message:
          nextStatus === 'Confirmed'
            ? `Enquiry confirmed and customer notification sent.`
            : `Enquiry rejected and customer notification sent.`,
      });
    } finally {
      inFlightActionDecisions.delete(lockKey);
    }
  });

  // Reports
  app.get('/api/admin/reports', requireAdmin, async (_req: Request, res: Response) => {
    const [bookings, payments, vehicles, drivers] = await Promise.all([
      db.getAll('bookings'),
      db.getAll('payments'),
      db.getAll('vehicles'),
      db.getAll('drivers'),
    ]);

    const dailyMap: Record<string, { date: string; bookings: number; revenue: number }> = {};
    const monthlyMap: Record<string, { month: string; bookings: number; revenue: number }> = {};

    for (const b of bookings) {
      const day = b.journeyDate;
      const month = b.journeyDate.slice(0, 7);
      if (!dailyMap[day]) dailyMap[day] = { date: day, bookings: 0, revenue: 0 };
      if (!monthlyMap[month]) monthlyMap[month] = { month, bookings: 0, revenue: 0 };
      dailyMap[day].bookings += 1;
      monthlyMap[month].bookings += 1;
      if (b.bookingStatus !== 'Cancelled' && b.bookingStatus !== 'Rejected') {
        dailyMap[day].revenue += b.paidAmount;
        monthlyMap[month].revenue += b.paidAmount;
      }
    }

    const vehicleUtilization = vehicles.map((v) => {
      const vBookings = bookings.filter((b) => b.vehicleId === v.id && b.bookingStatus !== 'Cancelled');
      const totalRevenue = vBookings.reduce((sum, b) => sum + b.paidAmount, 0);
      return {
        vehicleId: v.id,
        name: v.name,
        category: v.category,
        trips: vBookings.length,
        totalKm: vBookings.reduce((sum, b) => sum + b.estimatedDistanceKm, 0),
        revenue: totalRevenue,
        status: v.status,
      };
    });

    const driverReports = drivers.map((d) => {
      const dBookings = bookings.filter((b) => b.driverId === d.id && b.bookingStatus !== 'Cancelled');
      return {
        driverId: d.id,
        name: d.name,
        phone: d.phone,
        trips: dBookings.length,
        completedTrips: dBookings.filter((b) => b.bookingStatus === 'Completed').length,
        status: d.status,
      };
    });

    res.json({
      dailyBookings: Object.values(dailyMap).sort((a, b) => b.date.localeCompare(a.date)),
      monthlyBookings: Object.values(monthlyMap).sort((a, b) => b.month.localeCompare(a.month)),
      vehicleUtilization,
      driverReports,
      totalCaptured: payments
        .filter((p) => p.status === 'Captured')
        .reduce((sum, p) => sum + p.amount - (p.refundAmount || 0), 0),
    });
  });

  // ── Vite Middleware / Static Production Assets ─────────────────────────────
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vizag Jagan Travels server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
