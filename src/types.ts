export type VehicleCategory =
  | 'Cars'
  | 'SUVs'
  | 'Premium Cars'
  | 'Tempo Travellers'
  | 'Mini Buses'
  | 'Luxury Buses'
  | 'Large Passenger Buses';

export type FleetGroup = 'Car' | 'Bus';

export type VehicleStatus = 'Available' | 'Booked' | 'Maintenance' | 'Inactive';

export type TripType = 'One Way' | 'Round Trip' | 'Local Rental' | 'Airport Transfer';

export type BookingStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Driver Assigned'
  | 'In Progress'
  | 'Completed'
  | 'Cancellation Requested'
  | 'Cancelled'
  | 'Rejected';

export type PaymentStatus =
  | 'Unpaid'
  | 'Advance Paid'
  | 'Fully Paid'
  | 'Refund Pending'
  | 'Refunded';

export interface Vehicle {
  id: string;
  name: string;
  model: string;
  registrationNumber: string;
  category: VehicleCategory;
  fleetGroup: FleetGroup;
  seatingCapacity: number;
  luggageCapacity: number;
  ac: boolean;
  transmission: 'Automatic' | 'Manual';
  fuelType: 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric';
  status: VehicleStatus;
  images: string[];
  features: string[];
  services: string[];
  assignedDriverId?: string;
  description: string;
  terms: string[];
  customPerKmRate?: number;
  customPerDayRate?: number;
  createdAt: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string;
  licenseNumber: string;
  licenseExpiry: string;
  experienceYears: number;
  languages: string[];
  available: boolean;
  assignedVehicleId?: string;
  status: 'Active' | 'On Trip' | 'Off Duty';
  createdAt: string;
}

export interface CategoryPricingRule {
  category: VehicleCategory;
  fleetGroup: FleetGroup;
  perKmRate: number;
  perHourRate: number;
  halfDayRate: number; // 4 hrs / 40 km
  fullDayRate: number; // 8 hrs / 80 km
  outstationPerKmRate: number;
  outstationMinKmPerDay: number;
  perDayBusRate: number;
  extraKmRate: number;
  driverAllowancePerDay: number;
  nightCharge: number;
  customQuotationRequiredOverKm?: number;
}

export interface AdditionalChargesConfig {
  estimatedTollPer100Km: number;
  parkingNote: string;
  statePermitEstimate: number;
  taxPercent: number;
  advancePaymentPercent: number;
  includedSummary: string[];
  additionalSummary: string[];
}

export interface PricingConfig {
  rules: CategoryPricingRule[];
  additionalCharges: AdditionalChargesConfig;
  updatedAt: string;
}

export interface FareEstimate {
  baseFare: number;
  extraKmCharges: number;
  driverAllowance: number;
  nightCharges: number;
  taxAmount: number;
  subtotal: number;
  totalEstimatedFare: number;
  advancePayable: number;
  estimatedTollsExtra: number;
  estimatedStatePermitExtra: number;
  pricingBreakdownNote: string;
  includedItems: string[];
  additionalItems: string[];
  requiresCustomQuote: boolean;
}

export interface Booking {
  id: string;
  bookingCode: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  vehicleId: string;
  vehicleName: string;
  vehicleCategory: VehicleCategory;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  pickupLocation: string;
  dropLocation: string;
  pickupLat?: number;
  pickupLng?: number;
  dropLat?: number;
  dropLng?: number;
  journeyDate: string;
  journeyTime: string;
  returnDate?: string;
  passengerCount: number;
  tripType: TripType;
  estimatedDistanceKm: number;
  estimatedDurationText: string;
  fareEstimate: FareEstimate;
  totalFare: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  bookingStatus: BookingStatus;
  paymentMode?: 'Advance' | 'Full' | 'Pay Later';
  notes?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  bookingId: string;
  bookingCode: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  paymentType: 'Advance' | 'Full';
  gateway: 'Razorpay' | 'Razorpay Test';
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  status: 'Created' | 'Captured' | 'Failed' | 'Refunded';
  refundAmount?: number;
  refundNote?: string;
  createdAt: string;
}

export interface Enquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  source: 'Contact Form' | 'WhatsApp' | 'Custom Quote' | 'Support';
  bookingCode?: string;
  status: 'Pending' | 'Responded' | 'Resolved';
  createdAt: string;
}

export interface Review {
  id: string;
  customerName: string;
  roleOrCity: string;
  companyOrTrip: string;
  vehicleCategory: VehicleCategory;
  rating: number;
  comment: string;
  verified: boolean;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  role: 'customer' | 'admin';
  hasRecoveryPin?: boolean;
  createdAt: string;
}

export interface HeroSlide {
  id: string;
  eyebrow: string;
  headline: string;
  subheading: string;
  imageUrl: string;
  ctaLabel?: string;
  ctaTarget?: 'fleet' | 'booking' | 'services' | 'destinations';
}

export interface WebsiteSettings {
  companyName: string;
  tagline: string;
  logoUrl: string;
  establishedYear: string;
  footerDescription: string;
  footerPermitsLine: string;

  heroHeadline: string;
  heroSubheading: string;
  heroBannerUrl: string;
  heroAutoplaySeconds: number;
  heroSlides: HeroSlide[];
  whyChooseTitle: string;
  whyChooseDescription: string;
  onTimeMetric: string;
  ownedFleetMetric: string;

  defaultPickupAddress: string;
  defaultPickupLat: number;
  defaultPickupLng: number;
  defaultDropAddress: string;
  defaultDropLat: number;
  defaultDropLng: number;
  businessAddress: string;
  depotLat: number;
  depotLng: number;

  supportPhone: string;
  supportEmail: string;
  whatsappNumber: string;
  whatsappDefaultMessage: string;
  workingHours: string;

  bookingCodePrefix: string;
  allowOnlinePayment: boolean;
  allowPayLater: boolean;
  allowGuestBooking: boolean;
  showWhatsAppWidget: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  gstNumber: string;
  invoiceFooterNote: string;

  seoTitle: string;
  seoDescription: string;
  facebookUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  twitterUrl?: string;
  updatedAt: string;
}

export type GalleryCategory =
  | 'Fleet Showcase'
  | 'Airport & Corporate'
  | 'Weddings & Events'
  | 'Outstation & Tours'
  | 'Coach Interiors';

export interface GalleryItem {
  id: string;
  title: string;
  category: GalleryCategory;
  imageUrl: string;
  caption: string;
  routeOrContext: string;
  recommendedCategory?: VehicleCategory;
  featured?: boolean;
  createdAt: string;
}

export type ServiceStatus = 'Active' | 'Upcoming' | 'Archived';

export interface TravelService {
  id: string;
  num: string;
  title: string;
  tagline: string;
  desc: string;
  status: ServiceStatus;
  launchWindow?: string;
  tripType: TripType;
  defaultCategory: VehicleCategory;
  defaultPassengers: number;
  passengerRange: string;
  idealFleet: string;
  imageUrl: string;
  galleryCategory: GalleryCategory;
  highlights: string[];
  createdAt: string;
}

export interface FeaturedDestination {
  id: string;
  name: string;
  region: string;
  routeSummary: string;
  distanceKm: number;
  durationText: string;
  dropAddress: string;
  dropLat: number;
  dropLng: number;
  recommendedCategory: VehicleCategory;
  recommendedTripType: TripType;
  recommendedPassengers: number;
  startingEstimateLabel: string;
  imageUrl: string;
  description: string;
  highlights: string[];
  featured: boolean;
  active: boolean;
  createdAt: string;
}

export type PackageType =
  | 'City & Sightseeing'
  | 'Hill Station & Nature'
  | 'Pilgrimage Tour'
  | 'Weekend & Coastal'
  | 'Corporate & Group';

export interface TravelPackage {
  id: string;
  title: string;
  subtitle: string;
  packageType: PackageType;
  durationLabel: string;
  distanceKm: number;
  dropAddress: string;
  dropLat: number;
  dropLng: number;
  recommendedCategory: VehicleCategory;
  recommendedTripType: TripType;
  passengerCount: number;
  packagePriceInr: number;
  priceUnitLabel: string;
  imageUrl: string;
  inclusions: string[];
  itineraryHighlights: string[];
  featured: boolean;
  active: boolean;
  createdAt: string;
}
