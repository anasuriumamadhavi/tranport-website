import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Briefcase,
  Bus,
  CalendarCheck,
  Camera,
  Check,
  Compass,
  Copy,
  DollarSign,
  Download,
  Edit3,
  KeyRound,
  LayoutDashboard,
  MessageSquare,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  Booking,
  BookingStatus,
  Driver,
  Enquiry,
  FeaturedDestination,
  GalleryCategory,
  GalleryItem,
  HeroSlide,
  PackageType,
  PaymentRecord,
  PricingConfig,
  ServiceStatus,
  TravelPackage,
  TravelService,
  TripType,
  UserProfile,
  Vehicle,
  VehicleCategory,
  WebsiteSettings,
} from '../types';
import { apiFetch, formatINR } from '../lib/api';
import {
  downloadAdminReportPdf,
  downloadBookingInvoicePdf,
  downloadCsvReport,
} from '../lib/invoicePdf';

interface AdminDashboardProps {
  token: string;
  initialTab?: AdminTab;
  onFleetUpdated: () => void;
  onSessionUpdated?: (token: string, user: UserProfile) => void;
}

type AdminTab =
  | 'overview'
  | 'fleet'
  | 'services'
  | 'destinations'
  | 'packages'
  | 'gallery'
  | 'bookings'
  | 'drivers'
  | 'pricing'
  | 'customers'
  | 'payments'
  | 'enquiries'
  | 'reports'
  | 'credentials'
  | 'settings';

interface AdminOverviewKpis {
  totalVehicles: number;
  availableVehicles: number;
  bookedVehicles: number;
  totalDrivers: number;
  totalBookings: number;
  todaysTrips: number;
  upcomingTrips: number;
  totalRevenue: number;
  pendingEnquiries: number;
}

interface CustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  bookingsCount: number;
  totalSpent: number;
  lastTripDate: string;
  isRegistered?: boolean;
  hasRecoveryPin?: boolean;
}

interface AdminCredentialInfo {
  id: string;
  email: string;
  name: string;
  envPasscodeConfigured: boolean;
  hasClaimedAdmin: boolean;
  hasRecoveryKey: boolean;
  createdAt: string;
  updatedAt: string | null;
}

interface ReportsPayload {
  dailyBookings: Array<{ date: string; bookings: number; revenue: number }>;
  monthlyBookings: Array<{ month: string; bookings: number; revenue: number }>;
  vehicleUtilization: Array<{
    vehicleId: string;
    name: string;
    category: string;
    trips: number;
    totalKm: number;
    revenue: number;
    status: string;
  }>;
  driverReports: Array<{
    driverId: string;
    name: string;
    phone: string;
    trips: number;
    completedTrips: number;
    status: string;
  }>;
  totalCaptured: number;
}

const ALL_CATEGORIES: VehicleCategory[] = [
  'Cars',
  'SUVs',
  'Premium Cars',
  'Tempo Travellers',
  'Mini Buses',
  'Luxury Buses',
  'Large Passenger Buses',
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  token,
  initialTab,
  onFleetUpdated,
  onSessionUpdated,
}) => {
  const [tab, setTab] = useState<AdminTab>(initialTab || 'overview');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [kpis, setKpis] = useState<AdminOverviewKpis | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Array<Driver & { tripCount?: number }>>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pricing, setPricing] = useState<PricingConfig | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [reports, setReports] = useState<ReportsPayload | null>(null);
  const [siteSettings, setSiteSettings] = useState<WebsiteSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<string | null>(null);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [gTitle, setGTitle] = useState('');
  const [gCategory, setGCategory] = useState<GalleryCategory>('Fleet Showcase');
  const [gRoute, setGRoute] = useState('');
  const [gRecCategory, setGRecCategory] = useState<VehicleCategory | ''>('');
  const [gCaption, setGCaption] = useState('');
  const [gImageUrl, setGImageUrl] = useState('');
  const [gFeatured, setGFeatured] = useState(false);
  const [uploadingGalleryImg, setUploadingGalleryImg] = useState(false);

  // Services & Upcoming Services state
  const [adminServices, setAdminServices] = useState<TravelService[]>([]);
  const [sTitle, setSTitle] = useState('');
  const [sTagline, setSTagline] = useState('');
  const [sDesc, setSDesc] = useState('');
  const [sStatus, setSStatus] = useState<ServiceStatus>('Upcoming');
  const [sLaunchWindow, setSLaunchWindow] = useState('Launching Q1 2027');
  const [sTripType, setSTripType] = useState<TripType>('Round Trip');
  const [sDefaultCat, setSDefaultCat] = useState<VehicleCategory>('SUVs');
  const [sPassengerRange, setSPassengerRange] = useState('1–17 Passengers');
  const [sIdealFleet, setSIdealFleet] = useState('Innova Hycross · Urbania');
  const [sImageUrl, setSImageUrl] = useState('/src/assets/images/service_ev_fleet_upcoming_1795613750837.jpg');
  const [sHighlights, setSHighlights] = useState('');
  const [uploadingServiceImg, setUploadingServiceImg] = useState(false);

  // Featured Destinations state
  const [adminDestinations, setAdminDestinations] = useState<FeaturedDestination[]>([]);
  const [dstName, setDstName] = useState('');
  const [dstRegion, setDstRegion] = useState('');
  const [dstRoute, setDstRoute] = useState('');
  const [dstDistanceKm, setDstDistanceKm] = useState(120);
  const [dstDuration, setDstDuration] = useState('3 hrs drive');
  const [dstDropAddress, setDstDropAddress] = useState('');
  const [dstDropLat, setDstDropLat] = useState(18.3273);
  const [dstDropLng, setDstDropLng] = useState(82.8775);
  const [dstCategory, setDstCategory] = useState<VehicleCategory>('SUVs');
  const [dstTripType, setDstTripType] = useState<TripType>('Round Trip');
  const [dstEstimate, setDstEstimate] = useState('From ₹19/km · SUV & Van Ready');
  const [dstDescription, setDstDescription] = useState('');
  const [dstHighlights, setDstHighlights] = useState('');
  const [dstImageUrl, setDstImageUrl] = useState('/src/assets/images/dest_araku_valley_1795613749816.jpg');
  const [dstFeatured, setDstFeatured] = useState(true);
  const [uploadingDestImg, setUploadingDestImg] = useState(false);

  // Travel Packages state
  const [adminPackages, setAdminPackages] = useState<TravelPackage[]>([]);
  const [pkgTitle, setPkgTitle] = useState('');
  const [pkgSubtitle, setPkgSubtitle] = useState('');
  const [pkgType, setPkgType] = useState<PackageType>('City & Sightseeing');
  const [pkgDuration, setPkgDuration] = useState('1 Night / 2 Days');
  const [pkgDistanceKm, setPkgDistanceKm] = useState(240);
  const [pkgDropAddress, setPkgDropAddress] = useState('');
  const [pkgCategory, setPkgCategory] = useState<VehicleCategory>('SUVs');
  const [pkgTripType, setPkgTripType] = useState<TripType>('Round Trip');
  const [pkgPassengers, setPkgPassengers] = useState(6);
  const [pkgPrice, setPkgPrice] = useState(7500);
  const [pkgUnitLabel, setPkgUnitLabel] = useState('AC SUV (up to 6 pax)');
  const [pkgImageUrl, setPkgImageUrl] = useState('/src/assets/images/dest_araku_valley_1795613749816.jpg');
  const [pkgHighlights, setPkgHighlights] = useState('');
  const [pkgFeatured, setPkgFeatured] = useState(true);
  const [uploadingPkgImg, setUploadingPkgImg] = useState(false);

  // Vehicle form state
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vName, setVName] = useState('');
  const [vModel, setVModel] = useState('');
  const [vReg, setVReg] = useState('');
  const [vCategory, setVCategory] = useState<VehicleCategory>('Cars');
  const [vSeats, setVSeats] = useState(4);
  const [vBags, setVBags] = useState(3);
  const [vAc, setVAc] = useState(true);
  const [vTransmission, setVTransmission] = useState<'Automatic' | 'Manual'>('Automatic');
  const [vStatus, setVStatus] = useState<Vehicle['status']>('Available');
  const [vDriverId, setVDriverId] = useState('');
  const [vImageUrl, setVImageUrl] = useState('');
  const [vCustomPerKm, setVCustomPerKm] = useState('');
  const [vCustomPerDay, setVCustomPerDay] = useState('');
  const [uploadingImg, setUploadingImg] = useState(false);

  // Driver form state
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [dName, setDName] = useState('');
  const [dPhone, setDPhone] = useState('');
  const [dEmail, setDEmail] = useState('');
  const [dLicense, setDLicense] = useState('');
  const [dExpiry, setDExpiry] = useState('2030-12-31');
  const [dExpYears, setDExpYears] = useState(6);
  const [dAvailable, setDAvailable] = useState(true);

  // Admin Credentials & Customer Reset state
  const [adminCredInfo, setAdminCredInfo] = useState<AdminCredentialInfo | null>(null);
  const [credName, setCredName] = useState('');
  const [credEmail, setCredEmail] = useState('');
  const [credCurrentPassword, setCredCurrentPassword] = useState('');
  const [credNewPassword, setCredNewPassword] = useState('');
  const [credConfirmPassword, setCredConfirmPassword] = useState('');
  const [savingCreds, setSavingCreds] = useState(false);
  const [generatedAdminKey, setGeneratedAdminKey] = useState<string | null>(null);
  const [copiedAdminKey, setCopiedAdminKey] = useState(false);
  const [issuedCustomerReset, setIssuedCustomerReset] = useState<{
    resetCode: string;
    expiresAt: string;
    customerName: string;
    customerEmail: string;
  } | null>(null);
  const [copiedCustomerCode, setCopiedCustomerCode] = useState(false);

  const loadAllAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, veh, drv, bkg, prc, cst, pay, enq, rep, setRes, galRes, srvRes, dstRes, pkgRes, credRes] = await Promise.all([
        apiFetch<{ kpis: AdminOverviewKpis }>('/api/admin/overview', {}, token),
        apiFetch<{ vehicles: Vehicle[] }>('/api/admin/vehicles', {}, token),
        apiFetch<{ drivers: Array<Driver & { tripCount?: number }> }>('/api/admin/drivers', {}, token),
        apiFetch<{ bookings: Booking[] }>('/api/admin/bookings', {}, token),
        apiFetch<{ pricing: PricingConfig }>('/api/pricing', {}, token),
        apiFetch<{ customers: CustomerRow[] }>('/api/admin/customers', {}, token),
        apiFetch<{ payments: PaymentRecord[] }>('/api/admin/payments', {}, token),
        apiFetch<{ enquiries: Enquiry[] }>('/api/admin/enquiries', {}, token),
        apiFetch<ReportsPayload>('/api/admin/reports', {}, token),
        apiFetch<{ settings: WebsiteSettings }>('/api/settings', {}, token),
        apiFetch<{ gallery: GalleryItem[] }>('/api/gallery', {}, token),
        apiFetch<{ services: TravelService[] }>('/api/admin/services', {}, token),
        apiFetch<{ destinations: FeaturedDestination[] }>('/api/admin/destinations', {}, token),
        apiFetch<{ packages: TravelPackage[] }>('/api/admin/packages', {}, token),
        apiFetch<{ credentials: AdminCredentialInfo }>('/api/auth/admin/credentials', {}, token),
      ]);
      setKpis(ov.kpis);
      setVehicles(veh.vehicles);
      setDrivers(drv.drivers);
      setBookings(bkg.bookings);
      setPricing(prc.pricing);
      setCustomers(cst.customers);
      setPayments(pay.payments);
      setEnquiries(enq.enquiries);
      setReports(rep);
      setSiteSettings(setRes.settings);
      setGalleryItems(galRes.gallery);
      setAdminServices(srvRes.services);
      setAdminDestinations(dstRes.destinations);
      setAdminPackages(pkgRes.packages);
      setAdminCredInfo(credRes.credentials);
      setCredName(credRes.credentials.name);
      setCredEmail(credRes.credentials.email);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    void loadAllAdminData();
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadAllAdminData();
      }
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadAllAdminData();
      }
    }, 20000);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token]);

  const handleUpdateAdminCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (credNewPassword && credNewPassword.length < 6) {
      setError('New administrator password must be at least 6 characters.');
      return;
    }
    if (credNewPassword && credNewPassword !== credConfirmPassword) {
      setError('New administrator password and confirmation do not match.');
      return;
    }
    setSavingCreds(true);
    try {
      const res = await apiFetch<{
        token: string;
        user: UserProfile;
        credentials: AdminCredentialInfo;
      }>(
        '/api/auth/admin/change-credentials',
        {
          method: 'POST',
          body: JSON.stringify({
            currentPassword: credCurrentPassword,
            name: credName,
            email: credEmail,
            ...(credNewPassword ? { newPassword: credNewPassword } : {}),
          }),
        },
        token
      );
      setAdminCredInfo(res.credentials);
      setCredCurrentPassword('');
      setCredNewPassword('');
      setCredConfirmPassword('');
      setNotice('Administrator credentials updated and active.');
      onSessionUpdated?.(res.token, res.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingCreds(false);
    }
  };

  const handleRegenerateAdminRecoveryKey = async () => {
    setError(null);
    setNotice(null);
    if (!credCurrentPassword) {
      setError('Enter your Current Admin Password above before generating a new Recovery Key.');
      return;
    }
    setSavingCreds(true);
    try {
      const res = await apiFetch<{
        token: string;
        user: UserProfile;
        credentials: AdminCredentialInfo;
        newRecoveryKey?: string;
      }>(
        '/api/auth/admin/change-credentials',
        {
          method: 'POST',
          body: JSON.stringify({
            currentPassword: credCurrentPassword,
            regenerateRecoveryKey: true,
          }),
        },
        token
      );
      setAdminCredInfo(res.credentials);
      setCredCurrentPassword('');
      if (res.newRecoveryKey) {
        setGeneratedAdminKey(res.newRecoveryKey);
      }
      setNotice('New one-time Admin Recovery Key generated. Save it securely below.');
      onSessionUpdated?.(res.token, res.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingCreds(false);
    }
  };

  const handleGenerateCustomerResetCode = async (customer: CustomerRow) => {
    setError(null);
    try {
      const res = await apiFetch<{
        resetCode: string;
        expiresAt: string;
        customerName: string;
        customerEmail: string;
      }>(`/api/admin/customers/${customer.id}/reset-code`, { method: 'POST' }, token);
      setIssuedCustomerReset(res);
      setCopiedCustomerCode(false);
      setNotice(`15-minute password reset code generated for ${customer.email}.`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const openNewVehicleForm = () => {
    setEditingVehicle(null);
    setVName('');
    setVModel('');
    setVReg('');
    setVCategory('Cars');
    setVSeats(4);
    setVBags(3);
    setVAc(true);
    setVTransmission('Automatic');
    setVStatus('Available');
    setVDriverId('');
    setVImageUrl('');
    setVCustomPerKm('');
    setVCustomPerDay('');
    setShowVehicleForm(true);
  };

  const openEditVehicleForm = (v: Vehicle) => {
    setEditingVehicle(v);
    setVName(v.name);
    setVModel(v.model);
    setVReg(v.registrationNumber);
    setVCategory(v.category);
    setVSeats(v.seatingCapacity);
    setVBags(v.luggageCapacity);
    setVAc(v.ac);
    setVTransmission(v.transmission);
    setVStatus(v.status);
    setVDriverId(v.assignedDriverId || '');
    setVImageUrl(v.images[0] || '');
    setVCustomPerKm(v.customPerKmRate ? String(v.customPerKmRate) : '');
    setVCustomPerDay(v.customPerDayRate ? String(v.customPerDayRate) : '');
    setShowVehicleForm(true);
  };

  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    setError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
      });
      const res = await apiFetch<{ url: string }>(
        '/api/admin/upload',
        { method: 'POST', body: JSON.stringify({ dataUrl }) },
        token
      );
      setVImageUrl(res.url);
      setNotice('Vehicle photo uploaded.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadingImg(false);
    }
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        name: vName,
        model: vModel,
        registrationNumber: vReg,
        category: vCategory,
        seatingCapacity: vSeats,
        luggageCapacity: vBags,
        ac: vAc,
        transmission: vTransmission,
        status: vStatus,
        assignedDriverId: vDriverId || undefined,
        images: vImageUrl ? [vImageUrl] : undefined,
        customPerKmRate: vCustomPerKm ? Number(vCustomPerKm) : undefined,
        customPerDayRate: vCustomPerDay ? Number(vCustomPerDay) : undefined,
      };
      if (editingVehicle) {
        await apiFetch(
          `/api/admin/vehicles/${editingVehicle.id}`,
          { method: 'PATCH', body: JSON.stringify(payload) },
          token
        );
        setNotice(`Updated ${vName}.`);
      } else {
        await apiFetch('/api/admin/vehicles', { method: 'POST', body: JSON.stringify(payload) }, token);
        setNotice(`Added ${vName} to fleet.`);
      }
      setShowVehicleForm(false);
      await loadAllAdminData();
      onFleetUpdated();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    try {
      await apiFetch(`/api/admin/vehicles/${id}`, { method: 'DELETE' }, token);
      setNotice('Vehicle removed from active fleet.');
      await loadAllAdminData();
      onFleetUpdated();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleUpdateBooking = async (
    id: string,
    patch: { bookingStatus?: BookingStatus; driverId?: string; vehicleId?: string }
  ) => {
    setError(null);
    try {
      await apiFetch(`/api/admin/bookings/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }, token);
      setNotice('Booking updated.');
      await loadAllAdminData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const openNewDriverForm = () => {
    setEditingDriver(null);
    setDName('');
    setDPhone('');
    setDEmail('');
    setDLicense('');
    setDExpiry('2030-12-31');
    setDExpYears(6);
    setDAvailable(true);
    setShowDriverForm(true);
  };

  const openEditDriverForm = (d: Driver) => {
    setEditingDriver(d);
    setDName(d.name);
    setDPhone(d.phone);
    setDEmail(d.email);
    setDLicense(d.licenseNumber);
    setDExpiry(d.licenseExpiry);
    setDExpYears(d.experienceYears);
    setDAvailable(d.available);
    setShowDriverForm(true);
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        name: dName,
        phone: dPhone,
        email: dEmail,
        licenseNumber: dLicense,
        licenseExpiry: dExpiry,
        experienceYears: dExpYears,
        available: dAvailable,
      };
      if (editingDriver) {
        await apiFetch(
          `/api/admin/drivers/${editingDriver.id}`,
          { method: 'PATCH', body: JSON.stringify(payload) },
          token
        );
        setNotice(`Driver ${dName} updated.`);
      } else {
        await apiFetch('/api/admin/drivers', { method: 'POST', body: JSON.stringify(payload) }, token);
        setNotice(`Driver ${dName} added.`);
      }
      setShowDriverForm(false);
      await loadAllAdminData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSavePricing = async () => {
    if (!pricing) return;
    setError(null);
    try {
      const res = await apiFetch<{ pricing: PricingConfig }>(
        '/api/admin/pricing',
        { method: 'PUT', body: JSON.stringify({ pricing }) },
        token
      );
      setPricing(res.pricing);
      setNotice('Dynamic pricing rules and Razorpay advance percentage saved.');
      onFleetUpdated();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRefundPayment = async (payment: PaymentRecord) => {
    try {
      await apiFetch(
        `/api/admin/payments/${payment.id}/refund`,
        {
          method: 'POST',
          body: JSON.stringify({ refundAmount: payment.amount, refundNote: 'Processed via Admin Console' }),
        },
        token
      );
      setNotice(`Refund recorded for ${payment.bookingCode}.`);
      await loadAllAdminData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleEnquiryStatus = async (id: string, status: Enquiry['status']) => {
    try {
      await apiFetch(`/api/admin/enquiries/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }, token);
      await loadAllAdminData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleUploadSettingAsset = async (
    target: 'logo' | 'hero',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !siteSettings) return;
    setUploadingAsset(target);
    setError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
      });
      const res = await apiFetch<{ url: string }>(
        '/api/admin/upload',
        { method: 'POST', body: JSON.stringify({ dataUrl }) },
        token
      );
      if (target === 'logo') {
        setSiteSettings({ ...siteSettings, logoUrl: res.url });
      } else {
        const updatedSlides = (siteSettings.heroSlides || []).map((sl, idx) =>
          idx === 0 ? { ...sl, imageUrl: res.url } : sl
        );
        setSiteSettings({
          ...siteSettings,
          heroBannerUrl: res.url,
          heroSlides: updatedSlides,
        });
      }
      setNotice(
        `${target === 'logo' ? 'Brand logo' : 'Hero banner'} uploaded. Click Save Website Settings to publish.`
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadingAsset(null);
      e.target.value = '';
    }
  };

  const handleUploadSlideImage = async (
    slideIndex: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !siteSettings) return;
    setUploadingAsset(`slide-${slideIndex}`);
    setError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
      });
      const res = await apiFetch<{ url: string }>(
        '/api/admin/upload',
        { method: 'POST', body: JSON.stringify({ dataUrl }) },
        token
      );
      const nextSlides = [...(siteSettings.heroSlides || [])];
      if (nextSlides[slideIndex]) {
        nextSlides[slideIndex] = { ...nextSlides[slideIndex], imageUrl: res.url };
      }
      setSiteSettings({
        ...siteSettings,
        ...(slideIndex === 0 ? { heroBannerUrl: res.url } : {}),
        heroSlides: nextSlides,
      });
      setNotice(`Banner image for Slide 0${slideIndex + 1} uploaded. Click Save Website Settings to publish.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadingAsset(null);
      e.target.value = '';
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteSettings) return;
    setSavingSettings(true);
    setError(null);
    try {
      const res = await apiFetch<{ settings: WebsiteSettings }>(
        '/api/admin/settings',
        { method: 'PUT', body: JSON.stringify({ settings: siteSettings }) },
        token
      );
      setSiteSettings(res.settings);
      setNotice('Website settings published and active across the storefront.');
      onFleetUpdated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetSettings = async () => {
    setSavingSettings(true);
    setError(null);
    try {
      const res = await apiFetch<{ settings: WebsiteSettings }>(
        '/api/admin/settings/reset',
        { method: 'POST' },
        token
      );
      setSiteSettings(res.settings);
      setNotice('Website settings restored to Vizag Jagan Travels defaults.');
      onFleetUpdated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUploadGalleryImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingGalleryImg(true);
    setError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
      });
      const res = await apiFetch<{ url: string }>(
        '/api/admin/upload',
        { method: 'POST', body: JSON.stringify({ dataUrl }) },
        token
      );
      setGImageUrl(res.url);
      setNotice('Gallery photo uploaded. Add title & caption then click Publish Photo.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadingGalleryImg(false);
    }
  };

  const handleAddGalleryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch(
        '/api/admin/gallery',
        {
          method: 'POST',
          body: JSON.stringify({
            title: gTitle,
            category: gCategory,
            routeOrContext: gRoute,
            recommendedCategory: gRecCategory || undefined,
            caption: gCaption,
            imageUrl: gImageUrl,
            featured: gFeatured,
          }),
        },
        token
      );
      setGTitle('');
      setGRoute('');
      setGCaption('');
      setGImageUrl('');
      setGRecCategory('');
      setGFeatured(false);
      setNotice('Photo added to live fleet gallery.');
      await loadAllAdminData();
      onFleetUpdated();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDeleteGalleryItem = async (id: string) => {
    setError(null);
    try {
      await apiFetch(`/api/admin/gallery/${id}`, { method: 'DELETE' }, token);
      setNotice('Photo removed from fleet gallery.');
      await loadAllAdminData();
      onFleetUpdated();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleUploadServiceImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingServiceImg(true);
    setError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
      });
      const res = await apiFetch<{ url: string }>(
        '/api/admin/upload',
        { method: 'POST', body: JSON.stringify({ dataUrl }) },
        token
      );
      setSImageUrl(res.url);
      setNotice('Service photo uploaded.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadingServiceImg(false);
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const highlightsArr = sHighlights
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      await apiFetch(
        '/api/admin/services',
        {
          method: 'POST',
          body: JSON.stringify({
            title: sTitle,
            tagline: sTagline,
            desc: sDesc,
            status: sStatus,
            launchWindow: sStatus === 'Upcoming' ? sLaunchWindow : undefined,
            tripType: sTripType,
            defaultCategory: sDefaultCat,
            passengerRange: sPassengerRange,
            idealFleet: sIdealFleet,
            imageUrl: sImageUrl,
            highlights: highlightsArr,
          }),
        },
        token
      );
      setSTitle('');
      setSTagline('');
      setSDesc('');
      setSHighlights('');
      setNotice(`Service (${sStatus}) published to storefront.`);
      await loadAllAdminData();
      onFleetUpdated();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleUpdateServiceStatus = async (id: string, status: ServiceStatus) => {
    setError(null);
    try {
      await apiFetch(
        `/api/admin/services/${id}`,
        { method: 'PATCH', body: JSON.stringify({ status }) },
        token
      );
      setNotice(`Service status changed to ${status}.`);
      await loadAllAdminData();
      onFleetUpdated();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDeleteService = async (id: string) => {
    setError(null);
    try {
      await apiFetch(`/api/admin/services/${id}`, { method: 'DELETE' }, token);
      setNotice('Service removed.');
      await loadAllAdminData();
      onFleetUpdated();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleUploadDestImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDestImg(true);
    setError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
      });
      const res = await apiFetch<{ url: string }>(
        '/api/admin/upload',
        { method: 'POST', body: JSON.stringify({ dataUrl }) },
        token
      );
      setDstImageUrl(res.url);
      setNotice('Destination photo uploaded.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadingDestImg(false);
    }
  };

  const handleAddDestination = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const highlightsArr = dstHighlights
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      await apiFetch(
        '/api/admin/destinations',
        {
          method: 'POST',
          body: JSON.stringify({
            name: dstName,
            region: dstRegion,
            routeSummary: dstRoute,
            distanceKm: dstDistanceKm,
            durationText: dstDuration,
            dropAddress: dstDropAddress || dstName,
            dropLat: dstDropLat,
            dropLng: dstDropLng,
            recommendedCategory: dstCategory,
            recommendedTripType: dstTripType,
            startingEstimateLabel: dstEstimate,
            description: dstDescription,
            highlights: highlightsArr,
            imageUrl: dstImageUrl,
            featured: dstFeatured,
            active: true,
          }),
        },
        token
      );
      setDstName('');
      setDstRegion('');
      setDstRoute('');
      setDstDropAddress('');
      setDstDescription('');
      setDstHighlights('');
      setNotice('Featured destination published.');
      await loadAllAdminData();
      onFleetUpdated();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleToggleDestination = async (
    id: string,
    patch: { featured?: boolean; active?: boolean }
  ) => {
    setError(null);
    try {
      await apiFetch(
        `/api/admin/destinations/${id}`,
        { method: 'PATCH', body: JSON.stringify(patch) },
        token
      );
      await loadAllAdminData();
      onFleetUpdated();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDeleteDestination = async (id: string) => {
    setError(null);
    try {
      await apiFetch(`/api/admin/destinations/${id}`, { method: 'DELETE' }, token);
      setNotice('Destination removed.');
      await loadAllAdminData();
      onFleetUpdated();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleUploadPkgImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPkgImg(true);
    setError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
      });
      const res = await apiFetch<{ url: string }>(
        '/api/admin/upload',
        { method: 'POST', body: JSON.stringify({ dataUrl }) },
        token
      );
      setPkgImageUrl(res.url);
      setNotice('Package photo uploaded.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadingPkgImg(false);
    }
  };

  const handleAddPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const highlightsArr = pkgHighlights
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      await apiFetch(
        '/api/admin/packages',
        {
          method: 'POST',
          body: JSON.stringify({
            title: pkgTitle,
            subtitle: pkgSubtitle,
            packageType: pkgType,
            durationLabel: pkgDuration,
            distanceKm: pkgDistanceKm,
            dropAddress: pkgDropAddress || pkgTitle,
            recommendedCategory: pkgCategory,
            recommendedTripType: pkgTripType,
            passengerCount: pkgPassengers,
            packagePriceInr: pkgPrice,
            priceUnitLabel: pkgUnitLabel,
            imageUrl: pkgImageUrl,
            itineraryHighlights: highlightsArr,
            featured: pkgFeatured,
            active: true,
          }),
        },
        token
      );
      setPkgTitle('');
      setPkgSubtitle('');
      setPkgDropAddress('');
      setPkgHighlights('');
      setNotice('Travel package published.');
      await loadAllAdminData();
      onFleetUpdated();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleTogglePackage = async (id: string, patch: { featured?: boolean; active?: boolean }) => {
    setError(null);
    try {
      await apiFetch(`/api/admin/packages/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }, token);
      await loadAllAdminData();
      onFleetUpdated();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDeletePackage = async (id: string) => {
    setError(null);
    try {
      await apiFetch(`/api/admin/packages/${id}`, { method: 'DELETE' }, token);
      setNotice('Package removed.');
      await loadAllAdminData();
      onFleetUpdated();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const navItems: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'fleet', label: 'Fleet', icon: <Bus className="w-4 h-4" /> },
    { id: 'packages', label: 'Packages', icon: <Package className="w-4 h-4" /> },
    { id: 'services', label: 'Services & Upcoming', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'destinations', label: 'Destinations', icon: <Compass className="w-4 h-4" /> },
    { id: 'gallery', label: 'Gallery', icon: <Camera className="w-4 h-4" /> },
    { id: 'bookings', label: 'Bookings', icon: <CalendarCheck className="w-4 h-4" /> },
    { id: 'drivers', label: 'Drivers', icon: <UserCheck className="w-4 h-4" /> },
    { id: 'pricing', label: 'Pricing', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'customers', label: 'Customers', icon: <Users className="w-4 h-4" /> },
    { id: 'payments', label: 'Payments', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'enquiries', label: 'Enquiries', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'reports', label: 'Reports', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'credentials', label: 'Admin Credentials', icon: <KeyRound className="w-4 h-4" /> },
    { id: 'settings', label: 'Website Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <section className="bg-[#F5F7FA] min-h-[85vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Sidebar Navigation */}
          <aside className="w-full lg:w-60 shrink-0 bg-white border border-slate-200 rounded-xl p-3">
            <div className="px-3 py-2.5 border-b border-slate-100 mb-2">
              <p className="text-xs font-semibold text-[#2563EB]">Operations Console</p>
              <p className="text-sm font-bold text-[#102A43]">Fleet Administration</p>
            </div>
            <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    tab === item.id
                      ? 'bg-[#102A43] text-white'
                      : 'text-slate-600 hover:bg-[#F5F7FA] hover:text-[#102A43]'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main Admin Viewport */}
          <div className="flex-1 min-w-0 w-full space-y-5">
            <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-[#102A43] capitalize">{tab} Management</h1>
                <p className="text-xs text-slate-500">Live company fleet, dispatch, pricing, and revenue records</p>
              </div>
              <button
                type="button"
                onClick={loadAllAdminData}
                className="px-3.5 py-2 text-xs font-semibold bg-[#F5F7FA] hover:bg-slate-200 text-[#102A43] rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh Data
              </button>
            </div>

            {notice && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-2.5 rounded-xl text-xs flex justify-between items-center">
                <span>{notice}</span>
                <button type="button" onClick={() => setNotice(null)} className="underline font-semibold cursor-pointer">
                  Dismiss
                </button>
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-2.5 rounded-xl text-xs flex justify-between items-center">
                <span>{error}</span>
                <button type="button" onClick={() => setError(null)} className="underline font-semibold cursor-pointer">
                  Dismiss
                </button>
              </div>
            )}

            {/* OVERVIEW TAB */}
            {tab === 'overview' && kpis && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Vehicles', value: kpis.totalVehicles },
                    { label: 'Available Vehicles', value: kpis.availableVehicles },
                    { label: 'Booked Vehicles', value: kpis.bookedVehicles },
                    { label: 'Total Bookings', value: kpis.totalBookings },
                    { label: "Today's Trips", value: kpis.todaysTrips },
                    { label: 'Upcoming Trips', value: kpis.upcomingTrips },
                    { label: 'Total Revenue', value: formatINR(kpis.totalRevenue) },
                    { label: 'Pending Enquiries', value: kpis.pendingEnquiries },
                  ].map((m) => (
                    <div key={m.label} className="bg-white border border-slate-200 rounded-xl p-4">
                      <p className="text-xs text-slate-500">{m.label}</p>
                      <p className="text-2xl font-bold text-[#102A43] tabular-nums mt-1">{m.value}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-bold text-[#102A43]">Recent Bookings Queue</h2>
                    <button
                      type="button"
                      onClick={() => setTab('bookings')}
                      className="text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
                    >
                      Manage All →
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 text-slate-500">
                        <tr>
                          <th className="py-2 pr-3">Code</th>
                          <th className="py-2 pr-3">Customer</th>
                          <th className="py-2 pr-3">Vehicle</th>
                          <th className="py-2 pr-3">Date</th>
                          <th className="py-2 pr-3">Status</th>
                          <th className="py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bookings.slice(0, 6).map((b) => (
                          <tr key={b.id}>
                            <td className="py-2.5 pr-3 font-mono font-semibold text-[#102A43]">{b.bookingCode}</td>
                            <td className="py-2.5 pr-3">{b.customerName}</td>
                            <td className="py-2.5 pr-3">{b.vehicleName}</td>
                            <td className="py-2.5 pr-3 tabular-nums">{b.journeyDate}</td>
                            <td className="py-2.5 pr-3 font-semibold text-[#2563EB]">{b.bookingStatus}</td>
                            <td className="py-2.5 text-right font-bold tabular-nums">{formatINR(b.totalFare)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* FLEET MANAGEMENT TAB */}
            {tab === 'fleet' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-slate-600">{vehicles.length} company-owned vehicles configured</p>
                  <button
                    type="button"
                    onClick={openNewVehicleForm}
                    className="px-4 py-2 bg-[#102A43] hover:bg-[#1a3c5e] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Add Car / Bus
                  </button>
                </div>

                {showVehicleForm && (
                  <form onSubmit={handleSaveVehicle} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                    <h2 className="text-base font-bold text-[#102A43]">
                      {editingVehicle ? `Edit ${editingVehicle.name}` : 'Add New Fleet Vehicle'}
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Vehicle Name *</label>
                        <input type="text" required value={vName} onChange={(e) => setVName(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Model & Year *</label>
                        <input type="text" required value={vModel} onChange={(e) => setVModel(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Registration No. *</label>
                        <input type="text" required value={vReg} onChange={(e) => setVReg(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Category *</label>
                        <select value={vCategory} onChange={(e) => setVCategory(e.target.value as VehicleCategory)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg">
                          {ALL_CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Seating Capacity</label>
                        <input type="number" min={2} max={60} value={vSeats} onChange={(e) => setVSeats(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Luggage Capacity</label>
                        <input type="number" min={1} max={60} value={vBags} onChange={(e) => setVBags(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">AC / Non-AC</label>
                        <select value={vAc ? 'true' : 'false'} onChange={(e) => setVAc(e.target.value === 'true')} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg">
                          <option value="true">Air Conditioned (AC)</option>
                          <option value="false">Non-AC</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                        <select value={vStatus} onChange={(e) => setVStatus(e.target.value as Vehicle['status'])} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg">
                          <option value="Available">Available</option>
                          <option value="Booked">Booked</option>
                          <option value="Maintenance">Maintenance</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Assigned Driver</label>
                        <select value={vDriverId} onChange={(e) => setVDriverId(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg">
                          <option value="">Unassigned</option>
                          {drivers.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Custom Per-KM Override (Optional)</label>
                        <input type="number" value={vCustomPerKm} onChange={(e) => setVCustomPerKm(e.target.value)} placeholder="Use category default" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Custom Bus/Day Override (Optional)</label>
                        <input type="number" value={vCustomPerDay} onChange={(e) => setVCustomPerDay(e.target.value)} placeholder="Use category default" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Upload Vehicle Photo</label>
                        <label className="w-full px-3 py-2 text-xs font-semibold bg-[#F5F7FA] hover:bg-slate-200 border border-slate-200 rounded-lg flex items-center justify-center gap-2 cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          {uploadingImg ? 'Uploading...' : vImageUrl ? 'Photo Ready (Replace)' : 'Choose Image File'}
                          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageFileUpload} className="hidden" />
                        </label>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setShowVehicleForm(false)} className="px-4 py-2 text-xs font-semibold bg-[#F5F7FA] text-[#102A43] rounded-lg cursor-pointer">
                        Cancel
                      </button>
                      <button type="submit" className="px-5 py-2 text-xs font-semibold bg-[#2563EB] text-white rounded-lg cursor-pointer">
                        Save Vehicle
                      </button>
                    </div>
                  </form>
                )}

                <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 text-slate-500 bg-[#F5F7FA]">
                      <tr>
                        <th className="py-3 px-4">Vehicle</th>
                        <th className="py-3 px-3">Category</th>
                        <th className="py-3 px-3">Capacity</th>
                        <th className="py-3 px-3">AC</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {vehicles.map((v) => (
                        <tr key={v.id}>
                          <td className="py-3 px-4">
                            <p className="font-bold text-[#102A43]">{v.name}</p>
                            <p className="text-slate-500 font-mono text-[11px]">{v.registrationNumber}</p>
                          </td>
                          <td className="py-3 px-3">{v.category}</td>
                          <td className="py-3 px-3 tabular-nums">{v.seatingCapacity} Seats</td>
                          <td className="py-3 px-3">{v.ac ? 'AC' : 'Non-AC'}</td>
                          <td className="py-3 px-3">
                            <select
                              value={v.status}
                              onChange={async (e) => {
                                await apiFetch(
                                  `/api/admin/vehicles/${v.id}`,
                                  { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) },
                                  token
                                );
                                await loadAllAdminData();
                                onFleetUpdated();
                              }}
                              className="px-2 py-1 border border-slate-200 rounded text-xs font-semibold"
                            >
                              <option value="Available">Available</option>
                              <option value="Booked">Booked</option>
                              <option value="Maintenance">Maintenance</option>
                              <option value="Inactive">Inactive</option>
                            </select>
                          </td>
                          <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openEditVehicleForm(v)}
                              className="p-1.5 text-[#2563EB] hover:bg-blue-50 rounded cursor-pointer"
                              aria-label={`Edit ${v.name}`}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteVehicle(v.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                              aria-label={`Delete ${v.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* BOOKING MANAGEMENT TAB */}
            {tab === 'bookings' && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-500 bg-[#F5F7FA]">
                    <tr>
                      <th className="py-3 px-4">Booking</th>
                      <th className="py-3 px-3">Customer</th>
                      <th className="py-3 px-3">Route & Date</th>
                      <th className="py-3 px-3">Vehicle & Driver</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Fare / Paid</th>
                      <th className="py-3 px-4 text-right">Invoice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bookings.map((b) => (
                      <tr key={b.id}>
                        <td className="py-3 px-4">
                          <p className="font-mono font-bold text-[#102A43]">{b.bookingCode}</p>
                          <p className="text-slate-500">{b.tripType}</p>
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-[#102A43]">{b.customerName}</p>
                          <p className="text-slate-500">{b.customerPhone}</p>
                        </td>
                        <td className="py-3 px-3 max-w-xs">
                          <p className="truncate font-medium">{b.pickupLocation} → {b.dropLocation}</p>
                          <p className="text-slate-500 tabular-nums">{b.journeyDate} · {b.journeyTime}</p>
                        </td>
                        <td className="py-3 px-3 space-y-1">
                          <select
                            value={b.vehicleId}
                            onChange={(e) => handleUpdateBooking(b.id, { vehicleId: e.target.value })}
                            className="w-40 px-2 py-1 border border-slate-200 rounded text-[11px]"
                          >
                            {vehicles.map((v) => (
                              <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                          </select>
                          <select
                            value={b.driverId || ''}
                            onChange={(e) => handleUpdateBooking(b.id, { driverId: e.target.value })}
                            className="w-40 px-2 py-1 border border-slate-200 rounded text-[11px] block"
                          >
                            <option value="">Assign Driver...</option>
                            {drivers.map((d) => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-3">
                          <select
                            value={b.bookingStatus}
                            onChange={(e) => handleUpdateBooking(b.id, { bookingStatus: e.target.value as BookingStatus })}
                            className="px-2 py-1 border border-slate-200 rounded text-[11px] font-semibold"
                          >
                            {[
                              'Pending',
                              'Confirmed',
                              'Driver Assigned',
                              'In Progress',
                              'Completed',
                              'Cancellation Requested',
                              'Cancelled',
                              'Rejected',
                            ].map((st) => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                          <p className="text-[11px] text-slate-500 mt-1">{b.paymentStatus}</p>
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums">
                          <p className="font-bold text-[#102A43]">{formatINR(b.totalFare)}</p>
                          <p className="text-emerald-700">{formatINR(b.paidAmount)} paid</p>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => downloadBookingInvoicePdf(b, siteSettings)}
                            className="px-2.5 py-1.5 bg-[#F5F7FA] hover:bg-slate-200 text-[#102A43] rounded font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* DRIVERS MANAGEMENT TAB */}
            {tab === 'drivers' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-slate-600">{drivers.length} employed chauffeurs & coach captains</p>
                  <button
                    type="button"
                    onClick={openNewDriverForm}
                    className="px-4 py-2 bg-[#102A43] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Add Driver
                  </button>
                </div>

                {showDriverForm && (
                  <form onSubmit={handleSaveDriver} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <input type="text" required placeholder="Driver Name *" value={dName} onChange={(e) => setDName(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg" />
                    <input type="tel" required placeholder="Mobile *" value={dPhone} onChange={(e) => setDPhone(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg" />
                    <input type="email" placeholder="Email" value={dEmail} onChange={(e) => setDEmail(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg" />
                    <input type="text" required placeholder="License Number *" value={dLicense} onChange={(e) => setDLicense(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg" />
                    <input type="date" value={dExpiry} onChange={(e) => setDExpiry(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg" />
                    <input type="number" min={1} value={dExpYears} onChange={(e) => setDExpYears(Number(e.target.value))} placeholder="Years Experience" className="px-3 py-2 text-sm border border-slate-200 rounded-lg" />
                    <div className="sm:col-span-3 flex justify-end gap-2">
                      <button type="button" onClick={() => setShowDriverForm(false)} className="px-4 py-2 text-xs font-semibold bg-[#F5F7FA] rounded-lg cursor-pointer">Cancel</button>
                      <button type="submit" className="px-4 py-2 text-xs font-semibold bg-[#2563EB] text-white rounded-lg cursor-pointer">Save Driver</button>
                    </div>
                  </form>
                )}

                <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 text-slate-500 bg-[#F5F7FA]">
                      <tr>
                        <th className="py-3 px-4">Driver</th>
                        <th className="py-3 px-3">License & Expiry</th>
                        <th className="py-3 px-3">Experience</th>
                        <th className="py-3 px-3">Assigned Trips</th>
                        <th className="py-3 px-3">Availability</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {drivers.map((d) => (
                        <tr key={d.id}>
                          <td className="py-3 px-4">
                            <p className="font-bold text-[#102A43]">{d.name}</p>
                            <p className="text-slate-500">{d.phone}</p>
                          </td>
                          <td className="py-3 px-3 font-mono">{d.licenseNumber} · exp {d.licenseExpiry}</td>
                          <td className="py-3 px-3 tabular-nums">{d.experienceYears} yrs</td>
                          <td className="py-3 px-3 tabular-nums font-semibold">{d.tripCount ?? 0}</td>
                          <td className="py-3 px-3">
                            <button
                              type="button"
                              onClick={async () => {
                                await apiFetch(
                                  `/api/admin/drivers/${d.id}`,
                                  { method: 'PATCH', body: JSON.stringify({ available: !d.available }) },
                                  token
                                );
                                await loadAllAdminData();
                              }}
                              className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                                d.available ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                              }`}
                            >
                              {d.available ? 'Available' : 'Off Duty'}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right space-x-2">
                            <button type="button" onClick={() => openEditDriverForm(d)} className="p-1.5 text-[#2563EB] hover:bg-blue-50 rounded cursor-pointer">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await apiFetch(`/api/admin/drivers/${d.id}`, { method: 'DELETE' }, token);
                                await loadAllAdminData();
                              }}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PRICING MANAGEMENT TAB */}
            {tab === 'pricing' && pricing && (
              <div className="space-y-5">
                <div className="bg-white border border-slate-200 rounded-xl p-5 overflow-x-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-[#102A43]">Category Tariff Matrix (Cars & Buses)</h2>
                    <button
                      type="button"
                      onClick={handleSavePricing}
                      className="px-4 py-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Save All Pricing Rules
                    </button>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="py-2 pr-3">Category</th>
                        <th className="py-2 px-2">Per KM (₹)</th>
                        <th className="py-2 px-2">Half-Day (₹)</th>
                        <th className="py-2 px-2">Full-Day (₹)</th>
                        <th className="py-2 px-2">Outstation/KM</th>
                        <th className="py-2 px-2">Bus/Day (₹)</th>
                        <th className="py-2 px-2">Driver/Day</th>
                        <th className="py-2 pl-2">Night Charge</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pricing.rules.map((rule, idx) => (
                        <tr key={rule.category}>
                          <td className="py-2.5 pr-3 font-bold text-[#102A43]">{rule.category}</td>
                          {(
                            [
                              'perKmRate',
                              'halfDayRate',
                              'fullDayRate',
                              'outstationPerKmRate',
                              'perDayBusRate',
                              'driverAllowancePerDay',
                              'nightCharge',
                            ] as const
                          ).map((field) => (
                            <td key={field} className="py-2 px-2">
                              <input
                                type="number"
                                value={rule[field]}
                                onChange={(e) => {
                                  const next = structuredClone(pricing);
                                  next.rules[idx][field] = Number(e.target.value);
                                  setPricing(next);
                                }}
                                className="w-20 px-2 py-1 border border-slate-200 rounded tabular-nums"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Razorpay Advance Payment (%)
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={100}
                      value={pricing.additionalCharges.advancePaymentPercent}
                      onChange={(e) =>
                        setPricing({
                          ...pricing,
                          additionalCharges: {
                            ...pricing.additionalCharges,
                            advancePaymentPercent: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">GST / Tax (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={28}
                      value={pricing.additionalCharges.taxPercent}
                      onChange={(e) =>
                        setPricing({
                          ...pricing,
                          additionalCharges: {
                            ...pricing.additionalCharges,
                            taxPercent: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Est. Toll per 100 km (₹)</label>
                    <input
                      type="number"
                      value={pricing.additionalCharges.estimatedTollPer100Km}
                      onChange={(e) =>
                        setPricing({
                          ...pricing,
                          additionalCharges: {
                            ...pricing.additionalCharges,
                            estimatedTollPer100Km: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">State Permit Estimate (₹)</label>
                    <input
                      type="number"
                      value={pricing.additionalCharges.statePermitEstimate}
                      onChange={(e) =>
                        setPricing({
                          ...pricing,
                          additionalCharges: {
                            ...pricing.additionalCharges,
                            statePermitEstimate: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* CUSTOMERS TAB */}
            {tab === 'customers' && (
              <div className="space-y-4">
                {issuedCustomerReset && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-[#102A43]">
                        One-Time Customer Reset Code Issued for {issuedCustomerReset.customerName} ({issuedCustomerReset.customerEmail})
                      </p>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Valid for 15 minutes (until {new Date(issuedCustomerReset.expiresAt).toLocaleTimeString()}). Customer enters this under Login → Forgot Password → Desk Code.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1.5 bg-white border border-blue-300 rounded-lg font-mono text-sm font-bold text-[#102A43] tracking-widest">
                        {issuedCustomerReset.resetCode}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(issuedCustomerReset.resetCode);
                            setCopiedCustomerCode(true);
                          } catch {}
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-[#102A43] text-white rounded-lg inline-flex items-center gap-1 cursor-pointer"
                      >
                        {copiedCustomerCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedCustomerCode ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIssuedCustomerReset(null)}
                        className="text-xs font-semibold text-slate-500 hover:text-[#102A43] px-2 cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}

                <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 text-slate-500 bg-[#F5F7FA]">
                      <tr>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-3">Account</th>
                        <th className="py-3 px-3">Email</th>
                        <th className="py-3 px-3">Phone</th>
                        <th className="py-3 px-3">Trips</th>
                        <th className="py-3 px-3">Last Trip</th>
                        <th className="py-3 px-3 text-right">Total Paid</th>
                        <th className="py-3 px-4 text-right">Password Recovery</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customers.map((c) => (
                        <tr key={c.email}>
                          <td className="py-3 px-4 font-bold text-[#102A43]">{c.name}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                                c.isRegistered
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {c.isRegistered ? 'Registered' : 'Guest'}
                            </span>
                            {c.isRegistered && c.hasRecoveryPin && (
                              <span className="ml-1.5 text-[10px] font-medium text-[#2563EB]">PIN Set</span>
                            )}
                          </td>
                          <td className="py-3 px-3">{c.email}</td>
                          <td className="py-3 px-3">{c.phone}</td>
                          <td className="py-3 px-3 tabular-nums font-semibold">{c.bookingsCount}</td>
                          <td className="py-3 px-3 tabular-nums">{c.lastTripDate}</td>
                          <td className="py-3 px-3 text-right font-bold tabular-nums">{formatINR(c.totalSpent)}</td>
                          <td className="py-3 px-4 text-right">
                            {c.isRegistered ? (
                              <button
                                type="button"
                                onClick={() => handleGenerateCustomerResetCode(c)}
                                className="px-2.5 py-1 bg-[#F5F7FA] hover:bg-blue-50 text-[#102A43] hover:text-[#2563EB] border border-slate-200 rounded font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <KeyRound className="w-3 h-3" />
                                Issue Reset Code
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400">Guest checkout</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PAYMENTS & REFUNDS TAB */}
            {tab === 'payments' && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-500 bg-[#F5F7FA]">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-3">Booking</th>
                      <th className="py-3 px-3">Customer</th>
                      <th className="py-3 px-3">Gateway / Ref</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Amount</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-3 px-4 tabular-nums">{p.createdAt.slice(0, 10)}</td>
                        <td className="py-3 px-3 font-mono font-bold">{p.bookingCode}</td>
                        <td className="py-3 px-3">{p.customerName}</td>
                        <td className="py-3 px-3 font-mono text-[11px]">{p.gateway} · {p.razorpayPaymentId}</td>
                        <td className="py-3 px-3 font-semibold">{p.status}</td>
                        <td className="py-3 px-3 text-right font-bold tabular-nums">{formatINR(p.amount)}</td>
                        <td className="py-3 px-4 text-right">
                          {p.status === 'Captured' && (
                            <button
                              type="button"
                              onClick={() => handleRefundPayment(p)}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded font-semibold cursor-pointer"
                            >
                              Issue Refund
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ENQUIRIES TAB */}
            {tab === 'enquiries' && (
              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                {enquiries.map((e) => (
                  <div key={e.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-[#2563EB]">
                        {e.source} · {e.createdAt.slice(0, 10)}
                      </p>
                      <h3 className="text-sm font-bold text-[#102A43]">{e.subject}</h3>
                      <p className="text-xs text-slate-600">{e.message}</p>
                      <p className="text-xs text-slate-500">{e.name} · {e.phone} · {e.email}</p>
                    </div>
                    <select
                      value={e.status}
                      onChange={(ev) => handleEnquiryStatus(e.id, ev.target.value as Enquiry['status'])}
                      className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg shrink-0"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="Rejected">Rejected</option>
                      <option value="Responded">Responded</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </div>
                ))}
              </div>
            )}

            {/* REPORTS TAB */}
            {tab === 'reports' && reports && (
              <div className="space-y-5">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                      <h2 className="text-base font-bold text-[#102A43]">Vehicle Utilization & Revenue Report</h2>
                      <p className="text-xs text-slate-500">Captured Revenue Total: <strong className="tabular-nums text-[#102A43]">{formatINR(reports.totalCaptured)}</strong></p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          downloadAdminReportPdf(
                            'Vehicle Utilization Report',
                            ['Vehicle', 'Category', 'Trips', 'Total KM', 'Revenue (INR)'],
                            reports.vehicleUtilization.map((u) => [
                              u.name,
                              u.category,
                              u.trips,
                              u.totalKm,
                              u.revenue,
                            ]),
                            siteSettings
                          )
                        }
                        className="px-3 py-2 text-xs font-semibold bg-[#102A43] text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export PDF
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadCsvReport(
                            `${(siteSettings?.companyName || 'Vizag-Jagan-Travels').replace(/\s+/g, '-')}-Fleet-Utilization`,
                            ['Vehicle', 'Category', 'Trips', 'Total KM', 'Revenue INR', 'Status'],
                            reports.vehicleUtilization.map((u) => [
                              u.name,
                              u.category,
                              u.trips,
                              u.totalKm,
                              u.revenue,
                              u.status,
                            ])
                          )
                        }
                        className="px-3 py-2 text-xs font-semibold bg-[#F5F7FA] hover:bg-slate-200 text-[#102A43] rounded-lg flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export Excel / CSV
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 text-slate-500">
                        <tr>
                          <th className="py-2 pr-3">Vehicle</th>
                          <th className="py-2 pr-3">Category</th>
                          <th className="py-2 pr-3">Trips</th>
                          <th className="py-2 pr-3">Distance</th>
                          <th className="py-2 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reports.vehicleUtilization.map((u) => (
                          <tr key={u.vehicleId}>
                            <td className="py-2.5 pr-3 font-semibold text-[#102A43]">{u.name}</td>
                            <td className="py-2.5 pr-3">{u.category}</td>
                            <td className="py-2.5 pr-3 tabular-nums">{u.trips}</td>
                            <td className="py-2.5 pr-3 tabular-nums">{u.totalKm} km</td>
                            <td className="py-2.5 text-right font-bold tabular-nums">{formatINR(u.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-[#102A43] mb-3">Monthly Bookings & Revenue</h3>
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 text-slate-500">
                        <tr>
                          <th className="py-2">Month</th>
                          <th className="py-2">Bookings</th>
                          <th className="py-2 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reports.monthlyBookings.map((m) => (
                          <tr key={m.month}>
                            <td className="py-2 font-mono">{m.month}</td>
                            <td className="py-2 tabular-nums">{m.bookings}</td>
                            <td className="py-2 text-right font-bold tabular-nums">{formatINR(m.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-[#102A43] mb-3">Driver Trip Reports</h3>
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 text-slate-500">
                        <tr>
                          <th className="py-2">Driver</th>
                          <th className="py-2">Assigned</th>
                          <th className="py-2 text-right">Completed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reports.driverReports.map((d) => (
                          <tr key={d.driverId}>
                            <td className="py-2 font-semibold text-[#102A43]">{d.name}</td>
                            <td className="py-2 tabular-nums">{d.trips}</td>
                            <td className="py-2 text-right font-bold tabular-nums">{d.completedTrips}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* WEBSITE SETTINGS TAB */}
            {tab === 'settings' && siteSettings && (
              <form onSubmit={handleSaveSettings} className="space-y-5">
                <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-[#102A43]">Complete Website & Storefront Settings</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Last updated {new Date(siteSettings.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      disabled={savingSettings}
                      onClick={handleResetSettings}
                      className="px-3.5 py-2 text-xs font-semibold bg-[#F5F7FA] hover:bg-slate-200 text-[#102A43] rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset to Defaults
                    </button>
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="px-5 py-2 text-xs font-semibold bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-lg cursor-pointer disabled:opacity-60"
                    >
                      {savingSettings ? 'Saving...' : 'Save Website Settings'}
                    </button>
                  </div>
                </div>

                {/* 1. Brand Identity & Logo */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-[#102A43]">01. Company Identity & Logo</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Controls header wordmark, brand logo, footer summary, and PDF invoice headers.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                    <div className="flex items-center gap-3 p-3 bg-[#F5F7FA] rounded-lg border border-slate-200">
                      <img
                        src={siteSettings.logoUrl}
                        alt="Site logo preview"
                        referrerPolicy="no-referrer"
                        className="w-14 h-14 object-contain bg-white rounded-lg border border-slate-200 p-1 shrink-0"
                      />
                      <div className="space-y-1.5 min-w-0">
                        <p className="text-xs font-semibold text-[#102A43]">Brand Emblem</p>
                        <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold bg-white hover:bg-slate-50 border border-slate-200 rounded cursor-pointer">
                          <Upload className="w-3 h-3" />
                          {uploadingAsset === 'logo' ? 'Uploading...' : 'Upload Logo'}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(e) => handleUploadSettingAsset('logo', e)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Company Name *</label>
                      <input
                        type="text"
                        required
                        value={siteSettings.companyName}
                        onChange={(e) => setSiteSettings({ ...siteSettings, companyName: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Established Badge Text</label>
                      <input
                        type="text"
                        value={siteSettings.establishedYear}
                        onChange={(e) => setSiteSettings({ ...siteSettings, establishedYear: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Logo Asset URL</label>
                      <input
                        type="text"
                        value={siteSettings.logoUrl}
                        onChange={(e) => setSiteSettings({ ...siteSettings, logoUrl: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Hero Kicker Tagline</label>
                      <input
                        type="text"
                        value={siteSettings.tagline}
                        onChange={(e) => setSiteSettings({ ...siteSettings, tagline: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Footer Brand Description</label>
                      <textarea
                        rows={2}
                        value={siteSettings.footerDescription}
                        onChange={(e) => setSiteSettings({ ...siteSettings, footerDescription: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Footer Permits & Dispatch Line</label>
                      <input
                        type="text"
                        value={siteSettings.footerPermitsLine}
                        onChange={(e) => setSiteSettings({ ...siteSettings, footerPermitsLine: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Homepage Hero & About Content */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-[#102A43]">02. Homepage Hero & Why Choose Us</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Customize the landing headline, hero banner image, and trust highlights.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Hero Headline *</label>
                      <input
                        type="text"
                        required
                        value={siteSettings.heroHeadline}
                        onChange={(e) => setSiteSettings({ ...siteSettings, heroHeadline: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Hero Banner Photo</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={siteSettings.heroBannerUrl}
                          onChange={(e) => setSiteSettings({ ...siteSettings, heroBannerUrl: e.target.value })}
                          className="flex-1 px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg"
                        />
                        <label className="px-3 py-2 text-xs font-semibold bg-[#F5F7FA] hover:bg-slate-200 border border-slate-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer shrink-0">
                          <Upload className="w-3.5 h-3.5" />
                          {uploadingAsset === 'hero' ? 'Uploading...' : 'Upload'}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(e) => handleUploadSettingAsset('hero', e)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Hero Subheading</label>
                      <input
                        type="text"
                        value={siteSettings.heroSubheading}
                        onChange={(e) => setSiteSettings({ ...siteSettings, heroSubheading: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Why Choose Us Title</label>
                      <input
                        type="text"
                        value={siteSettings.whyChooseTitle}
                        onChange={(e) => setSiteSettings({ ...siteSettings, whyChooseTitle: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">On-Time Metric</label>
                        <input
                          type="text"
                          value={siteSettings.onTimeMetric}
                          onChange={(e) => setSiteSettings({ ...siteSettings, onTimeMetric: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Owned Fleet Metric</label>
                        <input
                          type="text"
                          value={siteSettings.ownedFleetMetric}
                          onChange={(e) => setSiteSettings({ ...siteSettings, ownedFleetMetric: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums"
                        />
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">About / Why Choose Us Narrative</label>
                      <textarea
                        rows={2}
                        value={siteSettings.whyChooseDescription}
                        onChange={(e) => setSiteSettings({ ...siteSettings, whyChooseDescription: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Hero Banner Carousel Slides Manager */}
                  <div className="pt-4 border-t border-slate-100 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-[#102A43]">
                          Hero Banner Sliding Carousel ({siteSettings.heroSlides?.length || 0} Slides)
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Slide 1 syncs with the primary Hero Headline & Photo above; additional slides rotate automatically.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-xs font-medium text-slate-600">
                          Auto-Slide:
                          <select
                            value={siteSettings.heroAutoplaySeconds ?? 6}
                            onChange={(e) =>
                              setSiteSettings({
                                ...siteSettings,
                                heroAutoplaySeconds: Number(e.target.value),
                              })
                            }
                            className="ml-2 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-[#102A43]"
                          >
                            <option value={0}>Manual Only</option>
                            <option value={4}>Every 4s</option>
                            <option value={6}>Every 6s</option>
                            <option value={8}>Every 8s</option>
                            <option value={12}>Every 12s</option>
                          </select>
                        </label>
                        {(siteSettings.heroSlides?.length || 0) < 8 && (
                          <button
                            type="button"
                            onClick={() => {
                              const nextIndex = (siteSettings.heroSlides?.length || 0) + 1;
                              const newSlide: HeroSlide = {
                                id: `slide-${Date.now()}`,
                                eyebrow: 'Direct-Owned Fleet Showcase',
                                headline: `Featured Travel Highlight ${nextIndex}`,
                                subheading:
                                  'Chauffeur-driven cars, Tempo Travellers, and luxury buses operated directly by Vizag Jagan Travels.',
                                imageUrl: '/src/assets/images/hero_fleet_showcase_1795608169193.jpg',
                                ctaLabel: 'Explore Fleet',
                                ctaTarget: 'fleet',
                              };
                              setSiteSettings({
                                ...siteSettings,
                                heroSlides: [...(siteSettings.heroSlides || []), newSlide],
                              });
                            }}
                            className="px-3 py-1.5 text-xs font-semibold bg-[#102A43] hover:bg-[#1a3c5e] text-white rounded-lg inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Slide
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {(siteSettings.heroSlides || []).map((slide, sIdx) => (
                        <div
                          key={slide.id}
                          className="p-4 bg-[#F5F7FA] border border-slate-200 rounded-xl space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-[#102A43] tabular-nums">
                              Slide 0{sIdx + 1} {sIdx === 0 ? '· Primary Hero' : ''}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={sIdx === 0}
                                onClick={() => {
                                  const next = [...(siteSettings.heroSlides || [])];
                                  [next[sIdx - 1], next[sIdx]] = [next[sIdx], next[sIdx - 1]];
                                  setSiteSettings({ ...siteSettings, heroSlides: next });
                                }}
                                className="p-1.5 text-xs bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                                aria-label="Move slide up"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={sIdx === (siteSettings.heroSlides?.length || 1) - 1}
                                onClick={() => {
                                  const next = [...(siteSettings.heroSlides || [])];
                                  [next[sIdx + 1], next[sIdx]] = [next[sIdx], next[sIdx + 1]];
                                  setSiteSettings({ ...siteSettings, heroSlides: next });
                                }}
                                className="p-1.5 text-xs bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                                aria-label="Move slide down"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              {(siteSettings.heroSlides?.length || 0) > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = (siteSettings.heroSlides || []).filter((_, i) => i !== sIdx);
                                    setSiteSettings({ ...siteSettings, heroSlides: next });
                                  }}
                                  className="p-1.5 text-xs bg-white border border-red-200 text-red-600 rounded hover:bg-red-50 cursor-pointer"
                                  aria-label="Remove slide"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 mb-1">Eyebrow Label</label>
                              <input
                                type="text"
                                value={sIdx === 0 ? siteSettings.tagline : slide.eyebrow}
                                disabled={sIdx === 0}
                                onChange={(e) => {
                                  const next = [...(siteSettings.heroSlides || [])];
                                  next[sIdx] = { ...slide, eyebrow: e.target.value };
                                  setSiteSettings({ ...siteSettings, heroSlides: next });
                                }}
                                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg disabled:bg-slate-100 disabled:text-slate-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 mb-1">Slide Headline</label>
                              <input
                                type="text"
                                value={sIdx === 0 ? siteSettings.heroHeadline : slide.headline}
                                disabled={sIdx === 0}
                                onChange={(e) => {
                                  const next = [...(siteSettings.heroSlides || [])];
                                  next[sIdx] = { ...slide, headline: e.target.value };
                                  setSiteSettings({ ...siteSettings, heroSlides: next });
                                }}
                                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg disabled:bg-slate-100 disabled:text-slate-500"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-[11px] font-medium text-slate-600 mb-1">Subheading</label>
                              <input
                                type="text"
                                value={sIdx === 0 ? siteSettings.heroSubheading : slide.subheading}
                                disabled={sIdx === 0}
                                onChange={(e) => {
                                  const next = [...(siteSettings.heroSlides || [])];
                                  next[sIdx] = { ...slide, subheading: e.target.value };
                                  setSiteSettings({ ...siteSettings, heroSlides: next });
                                }}
                                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg disabled:bg-slate-100 disabled:text-slate-500"
                              />
                            </div>
                            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center pt-1">
                              <div className="sm:col-span-4 aspect-[16/9] rounded-lg overflow-hidden border border-slate-200 bg-slate-200">
                                <img
                                  src={sIdx === 0 ? siteSettings.heroBannerUrl : slide.imageUrl}
                                  alt={`Banner preview ${sIdx + 1}`}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="sm:col-span-8 space-y-2">
                                <label className="block text-[11px] font-medium text-slate-600">
                                  Banner Image (Upload or URL)
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={sIdx === 0 ? siteSettings.heroBannerUrl : slide.imageUrl}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const next = [...(siteSettings.heroSlides || [])];
                                      next[sIdx] = { ...slide, imageUrl: val };
                                      setSiteSettings({
                                        ...siteSettings,
                                        ...(sIdx === 0 ? { heroBannerUrl: val } : {}),
                                        heroSlides: next,
                                      });
                                    }}
                                    className="flex-1 px-3 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg"
                                  />
                                  <label className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-100 border border-slate-300 text-[#102A43] rounded-lg inline-flex items-center gap-1.5 cursor-pointer shrink-0">
                                    <Upload className="w-3.5 h-3.5" />
                                    {uploadingAsset === `slide-${sIdx}` ? 'Uploading...' : 'Upload Banner'}
                                    <input
                                      type="file"
                                      accept="image/png,image/jpeg,image/webp"
                                      onChange={(e) => handleUploadSlideImage(sIdx, e)}
                                      className="hidden"
                                    />
                                  </label>
                                </div>
                              </div>
                            </div>
                            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-1">Button Label</label>
                                <input
                                  type="text"
                                  value={slide.ctaLabel || ''}
                                  placeholder="Explore Fleet"
                                  onChange={(e) => {
                                    const next = [...(siteSettings.heroSlides || [])];
                                    next[sIdx] = { ...slide, ctaLabel: e.target.value };
                                    setSiteSettings({ ...siteSettings, heroSlides: next });
                                  }}
                                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-1">Button Target</label>
                                <select
                                  value={slide.ctaTarget || 'fleet'}
                                  onChange={(e) => {
                                    const next = [...(siteSettings.heroSlides || [])];
                                    next[sIdx] = {
                                      ...slide,
                                      ctaTarget: e.target.value as 'fleet' | 'booking' | 'services' | 'destinations',
                                    };
                                    setSiteSettings({ ...siteSettings, heroSlides: next });
                                  }}
                                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                                >
                                  <option value="fleet">Our Vehicles</option>
                                  <option value="destinations">Destinations</option>
                                  <option value="services">Services</option>
                                  <option value="booking">Booking Wizard</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Contact, WhatsApp & Depot Map */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-[#102A43]">03. Contact, WhatsApp & Dispatch Hub Location</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Updates contact cards, WhatsApp widget number, Google Maps depot pin, and default trip endpoints.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Support & Dispatch Phone *</label>
                      <input
                        type="text"
                        required
                        value={siteSettings.supportPhone}
                        onChange={(e) => setSiteSettings({ ...siteSettings, supportPhone: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Bookings Email *</label>
                      <input
                        type="email"
                        required
                        value={siteSettings.supportEmail}
                        onChange={(e) => setSiteSettings({ ...siteSettings, supportEmail: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Operating Hours Label</label>
                      <input
                        type="text"
                        value={siteSettings.workingHours}
                        onChange={(e) => setSiteSettings({ ...siteSettings, workingHours: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">WhatsApp Number (digits w/ country code)</label>
                      <input
                        type="text"
                        value={siteSettings.whatsappNumber}
                        onChange={(e) => setSiteSettings({ ...siteSettings, whatsappNumber: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">WhatsApp Greeting Message</label>
                      <input
                        type="text"
                        value={siteSettings.whatsappDefaultMessage}
                        onChange={(e) => setSiteSettings({ ...siteSettings, whatsappDefaultMessage: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Garage / Office Address *</label>
                      <input
                        type="text"
                        required
                        value={siteSettings.businessAddress}
                        onChange={(e) => setSiteSettings({ ...siteSettings, businessAddress: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Depot Latitude</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={siteSettings.depotLat}
                          onChange={(e) => setSiteSettings({ ...siteSettings, depotLat: Number(e.target.value) })}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Depot Longitude</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={siteSettings.depotLng}
                          onChange={(e) => setSiteSettings({ ...siteSettings, depotLng: Number(e.target.value) })}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums"
                        />
                      </div>
                    </div>
                    <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Default Search Pickup Address</label>
                        <input
                          type="text"
                          value={siteSettings.defaultPickupAddress}
                          onChange={(e) => setSiteSettings({ ...siteSettings, defaultPickupAddress: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Default Search Destination Address</label>
                        <input
                          type="text"
                          value={siteSettings.defaultDropAddress}
                          onChange={(e) => setSiteSettings({ ...siteSettings, defaultDropAddress: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Booking Rules, Invoices & Operational Toggles */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-[#102A43]">04. Booking Policies, Invoices & Availability</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Control booking reference prefixes, GSTIN billing details, guest checkout, and site maintenance mode.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Booking Reference Prefix</label>
                      <input
                        type="text"
                        maxLength={6}
                        value={siteSettings.bookingCodePrefix}
                        onChange={(e) => setSiteSettings({ ...siteSettings, bookingCodePrefix: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Company GSTIN (Optional)</label>
                      <input
                        type="text"
                        value={siteSettings.gstNumber}
                        placeholder="e.g. 37AABCV1234F1Z5"
                        onChange={(e) => setSiteSettings({ ...siteSettings, gstNumber: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">PDF Invoice Footer Note</label>
                      <input
                        type="text"
                        value={siteSettings.invoiceFooterNote}
                        onChange={(e) => setSiteSettings({ ...siteSettings, invoiceFooterNote: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <label className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-[#F5F7FA] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={siteSettings.allowOnlinePayment}
                        onChange={(e) => setSiteSettings({ ...siteSettings, allowOnlinePayment: e.target.checked })}
                        className="mt-0.5 rounded border-slate-300"
                      />
                      <div>
                        <p className="text-xs font-bold text-[#102A43]">Enable Online Pre-Payment (Razorpay)</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          When disabled, pre-pay amounts stay visible as unavailable and Submit Request is selected.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-[#F5F7FA] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={siteSettings.allowPayLater}
                        onChange={(e) => setSiteSettings({ ...siteSettings, allowPayLater: e.target.checked })}
                        className="mt-0.5 rounded border-slate-300"
                      />
                      <div>
                        <p className="text-xs font-bold text-[#102A43]">Allow Pay Later / Confirm with Dispatch</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Let customers submit requests without immediate Razorpay payment.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-[#F5F7FA] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={siteSettings.allowGuestBooking}
                        onChange={(e) => setSiteSettings({ ...siteSettings, allowGuestBooking: e.target.checked })}
                        className="mt-0.5 rounded border-slate-300"
                      />
                      <div>
                        <p className="text-xs font-bold text-[#102A43]">Allow Guest Checkout</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Allow travellers to book vehicles without signing in first.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-[#F5F7FA] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={siteSettings.showWhatsAppWidget}
                        onChange={(e) => setSiteSettings({ ...siteSettings, showWhatsAppWidget: e.target.checked })}
                        className="mt-0.5 rounded border-slate-300"
                      />
                      <div>
                        <p className="text-xs font-bold text-[#102A43]">Show Floating WhatsApp Desk</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Displays the quick WhatsApp enquiry launcher on public pages.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3.5 rounded-lg border border-amber-200 bg-amber-50/70 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={siteSettings.maintenanceMode}
                        onChange={(e) => setSiteSettings({ ...siteSettings, maintenanceMode: e.target.checked })}
                        className="mt-0.5 rounded border-amber-400"
                      />
                      <div>
                        <p className="text-xs font-bold text-amber-950">Maintenance Mode (Pause New Bookings)</p>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          Displays an operational notice banner and temporarily pauses checkout.
                        </p>
                      </div>
                    </label>
                  </div>

                  {siteSettings.maintenanceMode && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Maintenance Banner Message</label>
                      <input
                        type="text"
                        value={siteSettings.maintenanceMessage}
                        onChange={(e) => setSiteSettings({ ...siteSettings, maintenanceMessage: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-amber-300 bg-amber-50/40 rounded-lg"
                      />
                    </div>
                  )}
                </div>

                {/* 5. SEO & Social Profiles */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-[#102A43]">05. SEO Metadata & Social Links</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Updates browser tab title, search engine meta description, and footer social links.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">SEO Page Title</label>
                      <input
                        type="text"
                        value={siteSettings.seoTitle}
                        onChange={(e) => setSiteSettings({ ...siteSettings, seoTitle: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Facebook Page URL</label>
                      <input
                        type="url"
                        placeholder="https://facebook.com/..."
                        value={siteSettings.facebookUrl}
                        onChange={(e) => setSiteSettings({ ...siteSettings, facebookUrl: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">SEO Meta Description</label>
                      <textarea
                        rows={2}
                        value={siteSettings.seoDescription}
                        onChange={(e) => setSiteSettings({ ...siteSettings, seoDescription: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Instagram Profile URL</label>
                      <input
                        type="url"
                        placeholder="https://instagram.com/..."
                        value={siteSettings.instagramUrl}
                        onChange={(e) => setSiteSettings({ ...siteSettings, instagramUrl: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">YouTube Channel URL</label>
                      <input
                        type="url"
                        placeholder="https://youtube.com/..."
                        value={siteSettings.youtubeUrl}
                        onChange={(e) => setSiteSettings({ ...siteSettings, youtubeUrl: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">X (Twitter) Profile URL</label>
                      <input
                        type="url"
                        placeholder="https://x.com/..."
                        value={siteSettings.twitterUrl || ''}
                        onChange={(e) => setSiteSettings({ ...siteSettings, twitterUrl: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              </form>
            )}
            {/* SERVICES & UPCOMING SERVICES TAB */}
            {tab === 'services' && (
              <div className="space-y-5">
                <form
                  onSubmit={handleAddService}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
                >
                  <div>
                    <h2 className="text-base font-bold text-[#102A43]">Add New or Upcoming Fleet Service</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Launch new active rental categories or announce upcoming fleet corridors (EV shuttles, sleeper coaches, express airport lines).
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Service Title *</label>
                      <input
                        type="text"
                        required
                        value={sTitle}
                        onChange={(e) => setSTitle(e.target.value)}
                        placeholder="e.g. Zero-Emission EV Corporate Fleet"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Subtitle / Tagline *</label>
                      <input
                        type="text"
                        required
                        value={sTagline}
                        onChange={(e) => setSTagline(e.target.value)}
                        placeholder="e.g. Electric Executive MPV Shuttles"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Service Status *</label>
                      <select
                        value={sStatus}
                        onChange={(e) => setSStatus(e.target.value as ServiceStatus)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-semibold"
                      >
                        <option value="Upcoming">Upcoming (Coming Soon)</option>
                        <option value="Active">Active (Bookable Now)</option>
                      </select>
                    </div>

                    {sStatus === 'Upcoming' && (
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Launch Window *</label>
                        <input
                          type="text"
                          value={sLaunchWindow}
                          onChange={(e) => setSLaunchWindow(e.target.value)}
                          placeholder="e.g. Launching Mar 2027"
                          className="w-full px-3 py-2 text-sm border border-amber-300 bg-amber-50/40 rounded-lg"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Default Vehicle Category</label>
                      <select
                        value={sDefaultCat}
                        onChange={(e) => setSDefaultCat(e.target.value as VehicleCategory)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      >
                        {ALL_CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Default Trip Type</label>
                      <select
                        value={sTripType}
                        onChange={(e) => setSTripType(e.target.value as TripType)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      >
                        {(['Local Rental', 'Outstation', 'Airport Transfer', 'Round Trip', 'One Way'] as const)
                          .filter((t) => t !== 'Outstation')
                          .map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Passenger Capacity Range</label>
                      <input
                        type="text"
                        value={sPassengerRange}
                        onChange={(e) => setSPassengerRange(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Ideal Fleet Lineup</label>
                      <input
                        type="text"
                        value={sIdealFleet}
                        onChange={(e) => setSIdealFleet(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Photo URL or Upload</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={sImageUrl}
                          onChange={(e) => setSImageUrl(e.target.value)}
                          className="flex-1 px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg"
                        />
                        <label className="px-3 py-2 text-xs font-semibold bg-[#F5F7FA] hover:bg-slate-200 border border-slate-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer shrink-0">
                          <Upload className="w-3.5 h-3.5" />
                          {uploadingServiceImg ? '...' : 'Upload'}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleUploadServiceImage}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Service Description *</label>
                      <textarea
                        rows={2}
                        required
                        value={sDesc}
                        onChange={(e) => setSDesc(e.target.value)}
                        placeholder="Describe vehicles assigned, route coverage, and passenger amenities..."
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Highlights (one per line)</label>
                      <textarea
                        rows={2}
                        value={sHighlights}
                        onChange={(e) => setSHighlights(e.target.value)}
                        placeholder="Zero-emission cabin&#10;Dedicated dispatch team"
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-semibold bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Publish {sStatus} Service
                    </button>
                  </div>
                </form>

                <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 text-slate-500 bg-[#F5F7FA]">
                      <tr>
                        <th className="py-3 px-4"># · Service</th>
                        <th className="py-3 px-3">Fleet & Category</th>
                        <th className="py-3 px-3">Status / Launch</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {adminServices.map((srv) => (
                        <tr key={srv.id}>
                          <td className="py-3 px-4">
                            <p className="font-bold text-[#102A43]">
                              {srv.num}. {srv.title}
                            </p>
                            <p className="text-slate-500 text-[11px]">{srv.tagline}</p>
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-medium text-[#102A43]">{srv.defaultCategory}</p>
                            <p className="text-slate-500 text-[11px]">{srv.passengerRange}</p>
                          </td>
                          <td className="py-3 px-3">
                            <select
                              value={srv.status}
                              onChange={(e) =>
                                handleUpdateServiceStatus(srv.id, e.target.value as ServiceStatus)
                              }
                              className="px-2 py-1 border border-slate-200 rounded text-xs font-semibold"
                            >
                              <option value="Active">Active</option>
                              <option value="Upcoming">Upcoming</option>
                              <option value="Archived">Archived</option>
                            </select>
                            {srv.status === 'Upcoming' && srv.launchWindow && (
                              <p className="text-[11px] text-amber-700 font-medium mt-0.5">
                                {srv.launchWindow}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                            {srv.status === 'Upcoming' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateServiceStatus(srv.id, 'Active')}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded cursor-pointer"
                              >
                                Launch Active
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteService(srv.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                              aria-label={`Delete ${srv.title}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* FEATURED DESTINATIONS TAB */}
            {tab === 'destinations' && (
              <div className="space-y-5">
                <form
                  onSubmit={handleAddDestination}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
                >
                  <div>
                    <h2 className="text-base font-bold text-[#102A43]">Add Featured Destination Route</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Add Visakhapatnam outstation & local corridor destinations with coordinates and recommended vehicles for 1-click booking prefill.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Destination Name *</label>
                      <input
                        type="text"
                        required
                        value={dstName}
                        onChange={(e) => setDstName(e.target.value)}
                        placeholder="e.g. Araku Valley & Borra Caves"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Region Label *</label>
                      <input
                        type="text"
                        required
                        value={dstRegion}
                        onChange={(e) => setDstRegion(e.target.value)}
                        placeholder="e.g. Eastern Ghats · Andhra Pradesh"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Route Corridor Summary</label>
                      <input
                        type="text"
                        value={dstRoute}
                        onChange={(e) => setDstRoute(e.target.value)}
                        placeholder="Visakhapatnam → Borra → Araku"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Distance (km) *</label>
                      <input
                        type="number"
                        min={10}
                        value={dstDistanceKm}
                        onChange={(e) => setDstDistanceKm(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Estimated Travel Time *</label>
                      <input
                        type="text"
                        value={dstDuration}
                        onChange={(e) => setDstDuration(e.target.value)}
                        placeholder="e.g. 3 hrs 15 mins"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Recommended Fleet</label>
                      <select
                        value={dstCategory}
                        onChange={(e) => setDstCategory(e.target.value as VehicleCategory)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      >
                        {ALL_CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Drop Point Address</label>
                      <input
                        type="text"
                        value={dstDropAddress}
                        onChange={(e) => setDstDropAddress(e.target.value)}
                        placeholder="Full destination drop address"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Latitude</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={dstDropLat}
                          onChange={(e) => setDstDropLat(Number(e.target.value))}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Longitude</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={dstDropLng}
                          onChange={(e) => setDstDropLng(Number(e.target.value))}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Starting Price Label</label>
                      <input
                        type="text"
                        value={dstEstimate}
                        onChange={(e) => setDstEstimate(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Trip Type</label>
                      <select
                        value={dstTripType}
                        onChange={(e) => setDstTripType(e.target.value as TripType)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      >
                        {(['Round Trip', 'One Way', 'Local Rental', 'Airport Transfer'] as const).map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Photo URL or Upload</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={dstImageUrl}
                          onChange={(e) => setDstImageUrl(e.target.value)}
                          className="flex-1 px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg"
                        />
                        <label className="px-3 py-2 text-xs font-semibold bg-[#F5F7FA] hover:bg-slate-200 border border-slate-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer shrink-0">
                          <Upload className="w-3.5 h-3.5" />
                          {uploadingDestImg ? '...' : 'Upload'}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleUploadDestImage}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Destination Description *</label>
                      <textarea
                        rows={2}
                        required
                        value={dstDescription}
                        onChange={(e) => setDstDescription(e.target.value)}
                        placeholder="Describe highway conditions, chauffeur support, and recommended stops..."
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Highlights (one per line)</label>
                      <textarea
                        rows={2}
                        value={dstHighlights}
                        onChange={(e) => setDstHighlights(e.target.value)}
                        placeholder="Hill-ghat experienced driver&#10;Dawn dispatch ready"
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#102A43] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dstFeatured}
                        onChange={(e) => setDstFeatured(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      Feature on Homepage Featured Destinations Showcase
                    </label>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-semibold bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Featured Destination
                    </button>
                  </div>
                </form>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {adminDestinations.map((dest) => (
                    <div key={dest.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between">
                      <div>
                        <div className="aspect-[16/10] bg-slate-100 overflow-hidden">
                          <img
                            src={dest.imageUrl}
                            alt={dest.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-4">
                          <p className="text-[11px] font-semibold text-[#2563EB] tabular-nums">
                            {dest.distanceKm} km · {dest.durationText}
                          </p>
                          <p className="text-sm font-bold text-[#102A43] mt-0.5">{dest.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{dest.recommendedCategory} · {dest.startingEstimateLabel}</p>
                        </div>
                      </div>
                      <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between gap-2 bg-[#F5F7FA]">
                        <div className="flex items-center gap-3 text-[11px]">
                          <label className="inline-flex items-center gap-1 cursor-pointer font-semibold text-[#102A43]">
                            <input
                              type="checkbox"
                              checked={dest.featured}
                              onChange={(e) => handleToggleDestination(dest.id, { featured: e.target.checked })}
                              className="rounded border-slate-300"
                            />
                            Featured
                          </label>
                          <label className="inline-flex items-center gap-1 cursor-pointer text-slate-600">
                            <input
                              type="checkbox"
                              checked={dest.active}
                              onChange={(e) => handleToggleDestination(dest.id, { active: e.target.checked })}
                              className="rounded border-slate-300"
                            />
                            Visible
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteDestination(dest.id)}
                          className="text-xs font-semibold text-red-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TRAVEL PACKAGES TAB */}
            {tab === 'packages' && (
              <div className="space-y-5">
                <form
                  onSubmit={handleAddPackage}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
                >
                  <div>
                    <h2 className="text-base font-bold text-[#102A43]">Create Tour & Travel Package</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Add city sightseeing, hill-station, or pilgrimage packages with fixed starting tariff and instant booking prefill.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Package Title *</label>
                      <input
                        type="text"
                        required
                        value={pkgTitle}
                        onChange={(e) => setPkgTitle(e.target.value)}
                        placeholder="e.g. Araku Valley 2-Day Retreat"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Route / Stops Summary *</label>
                      <input
                        type="text"
                        required
                        value={pkgSubtitle}
                        onChange={(e) => setPkgSubtitle(e.target.value)}
                        placeholder="Vizag → Borra Caves → Araku"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Package Type</label>
                      <select
                        value={pkgType}
                        onChange={(e) => setPkgType(e.target.value as PackageType)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                      >
                        <option value="City & Sightseeing">City & Sightseeing</option>
                        <option value="Hill Station & Nature">Hill Station & Nature</option>
                        <option value="Pilgrimage Tour">Pilgrimage Tour</option>
                        <option value="Weekend & Coastal">Weekend & Coastal</option>
                        <option value="Corporate & Group">Corporate & Group</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Duration Label</label>
                      <input
                        type="text"
                        value={pkgDuration}
                        onChange={(e) => setPkgDuration(e.target.value)}
                        placeholder="e.g. 1 Night / 2 Days"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Starting Price (INR)</label>
                      <input
                        type="number"
                        min={500}
                        value={pkgPrice}
                        onChange={(e) => setPkgPrice(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Vehicle Capacity Note</label>
                      <input
                        type="text"
                        value={pkgUnitLabel}
                        onChange={(e) => setPkgUnitLabel(e.target.value)}
                        placeholder="AC SUV (up to 6 pax)"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Recommended Fleet</label>
                      <select
                        value={pkgCategory}
                        onChange={(e) => setPkgCategory(e.target.value as VehicleCategory)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                      >
                        {ALL_CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Distance (km)</label>
                        <input
                          type="number"
                          min={20}
                          value={pkgDistanceKm}
                          onChange={(e) => setPkgDistanceKm(Number(e.target.value))}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Passengers</label>
                        <input
                          type="number"
                          min={1}
                          max={55}
                          value={pkgPassengers}
                          onChange={(e) => setPkgPassengers(Number(e.target.value))}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Destination Address</label>
                      <input
                        type="text"
                        value={pkgDropAddress}
                        onChange={(e) => setPkgDropAddress(e.target.value)}
                        placeholder="Primary drop / destination hub"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Package Photo URL / Upload</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={pkgImageUrl}
                          onChange={(e) => setPkgImageUrl(e.target.value)}
                          className="flex-1 px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg"
                        />
                        <label className="px-3 py-2 text-xs font-semibold bg-[#F5F7FA] hover:bg-slate-200 border border-slate-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer shrink-0">
                          <Upload className="w-3.5 h-3.5" />
                          {uploadingPkgImg ? '...' : 'Upload'}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleUploadPkgImage}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Itinerary Highlights (one per line)</label>
                      <textarea
                        rows={2}
                        value={pkgHighlights}
                        onChange={(e) => setPkgHighlights(e.target.value)}
                        placeholder="Borra Caves morning exploration&#10;Coffee Museum & Tribal Village visit"
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#102A43] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pkgFeatured}
                        onChange={(e) => setPkgFeatured(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      Feature on Homepage Travel Packages Showcase
                    </label>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-semibold bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Publish Package
                    </button>
                  </div>
                </form>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {adminPackages.map((pkg) => (
                    <div key={pkg.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between">
                      <div>
                        <div className="aspect-[16/10] bg-slate-100 overflow-hidden">
                          <img
                            src={pkg.imageUrl}
                            alt={pkg.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-4">
                          <p className="text-[11px] font-semibold text-[#2563EB] tabular-nums">
                            {pkg.packageType} · {pkg.durationLabel}
                          </p>
                          <p className="text-sm font-bold text-[#102A43] mt-0.5">{pkg.title}</p>
                          <p className="text-xs font-semibold text-slate-600 mt-1 tabular-nums">
                            {formatINR(pkg.packagePriceInr)} · {pkg.priceUnitLabel}
                          </p>
                        </div>
                      </div>
                      <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between gap-2 bg-[#F5F7FA]">
                        <div className="flex items-center gap-3 text-[11px]">
                          <label className="inline-flex items-center gap-1 cursor-pointer font-semibold text-[#102A43]">
                            <input
                              type="checkbox"
                              checked={pkg.featured}
                              onChange={(e) => handleTogglePackage(pkg.id, { featured: e.target.checked })}
                              className="rounded border-slate-300"
                            />
                            Featured
                          </label>
                          <label className="inline-flex items-center gap-1 cursor-pointer text-slate-600">
                            <input
                              type="checkbox"
                              checked={pkg.active}
                              onChange={(e) => handleTogglePackage(pkg.id, { active: e.target.checked })}
                              className="rounded border-slate-300"
                            />
                            Visible
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeletePackage(pkg.id)}
                          className="text-xs font-semibold text-red-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* GALLERY MANAGEMENT TAB */}
            {tab === 'gallery' && (
              <div className="space-y-5">
                <form
                  onSubmit={handleAddGalleryItem}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
                >
                  <div>
                    <h2 className="text-base font-bold text-[#102A43]">Publish Fleet & Trip Photo</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Add curated vehicle dispatches, wedding arrivals, or coach cabin photos directly to the public Gallery page.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Photo Title *</label>
                      <input
                        type="text"
                        required
                        value={gTitle}
                        onChange={(e) => setGTitle(e.target.value)}
                        placeholder="e.g. Volvo 9600 Araku Departure"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Gallery Category *</label>
                      <select
                        value={gCategory}
                        onChange={(e) => setGCategory(e.target.value as GalleryCategory)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      >
                        {[
                          'Fleet Showcase',
                          'Airport & Corporate',
                          'Weddings & Events',
                          'Outstation & Tours',
                          'Coach Interiors',
                        ].map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Route / Context Label</label>
                      <input
                        type="text"
                        value={gRoute}
                        onChange={(e) => setGRoute(e.target.value)}
                        placeholder="e.g. VTZ Airport · Executive Sedan"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Linked Booking Category</label>
                      <select
                        value={gRecCategory}
                        onChange={(e) => setGRecCategory(e.target.value as VehicleCategory | '')}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      >
                        <option value="">None</option>
                        {ALL_CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Photo URL or Upload *</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          required
                          value={gImageUrl}
                          onChange={(e) => setGImageUrl(e.target.value)}
                          placeholder="/uploads/... or /src/assets/images/..."
                          className="flex-1 px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg"
                        />
                        <label className="px-3 py-2 text-xs font-semibold bg-[#F5F7FA] hover:bg-slate-200 border border-slate-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer shrink-0">
                          <Upload className="w-3.5 h-3.5" />
                          {uploadingGalleryImg ? 'Uploading...' : 'Upload'}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleUploadGalleryImage}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Short Caption *</label>
                      <input
                        type="text"
                        required
                        value={gCaption}
                        onChange={(e) => setGCaption(e.target.value)}
                        placeholder="Describe the vehicle, trip highlights, or passenger amenities shown in the photograph."
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#102A43] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={gFeatured}
                        onChange={(e) => setGFeatured(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      Highlight as Wide Featured Frame
                    </label>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-semibold bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Publish Photo to Gallery
                    </button>
                  </div>
                </form>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {galleryItems.map((item) => (
                    <div key={item.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between">
                      <div>
                        <div className="aspect-[16/10] bg-slate-100 overflow-hidden">
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-4">
                          <p className="text-[11px] font-semibold text-[#2563EB]">
                            {item.category} · {item.routeOrContext}
                          </p>
                          <p className="text-sm font-bold text-[#102A43] mt-0.5">{item.title}</p>
                          <p className="text-xs text-slate-600 mt-1 line-clamp-2">{item.caption}</p>
                        </div>
                      </div>
                      <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between bg-[#F5F7FA]">
                        <span className="text-[11px] text-slate-500 font-medium">
                          {item.featured ? 'Featured Wide' : 'Standard 4:3'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteGalleryItem(item.id)}
                          className="text-xs font-semibold text-red-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ADMIN CREDENTIALS & RECOVERY TAB */}
            {tab === 'credentials' && (
              <div className="space-y-5">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-[#102A43]">Administrator Credentials & Access</h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          View your active administrator sign-in details, update email or password, and manage your Recovery Key.
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md ${
                        adminCredInfo?.envPasscodeConfigured
                          ? 'bg-amber-50 text-amber-900 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {adminCredInfo?.envPasscodeConfigured
                        ? 'Environment Passcode Mode'
                        : 'Database Admin Account'}
                    </span>
                  </div>

                  {adminCredInfo && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
                      <div className="p-3.5 rounded-lg bg-[#F5F7FA] border border-slate-200">
                        <p className="text-[11px] text-slate-500">Administrator Name</p>
                        <p className="text-sm font-bold text-[#102A43] mt-0.5">{adminCredInfo.name}</p>
                      </div>
                      <div className="p-3.5 rounded-lg bg-[#F5F7FA] border border-slate-200">
                        <p className="text-[11px] text-slate-500">Admin Login Email</p>
                        <p className="text-sm font-mono font-semibold text-[#102A43] mt-0.5 break-all">
                          {adminCredInfo.email}
                        </p>
                      </div>
                      <div className="p-3.5 rounded-lg bg-[#F5F7FA] border border-slate-200">
                        <p className="text-[11px] text-slate-500">Forgot-Password Recovery Key</p>
                        <p
                          className={`text-sm font-bold mt-0.5 ${
                            adminCredInfo.hasRecoveryKey ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {adminCredInfo.envPasscodeConfigured
                            ? 'Env Managed'
                            : adminCredInfo.hasRecoveryKey
                            ? 'Configured & Active'
                            : 'Not Generated Yet'}
                        </p>
                      </div>
                      <div className="p-3.5 rounded-lg bg-[#F5F7FA] border border-slate-200">
                        <p className="text-[11px] text-slate-500">Last Credential Update</p>
                        <p className="text-xs font-semibold text-[#102A43] mt-1 tabular-nums">
                          {adminCredInfo.updatedAt
                            ? new Date(adminCredInfo.updatedAt).toLocaleString()
                            : new Date(adminCredInfo.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {adminCredInfo?.envPasscodeConfigured ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-xs text-amber-950 space-y-1.5">
                    <p className="font-bold text-sm">Admin Access Managed via Server Environment Configuration</p>
                    <p>
                      Your deployment sets <code className="font-mono bg-white/80 px-1.5 py-0.5 rounded">ADMIN_PASSCODE</code> in environment variables. Update or rotate that environment variable on the host to change the admin passcode.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <form
                      onSubmit={handleUpdateAdminCredentials}
                      className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 space-y-4"
                    >
                      <h3 className="text-sm font-bold text-[#102A43]">Update Admin Email, Name & Password</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Administrator Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={credName}
                            onChange={(e) => setCredName(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Administrator Email *
                          </label>
                          <input
                            type="email"
                            required
                            value={credEmail}
                            onChange={(e) => setCredEmail(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Current Admin Password * (required to save any change)
                          </label>
                          <input
                            type="password"
                            required
                            value={credCurrentPassword}
                            onChange={(e) => setCredCurrentPassword(e.target.value)}
                            placeholder="Enter your current password"
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            New Password (Optional · min 6 chars)
                          </label>
                          <input
                            type="password"
                            minLength={6}
                            value={credNewPassword}
                            onChange={(e) => setCredNewPassword(e.target.value)}
                            placeholder="Leave blank to keep current password"
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Confirm New Password
                          </label>
                          <input
                            type="password"
                            minLength={6}
                            value={credConfirmPassword}
                            onChange={(e) => setCredConfirmPassword(e.target.value)}
                            placeholder="Repeat new password"
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={savingCreds}
                        className="px-5 py-2.5 bg-[#102A43] hover:bg-[#1a3c5e] text-white text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-60"
                      >
                        {savingCreds ? 'Updating...' : 'Save Admin Credentials'}
                      </button>
                    </form>

                    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 flex flex-col justify-between">
                      <div className="space-y-3">
                        <h3 className="text-sm font-bold text-[#102A43]">Forgot-Password Recovery Key</h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Generate or rotate your one-time Admin Recovery Key. Use this key on the{' '}
                          <strong>Admin Console → Forgot Admin Password</strong> screen if you ever lose your password.
                        </p>
                        {generatedAdminKey && (
                          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
                            <p className="text-[11px] font-bold text-emerald-900">
                              NEW ONE-TIME RECOVERY KEY (SAVE NOW)
                            </p>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-sm font-bold text-[#102A43] tracking-wider">
                                {generatedAdminKey}
                              </span>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(generatedAdminKey);
                                    setCopiedAdminKey(true);
                                    setTimeout(() => setCopiedAdminKey(false), 2000);
                                  } catch {}
                                }}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-emerald-300 rounded inline-flex items-center gap-1 cursor-pointer"
                              >
                                {copiedAdminKey ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                {copiedAdminKey ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={savingCreds}
                        onClick={handleRegenerateAdminRecoveryKey}
                        className="w-full py-2.5 px-4 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        {adminCredInfo?.hasRecoveryKey ? 'Rotate Recovery Key' : 'Generate Recovery Key'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
