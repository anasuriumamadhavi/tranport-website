import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Car,
  CheckCircle2,
  CreditCard,
  Download,
  Info,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  Booking,
  FareEstimate,
  TripType,
  UserProfile,
  Vehicle,
  VehicleCategory,
  WebsiteSettings,
} from '../types';
import { apiFetch, formatINR } from '../lib/api';
import { downloadBookingInvoicePdf } from '../lib/invoicePdf';
import { PlaceAutocompleteInput, PlaceValue, RoutePreviewMap } from './MapsComponents';
import { PassengerCountInput } from './PassengerCountInput';

export interface BookingPrefill {
  category?: VehicleCategory | 'All';
  pickup?: PlaceValue;
  drop?: PlaceValue;
  journeyDate?: string;
  journeyTime?: string;
  returnDate?: string;
  passengers?: number;
  tripType?: TripType;
  selectedVehicleId?: string;
}

interface AvailableVehicleResult extends Vehicle {
  isAvailableForDates: boolean;
  conflictNote: string | null;
  fareEstimate: FareEstimate;
  driverInfo?: {
    id: string;
    name: string;
    experienceYears: number;
    languages: string[];
  } | null;
}

interface RazorpayOrderResponse {
  mode: 'live_razorpay' | 'test_checkout';
  keyId?: string;
  orderId: string;
  testSignatureToken?: string;
  amountInr: number;
  amountPaise: number;
  currency: string;
  bookingCode: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

interface BookingWizardProps {
  prefill?: BookingPrefill;
  categories: VehicleCategory[];
  user: UserProfile | null;
  token: string | null;
  settings?: WebsiteSettings | null;
  onBookingComplete?: (booking: Booking) => void;
  onGoToDashboard: () => void;
}

function estimateFallbackKm(origin: PlaceValue, dest: PlaceValue): number {
  if (
    typeof origin.lat === 'number' &&
    typeof origin.lng === 'number' &&
    typeof dest.lat === 'number' &&
    typeof dest.lng === 'number'
  ) {
    const R = 6371;
    const dLat = ((dest.lat - origin.lat) * Math.PI) / 180;
    const dLon = ((dest.lng - origin.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((origin.lat * Math.PI) / 180) *
        Math.cos((dest.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    const roadKm = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.25);
    return Math.max(25, roadKm);
  }
  return 65;
}

export const BookingWizard: React.FC<BookingWizardProps> = ({
  prefill,
  categories,
  user,
  token,
  settings,
  onBookingComplete,
  onGoToDashboard,
}) => {
  const companyName = settings?.companyName || 'Vizag Jagan Travels';
  const allowOnlinePayment = settings ? settings.allowOnlinePayment : false;
  const allowPayLater = settings ? settings.allowPayLater : true;
  const allowGuestBooking = settings ? settings.allowGuestBooking : true;
  const maintenanceMode = settings ? settings.maintenanceMode : false;
  const today = new Date().toISOString().slice(0, 10);
  const [stage, setStage] = useState<1 | 2 | 3 | 4>(1);

  // Steps 1–7 state
  const [category, setCategory] = useState<string>(prefill?.category || 'All');
  const [pickup, setPickup] = useState<PlaceValue>(
    prefill?.pickup || {
      address: settings?.defaultPickupAddress || 'Visakhapatnam International Airport (VTZ), Vizag',
      lat: settings?.defaultPickupLat ?? 17.7212,
      lng: settings?.defaultPickupLng ?? 83.2245,
    }
  );
  const [drop, setDrop] = useState<PlaceValue>(
    prefill?.drop || {
      address: settings?.defaultDropAddress || 'RK Beach & Kailasagiri, Visakhapatnam',
      lat: settings?.defaultDropLat ?? 17.7142,
      lng: settings?.defaultDropLng ?? 83.3237,
    }
  );
  const [journeyDate, setJourneyDate] = useState<string>(prefill?.journeyDate || today);
  const [journeyTime, setJourneyTime] = useState<string>(prefill?.journeyTime || '09:30');
  const [returnDate, setReturnDate] = useState<string>(prefill?.returnDate || '');
  const [passengerCount, setPassengerCount] = useState<number>(prefill?.passengers || 4);
  const [tripType, setTripType] = useState<TripType>(prefill?.tripType || 'One Way');
  const [localHours, setLocalHours] = useState<number>(8);
  const [distanceKm, setDistanceKm] = useState<number>(45);
  const [durationText, setDurationText] = useState<string>('1 hr 15 mins');

  // Steps 8–9 state
  const [availableVehicles, setAvailableVehicles] = useState<AvailableVehicleResult[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(prefill?.selectedVehicleId || '');
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  // Steps 10–11 state
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [notes, setNotes] = useState('');
  const [fareEstimate, setFareEstimate] = useState<FareEstimate | null>(null);

  // Step 12 state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdBooking, setCreatedBooking] = useState<Booking | null>(null);
  const [paymentOption, setPaymentOption] = useState<'Advance' | 'Full' | 'Pay Later'>(
    allowOnlinePayment ? 'Advance' : 'Pay Later'
  );
  const [testCheckoutOrder, setTestCheckoutOrder] = useState<RazorpayOrderResponse | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setPaymentOption((prev) => {
      if (!allowOnlinePayment) return 'Pay Later';
      return prev === 'Pay Later' ? 'Advance' : prev;
    });
  }, [allowOnlinePayment]);

  useEffect(() => {
    if (!prefill) return;
    if (prefill.category) setCategory(prefill.category);
    if (prefill.pickup) setPickup(prefill.pickup);
    if (prefill.drop) setDrop(prefill.drop);
    if (prefill.journeyDate) setJourneyDate(prefill.journeyDate);
    if (prefill.journeyTime) setJourneyTime(prefill.journeyTime);
    if (prefill.returnDate !== undefined) setReturnDate(prefill.returnDate);
    if (typeof prefill.passengers === 'number') {
      setPassengerCount(Math.min(55, Math.max(1, prefill.passengers)));
    }
    if (prefill.tripType) setTripType(prefill.tripType);
    if (prefill.selectedVehicleId) setSelectedVehicleId(prefill.selectedVehicleId);
  }, [prefill]);

  useEffect(() => {
    if (user) {
      if (!customerName) setCustomerName(user.name);
      if (!customerEmail) setCustomerEmail(user.email);
      if (!customerPhone) setCustomerPhone(user.phone);
    }
  }, [user]);

  useEffect(() => {
    const est = estimateFallbackKm(pickup, drop);
    setDistanceKm(est);
  }, [pickup.lat, pickup.lng, drop.lat, drop.lng]);

  const selectedVehicle = availableVehicles.find((v) => v.id === selectedVehicleId) || null;

  const fetchAvailableVehicles = async () => {
    if (!pickup.address.trim() || !drop.address.trim() || !journeyDate) {
      setAvailabilityError('Please enter pickup location, destination, and journey date.');
      return;
    }
    setAvailabilityError(null);
    setLoadingVehicles(true);
    try {
      const qs = new URLSearchParams({
        category: category === 'All' ? '' : category,
        passengers: String(passengerCount),
        journeyDate,
        returnDate: tripType === 'Round Trip' && returnDate ? returnDate : '',
        journeyTime,
        tripType,
        distanceKm: String(distanceKm),
      });
      const data = await apiFetch<{ vehicles: AvailableVehicleResult[] }>(`/api/vehicles/available?${qs}`);
      setAvailableVehicles(data.vehicles);

      if (prefill?.selectedVehicleId) {
        const pre = data.vehicles.find((v) => v.id === prefill.selectedVehicleId && v.isAvailableForDates);
        if (pre) {
          setSelectedVehicleId(pre.id);
          setFareEstimate(pre.fareEstimate);
        }
      }
      setStage(2);
    } catch (err) {
      setAvailabilityError((err as Error).message);
    } finally {
      setLoadingVehicles(false);
    }
  };

  const handleSelectVehicle = async (veh: AvailableVehicleResult) => {
    if (!veh.isAvailableForDates) return;
    setSelectedVehicleId(veh.id);
    setFareEstimate(veh.fareEstimate);
    try {
      const data = await apiFetch<{ estimate: FareEstimate }>('/api/pricing/estimate', {
        method: 'POST',
        body: JSON.stringify({
          vehicleId: veh.id,
          tripType,
          distanceKm,
          journeyDate,
          journeyTime,
          returnDate: tripType === 'Round Trip' ? returnDate : undefined,
          localPackageHours: localHours,
        }),
      });
      setFareEstimate(data.estimate);
    } catch {
      // Keep list estimate if refresh fails
    }
    setStage(3);
  };

  const handleSubmitBooking = async (mode: 'Advance' | 'Full' | 'Pay Later') => {
    if (!selectedVehicle || !customerName.trim() || !customerEmail.trim() || !customerPhone.trim()) {
      setSubmitError('Please fill in your full name, email address, and mobile number.');
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    setPaymentOption(mode);

    try {
      let booking = createdBooking;
      if (!booking) {
        const res = await apiFetch<{ booking: Booking }>(
          '/api/bookings',
          {
            method: 'POST',
            body: JSON.stringify({
              vehicleId: selectedVehicle.id,
              customerName,
              customerEmail,
              customerPhone,
              pickupLocation: pickup.address,
              dropLocation: drop.address,
              pickupLat: pickup.lat,
              pickupLng: pickup.lng,
              dropLat: drop.lat,
              dropLng: drop.lng,
              journeyDate,
              journeyTime,
              returnDate: tripType === 'Round Trip' && returnDate ? returnDate : undefined,
              passengerCount,
              tripType,
              estimatedDistanceKm: distanceKm,
              estimatedDurationText: durationText,
              localPackageHours: localHours,
              paymentMode: mode,
              notes,
            }),
          },
          token
        );
        booking = res.booking;
        setCreatedBooking(booking);
        onBookingComplete?.(booking);
      }

      if (mode === 'Pay Later') {
        setStage(4);
        return;
      }

      // Initiate Razorpay Order
      const order = await apiFetch<RazorpayOrderResponse>('/api/payments/razorpay/order', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: booking.id,
          paymentType: mode,
        }),
      });

      if (order.mode === 'live_razorpay' && order.keyId) {
        const scriptLoaded = await new Promise<boolean>((resolve) => {
          if ((window as unknown as { Razorpay?: unknown }).Razorpay) {
            resolve(true);
            return;
          }
          const s = document.createElement('script');
          s.src = 'https://checkout.razorpay.com/v1/checkout.js';
          s.onload = () => resolve(true);
          s.onerror = () => resolve(false);
          document.body.appendChild(s);
        });

        if (scriptLoaded && (window as unknown as { Razorpay?: new (opts: unknown) => { open: () => void } }).Razorpay) {
          const Rzp = (window as unknown as { Razorpay: new (opts: unknown) => { open: () => void } }).Razorpay;
          const rzp = new Rzp({
            key: order.keyId,
            amount: order.amountPaise,
            currency: order.currency,
            name: companyName,
            description: `Booking ${order.bookingCode} (${mode} Payment)`,
            order_id: order.orderId,
            prefill: {
              name: order.customerName,
              email: order.customerEmail,
              contact: order.customerPhone,
            },
            handler: async (response: {
              razorpay_order_id: string;
              razorpay_payment_id: string;
              razorpay_signature: string;
            }) => {
              await verifyRazorpayPayment(booking!, mode, order, response);
            },
          });
          rzp.open();
          return;
        }
      }

      // Open interactive Sandbox Razorpay Checkout UI when live keys aren't configured
      setTestCheckoutOrder(order);
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const verifyRazorpayPayment = async (
    booking: Booking,
    mode: 'Advance' | 'Full',
    order: RazorpayOrderResponse,
    rzpResponse?: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }
  ) => {
    setVerifyingPayment(true);
    setSubmitError(null);
    try {
      const verified = await apiFetch<{ verified: boolean; booking: Booking }>(
        '/api/payments/razorpay/verify',
        {
          method: 'POST',
          body: JSON.stringify({
            bookingId: booking.id,
            paymentType: mode,
            amountInr: order.amountInr,
            razorpay_order_id: rzpResponse?.razorpay_order_id || order.orderId,
            razorpay_payment_id: rzpResponse?.razorpay_payment_id || `pay_vf_${Date.now()}`,
            razorpay_signature: rzpResponse?.razorpay_signature || '',
            testSignatureToken: order.testSignatureToken || '',
          }),
        }
      );
      setCreatedBooking(verified.booking);
      onBookingComplete?.(verified.booking);
      setTestCheckoutOrder(null);
      setStage(4);
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setVerifyingPayment(false);
    }
  };

  return (
    <section className="py-10 bg-[#F5F7FA] min-h-[82vh]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Progress Stepper covering all 12 steps cleanly */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#102A43]">Reserve Your Fleet Vehicle</h1>
              <p className="text-xs text-slate-500 mt-1">
                {allowOnlinePayment
                  ? '12-step verified booking · Live availability check · Instant Razorpay checkout'
                  : '12-step verified booking · Live availability check · Direct dispatch confirmation'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { num: 1, title: '1–7. Trip & Route' },
                { num: 2, title: '8–9. Select Vehicle' },
                { num: 3, title: '10–11. Fare & Details' },
                { num: 4, title: '12. Confirmed' },
              ].map((s) => (
                <button
                  key={s.num}
                  type="button"
                  disabled={s.num > stage && !(s.num === 4 && createdBooking)}
                  onClick={() => {
                    if (s.num < stage) setStage(s.num as 1 | 2 | 3 | 4);
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    stage === s.num
                      ? 'bg-[#102A43] text-white'
                      : stage > s.num
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-pointer'
                      : 'bg-[#F5F7FA] text-slate-400'
                  }`}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* STAGE 1: Steps 1 to 7 */}
        {stage === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div>
                  <label htmlFor="wizard-category" className="block text-xs font-medium text-slate-600 mb-1.5">
                    Step 1 · Vehicle Category
                  </label>
                  <select
                    id="wizard-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                  >
                    <option value="All">All Available Fleet Categories</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="wizard-trip-type" className="block text-xs font-medium text-slate-600 mb-1.5">
                    Step 7 · Trip Type
                  </label>
                  <select
                    id="wizard-trip-type"
                    value={tripType}
                    onChange={(e) => setTripType(e.target.value as TripType)}
                    className="w-full min-h-[44px] px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                  >
                    <option value="One Way">One Way Outstation</option>
                    <option value="Round Trip">Round Trip</option>
                    <option value="Local Rental">Local City Package</option>
                    <option value="Airport Transfer">Airport Pickup & Drop</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <PlaceAutocompleteInput
                  id="wizard-pickup"
                  label="Step 2 · Pickup Location"
                  placeholder="Enter pickup address, airport, or hub"
                  value={pickup.address}
                  onChange={setPickup}
                  iconType="pickup"
                />
                <PlaceAutocompleteInput
                  id="wizard-drop"
                  label="Step 3 · Destination Location"
                  placeholder="Enter destination city, hotel, or terminal"
                  value={drop.address}
                  onChange={setDrop}
                  iconType="drop"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div>
                  <label htmlFor="wizard-date" className="block text-xs font-medium text-slate-600 mb-1.5">
                    Step 4 · Pickup Date
                  </label>
                  <input
                    id="wizard-date"
                    type="date"
                    min={today}
                    value={journeyDate}
                    onChange={(e) => setJourneyDate(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                  />
                </div>
                <div>
                  <label htmlFor="wizard-time" className="block text-xs font-medium text-slate-600 mb-1.5">
                    Pickup Time
                  </label>
                  <input
                    id="wizard-time"
                    type="time"
                    value={journeyTime}
                    onChange={(e) => setJourneyTime(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                  />
                </div>
                {tripType === 'Round Trip' ? (
                  <div>
                    <label htmlFor="wizard-return-date" className="block text-xs font-medium text-slate-600 mb-1.5">
                      Step 5 · Return Date
                    </label>
                    <input
                      id="wizard-return-date"
                      type="date"
                      min={journeyDate || today}
                      value={returnDate || journeyDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                    />
                  </div>
                ) : tripType === 'Local Rental' ? (
                  <div>
                    <label htmlFor="wizard-local-pkg" className="block text-xs font-medium text-slate-600 mb-1.5">
                      Step 5 · Local Package
                    </label>
                    <select
                      id="wizard-local-pkg"
                      value={localHours}
                      onChange={(e) => setLocalHours(Number(e.target.value))}
                      className="w-full min-h-[44px] px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                    >
                      <option value={4}>Half-Day (4 hrs / 40 km)</option>
                      <option value={8}>Full-Day (8 hrs / 80 km)</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="wizard-return-na" className="block text-xs font-medium text-slate-600 mb-1.5">
                      Step 5 · Return Date
                    </label>
                    <input
                      id="wizard-return-na"
                      type="text"
                      disabled
                      value="Not required"
                      className="w-full min-h-[44px] px-3 py-2.5 text-sm border border-slate-200/80 bg-[#F5F7FA] rounded-lg text-slate-400"
                    />
                  </div>
                )}

                <PassengerCountInput
                  id="wizard-passengers"
                  label="Step 6 · Number of Passengers"
                  value={passengerCount}
                  onChange={setPassengerCount}
                  min={1}
                  max={55}
                />
              </div>

              {availabilityError && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                  {availabilityError}
                </p>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={fetchAvailableVehicles}
                  disabled={loadingVehicles}
                  className="w-full sm:w-auto min-h-[44px] px-6 py-3 bg-[#102A43] hover:bg-[#1a3c5e] text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 transition-colors"
                >
                  {loadingVehicles ? 'Checking Fleet Availability...' : 'Check Available Vehicles'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Live Google Maps Route Preview */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#102A43]">Live Route & Distance</h2>
                <span className="text-xs font-mono font-medium text-[#2563EB] tabular-nums">
                  {distanceKm} km · {durationText}
                </span>
              </div>
              <RoutePreviewMap
                origin={pickup}
                destination={drop}
                onRouteCalculated={({ distanceKm: km, durationText: dur }) => {
                  setDistanceKm(km);
                  setDurationText(dur);
                }}
              />
              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div className="p-3 bg-[#F5F7FA] rounded-lg">
                  <p className="text-slate-500">Estimated Distance</p>
                  <p className="text-base font-bold text-[#102A43] tabular-nums mt-0.5">{distanceKm} km</p>
                </div>
                <div className="p-3 bg-[#F5F7FA] rounded-lg">
                  <p className="text-slate-500">Estimated Drive Time</p>
                  <p className="text-base font-bold text-[#102A43] mt-0.5">{durationText}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 2: Steps 8 & 9 — Available Vehicles */}
        {stage === 2 && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-sm text-[#102A43]">
                <span className="font-semibold">Steps 8–9 · Select Available Fleet Vehicle</span>
                <span className="mx-2 text-slate-300">|</span>
                <span className="text-slate-600">
                  {pickup.address} to {drop.address} · {journeyDate} · {passengerCount} passengers
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStage(1)}
                className="px-3.5 py-2 text-xs font-semibold text-[#102A43] bg-[#F5F7FA] hover:bg-slate-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Modify Trip
              </button>
            </div>

            {availableVehicles.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                <Users className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-[#102A43]">No Matching Vehicles Found</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Try widening your vehicle category filter or reducing passenger count per vehicle.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCategory('All');
                    setStage(1);
                  }}
                  className="mt-4 px-5 py-2.5 bg-[#2563EB] text-white text-sm font-semibold rounded-lg cursor-pointer"
                >
                  Adjust Search Parameters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {availableVehicles.map((v) => (
                  <div
                    key={v.id}
                    className={`bg-white border rounded-xl overflow-hidden flex flex-col ${
                      v.isAvailableForDates ? 'border-slate-200' : 'border-red-200 opacity-75'
                    }`}
                  >
                    <div className="aspect-[4/3] bg-[#F5F7FA] overflow-hidden">
                      {v.images?.[0] && !brokenImages[v.id] ? (
                        <img
                          src={v.images[0]}
                          alt={v.name}
                          referrerPolicy="no-referrer"
                          onError={() => setBrokenImages((prev) => ({ ...prev, [v.id]: true }))}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#F5F7FA] to-slate-200 text-[#102A43] p-4 text-center">
                          <Car className="w-9 h-9 text-[#2563EB] mb-2" />
                          <span className="text-xs font-semibold">{v.name}</span>
                        </div>
                      )}
                    </div>
                    <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                      <div>
                        <p className="text-xs font-medium text-[#2563EB]">
                          {v.category} · {v.seatingCapacity} Seats · {v.ac ? 'AC' : 'Non-AC'}
                        </p>
                        <h3 className="text-lg font-bold text-[#102A43] mt-1">{v.name}</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          {v.fareEstimate.pricingBreakdownNote}
                        </p>
                        {!v.isAvailableForDates && (
                          <p className="text-xs font-semibold text-red-700 mt-2">
                            Unavailable: {v.conflictNote}
                          </p>
                        )}
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs text-slate-500">Estimated Total</p>
                          <p className="text-lg font-bold text-[#102A43] tabular-nums">
                            {formatINR(v.fareEstimate.totalEstimatedFare)}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={!v.isAvailableForDates}
                          onClick={() => handleSelectVehicle(v)}
                          className="px-4 py-2.5 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1d4ed8] disabled:bg-slate-300 rounded-lg cursor-pointer"
                        >
                          {v.isAvailableForDates ? 'Select Vehicle' : 'Booked'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STAGE 3: Steps 10, 11, 12 — Customer Info, Fare Breakdown & Razorpay Checkout */}
        {stage === 3 && selectedVehicle && fareEstimate && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h2 className="text-lg font-bold text-[#102A43]">Step 10 · Passenger Contact Information</h2>
                <button
                  type="button"
                  onClick={() => setStage(2)}
                  className="text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
                >
                  Change Vehicle
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Aarav Mehta"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg text-[#102A43]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+91 98450 00000"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg text-[#102A43]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Email Address (for Invoice & Confirmation) *</label>
                <input
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg text-[#102A43]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Pickup Landmark, Flight Number or Special Instructions
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional: Terminal arrival gate, child seat request, or multi-stop itinerary notes"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg text-[#102A43]"
                />
              </div>

              {submitError && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                  {submitError}
                </p>
              )}

              {/* Step 12 Payment Actions */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-[#102A43]">Step 12 · Confirm Booking & Payment</p>
                  {!allowOnlinePayment && (
                    <span className="text-[11px] font-medium text-amber-800">
                      Pre-pay unavailable · Direct dispatch selected
                    </span>
                  )}
                </div>
                {!allowOnlinePayment && (
                  <p className="text-xs text-slate-600 bg-[#F5F7FA] border border-slate-200 rounded-lg px-3.5 py-2.5">
                    Online pre-payment is not available right now. Please click{' '}
                    <strong className="text-[#102A43]">Submit Booking Request</strong> below to confirm your vehicle directly with our dispatch team.
                  </p>
                )}
                {maintenanceMode && (
                  <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2.5">
                    {settings?.maintenanceMessage || 'Bookings are temporarily paused for maintenance.'}
                  </p>
                )}
                {!allowGuestBooking && !user && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                    Guest booking is currently disabled. Please sign in to complete your reservation.
                  </p>
                )}
                <div className={`grid grid-cols-1 ${allowPayLater || !allowOnlinePayment ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
                  <button
                    type="button"
                    disabled={!allowOnlinePayment || submitting || maintenanceMode || (!allowGuestBooking && !user)}
                    onClick={() => {
                      if (allowOnlinePayment) void handleSubmitBooking('Advance');
                    }}
                    className={`px-4 py-3 text-xs font-semibold rounded-lg flex flex-col items-center justify-center gap-0.5 border transition-colors ${
                      allowOnlinePayment
                        ? 'bg-[#2563EB] hover:bg-[#1d4ed8] border-[#2563EB] text-white cursor-pointer disabled:opacity-60'
                        : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" />
                      Pre-Pay Advance
                    </span>
                    <span className={`font-mono tabular-nums text-[11px] ${allowOnlinePayment ? 'text-blue-100' : 'text-slate-400'}`}>
                      {formatINR(fareEstimate.advancePayable)}
                    </span>
                    {!allowOnlinePayment && (
                      <span className="text-[10px] font-medium text-amber-700 mt-0.5">
                        Not Available Now
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={!allowOnlinePayment || submitting || maintenanceMode || (!allowGuestBooking && !user)}
                    onClick={() => {
                      if (allowOnlinePayment) void handleSubmitBooking('Full');
                    }}
                    className={`px-4 py-3 text-xs font-semibold rounded-lg flex flex-col items-center justify-center gap-0.5 border transition-colors ${
                      allowOnlinePayment
                        ? 'bg-[#102A43] hover:bg-[#1a3c5e] border-[#102A43] text-white cursor-pointer disabled:opacity-60'
                        : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <span>Pre-Pay Full Fare</span>
                    <span className={`font-mono tabular-nums text-[11px] ${allowOnlinePayment ? 'text-slate-300' : 'text-slate-400'}`}>
                      {formatINR(fareEstimate.totalEstimatedFare)}
                    </span>
                    {!allowOnlinePayment && (
                      <span className="text-[10px] font-medium text-amber-700 mt-0.5">
                        Not Available Now
                      </span>
                    )}
                  </button>

                  {(allowPayLater || !allowOnlinePayment) && (
                    <button
                      type="button"
                      disabled={submitting || maintenanceMode || (!allowGuestBooking && !user)}
                      onClick={() => handleSubmitBooking('Pay Later')}
                      className={`px-4 py-3 text-xs font-semibold rounded-lg flex flex-col items-center justify-center gap-0.5 cursor-pointer disabled:opacity-60 transition-all ${
                        !allowOnlinePayment
                          ? 'bg-[#2563EB] hover:bg-[#1d4ed8] text-white ring-2 ring-[#2563EB]/25 shadow-sm'
                          : 'bg-[#F5F7FA] hover:bg-slate-200 text-[#102A43] border border-slate-200'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {submitting && paymentOption === 'Pay Later' ? 'Submitting...' : 'Submit Booking Request'}
                      </span>
                      <span className={`text-[11px] ${!allowOnlinePayment ? 'text-blue-100' : 'text-slate-500'}`}>
                        {!allowOnlinePayment ? 'Selected · Confirm with Dispatch' : 'Confirm with Dispatch'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Step 11 Fare Breakdown Card */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div>
                <p className="text-xs font-medium text-[#2563EB]">Step 11 · Transparent Price Estimate</p>
                <h3 className="text-lg font-bold text-[#102A43] mt-1">{selectedVehicle.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {tripType} · {journeyDate} at {journeyTime} · {passengerCount} Passengers
                </p>
              </div>

              <div className="space-y-2.5 text-sm border-t border-b border-slate-100 py-4">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-600">Base Rental Fare</span>
                  <span className="font-semibold text-[#102A43] tabular-nums">{formatINR(fareEstimate.baseFare)}</span>
                </div>
                {fareEstimate.extraKmCharges > 0 && (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-600">Extra Distance Estimate</span>
                    <span className="font-semibold text-[#102A43] tabular-nums">{formatINR(fareEstimate.extraKmCharges)}</span>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <span className="text-slate-600">Driver Allowance</span>
                  <span className="font-semibold text-[#102A43] tabular-nums">{formatINR(fareEstimate.driverAllowance)}</span>
                </div>
                {fareEstimate.nightCharges > 0 && (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-600">Night Pickup Operations</span>
                    <span className="font-semibold text-[#102A43] tabular-nums">{formatINR(fareEstimate.nightCharges)}</span>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <span className="text-slate-600">GST (5%)</span>
                  <span className="font-semibold text-[#102A43] tabular-nums">{formatINR(fareEstimate.taxAmount)}</span>
                </div>
                <div className="flex justify-between gap-4 pt-2 border-t border-slate-100 text-base font-bold text-[#102A43]">
                  <span>Total Estimated Fare</span>
                  <span className="tabular-nums">{formatINR(fareEstimate.totalEstimatedFare)}</span>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-lg bg-[#F5F7FA]">
                  <p className="font-semibold text-[#102A43] mb-1">Included in this price:</p>
                  <ul className="space-y-1 text-slate-600">
                    {fareEstimate.includedItems.map((i) => (
                      <li key={i}>• {i}</li>
                    ))}
                  </ul>
                </div>
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="font-semibold text-amber-900 flex items-center gap-1.5 mb-1">
                    <Info className="w-3.5 h-3.5" />
                    Additional Charges (Payable at Actuals):
                  </p>
                  <p className="text-amber-900/90">
                    Est. Highway Tolls: ~{formatINR(fareEstimate.estimatedTollsExtra)}
                    {fareEstimate.estimatedStatePermitExtra > 0 &&
                      ` · Interstate Permit: ~${formatINR(fareEstimate.estimatedStatePermitExtra)}`}
                    {' · Parking at actuals.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 4: Confirmation & Receipt */}
        {stage === 4 && createdBooking && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-2xl mx-auto text-center space-y-5">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <div>
              <p className="text-xs font-semibold text-[#2563EB]">
                Booking Reference: <span className="font-mono">{createdBooking.bookingCode}</span>
              </p>
              <h2 className="text-2xl font-bold text-[#102A43] mt-1">
                {createdBooking.paymentStatus === 'Unpaid'
                  ? 'Booking Request Submitted'
                  : 'Booking Confirmed & Payment Verified'}
              </h2>
              <p className="text-sm text-slate-600 mt-2">
                {createdBooking.vehicleName} · {createdBooking.journeyDate} at {createdBooking.journeyTime}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left bg-[#F5F7FA] p-4 rounded-xl text-xs">
              <div>
                <p className="text-slate-500">Booking Status</p>
                <p className="font-bold text-[#102A43] mt-0.5">{createdBooking.bookingStatus}</p>
              </div>
              <div>
                <p className="text-slate-500">Payment Status</p>
                <p className="font-bold text-[#102A43] mt-0.5">{createdBooking.paymentStatus}</p>
              </div>
              <div>
                <p className="text-slate-500">Total Fare</p>
                <p className="font-bold text-[#102A43] tabular-nums mt-0.5">{formatINR(createdBooking.totalFare)}</p>
              </div>
              <div>
                <p className="text-slate-500">Paid Online</p>
                <p className="font-bold text-emerald-700 tabular-nums mt-0.5">{formatINR(createdBooking.paidAmount)}</p>
              </div>
            </div>

            {createdBooking.driverName && (
              <p className="text-xs text-slate-600 flex items-center justify-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#2563EB]" />
                Assigned Chauffeur: <strong className="text-[#102A43]">{createdBooking.driverName}</strong> ({createdBooking.driverPhone})
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => downloadBookingInvoicePdf(createdBooking, settings)}
                className="px-5 py-2.5 bg-[#102A43] hover:bg-[#1a3c5e] text-white text-sm font-semibold rounded-lg flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download PDF Invoice
              </button>
              <button
                type="button"
                onClick={onGoToDashboard}
                className="px-5 py-2.5 bg-[#F5F7FA] hover:bg-slate-200 text-[#102A43] text-sm font-semibold rounded-lg cursor-pointer"
              >
                Open Customer Dashboard
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Razorpay Test Mode Checkout Modal (when live Razorpay env keys are not set) */}
      {testCheckoutOrder && createdBooking && (
        <div className="fixed inset-0 z-50 bg-[#102A43]/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full overflow-hidden shadow-2xl">
            <div className="bg-[#102A43] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-200">Razorpay Secure Checkout (Test Mode)</p>
                <h3 className="text-base font-bold">{companyName}</h3>
              </div>
              <p className="text-lg font-bold tabular-nums">{formatINR(testCheckoutOrder.amountInr)}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-xs text-slate-600 space-y-1 bg-[#F5F7FA] p-3.5 rounded-lg">
                <p>Order ID: <span className="font-mono text-[#102A43]">{testCheckoutOrder.orderId}</span></p>
                <p>Booking: <span className="font-mono text-[#102A43]">{testCheckoutOrder.bookingCode}</span></p>
                <p>Customer: {testCheckoutOrder.customerName} ({testCheckoutOrder.customerPhone})</p>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                Payment signature is verified server-side before confirming fleet allocation.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTestCheckoutOrder(null)}
                  className="flex-1 py-2.5 px-4 bg-[#F5F7FA] text-[#102A43] text-sm font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={verifyingPayment}
                  onClick={() =>
                    verifyRazorpayPayment(
                      createdBooking,
                      paymentOption === 'Full' ? 'Full' : 'Advance',
                      testCheckoutOrder
                    )
                  }
                  className="flex-1 py-2.5 px-4 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-sm font-semibold rounded-lg cursor-pointer disabled:opacity-60"
                >
                  {verifyingPayment ? 'Verifying...' : `Authorize ${formatINR(testCheckoutOrder.amountInr)}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
