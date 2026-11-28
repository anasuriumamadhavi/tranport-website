import fs from 'fs';
import path from 'path';
import { MongoClient, Db } from 'mongodb';
import {
  Booking,
  Driver,
  Enquiry,
  FeaturedDestination,
  GalleryItem,
  PaymentRecord,
  PricingConfig,
  Review,
  TravelPackage,
  TravelService,
  UserProfile,
  Vehicle,
  WebsiteSettings,
} from '../src/types';

export interface StoredUser extends UserProfile {
  passwordHash: string;
  recoveryPinHash?: string;
  resetTokenHash?: string;
  resetTokenExpiresAt?: string;
}

export interface AdminCredentialRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  recoveryCodeHash?: string;
  resetTokenHash?: string;
  resetTokenExpiresAt?: string;
  adminEmailMigrated?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AdminActionTokenRecord {
  id: string;
  tokenHash: string;
  targetType: 'booking' | 'enquiry';
  targetId: string;
  action: 'confirm' | 'reject' | 'reply';
  expiresAt: string;
  usedAt?: string;
  usedByEmail?: string;
  usedByRole?: string;
  decisionResult?: string;
  createdAt: string;
}

export interface DatabaseSchema {
  vehicles: Vehicle[];
  drivers: Driver[];
  bookings: Booking[];
  payments: PaymentRecord[];
  enquiries: Enquiry[];
  reviews: Review[];
  gallery: GalleryItem[];
  services: TravelService[];
  destinations: FeaturedDestination[];
  packages: TravelPackage[];
  users: StoredUser[];
  pricing: PricingConfig;
  settings: WebsiteSettings;
  adminCredentials: AdminCredentialRecord[];
  adminActionTokens: AdminActionTokenRecord[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'vizag_jagan_db.json');

const SEED_PRICING: PricingConfig = {
  updatedAt: new Date().toISOString(),
  additionalCharges: {
    estimatedTollPer100Km: 180,
    parkingNote: 'Airport, hotel & city parking fees payable at actuals',
    statePermitEstimate: 850,
    taxPercent: 5,
    advancePaymentPercent: 25,
    includedSummary: [
      'Company-owned inspected vehicle & verified chauffeur',
      'Fuel charges for the quoted distance & package hours',
      'Standard 5% GST included in final invoice total',
      '24/7 fleet dispatch & trip monitoring support',
    ],
    additionalSummary: [
      'Highway tolls & FASTag charges (payable as actuals)',
      'Parking fees & airport entry/waiting charges (at actuals)',
      'Interstate road tax / state border permits (when crossing state lines)',
      'Extra km / extra hours beyond package limit billed at category rate',
    ],
  },
  rules: [
    {
      category: 'Cars',
      fleetGroup: 'Car',
      perKmRate: 14,
      perHourRate: 260,
      halfDayRate: 1350,
      fullDayRate: 2450,
      outstationPerKmRate: 14,
      outstationMinKmPerDay: 250,
      perDayBusRate: 0,
      extraKmRate: 14,
      driverAllowancePerDay: 400,
      nightCharge: 300,
    },
    {
      category: 'SUVs',
      fleetGroup: 'Car',
      perKmRate: 19,
      perHourRate: 360,
      halfDayRate: 1950,
      fullDayRate: 3500,
      outstationPerKmRate: 19,
      outstationMinKmPerDay: 250,
      perDayBusRate: 0,
      extraKmRate: 19,
      driverAllowancePerDay: 500,
      nightCharge: 400,
    },
    {
      category: 'Premium Cars',
      fleetGroup: 'Car',
      perKmRate: 38,
      perHourRate: 750,
      halfDayRate: 4200,
      fullDayRate: 7800,
      outstationPerKmRate: 38,
      outstationMinKmPerDay: 250,
      perDayBusRate: 0,
      extraKmRate: 38,
      driverAllowancePerDay: 800,
      nightCharge: 700,
    },
    {
      category: 'Tempo Travellers',
      fleetGroup: 'Bus',
      perKmRate: 26,
      perHourRate: 520,
      halfDayRate: 3200,
      fullDayRate: 5600,
      outstationPerKmRate: 26,
      outstationMinKmPerDay: 250,
      perDayBusRate: 6200,
      extraKmRate: 26,
      driverAllowancePerDay: 600,
      nightCharge: 500,
      customQuotationRequiredOverKm: 1800,
    },
    {
      category: 'Mini Buses',
      fleetGroup: 'Bus',
      perKmRate: 34,
      perHourRate: 680,
      halfDayRate: 4500,
      fullDayRate: 7900,
      outstationPerKmRate: 34,
      outstationMinKmPerDay: 250,
      perDayBusRate: 8500,
      extraKmRate: 34,
      driverAllowancePerDay: 750,
      nightCharge: 650,
      customQuotationRequiredOverKm: 1600,
    },
    {
      category: 'Luxury Buses',
      fleetGroup: 'Bus',
      perKmRate: 58,
      perHourRate: 1200,
      halfDayRate: 8500,
      fullDayRate: 14500,
      outstationPerKmRate: 58,
      outstationMinKmPerDay: 300,
      perDayBusRate: 16500,
      extraKmRate: 58,
      driverAllowancePerDay: 1000,
      nightCharge: 900,
      customQuotationRequiredOverKm: 1500,
    },
    {
      category: 'Large Passenger Buses',
      fleetGroup: 'Bus',
      perKmRate: 52,
      perHourRate: 1050,
      halfDayRate: 7800,
      fullDayRate: 13200,
      outstationPerKmRate: 52,
      outstationMinKmPerDay: 300,
      perDayBusRate: 14800,
      extraKmRate: 52,
      driverAllowancePerDay: 1000,
      nightCharge: 850,
      customQuotationRequiredOverKm: 1500,
    },
  ],
};

const SEED_DRIVERS: Driver[] = [
  {
    id: 'drv-101',
    name: 'Rajesh Sharma',
    phone: '+91 98450 21401',
    email: 'rajesh.sharma@vizagjagantravels.com',
    licenseNumber: 'AP31-20160048219',
    licenseExpiry: '2031-08-15',
    experienceYears: 11,
    languages: ['English', 'Hindi', 'Telugu'],
    available: true,
    assignedVehicleId: 'veh-car-1',
    status: 'Active',
    createdAt: '2025-01-10T08:00:00.000Z',
  },
  {
    id: 'drv-102',
    name: 'Vikram Nair',
    phone: '+91 98450 21402',
    email: 'vikram.nair@vizagjagantravels.com',
    licenseNumber: 'AP31-20140091204',
    licenseExpiry: '2030-05-20',
    experienceYears: 14,
    languages: ['English', 'Hindi', 'Telugu'],
    available: true,
    assignedVehicleId: 'veh-suv-1',
    status: 'Active',
    createdAt: '2025-01-12T08:00:00.000Z',
  },
  {
    id: 'drv-103',
    name: 'Arjun Deshmukh',
    phone: '+91 98450 21403',
    email: 'arjun.d@vizagjagantravels.com',
    licenseNumber: 'AP31-20120033811',
    licenseExpiry: '2029-11-30',
    experienceYears: 16,
    languages: ['English', 'Hindi', 'Telugu'],
    available: true,
    assignedVehicleId: 'veh-prem-1',
    status: 'Active',
    createdAt: '2025-02-01T08:00:00.000Z',
  },
  {
    id: 'drv-104',
    name: 'Suresh Rao',
    phone: '+91 98450 21404',
    email: 'suresh.r@vizagjagantravels.com',
    licenseNumber: 'AP31-20130077412',
    licenseExpiry: '2030-09-12',
    experienceYears: 13,
    languages: ['English', 'Telugu', 'Hindi'],
    available: true,
    assignedVehicleId: 'veh-tt-1',
    status: 'Active',
    createdAt: '2025-02-10T08:00:00.000Z',
  },
  {
    id: 'drv-105',
    name: 'Mahesh Kulkarni',
    phone: '+91 98450 21405',
    email: 'mahesh.k@vizagjagantravels.com',
    licenseNumber: 'AP31-20100051908',
    licenseExpiry: '2029-04-18',
    experienceYears: 18,
    languages: ['English', 'Hindi', 'Telugu'],
    available: true,
    assignedVehicleId: 'veh-bus-1',
    status: 'Active',
    createdAt: '2025-03-01T08:00:00.000Z',
  },
  {
    id: 'drv-106',
    name: 'Prakash Reddy',
    phone: '+91 98450 21406',
    email: 'prakash.r@vizagjagantravels.com',
    licenseNumber: 'AP39-20110064231',
    licenseExpiry: '2031-01-25',
    experienceYears: 15,
    languages: ['English', 'Hindi', 'Telugu'],
    available: true,
    assignedVehicleId: 'veh-lbus-1',
    status: 'Active',
    createdAt: '2025-03-14T08:00:00.000Z',
  },
];

const SEED_VEHICLES: Vehicle[] = [
  {
    id: 'veh-car-1',
    name: 'Honda City ZX Executive',
    model: '2025 Honda City i-VTEC',
    registrationNumber: 'AP-31-VJ-1102',
    category: 'Cars',
    fleetGroup: 'Car',
    seatingCapacity: 4,
    luggageCapacity: 3,
    ac: true,
    transmission: 'Automatic',
    fuelType: 'Petrol',
    status: 'Available',
    images: [
      '/src/assets/images/fleet_executive_sedan_1795608170835.jpg',
      '/src/assets/images/hero_fleet_showcase_1795608169193.jpg',
    ],
    features: ['Dual-Zone Climate Control', 'Rear AC Vents', 'USB-C Fast Charging', 'Bottled Water & First-Aid Kit'],
    services: ['Local City Travel', 'Airport Pickup & Drop', 'Corporate Transportation', 'Outstation Trips'],
    assignedDriverId: 'drv-101',
    description: 'Company-maintained executive sedan tailored for airport transfers, city meetings, and comfortable intercity family rides.',
    terms: [
      'Kilometres and hours are calculated from garage to garage.',
      'Tolls, parking, and interstate permits are billed at actuals.',
      'Night driver allowance applies between 10:00 PM and 6:00 AM.',
    ],
    createdAt: '2025-01-10T09:00:00.000Z',
  },
  {
    id: 'veh-suv-1',
    name: 'Toyota Innova Hycross Touring',
    model: '2025 Innova Hycross VX Hybrid',
    registrationNumber: 'AP-31-VJ-2208',
    category: 'SUVs',
    fleetGroup: 'Car',
    seatingCapacity: 7,
    luggageCapacity: 5,
    ac: true,
    transmission: 'Automatic',
    fuelType: 'Hybrid',
    status: 'Available',
    images: [
      '/src/assets/images/fleet_luxury_suv_1795608170547.jpg',
      '/src/assets/images/hero_fleet_showcase_1795608169193.jpg',
    ],
    features: ['Captain Lounge Seats', 'Panoramic Sunroof', '3-Zone AC', 'Ample Highway Boot Space'],
    services: ['Family Trips', 'Outstation Trips', 'Airport Pickup & Drop', 'Corporate Transportation'],
    assignedDriverId: 'drv-102',
    description: 'Our flagship 7-seater hybrid family and executive MPV featuring whisper-quiet cabin comfort for long highway journeys.',
    terms: [
      'Minimum 250 km/day billing applies on outstation trips.',
      'Captain seats comfortably accommodate 6 passengers + driver or 7 with bench configuration.',
      'Free cancellation up to 24 hours before scheduled departure.',
    ],
    createdAt: '2025-01-14T09:00:00.000Z',
  },
  {
    id: 'veh-prem-1',
    name: 'Mercedes-Benz E-Class Chauffeur',
    model: '2025 E 220d Long Wheelbase',
    registrationNumber: 'AP-31-VJ-0009',
    category: 'Premium Cars',
    fleetGroup: 'Car',
    seatingCapacity: 4,
    luggageCapacity: 3,
    ac: true,
    transmission: 'Automatic',
    fuelType: 'Diesel',
    status: 'Available',
    images: [
      '/src/assets/images/fleet_premium_sedan_1795608172264.jpg',
      '/src/assets/images/hero_fleet_showcase_1795608169193.jpg',
    ],
    features: ['Executive Rear Lounge', 'Chauffeur in Formal Attire', 'Wi-Fi Hotspot', 'Ambient Cabin Lighting'],
    services: ['Corporate Transportation', 'Wedding Transportation', 'Airport Pickup & Drop', 'Event Transportation'],
    assignedDriverId: 'drv-103',
    description: 'Flagship chauffeur-driven luxury saloon for VIP executives, diplomatic guests, and milestone wedding arrivals.',
    terms: [
      'Uniformed English-speaking chauffeur included.',
      'Complimentary 45-minute airport flight-delay wait time.',
      'Wedding floral decor available upon advance notice.',
    ],
    createdAt: '2025-02-01T09:00:00.000Z',
  },
  {
    id: 'veh-tt-1',
    name: 'Force Urbania 17-Seater Executive',
    model: '2025 Force Urbania High-Roof AC',
    registrationNumber: 'AP-31-VJ-4410',
    category: 'Tempo Travellers',
    fleetGroup: 'Bus',
    seatingCapacity: 17,
    luggageCapacity: 14,
    ac: true,
    transmission: 'Manual',
    fuelType: 'Diesel',
    status: 'Available',
    images: [
      '/src/assets/images/fleet_tempo_traveller_1795608172563.jpg',
      '/src/assets/images/hero_fleet_showcase_1795608169193.jpg',
    ],
    features: ['Individual Reclining Pushback Seats', 'Full Standing Cabin Height', 'Individual AC Louvers', 'Dedicated Rear Luggage Bay'],
    services: ['Group Travel', 'Family Trips', 'Outstation Trips', 'Event Transportation'],
    assignedDriverId: 'drv-104',
    description: 'Next-generation 17-seater executive van built for extended family vacations, corporate offsites, and weekend group travel.',
    terms: [
      'All-India tourist permit ready; state border taxes billed at actuals.',
      'Overhead cabin racks + dedicated rear luggage bay.',
      'Minimum 250 km/day outstation billing.',
    ],
    createdAt: '2025-02-12T09:00:00.000Z',
  },
  {
    id: 'veh-mbus-1',
    name: 'Eicher Skyline 24-Seater Mini Coach',
    model: '2025 Eicher Skyline Pro AC',
    registrationNumber: 'AP-31-VJ-5521',
    category: 'Mini Buses',
    fleetGroup: 'Bus',
    seatingCapacity: 24,
    luggageCapacity: 22,
    ac: true,
    transmission: 'Manual',
    fuelType: 'Diesel',
    status: 'Available',
    images: [
      '/src/assets/images/fleet_tempo_traveller_1795608172563.jpg',
      '/src/assets/images/fleet_luxury_coach_1795608171806.jpg',
    ],
    features: ['2x2 Plush Pushback Seating', 'Air Suspension', 'PA Microphone System', 'Under-Floor Luggage Hold'],
    services: ['Corporate Transportation', 'Wedding Transportation', 'School and College Transportation', 'Event Transportation'],
    assignedDriverId: 'drv-104',
    description: 'Agile 24-seater air-conditioned mini coach designed for wedding guest shuttles, campus tours, and mid-size group charters.',
    terms: [
      'Includes uniformed driver and cabin attendant on multi-day charters.',
      'Sound system & microphone available for tour coordinators.',
    ],
    createdAt: '2025-02-20T09:00:00.000Z',
  },
  {
    id: 'veh-bus-1',
    name: 'Volvo 9600 45-Seater Luxury Coach',
    model: '2025 Volvo 9600 Multi-Axle AC',
    registrationNumber: 'AP-31-VJ-8801',
    category: 'Luxury Buses',
    fleetGroup: 'Bus',
    seatingCapacity: 45,
    luggageCapacity: 45,
    ac: true,
    transmission: 'Automatic',
    fuelType: 'Diesel',
    status: 'Available',
    images: [
      '/src/assets/images/fleet_luxury_coach_1795608171806.jpg',
      '/src/assets/images/hero_fleet_showcase_1795608169193.jpg',
    ],
    features: ['45 Semi-Sleeper Executive Seats', 'Pneumatic Air Suspension', 'Dual LED Screens & Wi-Fi', 'Massive Under-Deck Cargo'],
    services: ['Group Travel', 'Corporate Transportation', 'Outstation Trips', 'Event Transportation'],
    assignedDriverId: 'drv-105',
    description: 'Flagship multi-axle intercity touring coach built for seamless long-distance group charters, conferences, and destination weddings.',
    terms: [
      'Minimum 300 km/day outstation billing.',
      'Dual-driver compliance enforced on overnight routes over 450 km.',
      'GPS speed governor & live dispatch tracking active.',
    ],
    createdAt: '2025-03-01T09:00:00.000Z',
  },
  {
    id: 'veh-lbus-1',
    name: 'BharatBenz 52-Seater Touring Coach',
    model: '2025 BharatBenz 1624 High-Capacity',
    registrationNumber: 'AP-31-VJ-9910',
    category: 'Large Passenger Buses',
    fleetGroup: 'Bus',
    seatingCapacity: 52,
    luggageCapacity: 52,
    ac: false,
    transmission: 'Manual',
    fuelType: 'Diesel',
    status: 'Available',
    images: [
      '/src/assets/images/fleet_luxury_coach_1795608171806.jpg',
      '/src/assets/images/hero_fleet_showcase_1795608169193.jpg',
    ],
    features: ['52 High-Back Ergonomic Seats', 'Panoramic Sliding Windows', 'Emergency Exit & First Aid', 'High-Volume Luggage Racks'],
    services: ['School and College Transportation', 'Event Transportation', 'Group Travel', 'Wedding Transportation'],
    assignedDriverId: 'drv-106',
    description: 'High-capacity 52-seater non-AC / ventilated passenger coach ideal for school excursions, college fests, and large workforce shuttles.',
    terms: [
      'Certified school & institutional safety inspection compliant.',
      'Speed limiter & CCTV cabin monitoring installed.',
    ],
    createdAt: '2025-03-14T09:00:00.000Z',
  },
];

const SEED_REVIEWS: Review[] = [
  {
    id: 'rev-1',
    customerName: 'Ananya Krishnan',
    roleOrCity: 'Operations Director · Visakhapatnam',
    companyOrTrip: 'Corporate Offsite (45-Seater Volvo Coach)',
    vehicleCategory: 'Luxury Buses',
    rating: 5,
    comment: 'Booked two Volvo 9600 coaches for our annual leadership retreat to Araku Valley. Both buses arrived 20 minutes ahead of schedule, spotless interiors, and transparent final billing with zero surprises.',
    verified: true,
    createdAt: '2026-09-12T10:00:00.000Z',
  },
  {
    id: 'rev-2',
    customerName: 'Rohan Malhotra',
    roleOrCity: 'Family Traveller · Vijayawada',
    companyOrTrip: '5-Day Outstation Family Trip (Innova Hycross)',
    vehicleCategory: 'SUVs',
    rating: 5,
    comment: 'Having the company own its fleet makes a huge difference. The Innova Hycross felt brand new, and our driver Vikram knew every coastal highway stop and ghat section safely.',
    verified: true,
    createdAt: '2026-10-03T14:30:00.000Z',
  },
  {
    id: 'rev-3',
    customerName: 'Meera & Siddharth Rao',
    roleOrCity: 'Wedding Hosts · Visakhapatnam',
    companyOrTrip: 'Wedding Guest Shuttles (Tempo Traveller & E-Class)',
    vehicleCategory: 'Premium Cars',
    rating: 5,
    comment: 'We coordinated airport pickups for 60 wedding guests using Vizag Jagan Travels’ Tempo Travellers plus a Mercedes E-Class for the couple. Seamless dispatch and instant WhatsApp support.',
    verified: true,
    createdAt: '2026-10-21T09:15:00.000Z',
  },
];

const SEED_BOOKINGS: Booking[] = [
  {
    id: 'bkg-seed-1',
    bookingCode: 'VF-2026-1042',
    customerName: 'Karthik Subramanian',
    customerEmail: 'karthik.s@example.com',
    customerPhone: '+91 98801 44510',
    vehicleId: 'veh-suv-1',
    vehicleName: 'Toyota Innova Hycross Touring',
    vehicleCategory: 'SUVs',
    driverId: 'drv-102',
    driverName: 'Vikram Nair',
    driverPhone: '+91 98450 21402',
    pickupLocation: 'Visakhapatnam International Airport (VTZ), Visakhapatnam',
    dropLocation: 'Araku Valley Hill Station, Andhra Pradesh',
    pickupLat: 17.7212,
    pickupLng: 83.2245,
    dropLat: 18.3273,
    dropLng: 82.8775,
    journeyDate: '2026-11-28',
    journeyTime: '08:30',
    returnDate: '2026-11-29',
    passengerCount: 5,
    tripType: 'Round Trip',
    estimatedDistanceKm: 118,
    estimatedDurationText: '3 hrs 10 mins',
    fareEstimate: {
      baseFare: 9500,
      extraKmCharges: 0,
      driverAllowance: 1000,
      nightCharges: 0,
      taxAmount: 525,
      subtotal: 10500,
      totalEstimatedFare: 11025,
      advancePayable: 2756,
      estimatedTollsExtra: 666,
      estimatedStatePermitExtra: 0,
      pricingBreakdownNote: '2 day(s) · 500 km billed (min 250 km/day @ ₹19/km)',
      includedItems: SEED_PRICING.additionalCharges.includedSummary,
      additionalItems: SEED_PRICING.additionalCharges.additionalSummary,
      requiresCustomQuote: false,
    },
    totalFare: 11025,
    paidAmount: 2756,
    paymentStatus: 'Advance Paid',
    bookingStatus: 'Driver Assigned',
    paymentMode: 'Advance',
    createdAt: '2026-11-20T11:00:00.000Z',
    updatedAt: '2026-11-20T11:30:00.000Z',
  },
  {
    id: 'bkg-seed-2',
    bookingCode: 'VF-2026-1038',
    customerName: 'Priya Nair',
    customerEmail: 'priya.nair@example.com',
    customerPhone: '+91 99002 33112',
    vehicleId: 'veh-bus-1',
    vehicleName: 'Volvo 9600 45-Seater Luxury Coach',
    vehicleCategory: 'Luxury Buses',
    driverId: 'drv-105',
    driverName: 'Mahesh Kulkarni',
    driverPhone: '+91 98450 21405',
    pickupLocation: 'RK Beach Road, Visakhapatnam',
    dropLocation: 'Benz Circle, Vijayawada',
    pickupLat: 17.7143,
    pickupLng: 83.3237,
    dropLat: 16.5062,
    dropLng: 80.648,
    journeyDate: '2026-11-18',
    journeyTime: '06:00',
    returnDate: '2026-11-19',
    passengerCount: 40,
    tripType: 'Round Trip',
    estimatedDistanceKm: 350,
    estimatedDurationText: '6 hrs 15 mins',
    fareEstimate: {
      baseFare: 34800,
      extraKmCharges: 0,
      driverAllowance: 2000,
      nightCharges: 0,
      taxAmount: 1840,
      subtotal: 36800,
      totalEstimatedFare: 38640,
      advancePayable: 9660,
      estimatedTollsExtra: 972,
      estimatedStatePermitExtra: 0,
      pricingBreakdownNote: '2 day(s) · 600 km billed (min 300 km/day @ ₹58/km)',
      includedItems: SEED_PRICING.additionalCharges.includedSummary,
      additionalItems: SEED_PRICING.additionalCharges.additionalSummary,
      requiresCustomQuote: false,
    },
    totalFare: 38640,
    paidAmount: 38640,
    paymentStatus: 'Fully Paid',
    bookingStatus: 'Completed',
    paymentMode: 'Full',
    createdAt: '2026-11-10T09:00:00.000Z',
    updatedAt: '2026-11-19T21:00:00.000Z',
  },
];

const SEED_PAYMENTS: PaymentRecord[] = [
  {
    id: 'pay-seed-1',
    bookingId: 'bkg-seed-1',
    bookingCode: 'VF-2026-1042',
    customerName: 'Karthik Subramanian',
    customerEmail: 'karthik.s@example.com',
    amount: 2756,
    paymentType: 'Advance',
    gateway: 'Razorpay Test',
    razorpayOrderId: 'order_seed_1042',
    razorpayPaymentId: 'pay_seed_1042',
    status: 'Captured',
    createdAt: '2026-11-20T11:05:00.000Z',
  },
  {
    id: 'pay-seed-2',
    bookingId: 'bkg-seed-2',
    bookingCode: 'VF-2026-1038',
    customerName: 'Priya Nair',
    customerEmail: 'priya.nair@example.com',
    amount: 38640,
    paymentType: 'Full',
    gateway: 'Razorpay Test',
    razorpayOrderId: 'order_seed_1038',
    razorpayPaymentId: 'pay_seed_1038',
    status: 'Captured',
    createdAt: '2026-11-10T09:10:00.000Z',
  },
];

const SEED_ENQUIRIES: Enquiry[] = [
  {
    id: 'enq-1',
    name: 'Devika Menon',
    email: 'devika@horizoncorp.in',
    phone: '+91 98111 77420',
    subject: 'Monthly Corporate Shuttle Contract (2 Mini Buses)',
    message: 'Looking for two 24-seater AC mini buses for daily employee shuttle between Madhurawada IT SEZ and Dwaraka Nagar.',
    source: 'Contact Form',
    status: 'New',
    createdAt: '2026-11-24T10:15:00.000Z',
  },
];

export const SEED_SETTINGS: WebsiteSettings = {
  companyName: 'Vizag Jagan Travels',
  tagline: 'Direct-Owned Cars, Tempo Travellers & Luxury Buses',
  logoUrl: '/assets/aistudio/Vizag_Jagan_Tours___Travels_Emblem_1d2872dc.png',
  establishedYear: 'Est. 2020',
  footerDescription:
    'Direct-owned sedans, executive SUVs, Tempo Travellers, and luxury motorcoaches. Travel with comfort, explore with us.',
  footerPermitsLine: 'Est. 2020 · All-India Tourist Permit · GPS Monitored Dispatch',

  heroHeadline: 'Your Journey, Our Responsibility.',
  heroSubheading:
    'Reliable Cars and Buses for Every Journey. Travel Comfortably, Safely and Affordably.',
  heroBannerUrl: '/src/assets/images/hero_fleet_showcase_1795608169193.jpg',
  heroAutoplaySeconds: 6,
  heroSlides: [
    {
      id: 'slide-1',
      eyebrow: 'Direct-Owned Cars, Tempo Travellers & Luxury Buses',
      headline: 'Your Journey, Our Responsibility.',
      subheading:
        'Reliable Cars and Buses for Every Journey. Travel Comfortably, Safely and Affordably.',
      imageUrl: '/src/assets/images/hero_fleet_showcase_1795608169193.jpg',
      ctaLabel: 'Explore Our Fleet',
      ctaTarget: 'fleet',
    },
    {
      id: 'slide-2',
      eyebrow: 'Eastern Ghats & Outstation Coach Charters',
      headline: 'Araku Valley & Highway Coach Charters.',
      subheading:
        'Multi-axle Volvo coaches and pushback Tempo Travellers driven by full-time ghat-route specialists.',
      imageUrl: '/src/assets/images/gallery_highway_coach_araku_1795613271573.jpg',
      ctaLabel: 'Explore Destinations',
      ctaTarget: 'destinations',
    },
    {
      id: 'slide-3',
      eyebrow: '24/7 VTZ Terminal Pickups & Executive Mobility',
      headline: 'Punctual Airport & Corporate Transfers.',
      subheading:
        'Flight-tracked arrivals with uniformed chauffeurs and sanitized executive sedans ready at the terminal.',
      imageUrl: '/src/assets/images/gallery_airport_transfer_1795613269949.jpg',
      ctaLabel: 'View Services',
      ctaTarget: 'services',
    },
    {
      id: 'slide-4',
      eyebrow: 'Bridal Luxury Cars & Coordinated Guest Shuttles',
      headline: 'Seamless Wedding & Event Transportation.',
      subheading:
        'Coordinated Mercedes saloons, SUVs, and AC guest coaches with on-site dispatch management.',
      imageUrl: '/src/assets/images/gallery_wedding_fleet_1795613271173.jpg',
      ctaLabel: 'Book Event Fleet',
      ctaTarget: 'booking',
    },
  ],
  whyChooseTitle: 'Why Choose Vizag Jagan Travels?',
  whyChooseDescription:
    'Unlike third-party aggregator marketplaces, Vizag Jagan Travels owns, services, and dispatches every car and bus in our inventory. You get predictable quality, accountable drivers, and direct pricing.',
  onTimeMetric: '99.4%',
  ownedFleetMetric: '100%',

  defaultPickupAddress: 'Visakhapatnam International Airport (VTZ), Vizag',
  defaultPickupLat: 17.7212,
  defaultPickupLng: 83.2245,
  defaultDropAddress: 'Araku Valley Hill Station, Visakhapatnam District',
  defaultDropLat: 18.3273,
  defaultDropLng: 82.8775,
  businessAddress: 'Dwaraka Nagar Main Road, Visakhapatnam, AP 530016',
  depotLat: 17.7289,
  depotLng: 83.3106,

  supportPhone: '+91 891 274 8800',
  supportEmail: 'dispatch@vizagjagantravels.com',
  whatsappNumber: '918912748800',
  whatsappDefaultMessage: 'Hello Vizag Jagan Travels Dispatch',
  workingHours: '24/7 Dispatch & Booking Desk',

  bookingCodePrefix: 'VF',
  allowOnlinePayment: false,
  allowPayLater: true,
  allowGuestBooking: true,
  showWhatsAppWidget: true,
  maintenanceMode: false,
  maintenanceMessage:
    'Scheduled fleet dispatch maintenance is underway. Existing bookings remain active; call our 24/7 desk for urgent reservations.',
  gstNumber: '',
  invoiceFooterNote:
    'Thank you for travelling with Vizag Jagan Travels · 24/7 Dispatch: +91 891 274 8800',

  seoTitle: 'Vizag Jagan Travels — Car & Bus Travel Booking Platform',
  seoDescription:
    'Book direct-owned cars, SUVs, Tempo Travellers, mini buses, and luxury coaches with Vizag Jagan Travels for local city travel, airport transfers, outstation trips, weddings, and corporate charters.',
  facebookUrl: 'https://www.facebook.com/vizagjagantravels',
  instagramUrl: 'https://www.instagram.com/vizagjagantravels',
  youtubeUrl: 'https://www.youtube.com/@vizagjagantravels',
  twitterUrl: 'https://x.com/vizagjagantravel',
  updatedAt: new Date().toISOString(),
};

export const SEED_GALLERY: GalleryItem[] = [
  {
    id: 'gal-101',
    title: 'Eastern Ghats Araku Coach Dispatch',
    category: 'Outstation & Tours',
    imageUrl: '/src/assets/images/gallery_highway_coach_araku_1795613271573.jpg',
    caption: 'Volvo 9600 multi-axle AC coach climbing the scenic Araku Valley ghat highway on an institutional corporate retreat.',
    routeOrContext: 'Visakhapatnam → Araku Valley · 45-Seater Coach',
    recommendedCategory: 'Luxury Buses',
    featured: true,
    createdAt: '2026-11-10T08:00:00.000Z',
  },
  {
    id: 'gal-102',
    title: 'VTZ Terminal Chauffeur Meet & Greet',
    category: 'Airport & Corporate',
    imageUrl: '/src/assets/images/gallery_airport_transfer_1795613269949.jpg',
    caption: 'Uniformed company chauffeur stationed at Visakhapatnam International Airport arrival bay 20 minutes before landing.',
    routeOrContext: 'VTZ Airport → RK Beach & IT SEZ · Executive Sedan',
    recommendedCategory: 'Cars',
    featured: false,
    createdAt: '2026-11-09T09:00:00.000Z',
  },
  {
    id: 'gal-103',
    title: 'Bridal Saloon & Wedding Guest Lineup',
    category: 'Weddings & Events',
    imageUrl: '/src/assets/images/gallery_wedding_fleet_1795613271173.jpg',
    caption: 'White Mercedes E-Class long-wheelbase bridal arrival prepared with fresh floral ribbon outside coastal heritage venue.',
    routeOrContext: 'Rushikonda Resorts · Wedding Chauffeur Fleet',
    recommendedCategory: 'Premium Cars',
    featured: false,
    createdAt: '2026-11-08T10:30:00.000Z',
  },
  {
    id: 'gal-104',
    title: 'Volvo 9600 Executive Cabin & Pushback Seating',
    category: 'Coach Interiors',
    imageUrl: '/src/assets/images/gallery_coach_interior_cabin_1795613271229.jpg',
    caption: 'Sanitized 2x2 semi-sleeper reclining cabin with individual AC louvers, reading lamps, and panoramic highway glass.',
    routeOrContext: 'Luxury Buses · Onboard Passenger Cabin',
    recommendedCategory: 'Luxury Buses',
    featured: true,
    createdAt: '2026-11-07T11:00:00.000Z',
  },
  {
    id: 'gal-105',
    title: 'Direct-Owned Vizag Fleet Yard Lineup',
    category: 'Fleet Showcase',
    imageUrl: '/src/assets/images/hero_fleet_showcase_1795608169193.jpg',
    caption: 'Morning inspection completed across our company-owned executive sedans, hybrid SUVs, and multi-axle coaches.',
    routeOrContext: 'Dwaraka Nagar Central Depot · Visakhapatnam',
    recommendedCategory: 'Cars',
    featured: true,
    createdAt: '2026-11-06T07:00:00.000Z',
  },
  {
    id: 'gal-106',
    title: 'Toyota Innova Hycross Family Touring MPV',
    category: 'Outstation & Tours',
    imageUrl: '/src/assets/images/fleet_luxury_suv_1795608170547.jpg',
    caption: 'Hybrid 7-seater captain-chair MPV ready for multi-day coastal and temple circuit journeys across Andhra Pradesh.',
    routeOrContext: 'Visakhapatnam → Vijayawada & Simhachalam',
    recommendedCategory: 'SUVs',
    featured: false,
    createdAt: '2026-11-05T12:00:00.000Z',
  },
  {
    id: 'gal-107',
    title: 'Force Urbania 17-Seater High-Roof Van',
    category: 'Fleet Showcase',
    imageUrl: '/src/assets/images/fleet_tempo_traveller_1795608172563.jpg',
    caption: 'Full standing height, wide aisles, and individual AC vents engineered for relaxed family reunions and group tours.',
    routeOrContext: 'Group Travel · 17-Seater Tempo Traveller',
    recommendedCategory: 'Tempo Travellers',
    featured: false,
    createdAt: '2026-11-04T14:00:00.000Z',
  },
  {
    id: 'gal-108',
    title: 'VIP Corporate Saloon Dispatch',
    category: 'Airport & Corporate',
    imageUrl: '/src/assets/images/fleet_premium_sedan_1795608172264.jpg',
    caption: 'Discreet executive ground transport tailored for board visits, diplomatic delegations, and maritime port officials.',
    routeOrContext: 'Visakhapatnam Port & Madhura IT SEZ',
    recommendedCategory: 'Premium Cars',
    featured: false,
    createdAt: '2026-11-03T15:00:00.000Z',
  },
  {
    id: 'gal-109',
    title: 'Honda City ZX Local City & Business Charter',
    category: 'Fleet Showcase',
    imageUrl: '/src/assets/images/fleet_executive_sedan_1795608170835.jpg',
    caption: 'Clean, quiet 4-seater city sedan for 4-hour and 8-hour local client meetings and family errands.',
    routeOrContext: 'Vizag City · 4-Seater Executive Sedan',
    recommendedCategory: 'Cars',
    featured: false,
    createdAt: '2026-11-02T09:30:00.000Z',
  },
  {
    id: 'gal-110',
    title: 'Large Group Convention & Campus Coach',
    category: 'Weddings & Events',
    imageUrl: '/src/assets/images/fleet_luxury_coach_1795608171806.jpg',
    caption: 'High-capacity motorcoaches synchronized for wedding barat guests, college industrial visits, and conference shuttles.',
    routeOrContext: '45–52 Seater Coach Charter · AP & Telangana',
    recommendedCategory: 'Large Passenger Buses',
    featured: false,
    createdAt: '2026-11-01T08:45:00.000Z',
  },
];

export const SEED_SERVICES: TravelService[] = [
  {
    id: 'srv-01',
    num: '01',
    title: 'Local City Travel',
    tagline: 'Hourly & Full-Day Visakhapatnam Chauffeur Packages',
    desc: 'Flexible 4-hour / 40 km and 8-hour / 80 km chauffeur-driven city packages built for business meetings, medical visits, shopping errands, and family city itineraries.',
    status: 'Active',
    tripType: 'Local Rental',
    defaultCategory: 'Cars',
    defaultPassengers: 3,
    passengerRange: '1–7 Passengers',
    idealFleet: 'Honda City ZX · Innova Hycross',
    imageUrl: '/src/assets/images/fleet_executive_sedan_1795608170835.jpg',
    galleryCategory: 'Fleet Showcase',
    highlights: [
      'Direct garage dispatch with sanitized cabin',
      'Predictable package hours with transparent extra-km tariff',
      'City-experienced uniformed chauffeurs',
    ],
    createdAt: '2026-01-01T08:00:00.000Z',
  },
  {
    id: 'srv-02',
    num: '02',
    title: 'Outstation Trips',
    tagline: 'Coastal Highways, Temple Circuits & Hill Station Charters',
    desc: 'One-way and multi-day intercity travel across Andhra Pradesh, Telangana, and Odisha including Araku Valley, Vijayawada, Tirupati, Rajahmundry, and Bhubaneswar.',
    status: 'Active',
    tripType: 'Round Trip',
    defaultCategory: 'SUVs',
    defaultPassengers: 5,
    passengerRange: '4–45 Passengers',
    idealFleet: 'Innova Hycross · Urbania · Volvo 9600',
    imageUrl: '/src/assets/images/gallery_highway_coach_araku_1795613271573.jpg',
    galleryCategory: 'Outstation & Tours',
    highlights: [
      'Mountain ghat & highway-trained company captains',
      'Upfront estimate showing fuel, allowance & actual tolls',
      '24/7 central dispatch tracking on long routes',
    ],
    createdAt: '2026-01-02T08:00:00.000Z',
  },
  {
    id: 'srv-03',
    num: '03',
    title: 'Airport Pickup & Drop',
    tagline: 'Flight-Tracked Terminal Transfers at VTZ Airport',
    desc: 'Punctual curbside pickups and early-morning drops at Visakhapatnam International Airport (VTZ) with complimentary flight-delay buffer and dedicated boot space.',
    status: 'Active',
    tripType: 'Airport Transfer',
    defaultCategory: 'Cars',
    defaultPassengers: 2,
    passengerRange: '1–17 Passengers',
    idealFleet: 'Honda City · E-Class · Force Urbania',
    imageUrl: '/src/assets/images/gallery_airport_transfer_1795613269949.jpg',
    galleryCategory: 'Airport & Corporate',
    highlights: [
      '45-minute complimentary arrival wait buffer',
      'Chauffeur placard greeting & luggage assistance',
      '24/7 red-eye & early dawn terminal coverage',
    ],
    createdAt: '2026-01-03T08:00:00.000Z',
  },
  {
    id: 'srv-04',
    num: '04',
    title: 'Family Trips',
    tagline: 'Spacious Captain-Seat MPVs & Executive Family Vans',
    desc: 'Uninterrupted multi-generational vacations with generous legroom, multi-zone climate control, and overhead plus rear luggage bays built for coastal and temple tours.',
    status: 'Active',
    tripType: 'Round Trip',
    defaultCategory: 'SUVs',
    defaultPassengers: 6,
    passengerRange: '5–17 Passengers',
    idealFleet: 'Toyota Innova Hycross · Force Urbania',
    imageUrl: '/src/assets/images/fleet_luxury_suv_1795608170547.jpg',
    galleryCategory: 'Outstation & Tours',
    highlights: [
      'Plush reclining captain seats & individual AC vents',
      'Verified highway-experienced family chauffeurs',
      'Zero broker markups—100% company-owned vehicles',
    ],
    createdAt: '2026-01-04T08:00:00.000Z',
  },
  {
    id: 'srv-05',
    num: '05',
    title: 'Corporate Transportation',
    tagline: 'VIP Leadership Saloons & IT SEZ Employee Shuttles',
    desc: 'Tailored ground mobility for visiting board directors, port & shipyard delegations, and scheduled daily 24-seater employee commute rosters across Madhurawada and Duvvada.',
    status: 'Active',
    tripType: 'Local Rental',
    defaultCategory: 'Premium Cars',
    defaultPassengers: 2,
    passengerRange: '1–45 Passengers',
    idealFleet: 'Mercedes E-Class · Eicher Skyline 24-Seater',
    imageUrl: '/src/assets/images/fleet_premium_sedan_1795608172264.jpg',
    galleryCategory: 'Airport & Corporate',
    highlights: [
      'GST-compliant corporate tax invoices',
      'Formal uniformed chauffeurs for VIP delegations',
      'Dedicated fleet account coordinator',
    ],
    createdAt: '2026-01-05T08:00:00.000Z',
  },
  {
    id: 'srv-06',
    num: '06',
    title: 'Wedding Transportation',
    tagline: 'Bridal Luxury Saloons & Synchronized Guest Fleet Shuttles',
    desc: 'Coordinate airport welcomes, hotel-to-mandap guest shuttles, and a flagship white Mercedes-Benz E-Class bridal entrance so hospitality schedules never slip.',
    status: 'Active',
    tripType: 'Round Trip',
    defaultCategory: 'Premium Cars',
    defaultPassengers: 4,
    passengerRange: '2–52 Passengers per Unit',
    idealFleet: 'Mercedes E-Class · Urbania · 24/45 Coaches',
    imageUrl: '/src/assets/images/gallery_wedding_fleet_1795613271173.jpg',
    galleryCategory: 'Weddings & Events',
    highlights: [
      'Bridal ribbon & floral car preparation support',
      'Multi-vehicle synchronized dispatch for large guest lists',
      'Stationed standby drivers throughout ceremony hours',
    ],
    createdAt: '2026-01-06T08:00:00.000Z',
  },
  {
    id: 'srv-07',
    num: '07',
    title: 'Group Travel',
    tagline: 'Pushback Tempo Travellers & Multi-Axle Volvo Coaches',
    desc: 'Keep your entire group together in comfortable 17-seater Force Urbania vans or 45-seater Volvo 9600 coaches equipped with pneumatic air suspension and cabin entertainment.',
    status: 'Active',
    tripType: 'Round Trip',
    defaultCategory: 'Tempo Travellers',
    defaultPassengers: 15,
    passengerRange: '12–52 Passengers',
    idealFleet: 'Force Urbania 17S · Volvo 9600 45S',
    imageUrl: '/src/assets/images/fleet_tempo_traveller_1795608172563.jpg',
    galleryCategory: 'Coach Interiors',
    highlights: [
      'Full standing-height aisles & under-deck luggage holds',
      'Dual-driver compliance on overnight highway journeys',
      'All-India Tourist Permit ready',
    ],
    createdAt: '2026-01-07T08:00:00.000Z',
  },
  {
    id: 'srv-08',
    num: '08',
    title: 'Event Transportation',
    tagline: 'Conferences, Exhibitions & Maritime Summit Logistics',
    desc: 'Scale quickly from 2 executive sedans to 6 multi-axle coaches with synchronized dispatch schedules for summits, trade expos, and cultural conventions.',
    status: 'Active',
    tripType: 'Local Rental',
    defaultCategory: 'Luxury Buses',
    defaultPassengers: 40,
    passengerRange: '20–300+ Event Guests',
    idealFleet: 'Volvo 9600 · Eicher Mini Bus · Sedans',
    imageUrl: '/src/assets/images/gallery_coach_interior_cabin_1795613271229.jpg',
    galleryCategory: 'Coach Interiors',
    highlights: [
      'PA microphone & dual cabin LED screens onboard',
      'Rapid rotation shuttles between hotels and venues',
      'Dedicated dispatch point-of-contact',
    ],
    createdAt: '2026-01-08T08:00:00.000Z',
  },
  {
    id: 'srv-09',
    num: '09',
    title: 'School & College Transportation',
    tagline: 'Safety-Certified Educational Excursions & Study Tours',
    desc: 'High-capacity 24 to 52 seater coaches maintained under strict fitness certification with speed governors, first-aid kits, CCTV monitoring, and experienced institutional captains.',
    status: 'Active',
    tripType: 'Round Trip',
    defaultCategory: 'Large Passenger Buses',
    defaultPassengers: 48,
    passengerRange: '24–52 Students & Faculty',
    idealFleet: 'BharatBenz 52-Seater · Eicher 24-Seater',
    imageUrl: '/src/assets/images/fleet_luxury_coach_1795608171806.jpg',
    galleryCategory: 'Weddings & Events',
    highlights: [
      'Verified speed-governed highway safety compliance',
      'High-volume rack space for study tour baggage',
      'Special educational excursion day-package rates',
    ],
    createdAt: '2026-01-09T08:00:00.000Z',
  },
  {
    id: 'srv-10',
    num: '10',
    title: 'Zero-Emission EV Corporate Fleet',
    tagline: 'Electric Executive MPVs & IT SEZ Commute Shuttles',
    desc: 'Expanding our Visakhapatnam owned fleet with long-range electric MPVs and 20-seater EV vans tailored for Rushikonda IT Hill & Pharma City ESG-compliant corporate rosters.',
    status: 'Upcoming',
    launchWindow: 'Launching Feb 2027',
    tripType: 'Local Rental',
    defaultCategory: 'Premium Cars',
    defaultPassengers: 4,
    passengerRange: '1–18 Passengers',
    idealFleet: 'Electric Executive MPV & EV Van',
    imageUrl: '/src/assets/images/service_ev_fleet_upcoming_1795613750837.jpg',
    galleryCategory: 'Airport & Corporate',
    highlights: [
      '100% zero-tailpipe emissions corporate ESG billing',
      'Whisper-quiet cabin with onboard Wi-Fi & workstation ports',
      'Priority contract pre-registration open for 2027 quarters',
    ],
    createdAt: '2026-11-20T08:00:00.000Z',
  },
  {
    id: 'srv-11',
    num: '11',
    title: 'Bhogapuram International Airport Express',
    tagline: 'Dedicated High-Frequency Transfers Along Coastal Corridor',
    desc: 'Upcoming scheduled & private express transfers connecting RK Beach, Dwaraka Nagar, and Bheemili directly with the new Bhogapuram Greenfield International Airport.',
    status: 'Upcoming',
    launchWindow: 'Launching Q2 2027',
    tripType: 'Airport Transfer',
    defaultCategory: 'SUVs',
    defaultPassengers: 4,
    passengerRange: '1–24 Passengers',
    idealFleet: 'Innova Hycross · Skyline 24-Seater',
    imageUrl: '/src/assets/images/gallery_airport_transfer_1795613269949.jpg',
    galleryCategory: 'Airport & Corporate',
    highlights: [
      'Live flight-arrival synchronization with zero waiting surcharges',
      'Guaranteed highway express timing via Beach Corridor',
      'Advance corporate & family pre-booking enquiries open',
    ],
    createdAt: '2026-11-21T08:00:00.000Z',
  },
  {
    id: 'srv-12',
    num: '12',
    title: 'Visakhapatnam–Hyderabad Sleeper Coach Charter',
    tagline: 'Overnight 36-Berth Multi-Axle Sleeper Private Charters',
    desc: 'Upcoming flagship overnight sleeper motorcoaches available for private group charters, tech conferences, and wedding delegations travelling between Vizag and Hyderabad.',
    status: 'Upcoming',
    launchWindow: 'Launching Jan 2027',
    tripType: 'Round Trip',
    defaultCategory: 'Luxury Buses',
    defaultPassengers: 36,
    passengerRange: '28–36 Sleeper Berths',
    idealFleet: 'Volvo 9600 36-Berth Sleeper Coach',
    imageUrl: '/src/assets/images/gallery_coach_interior_cabin_1795613271229.jpg',
    galleryCategory: 'Coach Interiors',
    highlights: [
      'Full flat-recline private AC sleeper berths with privacy curtains',
      'Dual licensed highway captains on overnight NH-16 sectors',
      'Direct whole-coach group charter with flexible stops',
    ],
    createdAt: '2026-11-22T08:00:00.000Z',
  },
];

export const SEED_DESTINATIONS: FeaturedDestination[] = [
  {
    id: 'dest-araku',
    name: 'Araku Valley & Borra Caves',
    region: 'Eastern Ghats · Andhra Pradesh',
    routeSummary: 'Visakhapatnam → Padmapuram → Borra Caves → Araku',
    distanceKm: 118,
    durationText: '3 hrs 15 mins',
    dropAddress: 'Araku Valley Hill Station, Andhra Pradesh',
    dropLat: 18.3273,
    dropLng: 82.8775,
    recommendedCategory: 'SUVs',
    recommendedTripType: 'Round Trip',
    recommendedPassengers: 6,
    startingEstimateLabel: 'From ₹19/km · ₹3,500/day SUV',
    imageUrl: '/src/assets/images/dest_araku_valley_1795613749816.jpg',
    description:
      'Misty coffee plantations, limestone caverns at Borra, and sweeping Eastern Ghats hairpins driven by mountain-certified Vizag chauffeurs in SUVs, Tempo Travellers, or coaches.',
    highlights: [
      'Hill-ghat experienced full-time company drivers',
      'Flexible stops at Galikonda Viewpoint & Coffee Museum',
      'Available in 7-Seater Hycross, 17-Seater Urbania & Coaches',
    ],
    featured: true,
    active: true,
    createdAt: '2026-11-01T08:00:00.000Z',
  },
  {
    id: 'dest-lambasingi',
    name: 'Lambasingi Pine Highlands',
    region: 'Chintapalli Hills · Eastern Ghats',
    routeSummary: 'Visakhapatnam → Narsipatnam → Lambasingi Misty Valley',
    distanceKm: 102,
    durationText: '3 hrs 00 mins',
    dropAddress: 'Lambasingi Viewpoint, Chintapalli Mandal, Andhra Pradesh',
    dropLat: 17.8184,
    dropLng: 82.4871,
    recommendedCategory: 'SUVs',
    recommendedTripType: 'Round Trip',
    recommendedPassengers: 6,
    startingEstimateLabel: 'From ₹19/km · Dawn Departure Ready',
    imageUrl: '/src/assets/images/dest_lambasingi_hills_1795613750264.jpg',
    description:
      'Known as the Kashmir of Andhra Pradesh for cool winter fog and pine forests. Schedule a 4:00 AM pickup from Vizag to catch sunrise above the valley clouds.',
    highlights: [
      'Early dawn depot dispatch with warm heater cabin ready',
      'Ideal for 1-day or weekend family & photography trips',
      'Seamless detour option to Kothapalli Waterfalls',
    ],
    featured: true,
    active: true,
    createdAt: '2026-11-02T08:00:00.000Z',
  },
  {
    id: 'dest-simhachalam',
    name: 'Simhachalam & Coastal Temple Circuit',
    region: 'Visakhapatnam Heritage & Coastline',
    routeSummary: 'VTZ Airport / City → Simhachalam → Rushikonda → Bheemili',
    distanceKm: 32,
    durationText: '55 mins drive',
    dropAddress: 'Simhachalam Hill Shrine, Visakhapatnam, Andhra Pradesh',
    dropLat: 17.7664,
    dropLng: 83.2505,
    recommendedCategory: 'Cars',
    recommendedTripType: 'Local Rental',
    recommendedPassengers: 4,
    startingEstimateLabel: 'From ₹1,350 · 4 Hr Local Package',
    imageUrl: '/src/assets/images/dest_coastal_temple_1795613751625.jpg',
    description:
      'Clean chauffeur-driven sedans and MPVs for morning darshan at Sri Varaha Lakshmi Narasimha temple paired with Kailasagiri, RK Beach, and Bheemili coastal stops.',
    highlights: [
      '4-hour & 8-hour local city charter packages available',
      'Zero parking stress at temple foothill & ghat drop zones',
      'Ideal for elderly parents, families & transit guests',
    ],
    featured: true,
    active: true,
    createdAt: '2026-11-03T08:00:00.000Z',
  },
  {
    id: 'dest-rajahmundry',
    name: 'Annavaram & Rajahmundry Godavari',
    region: 'East Godavari Corridor · NH-16',
    routeSummary: 'Visakhapatnam → Annavaram → Rajahmundry Riverfront',
    distanceKm: 195,
    durationText: '4 hrs 10 mins',
    dropAddress: 'Pushkar Ghat, Rajahmundry, Andhra Pradesh',
    dropLat: 17.0005,
    dropLng: 81.7712,
    recommendedCategory: 'Tempo Travellers',
    recommendedTripType: 'Round Trip',
    recommendedPassengers: 14,
    startingEstimateLabel: 'From ₹14/km Sedan · ₹26/km Urbania',
    imageUrl: '/src/assets/images/fleet_luxury_suv_1795608170547.jpg',
    description:
      'Smooth NH-16 four-lane highway transfers to Annavaram Satyanarayana Swamy temple and Godavari riverfront ghats for family pilgrimages and group charters.',
    highlights: [
      'Transparent highway FASTag & permit itemization',
      'Clean 17-seater Force Urbania for extended families',
      'One-way drop or same-day round trip options',
    ],
    featured: true,
    active: true,
    createdAt: '2026-11-04T08:00:00.000Z',
  },
  {
    id: 'dest-vijayawada',
    name: 'Vijayawada & Amaravati Express',
    region: 'Krishna River · Andhra Capital Region',
    routeSummary: 'Visakhapatnam → Rajahmundry → Eluru → Vijayawada',
    distanceKm: 350,
    durationText: '6 hrs 15 mins',
    dropAddress: 'Benz Circle, Vijayawada, Andhra Pradesh',
    dropLat: 16.5062,
    dropLng: 80.648,
    recommendedCategory: 'Luxury Buses',
    recommendedTripType: 'Round Trip',
    recommendedPassengers: 35,
    startingEstimateLabel: 'From ₹14/km Sedan · ₹58/km Volvo',
    imageUrl: '/src/assets/images/gallery_highway_coach_araku_1795613271573.jpg',
    description:
      'Reliable executive highway transfers for corporate conferences, Kanaka Durga temple visits, and intercity group charters between Visakhapatnam and Vijayawada.',
    highlights: [
      'Direct point-to-point corporate & VIP sedan options',
      '45-seater Volvo 9600 coaches for conferences & events',
      'GPS-tracked 24/7 dispatch monitoring along NH-16',
    ],
    featured: false,
    active: true,
    createdAt: '2026-11-05T08:00:00.000Z',
  },
  {
    id: 'dest-tirupati',
    name: 'Tirupati & Tirumala Pilgrimage',
    region: 'Chittoor District · Multi-Day Charter',
    routeSummary: 'Visakhapatnam → Vijayawada → Nellore → Tirupati',
    distanceKm: 760,
    durationText: '13 hrs Overnight Highway',
    dropAddress: 'Alipiri Footpath & Tirupati Bus Terminal, Andhra Pradesh',
    dropLat: 13.6288,
    dropLng: 79.4192,
    recommendedCategory: 'Luxury Buses',
    recommendedTripType: 'Round Trip',
    recommendedPassengers: 40,
    startingEstimateLabel: 'Multi-Day SUV & Coach Charter',
    imageUrl: '/src/assets/images/fleet_luxury_coach_1795608171806.jpg',
    description:
      'Dedicated multi-day family Tempo Travellers and 45-seater air-conditioned coaches with dual-driver overnight safety compliance for Tirumala pilgrimage groups.',
    highlights: [
      'Dual-driver rotation enforced on long overnight sectors',
      'Spacious under-deck luggage bays for group baggage',
      'Customizable stops at Srikalahasti & Kanipakam',
    ],
    featured: false,
    active: true,
    createdAt: '2026-11-06T08:00:00.000Z',
  },
  {
    id: 'dest-rushikonda',
    name: 'Rushikonda & Bheemili Beach Drive',
    region: 'Visakhapatnam Coastal Corridor',
    routeSummary: 'RK Beach → Tenneti Park → Rushikonda → Thotlakonda → Bheemili',
    distanceKm: 42,
    durationText: '1 hr 15 mins drive',
    dropAddress: 'Rushikonda Beach & Bheemili Coast, Visakhapatnam, Andhra Pradesh',
    dropLat: 17.7819,
    dropLng: 83.3853,
    recommendedCategory: 'Cars',
    recommendedTripType: 'Local Rental',
    recommendedPassengers: 4,
    startingEstimateLabel: 'From ₹1,350 · 4 Hr Coastal Charter',
    imageUrl: '/src/assets/images/gallery_wedding_fleet_1795613271173.jpg',
    description:
      'Scenic coastal bay drive covering Blue Flag Rushikonda Beach, Buddhist ruins at Thotlakonda, and Dutch-era Bheemunipatnam lighthouse.',
    highlights: [
      'Flexible 4-hour and 8-hour coastal sightseeing loops',
      'Clean AC sedans and 7-seater SUVs ready on call',
      'Sunset beach pickups with reliable wait flexibility',
    ],
    featured: false,
    active: true,
    createdAt: '2026-11-07T08:00:00.000Z',
  },
  {
    id: 'dest-puri',
    name: 'Puri Jagannath & Konark Coast',
    region: 'Odisha Coastal Highway · NH-16',
    routeSummary: 'Visakhapatnam → Srikakulam → Chilika → Puri → Konark',
    distanceKm: 445,
    durationText: '8 hrs 30 mins',
    dropAddress: 'Puri Jagannath Temple & Marine Drive, Odisha',
    dropLat: 19.8049,
    dropLng: 85.818,
    recommendedCategory: 'Tempo Travellers',
    recommendedTripType: 'Round Trip',
    recommendedPassengers: 15,
    startingEstimateLabel: 'Multi-Day Family Van & Coach',
    imageUrl: '/src/assets/images/fleet_tempo_traveller_1795608172563.jpg',
    description:
      'Interstate family and group pilgrimage corridor along NH-16 covering Chilika Lake boat point, Puri Jagannath shrine, and Konark Sun Temple.',
    highlights: [
      'Odisha interstate permit paperwork handled upfront',
      'Comfortable 17-seater Force Urbania pushback cabins',
      'Experienced highway captains familiar with coastal stops',
    ],
    featured: false,
    active: true,
    createdAt: '2026-11-08T08:00:00.000Z',
  },
];

export const SEED_PACKAGES: TravelPackage[] = [
  {
    id: 'pkg-vizag-city',
    title: 'Visakhapatnam Coastal & Heritage City Tour',
    subtitle: 'RK Beach → Kailasagiri → Submarine Museum → Rushikonda → Simhachalam',
    packageType: 'City & Sightseeing',
    durationLabel: '8 Hours / 80 km',
    distanceKm: 80,
    dropAddress: 'Kailasagiri & RK Beach Coastal Circuit, Visakhapatnam',
    dropLat: 17.7492,
    dropLng: 83.3422,
    recommendedCategory: 'Cars',
    recommendedTripType: 'Local Rental',
    passengerCount: 4,
    packagePriceInr: 2400,
    priceUnitLabel: 'AC Sedan (up to 4 pax)',
    imageUrl: '/src/assets/images/fleet_executive_sedan_1795608170835.jpg',
    inclusions: [
      '8 hours / 80 km dedicated AC chauffeur-driven sedan',
      'Fuel, chauffeur allowance, and doorstep hotel/VTZ pickup',
      'Flexible sightseeing halts at coastal & museum landmarks',
    ],
    itineraryHighlights: [
      'Morning Darshan at Simhachalam Temple',
      'INS Kursura Submarine Museum & TU-142 Aircraft Museum',
      'Kailasagiri Hilltop Ropeway & Rushikonda Sunset Point',
    ],
    featured: true,
    active: true,
    createdAt: '2026-11-01T08:00:00.000Z',
  },
  {
    id: 'pkg-araku-2day',
    title: 'Araku Valley & Borra Caves 2-Day Escape',
    subtitle: 'Visakhapatnam → Tyda → Borra Caves → Padmapuram → Coffee Museum → Araku',
    packageType: 'Hill Station & Nature',
    durationLabel: '1 Night / 2 Days',
    distanceKm: 245,
    dropAddress: 'Araku Valley Hill Station, Visakhapatnam District',
    dropLat: 18.3273,
    dropLng: 82.8775,
    recommendedCategory: 'SUVs',
    recommendedTripType: 'Round Trip',
    passengerCount: 6,
    packagePriceInr: 7800,
    priceUnitLabel: 'Innova Hycross / Crysta (up to 6 pax)',
    imageUrl: '/src/assets/images/dest_araku_valley_1795613749816.jpg',
    inclusions: [
      'Round-trip AC Innova SUV with ghat-certified full-time chauffeur',
      'Fuel & driver night bata for 2 full days',
      'Direct pickup from VTZ Airport, Railway Station, or home',
    ],
    itineraryHighlights: [
      'Ananthagiri Coffee Plantations & Galikonda Viewpoint',
      'Million-year-old Borra Limestone Caves exploration',
      'Padmapuram Botanical Gardens, Tribal Museum & Chaparai Falls',
    ],
    featured: true,
    active: true,
    createdAt: '2026-11-02T08:00:00.000Z',
  },
  {
    id: 'pkg-lambasingi-sunrise',
    title: 'Lambasingi Misty Hills & Vanjangi Dawn Package',
    subtitle: 'Visakhapatnam → Narsipatnam → Vanjangi Cloud Peak → Lambasingi → Kothapalli Falls',
    packageType: 'Hill Station & Nature',
    durationLabel: '1 Night / 2 Days',
    distanceKm: 260,
    dropAddress: 'Lambasingi & Vanjangi Hills, Alluri Sitharama Raju District',
    dropLat: 17.8195,
    dropLng: 82.4912,
    recommendedCategory: 'SUVs',
    recommendedTripType: 'Round Trip',
    passengerCount: 6,
    packagePriceInr: 8400,
    priceUnitLabel: '7-Seater AC SUV (up to 6 pax)',
    imageUrl: '/src/assets/images/dest_lambasingi_hills_1795613750264.jpg',
    inclusions: [
      'Early 2:30 AM dawn dispatch for Vanjangi sunrise trek base',
      '2 days SUV hire with experienced Eastern Ghats driver',
      'Heated/AC cabin & spacious luggage rack for camping gear',
    ],
    itineraryHighlights: [
      'Vanjangi Cloud Sea Sunrise Viewpoint arrival before dawn',
      'Lambasingi Pepper & Coffee Estates winter mist drive',
      'Kothapalli Waterfalls & Tajangi Reservoir stopover',
    ],
    featured: true,
    active: true,
    createdAt: '2026-11-03T08:00:00.000Z',
  },
  {
    id: 'pkg-temple-circuit',
    title: 'Simhachalam, Annavaram & Pithapuram Temple Circuit',
    subtitle: 'Visakhapatnam → Simhachalam → Annavaram Satyanarayana Swamy → Pithapuram',
    packageType: 'Pilgrimage Tour',
    durationLabel: 'Full Day (14 Hours)',
    distanceKm: 340,
    dropAddress: 'Annavaram Sri Satyanarayana Swamy Temple, AP',
    dropLat: 17.2836,
    dropLng: 82.4044,
    recommendedCategory: 'SUVs',
    recommendedTripType: 'Round Trip',
    passengerCount: 6,
    packagePriceInr: 6200,
    priceUnitLabel: 'AC SUV / Ertiga (up to 6 pax)',
    imageUrl: '/src/assets/images/dest_coastal_temple_1795613751625.jpg',
    inclusions: [
      'Early 5:00 AM temple-timed pickup from anywhere in Vizag',
      '340 km NH-16 round-trip highway allowance included',
      'Patient waiting hours at temple complexes & prasad counters',
    ],
    itineraryHighlights: [
      'Early morning Simhachalam Varaha Lakshmi Narasimha Darshan',
      'Ratnagiri Hill Annavaram Sri Satyanarayana Swamy Temple',
      'Pithapuram Kukkuteswara Swamy & Sripada Vallabha Peetham',
    ],
    featured: true,
    active: true,
    createdAt: '2026-11-04T08:00:00.000Z',
  },
  {
    id: 'pkg-puri-konark-group',
    title: 'Puri Jagannath, Chilika & Konark Group Package',
    subtitle: 'Visakhapatnam → Chilika Lake → Puri Jagannath → Konark Sun Temple',
    packageType: 'Weekend & Coastal',
    durationLabel: '2 Nights / 3 Days',
    distanceKm: 920,
    dropAddress: 'Puri Jagannath Temple & Marine Drive, Odisha',
    dropLat: 19.8049,
    dropLng: 85.818,
    recommendedCategory: 'Tempo Travellers',
    recommendedTripType: 'Round Trip',
    passengerCount: 14,
    packagePriceInr: 22500,
    priceUnitLabel: '17-Seater Pushback Tempo Traveller',
    imageUrl: '/src/assets/images/fleet_tempo_traveller_1795608172563.jpg',
    inclusions: [
      '17-seater Force Urbania / Tempo Traveller with pushback seats',
      '3 days highway dispatch with dual-experienced Odisha drivers',
      'Dedicated overhead & rear boot storage for family baggage',
    ],
    itineraryHighlights: [
      'Chilika Lake Barkul / Satapada dolphin boating point',
      'Sri Jagannath Temple Darshan & Golden Sea Beach walk',
      'UNESCO Konark Sun Temple & Chandrabhaga coastal drive',
    ],
    featured: false,
    active: true,
    createdAt: '2026-11-05T08:00:00.000Z',
  },
  {
    id: 'pkg-tirupati-coach',
    title: 'Tirupati Balaji & Srikalahasti Charter Coach',
    subtitle: 'Visakhapatnam → Vijayawada → Tirumala Tirupati → Srikalahasti',
    packageType: 'Corporate & Group',
    durationLabel: '3 Nights / 4 Days',
    distanceKm: 1560,
    dropAddress: 'Tirupati Balaji & Alipiri Foothills, AP',
    dropLat: 13.6288,
    dropLng: 79.4192,
    recommendedCategory: 'Luxury Buses',
    recommendedTripType: 'Round Trip',
    passengerCount: 35,
    packagePriceInr: 48000,
    priceUnitLabel: '35–45 Seater AC Luxury Coach',
    imageUrl: '/src/assets/images/fleet_luxury_coach_1795608171806.jpg',
    inclusions: [
      'AC Volvo / BharatBenz reclining coach with PA system',
      'Dual commercial drivers for safe overnight NH-16 travel',
      '24/7 dispatch desk coordination for group halts',
    ],
    itineraryHighlights: [
      'Kanaka Durga Temple Vijayawada en-route darshan stop',
      'Tirupati Alipiri transfer, Tiruchanur Padmavathi Temple',
      'Srikalahasti Vayu Linga shrine & Kapila Theertham visit',
    ],
    featured: false,
    active: true,
    createdAt: '2026-11-06T08:00:00.000Z',
  },
];

function createDefaultDb(): DatabaseSchema {
  return {
    vehicles: structuredClone(SEED_VEHICLES),
    drivers: structuredClone(SEED_DRIVERS),
    bookings: structuredClone(SEED_BOOKINGS),
    payments: structuredClone(SEED_PAYMENTS),
    enquiries: structuredClone(SEED_ENQUIRIES),
    reviews: structuredClone(SEED_REVIEWS),
    gallery: structuredClone(SEED_GALLERY),
    services: structuredClone(SEED_SERVICES),
    destinations: structuredClone(SEED_DESTINATIONS),
    packages: structuredClone(SEED_PACKAGES),
    users: [],
    pricing: structuredClone(SEED_PRICING),
    settings: structuredClone(SEED_SETTINGS),
    adminCredentials: [],
    adminActionTokens: [],
  };
}

class HybridDatabase {
  private mongoClient: MongoClient | null = null;
  private mongoDb: Db | null = null;
  private localCache: DatabaseSchema | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._initInternal();
    return this.initPromise;
  }

  private async _initInternal(): Promise<void> {
    const uri = (process.env.MONGODB_URI?.trim() || '').replace(/^["']|["']$/g, '');
    const isValidMongoUri =
      uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://');
    if (isValidMongoUri) {
      try {
        this.mongoClient = new MongoClient(uri);
        await this.mongoClient.connect();
        this.mongoDb = this.mongoClient.db('vizag_jagan_travels');
        const vehicleCount = await this.mongoDb.collection('vehicles').countDocuments();
        if (vehicleCount === 0) {
          const seed = createDefaultDb();
          await this.mongoDb.collection('vehicles').insertMany(seed.vehicles);
          await this.mongoDb.collection('drivers').insertMany(seed.drivers);
          await this.mongoDb.collection('bookings').insertMany(seed.bookings);
          await this.mongoDb.collection('payments').insertMany(seed.payments);
          await this.mongoDb.collection('enquiries').insertMany(seed.enquiries);
          await this.mongoDb.collection('reviews').insertMany(seed.reviews);
          await this.mongoDb.collection('gallery').insertMany(seed.gallery);
          await this.mongoDb.collection('services').insertMany(seed.services);
          await this.mongoDb.collection('destinations').insertMany(seed.destinations);
          await this.mongoDb.collection('packages').insertMany(seed.packages);
          await this.mongoDb.collection('pricing').insertOne({ id: 'default', ...seed.pricing });
          await this.mongoDb.collection('settings').insertOne({ id: 'default', ...seed.settings });
        } else {
          const [galleryCount, serviceCount, destCount, pkgCount] = await Promise.all([
            this.mongoDb.collection('gallery').countDocuments(),
            this.mongoDb.collection('services').countDocuments(),
            this.mongoDb.collection('destinations').countDocuments(),
            this.mongoDb.collection('packages').countDocuments(),
          ]);
          if (galleryCount === 0) {
            await this.mongoDb.collection('gallery').insertMany(structuredClone(SEED_GALLERY));
          }
          if (serviceCount === 0) {
            await this.mongoDb.collection('services').insertMany(structuredClone(SEED_SERVICES));
          }
          if (destCount === 0) {
            await this.mongoDb.collection('destinations').insertMany(structuredClone(SEED_DESTINATIONS));
          }
          if (pkgCount === 0) {
            await this.mongoDb.collection('packages').insertMany(structuredClone(SEED_PACKAGES));
          }
        }
        await this.mongoDb.collection('adminCredentials').updateMany(
          { adminEmailMigrated: { $ne: true } },
          {
            $set: {
              email: 'jagantravelsvizag@gmail.com',
              adminEmailMigrated: true,
              updatedAt: new Date().toISOString(),
            },
          }
        );
        const adminResetMarker = await this.mongoDb
          .collection('settings')
          .findOne({ id: '__migration_admin_reset_v1' });
        if (!adminResetMarker) {
          await this.mongoDb.collection('adminCredentials').deleteMany({});
          await this.mongoDb.collection('settings').updateOne(
            { id: '__migration_admin_reset_v1' },
            { $set: { id: '__migration_admin_reset_v1', doneAt: new Date().toISOString() } },
            { upsert: true }
          );
        }
        return;
      } catch (err) {
        console.warn('MongoDB connection failed, falling back to durable local store:', (err as Error).message);
        this.mongoClient = null;
        this.mongoDb = null;
      }
    }

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      this.localCache = createDefaultDb();
      (this.localCache as unknown as { __adminResetV1?: boolean }).__adminResetV1 = true;
      this.flushLocal();
    } else {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      this.localCache = JSON.parse(raw) as DatabaseSchema;
      let dirty = false;
      if (!Array.isArray(this.localCache.gallery) || this.localCache.gallery.length === 0) {
        this.localCache.gallery = structuredClone(SEED_GALLERY);
        dirty = true;
      }
      if (!Array.isArray(this.localCache.services) || this.localCache.services.length === 0) {
        this.localCache.services = structuredClone(SEED_SERVICES);
        dirty = true;
      }
      if (!Array.isArray(this.localCache.destinations) || this.localCache.destinations.length === 0) {
        this.localCache.destinations = structuredClone(SEED_DESTINATIONS);
        dirty = true;
      }
      if (!Array.isArray(this.localCache.packages) || this.localCache.packages.length === 0) {
        this.localCache.packages = structuredClone(SEED_PACKAGES);
        dirty = true;
      }
      if (!(this.localCache as unknown as { __adminResetV1?: boolean }).__adminResetV1) {
        if (Array.isArray(this.localCache.adminCredentials) && this.localCache.adminCredentials.length > 0) {
          this.localCache.adminCredentials = [];
        }
        (this.localCache as unknown as { __adminResetV1?: boolean }).__adminResetV1 = true;
        dirty = true;
      }
      if (!Array.isArray(this.localCache.adminActionTokens)) {
        this.localCache.adminActionTokens = [];
        dirty = true;
      }
      if (Array.isArray(this.localCache.adminCredentials)) {
        for (const cred of this.localCache.adminCredentials) {
          if (!cred.adminEmailMigrated) {
            cred.email = 'jagantravelsvizag@gmail.com';
            cred.adminEmailMigrated = true;
            cred.updatedAt = new Date().toISOString();
            dirty = true;
          }
        }
      }
      if (dirty) {
        this.flushLocal();
      }
    }
  }

  private flushLocal(): void {
    if (!this.localCache) return;
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.localCache, null, 2), 'utf-8');
    fs.renameSync(tmp, DB_FILE);
  }

  async getAll<K extends keyof Omit<DatabaseSchema, 'pricing' | 'settings'>>(
    collection: K
  ): Promise<DatabaseSchema[K]> {
    await this.init();
    if (this.mongoDb) {
      const docs = await this.mongoDb.collection(collection).find({}, { projection: { _id: 0 } }).toArray();
      return docs as unknown as DatabaseSchema[K];
    }
    const list = this.localCache![collection];
    return structuredClone(list ?? ([] as unknown as DatabaseSchema[K]));
  }

  async insertOne<K extends keyof Omit<DatabaseSchema, 'pricing' | 'settings'>>(
    collection: K,
    doc: DatabaseSchema[K][number]
  ): Promise<void> {
    await this.init();
    if (this.mongoDb) {
      await this.mongoDb.collection(collection).insertOne(structuredClone(doc) as unknown as Record<string, unknown>);
      return;
    }
    (this.localCache![collection] as Array<DatabaseSchema[K][number]>).push(structuredClone(doc));
    this.flushLocal();
  }

  async updateOneById<K extends keyof Omit<DatabaseSchema, 'pricing' | 'settings'>>(
    collection: K,
    id: string,
    patch: Partial<DatabaseSchema[K][number]>
  ): Promise<DatabaseSchema[K][number] | null> {
    await this.init();
    if (this.mongoDb) {
      await this.mongoDb
        .collection(collection)
        .updateOne({ id }, { $set: structuredClone(patch) });
      const updated = await this.mongoDb
        .collection(collection)
        .findOne({ id }, { projection: { _id: 0 } });
      return (updated as unknown as DatabaseSchema[K][number]) ?? null;
    }
    const arr = this.localCache![collection] as Array<{ id: string }>;
    const idx = arr.findIndex((item) => item.id === id);
    if (idx === -1) return null;
    arr[idx] = { ...arr[idx], ...structuredClone(patch) };
    this.flushLocal();
    return structuredClone(arr[idx]) as unknown as DatabaseSchema[K][number];
  }

  async deleteOneById<K extends keyof Omit<DatabaseSchema, 'pricing' | 'settings'>>(
    collection: K,
    id: string
  ): Promise<boolean> {
    await this.init();
    if (this.mongoDb) {
      const res = await this.mongoDb.collection(collection).deleteOne({ id });
      return res.deletedCount > 0;
    }
    const arr = this.localCache![collection] as Array<{ id: string }>;
    const before = arr.length;
    this.localCache![collection] = arr.filter((item) => item.id !== id) as DatabaseSchema[K];
    if (this.localCache![collection].length !== before) {
      this.flushLocal();
      return true;
    }
    return false;
  }

  async consumeAdminActionTokensForTarget(
    targetType: 'booking' | 'enquiry',
    targetId: string,
    meta: { usedByEmail?: string; usedByRole?: string; decisionResult: string }
  ): Promise<void> {
    await this.init();
    const nowIso = new Date().toISOString();
    if (this.mongoDb) {
      await this.mongoDb.collection('adminActionTokens').updateMany(
        { targetType, targetId, usedAt: { $exists: false } },
        {
          $set: {
            usedAt: nowIso,
            usedByEmail: meta.usedByEmail,
            usedByRole: meta.usedByRole,
            decisionResult: meta.decisionResult,
          },
        }
      );
      return;
    }
    const tokens = this.localCache!.adminActionTokens || [];
    let dirty = false;
    for (const t of tokens) {
      if (t.targetType === targetType && t.targetId === targetId && !t.usedAt) {
        t.usedAt = nowIso;
        t.usedByEmail = meta.usedByEmail;
        t.usedByRole = meta.usedByRole;
        t.decisionResult = meta.decisionResult;
        dirty = true;
      }
    }
    if (dirty) {
      this.flushLocal();
    }
  }

  async getPricing(): Promise<PricingConfig> {
    await this.init();
    if (this.mongoDb) {
      const doc = await this.mongoDb
        .collection('pricing')
        .findOne({ id: 'default' }, { projection: { _id: 0, id: 0 } });
      if (doc) return doc as unknown as PricingConfig;
    }
    return structuredClone(this.localCache!.pricing);
  }

  async savePricing(pricing: PricingConfig): Promise<PricingConfig> {
    await this.init();
    const updated = { ...structuredClone(pricing), updatedAt: new Date().toISOString() };
    if (this.mongoDb) {
      await this.mongoDb
        .collection('pricing')
        .updateOne({ id: 'default' }, { $set: { id: 'default', ...updated } }, { upsert: true });
      return updated;
    }
    this.localCache!.pricing = updated;
    this.flushLocal();
    return structuredClone(updated);
  }

  async getSettings(): Promise<WebsiteSettings> {
    await this.init();
    if (this.mongoDb) {
      const doc = await this.mongoDb
        .collection('settings')
        .findOne({ id: 'default' }, { projection: { _id: 0, id: 0 } });
      if (doc) {
        const merged = { ...structuredClone(SEED_SETTINGS), ...(doc as unknown as Partial<WebsiteSettings>) };
        if (!Array.isArray(merged.heroSlides) || merged.heroSlides.length === 0) {
          merged.heroSlides = structuredClone(SEED_SETTINGS.heroSlides);
        }
        return merged;
      }
    }
    const existing = this.localCache?.settings;
    const merged = { ...structuredClone(SEED_SETTINGS), ...(existing ? structuredClone(existing) : {}) };
    if (!Array.isArray(merged.heroSlides) || merged.heroSlides.length === 0) {
      merged.heroSlides = structuredClone(SEED_SETTINGS.heroSlides);
    }
    return merged;
  }

  async saveSettings(settings: WebsiteSettings): Promise<WebsiteSettings> {
    await this.init();
    const updated: WebsiteSettings = {
      ...structuredClone(SEED_SETTINGS),
      ...structuredClone(settings),
      updatedAt: new Date().toISOString(),
    };
    if (this.mongoDb) {
      await this.mongoDb
        .collection('settings')
        .updateOne({ id: 'default' }, { $set: { id: 'default', ...updated } }, { upsert: true });
      return updated;
    }
    this.localCache!.settings = updated;
    this.flushLocal();
    return structuredClone(updated);
  }

  isMongoConnected(): boolean {
    return Boolean(this.mongoDb);
  }
}

export const db = new HybridDatabase();
