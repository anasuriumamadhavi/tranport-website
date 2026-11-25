import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Headphones,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Star,
  Wrench,
} from 'lucide-react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import {
  FeaturedDestination,
  GalleryCategory,
  GalleryItem,
  PricingConfig,
  Review,
  TravelService,
  TripType,
  UserProfile,
  VehicleCategory,
  WebsiteSettings,
} from './types';
import { apiFetch, formatINR } from './lib/api';
import { ActivePage, Header } from './components/Header';
import { HeroBannerSlider } from './components/HeroBannerSlider';
import { Footer } from './components/Footer';
import { EnrichedVehicle, VehicleCard } from './components/VehicleCard';
import { VehicleDetailsModal } from './components/VehicleDetailsModal';
import { BookingPrefill, BookingWizard } from './components/BookingWizard';
import { CustomerDashboard } from './components/CustomerDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthView } from './components/AuthView';
import { ServicesPage } from './components/ServicesPage';
import { GalleryPage } from './components/GalleryPage';
import { DestinationsPage } from './components/DestinationsPage';
import { PopularDestinationsScroller } from './components/PopularDestinationsScroller';
import {
  DepotLocationMap,
  MapsProvider,
  PlaceAutocompleteInput,
  PlaceValue,
} from './components/MapsComponents';
import { WhatsAppWidget } from './components/WhatsAppWidget';

interface CategorySummary {
  category: VehicleCategory;
  fleetGroup: 'Car' | 'Bus';
  subtitle: string;
  count: number;
  availableCount: number;
  startingPerKm: number;
  startingHalfDay: number;
  startingPerDayBus: number;
  sampleImage: string;
}

const SERVICES_LIST: Array<{
  num: string;
  title: string;
  desc: string;
  tripType: TripType;
  defaultCategory: VehicleCategory | 'All';
}> = [
  {
    num: '01',
    title: 'Local City Travel',
    desc: 'Flexible 4-hour and 8-hour chauffeur-driven city packages for errands, meetings, and day itineraries.',
    tripType: 'Local Rental',
    defaultCategory: 'Cars',
  },
  {
    num: '02',
    title: 'Outstation Trips',
    desc: 'One-way and multi-day intercity highway travel in inspected sedans, SUVs, and touring coaches.',
    tripType: 'Round Trip',
    defaultCategory: 'SUVs',
  },
  {
    num: '03',
    title: 'Airport Pickup & Drop',
    desc: 'Punctual terminal pickups with flight-tracking buffer time and dedicated luggage capacity.',
    tripType: 'Airport Transfer',
    defaultCategory: 'Cars',
  },
  {
    num: '04',
    title: 'Family Trips',
    desc: 'Spacious 7-seater MPVs and 12–17 seater Tempo Travellers built for relaxed multi-generational travel.',
    tripType: 'Round Trip',
    defaultCategory: 'SUVs',
  },
  {
    num: '05',
    title: 'Corporate Transportation',
    desc: 'Executive saloons for visiting leadership and daily 24-seater employee shuttle operations.',
    tripType: 'Local Rental',
    defaultCategory: 'Premium Cars',
  },
  {
    num: '06',
    title: 'Wedding Transportation',
    desc: 'Coordinated bridal luxury cars and guest shuttle fleets ensuring smooth venue transfers.',
    tripType: 'Round Trip',
    defaultCategory: 'Premium Cars',
  },
  {
    num: '07',
    title: 'Group Travel',
    desc: 'Comfortable pushback Tempo Travellers and multi-axle Volvo coaches for reunions and tours.',
    tripType: 'Round Trip',
    defaultCategory: 'Tempo Travellers',
  },
  {
    num: '08',
    title: 'Event Transportation',
    desc: 'Dedicated conference, exhibition, and concert fleet dispatch with on-site coordinator support.',
    tripType: 'Local Rental',
    defaultCategory: 'Luxury Buses',
  },
  {
    num: '09',
    title: 'School & College Transportation',
    desc: 'Safety-certified 24 to 52 seater coaches with speed governors for educational excursions.',
    tripType: 'Round Trip',
    defaultCategory: 'Large Passenger Buses',
  },
];

export default function App() {
  const [activePage, setActivePage] = useState<ActivePage>('home');
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // Auth held strictly in React memory
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);

  // Fleet & Public Data
  const [vehicles, setVehicles] = useState<EnrichedVehicle[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [pricing, setPricing] = useState<PricingConfig | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [servicesList, setServicesList] = useState<TravelService[]>([]);
  const [destinationsList, setDestinationsList] = useState<FeaturedDestination[]>([]);
  const [galleryInitialCategory, setGalleryInitialCategory] = useState<GalleryCategory | 'All'>('All');
  const [settings, setSettings] = useState<WebsiteSettings | null>(null);
  const [loadingFleet, setLoadingFleet] = useState(true);

  // Modals & Prefills
  const [detailsVehicle, setDetailsVehicle] = useState<EnrichedVehicle | null>(null);
  const [bookingPrefill, setBookingPrefill] = useState<BookingPrefill | undefined>(undefined);

  // Hero Search Bar State
  const today = new Date().toISOString().slice(0, 10);
  const [heroPickup, setHeroPickup] = useState<PlaceValue>({
    address: 'Visakhapatnam International Airport (VTZ), Vizag',
    lat: 17.7212,
    lng: 83.2245,
  });
  const [heroDrop, setHeroDrop] = useState<PlaceValue>({
    address: 'Araku Valley Hill Station, Visakhapatnam District',
    lat: 18.3273,
    lng: 82.8775,
  });
  const [heroDate, setHeroDate] = useState(today);
  const [heroTime, setHeroTime] = useState('09:00');
  const [heroCategory, setHeroCategory] = useState<string>('All');
  const [heroPassengers, setHeroPassengers] = useState<number>(4);

  // Fleet Listing Filters
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterAc, setFilterAc] = useState<string>('');
  const [filterMinSeats, setFilterMinSeats] = useState<number>(0);
  const [filterMaxPrice, setFilterMaxPrice] = useState<number>(0);
  const [filterAvailableOnly, setFilterAvailableOnly] = useState<boolean>(false);

  // Contact Form State
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactStatus, setContactStatus] = useState<string | null>(null);

  useEffect(() => {
    const onQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  const loadPublicData = async () => {
    setLoadingFleet(true);
    try {
      const [vehRes, catRes, prcRes, revRes, setRes, galRes, srvRes, dstRes] = await Promise.all([
        apiFetch<{ vehicles: EnrichedVehicle[] }>('/api/vehicles'),
        apiFetch<{ categories: CategorySummary[] }>('/api/categories'),
        apiFetch<{ pricing: PricingConfig }>('/api/pricing'),
        apiFetch<{ reviews: Review[] }>('/api/reviews'),
        apiFetch<{ settings: WebsiteSettings }>('/api/settings'),
        apiFetch<{ gallery: GalleryItem[] }>('/api/gallery'),
        apiFetch<{ services: TravelService[] }>('/api/services'),
        apiFetch<{ destinations: FeaturedDestination[] }>('/api/destinations'),
      ]);
      setVehicles(vehRes.vehicles);
      setCategories(catRes.categories);
      setPricing(prcRes.pricing);
      setReviews(revRes.reviews);
      setSettings(setRes.settings);
      setGalleryItems(galRes.gallery);
      setServicesList(srvRes.services);
      setDestinationsList(dstRes.destinations);
      setHeroPickup((prev) =>
        prev.address === 'Visakhapatnam International Airport (VTZ), Vizag'
          ? {
              address: setRes.settings.defaultPickupAddress,
              lat: setRes.settings.defaultPickupLat,
              lng: setRes.settings.defaultPickupLng,
            }
          : prev
      );
      setHeroDrop((prev) =>
        prev.address === 'Araku Valley Hill Station, Visakhapatnam District'
          ? {
              address: setRes.settings.defaultDropAddress,
              lat: setRes.settings.defaultDropLat,
              lng: setRes.settings.defaultDropLng,
            }
          : prev
      );
    } catch {
      // handled in UI state
    } finally {
      setLoadingFleet(false);
    }
  };

  useEffect(() => {
    void loadPublicData();
  }, []);

  useEffect(() => {
    if (!settings) return;
    if (settings.seoTitle) {
      document.title = settings.seoTitle;
    }
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && settings.seoDescription) {
      metaDesc.setAttribute('content', settings.seoDescription);
    }
    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon && settings.logoUrl) {
      favicon.setAttribute('href', settings.logoUrl);
    }
  }, [settings]);

  const handleNavigate = (page: ActivePage, sectionId?: string) => {
    setActivePage(page);
    if (page === 'fleet') {
      setFilterCategory('');
    }
    if (page === 'gallery' && !sectionId) {
      setGalleryInitialCategory('All');
    }

    if (sectionId) {
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setBookingPrefill({
      category: (heroCategory === 'All' ? 'All' : heroCategory) as VehicleCategory | 'All',
      pickup: heroPickup,
      drop: heroDrop,
      journeyDate: heroDate,
      journeyTime: heroTime,
      passengers: heroPassengers,
      tripType: 'One Way',
    });
    setActivePage('booking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBookVehicle = (veh: EnrichedVehicle) => {
    setDetailsVehicle(null);
    setBookingPrefill({
      category: veh.category,
      selectedVehicleId: veh.id,
      pickup: heroPickup,
      drop: heroDrop,
      journeyDate: heroDate,
      journeyTime: heroTime,
      passengers: Math.min(heroPassengers, veh.seatingCapacity),
      tripType: 'One Way',
    });
    setActivePage('booking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactStatus(null);
    try {
      const res = await apiFetch<{ message: string }>('/api/enquiries', {
        method: 'POST',
        body: JSON.stringify({
          name: contactName,
          phone: contactPhone,
          email: contactEmail,
          subject: 'Homepage Contact & Custom Quote',
          message: contactMessage,
          source: 'Contact Form',
        }),
      });
      setContactStatus(res.message);
      setContactName('');
      setContactPhone('');
      setContactEmail('');
      setContactMessage('');
    } catch (err) {
      setContactStatus((err as Error).message);
    }
  };

  const isListingPage = activePage === 'fleet';

  const filteredListingVehicles = vehicles
    .filter((v) => !filterCategory || v.category === filterCategory)
    .filter((v) => !filterAc || (filterAc === 'true' ? v.ac : !v.ac))
    .filter((v) => v.seatingCapacity >= filterMinSeats)
    .filter((v) => !filterMaxPrice || (v.perKmRate ?? 0) <= filterMaxPrice)
    .filter((v) => !filterAvailableOnly || v.status === 'Available');

  const activeCategoryNames = categories.map((c) => c.category);

  return (
    <MotionConfig reducedMotion="user">
      <MapsProvider>
        <div className="min-h-screen flex flex-col bg-white text-[#102A43]">
          {quotaExceeded && (
            <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
              <span>
                Google Maps Platform quota reached. If you are the app owner, visit{' '}
                <a
                  href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-semibold text-amber-950 hover:text-amber-800"
                >
                  maps developer site
                </a>{' '}
                for instructions to update your account.
              </span>
            </div>
          )}

          <Header
            activePage={activePage}
            user={user}
            settings={settings}
            onNavigate={handleNavigate}
            onLogout={() => {
              setToken(null);
              setUser(null);
              setActivePage('home');
            }}
          />

          {settings?.maintenanceMode && (
            <div className="bg-amber-50 border-b border-amber-200 text-amber-950 px-4 py-2.5 text-xs sm:text-sm text-center">
              {settings.maintenanceMessage}
            </div>
          )}

          <main className="flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={activePage}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* HOMEPAGE */}
                {activePage === 'home' && (
                  <>
                    {/* Sliding Hero Banner (Full unobstructed showcase) */}
                    <HeroBannerSlider settings={settings} onNavigate={handleNavigate} />

                    {/* Booking Search Bar Strip below Hero Banner */}
                    <section className="bg-[#F5F7FA] border-b border-slate-200 py-6 sm:py-8">
                      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <motion.form
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                          onSubmit={handleHeroSearch}
                          className="bg-white rounded-xl p-5 sm:p-6 shadow-sm border border-slate-200"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
                            <PlaceAutocompleteInput
                              id="hero-pickup"
                              label="Pickup Location"
                              placeholder="Airport, station or city address"
                              value={heroPickup.address}
                              onChange={setHeroPickup}
                              iconType="pickup"
                              className="lg:col-span-2"
                            />
                            <PlaceAutocompleteInput
                              id="hero-drop"
                              label="Drop Location"
                              placeholder="Destination city or venue"
                              value={heroDrop.address}
                              onChange={setHeroDrop}
                              iconType="drop"
                              className="lg:col-span-2"
                            />
                            <div>
                              <label htmlFor="hero-date" className="block text-xs font-medium text-slate-600 mb-1.5">
                                Pickup Date
                              </label>
                              <input
                                id="hero-date"
                                type="date"
                                min={today}
                                value={heroDate}
                                onChange={(e) => setHeroDate(e.target.value)}
                                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg text-[#102A43]"
                              />
                            </div>
                            <div>
                              <label htmlFor="hero-time" className="block text-xs font-medium text-slate-600 mb-1.5">
                                Pickup Time
                              </label>
                              <input
                                id="hero-time"
                                type="time"
                                value={heroTime}
                                onChange={(e) => setHeroTime(e.target.value)}
                                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg text-[#102A43]"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100 items-end">
                            <div>
                              <label htmlFor="hero-type" className="block text-xs font-medium text-slate-600 mb-1.5">
                                Vehicle Type
                              </label>
                              <select
                                id="hero-type"
                                value={heroCategory}
                                onChange={(e) => setHeroCategory(e.target.value)}
                                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg text-[#102A43]"
                              >
                                <option value="All">All Fleet (Cars & Buses)</option>
                                {activeCategoryNames.map((cat) => (
                                  <option key={cat} value={cat}>
                                    {cat}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label htmlFor="hero-passengers" className="block text-xs font-medium text-slate-600 mb-1.5">
                                Number of Passengers
                              </label>
                              <input
                                id="hero-passengers"
                                type="number"
                                min={1}
                                max={55}
                                value={heroPassengers}
                                onChange={(e) => setHeroPassengers(Math.max(1, Number(e.target.value)))}
                                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg text-[#102A43] tabular-nums"
                              />
                            </div>
                            <button
                              type="submit"
                              className="w-full py-2.5 px-5 bg-[#2563EB] hover:bg-[#1d4ed8] active:scale-[0.98] text-white text-sm font-semibold rounded-lg transition-all duration-150 cursor-pointer min-h-[44px]"
                            >
                              Search Available Vehicles
                            </button>
                          </div>
                        </motion.form>
                      </div>
                    </section>

                    {/* Our Popular Destinations Circular Manual Side-Scrolling Strip */}
                    <PopularDestinationsScroller
                      destinations={destinationsList}
                      selectedDropAddress={heroDrop.address}
                      onSelectDestination={(dest) => {
                        setHeroDrop({
                          address: dest.dropAddress,
                          lat: dest.dropLat,
                          lng: dest.dropLng,
                        });
                        setHeroCategory(dest.recommendedCategory);
                        setHeroPassengers(dest.recommendedPassengers);
                      }}
                      onBookDestination={(dest) => {
                        setBookingPrefill({
                          category: dest.recommendedCategory,
                          tripType: dest.recommendedTripType,
                          pickup: heroPickup,
                          drop: {
                            address: dest.dropAddress,
                            lat: dest.dropLat,
                            lng: dest.dropLng,
                          },
                          journeyDate: heroDate,
                          journeyTime: heroTime,
                          passengers: dest.recommendedPassengers,
                        });
                        setActivePage('booking');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      onExploreAll={() => handleNavigate('destinations')}
                    />

              {/* Vehicle Categories Section (dynamically matches supported company fleet) */}
              <motion.section
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.12 }}
                transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                className="py-16 bg-white border-b border-slate-100"
              >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-bold text-[#102A43] tracking-tight">
                        Our Owned Fleet Categories
                      </h2>
                      <p className="text-sm text-slate-600 mt-1.5">
                        Every vehicle belongs to our own maintained fleet—inspect capacities and transparent base tariffs.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleNavigate('fleet')}
                      className="text-sm font-semibold text-[#2563EB] hover:underline cursor-pointer"
                    >
                      View Our Vehicles →
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {categories.map((cat, idx) => (
                      <motion.button
                        key={cat.category}
                        type="button"
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.15 }}
                        transition={{ duration: 0.22, delay: Math.min(idx * 0.04, 0.2), ease: [0.16, 1, 0.3, 1] }}
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => {
                          setFilterCategory(cat.category);
                          setActivePage('fleet');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="text-left bg-[#F5F7FA] hover:bg-slate-100 border border-slate-200 hover:border-[#2563EB]/40 hover:shadow-sm rounded-xl p-5 transition-colors cursor-pointer flex flex-col justify-between"
                      >
                        <div>
                          <p className="text-xs font-medium text-[#2563EB] tabular-nums">
                            {cat.fleetGroup} Fleet · {cat.availableCount}/{cat.count} Ready
                          </p>
                          <h3 className="text-lg font-bold text-[#102A43] mt-1">{cat.category}</h3>
                          <p className="text-xs text-slate-600 mt-1">{cat.subtitle}</p>
                        </div>
                        <p className="text-sm font-bold text-[#102A43] mt-4 pt-3 border-t border-slate-200/80 tabular-nums">
                          {cat.fleetGroup === 'Bus' && cat.startingPerDayBus
                            ? `From ${formatINR(cat.startingPerDayBus)} / day`
                            : `From ${formatINR(cat.startingPerKm)} / km`}
                        </p>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </motion.section>

              {/* Popular Vehicles */}
              <motion.section
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                className="py-16 bg-[#F5F7FA]"
              >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-bold text-[#102A43] tracking-tight">
                        Popular Fleet Vehicles
                      </h2>
                      <p className="text-sm text-slate-600 mt-1.5">
                        Live rates from our dispatch pricing matrix. Fuel and chauffeur included; tolls and parking at actuals.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleNavigate('fleet')}
                      className="px-4 py-2 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 active:scale-[0.98] text-[#102A43] rounded-lg transition-all cursor-pointer"
                    >
                      View Complete Fleet ({vehicles.length})
                    </button>
                  </div>

                  {loadingFleet ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-96 bg-white border border-slate-200 rounded-xl animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {vehicles.slice(0, 6).map((v, idx) => (
                        <motion.div
                          key={v.id}
                          initial={{ opacity: 0, y: 12 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, amount: 0.1 }}
                          transition={{ duration: 0.22, delay: Math.min(idx * 0.04, 0.2), ease: [0.16, 1, 0.3, 1] }}
                        >
                          <VehicleCard
                            vehicle={v}
                            onViewDetails={setDetailsVehicle}
                            onBookNow={handleBookVehicle}
                          />
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.section>

              {/* Our Services */}
              <motion.section
                id="services"
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                className="py-16 bg-white border-t border-slate-100"
              >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
                    <div className="max-w-2xl">
                      <h2 className="text-2xl sm:text-3xl font-bold text-[#102A43] tracking-tight">
                        Transportation Services for Every Occasion
                      </h2>
                      <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                        From solo airport transfers to 52-seater institutional charters, select a service to start your custom booking.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleNavigate('services')}
                        className="px-4 py-2 text-xs font-semibold bg-[#F5F7FA] hover:bg-slate-200 active:scale-[0.98] text-[#102A43] rounded-lg whitespace-nowrap transition-all cursor-pointer"
                      >
                        Services Overview
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNavigate('gallery')}
                        className="text-sm font-semibold text-[#2563EB] hover:underline whitespace-nowrap cursor-pointer"
                      >
                        Fleet Gallery →
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {(servicesList.length > 0
                      ? servicesList.filter((s) => s.status === 'Active')
                      : SERVICES_LIST
                    ).map((srv, idx) => (
                      <motion.button
                        key={srv.num}
                        type="button"
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.12 }}
                        transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.18), ease: [0.16, 1, 0.3, 1] }}
                        whileHover={{ y: -3 }}
                        onClick={() => {
                          setBookingPrefill({
                            tripType: srv.tripType,
                            category: srv.defaultCategory,
                            pickup: heroPickup,
                            drop: heroDrop,
                            journeyDate: heroDate,
                            journeyTime: heroTime,
                            passengers:
                              typeof (srv as TravelService).defaultPassengers === 'number'
                                ? (srv as TravelService).defaultPassengers
                                : srv.defaultCategory === 'Cars'
                                ? 3
                                : 12,
                          });
                          setActivePage('booking');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="text-left p-6 rounded-xl border border-slate-200 hover:border-[#2563EB] hover:shadow-sm bg-white transition-all duration-150 cursor-pointer group"
                      >
                        <p className="text-xs font-mono font-semibold text-[#2563EB]">{srv.num}.</p>
                        <h3 className="text-base font-bold text-[#102A43] mt-1 group-hover:text-[#2563EB] transition-colors">
                          {srv.title}
                        </h3>
                        <p className="text-xs text-slate-600 mt-2 leading-relaxed">{srv.desc}</p>
                      </motion.button>
                    ))}
                  </div>

                  {/* Upcoming Services Preview Strip */}
                  {servicesList.some((s) => s.status === 'Upcoming') && (
                    <div className="mt-10 bg-[#F5F7FA] border border-slate-200 rounded-xl p-6 space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-[#F59E0B]">Fleet Expansion Roadmap</p>
                          <h3 className="text-lg font-bold text-[#102A43] mt-0.5">
                            Upcoming Services Launching Soon
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleNavigate('services')}
                          className="text-xs font-semibold text-[#2563EB] hover:underline whitespace-nowrap cursor-pointer"
                        >
                          Pre-Register Priority Access →
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {servicesList
                          .filter((s) => s.status === 'Upcoming')
                          .slice(0, 3)
                          .map((up) => (
                            <motion.button
                              key={up.id}
                              type="button"
                              whileHover={{ y: -2 }}
                              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                              onClick={() => handleNavigate('services')}
                              className="text-left bg-white border border-slate-200 hover:border-[#2563EB] rounded-lg p-4 transition-colors cursor-pointer"
                            >
                              <p className="text-[11px] font-mono font-semibold text-[#F59E0B]">
                                {up.num} · {up.launchWindow || 'Launching Soon'}
                              </p>
                              <p className="text-sm font-bold text-[#102A43] mt-1">{up.title}</p>
                              <p className="text-xs text-slate-600 mt-1 line-clamp-2">{up.desc}</p>
                            </motion.button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.section>

              {/* Featured Destinations Showcase */}
              {destinationsList.length > 0 && (
                <motion.section
                  id="destinations"
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.1 }}
                  transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                  className="py-16 bg-white border-t border-slate-100"
                >
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
                      <div className="max-w-2xl">
                        <h2 className="text-2xl sm:text-3xl font-bold text-[#102A43] tracking-tight">
                          Featured Destinations from Visakhapatnam
                        </h2>
                        <p className="text-sm text-slate-600 mt-1.5">
                          Select a popular coastal, hill station, or pilgrimage corridor to auto-fill route coordinates and book a direct vehicle.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleNavigate('destinations')}
                        className="px-4 py-2 text-xs font-semibold bg-[#F5F7FA] hover:bg-slate-200 active:scale-[0.98] text-[#102A43] rounded-lg whitespace-nowrap transition-all cursor-pointer"
                      >
                        Explore All Destinations ({destinationsList.length})
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                      {(destinationsList.filter((d) => d.featured).length > 0
                        ? destinationsList.filter((d) => d.featured)
                        : destinationsList
                      )
                        .slice(0, 4)
                        .map((dest, idx) => (
                          <motion.article
                            key={dest.id}
                            initial={{ opacity: 0, y: 12 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.12 }}
                            transition={{ duration: 0.22, delay: Math.min(idx * 0.05, 0.2), ease: [0.16, 1, 0.3, 1] }}
                            whileHover={{ y: -4 }}
                            className="group bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between transition-shadow hover:shadow-md"
                          >
                            <div>
                              <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                                <img
                                  src={dest.imageUrl}
                                  alt={dest.name}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.05]"
                                />
                              </div>
                              <div className="p-4 space-y-1.5">
                                <p className="text-[11px] font-semibold text-[#2563EB] tabular-nums">
                                  {dest.distanceKm} km · {dest.durationText}
                                </p>
                                <h3 className="text-base font-bold text-[#102A43] leading-snug">
                                  {dest.name}
                                </h3>
                                <p className="text-xs text-slate-600 line-clamp-2">{dest.description}</p>
                              </div>
                            </div>
                            <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-2.5">
                              <p className="text-[11px] font-medium text-slate-500">
                                {dest.recommendedCategory} · {dest.startingEstimateLabel}
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setBookingPrefill({
                                    category: dest.recommendedCategory,
                                    tripType: dest.recommendedTripType,
                                    pickup: heroPickup,
                                    drop: {
                                      address: dest.dropAddress,
                                      lat: dest.dropLat,
                                      lng: dest.dropLng,
                                    },
                                    journeyDate: heroDate,
                                    journeyTime: heroTime,
                                    passengers: dest.recommendedPassengers,
                                  });
                                  setActivePage('booking');
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="w-full py-2 px-3 bg-[#102A43] hover:bg-[#1a3c5e] active:scale-[0.98] text-white text-xs font-semibold rounded-lg cursor-pointer transition-all duration-150"
                              >
                                Book Ride to Route
                              </button>
                            </div>
                          </motion.article>
                        ))}
                    </div>
                  </div>
                </motion.section>
              )}

              {/* Why Choose Us + Adjacent Customer Reviews */}
              <motion.section
                id="about"
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                className="py-16 bg-[#F5F7FA] border-t border-slate-200"
              >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                    <div className="lg:col-span-5 space-y-4">
                      <h2 className="text-2xl sm:text-3xl font-bold text-[#102A43] tracking-tight">
                        {settings?.whyChooseTitle || `Why Choose ${settings?.companyName || 'Vizag Jagan Travels'}?`}
                      </h2>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {settings?.whyChooseDescription ||
                          'Unlike third-party aggregator marketplaces, Vizag Jagan Travels owns, services, and dispatches every car and bus in our inventory. You get predictable quality, accountable drivers, and direct pricing.'}
                      </p>
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="bg-white border border-slate-200 rounded-xl p-4">
                          <p className="text-2xl font-bold text-[#102A43] tabular-nums">
                            {settings?.onTimeMetric || '99.4%'}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">On-time dispatch record</p>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-xl p-4">
                          <p className="text-2xl font-bold text-[#102A43] tabular-nums">
                            {settings?.ownedFleetMetric || '100%'}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">Company-owned vehicles</p>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        {
                          icon: <Wrench className="w-5 h-5 text-[#2563EB]" />,
                          title: 'Well-Maintained Vehicles',
                          desc: 'Scheduled multi-point garage inspections and sanitized cabins before every trip.',
                        },
                        {
                          icon: <ShieldCheck className="w-5 h-5 text-[#2563EB]" />,
                          title: 'Professional Drivers',
                          desc: 'Full-time uniformed chauffeurs with commercial licenses and highway route mastery.',
                        },
                        {
                          icon: <CheckCircle2 className="w-5 h-5 text-[#2563EB]" />,
                          title: 'Affordable Transparent Pricing',
                          desc: 'Clear upfront itemization of included fare vs. actual highway tolls and parking.',
                        },
                        {
                          icon: <Clock className="w-5 h-5 text-[#2563EB]" />,
                          title: 'On-Time Pickup',
                          desc: 'GPS-tracked vehicle dispatch arriving 15 minutes prior to departure.',
                        },
                        {
                          icon: <ShieldCheck className="w-5 h-5 text-[#F59E0B]" />,
                          title: 'Safe & Comfortable Journeys',
                          desc: 'Speed-governed coaches, first-aid kits, and strict dual-driver overnight policies.',
                        },
                        {
                          icon: <Headphones className="w-5 h-5 text-[#2563EB]" />,
                          title: '24/7 Customer Support',
                          desc: 'Live human dispatch coordinators reachable via phone or WhatsApp throughout your trip.',
                        },
                      ].map((item, idx) => (
                        <motion.div
                          key={item.title}
                          initial={{ opacity: 0, y: 10 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, amount: 0.12 }}
                          transition={{ duration: 0.2, delay: Math.min(idx * 0.04, 0.2), ease: [0.16, 1, 0.3, 1] }}
                          className="bg-white border border-slate-200 rounded-xl p-5"
                        >
                          <div className="mb-2.5">{item.icon}</div>
                          <h3 className="text-sm font-bold text-[#102A43]">{item.title}</h3>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.desc}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Customer Reviews */}
                  <div className="pt-8 border-t border-slate-200">
                    <h3 className="text-xl font-bold text-[#102A43] mb-6">Verified Passenger Reviews</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {reviews.slice(0, 3).map((rev, idx) => (
                        <motion.article
                          key={rev.id}
                          initial={{ opacity: 0, y: 10 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, amount: 0.15 }}
                          transition={{ duration: 0.2, delay: idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
                          className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-1 text-[#F59E0B] mb-3" aria-label={`${rev.rating} out of 5 stars`}>
                              {Array.from({ length: rev.rating }).map((_, i) => (
                                <Star key={i} className="w-4 h-4 fill-current" />
                              ))}
                            </div>
                            <p className="text-sm text-slate-700 leading-relaxed">“{rev.comment}”</p>
                          </div>
                          <div className="mt-5 pt-4 border-t border-slate-100">
                            <p className="text-sm font-bold text-[#102A43]">{rev.customerName}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {rev.roleOrCity} · {rev.companyOrTrip}
                            </p>
                          </div>
                        </motion.article>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.section>

              {/* Contact & Google Maps Depot Section */}
              <motion.section
                id="contact"
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                className="py-16 bg-white border-t border-slate-200"
              >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                    <div className="lg:col-span-6 space-y-6">
                      <div>
                        <h2 className="text-2xl sm:text-3xl font-bold text-[#102A43] tracking-tight">
                          Contact Dispatch & Custom Quotations
                        </h2>
                        <p className="text-sm text-slate-600 mt-2">
                          Need a multi-bus wedding shuttle, corporate contract, or custom multi-city itinerary? Reach our dispatch hub directly.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div className="p-4 bg-[#F5F7FA] rounded-xl border border-slate-200">
                          <p className="text-xs text-slate-500 flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-[#2563EB]" /> {settings?.workingHours || '24/7 Dispatch Phone'}
                          </p>
                          <p className="font-bold text-[#102A43] mt-1 tabular-nums">
                            {settings?.supportPhone || '+91 891 274 8800'}
                          </p>
                        </div>
                        <div className="p-4 bg-[#F5F7FA] rounded-xl border border-slate-200">
                          <p className="text-xs text-slate-500 flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-[#2563EB]" /> Bookings Email
                          </p>
                          <p className="font-bold text-[#102A43] mt-1">
                            {settings?.supportEmail || 'dispatch@vizagjagantravels.com'}
                          </p>
                        </div>
                        <div className="p-4 bg-[#F5F7FA] rounded-xl border border-slate-200 sm:col-span-2 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs text-slate-500 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-[#2563EB]" /> Central Garage & Dispatch Hub
                            </p>
                            <p className="font-semibold text-[#102A43] mt-1 text-xs sm:text-sm">
                              {settings?.businessAddress || 'Dwaraka Nagar Main Road, Visakhapatnam, AP 530016'}
                            </p>
                          </div>
                          <a
                            href={`https://wa.me/${(settings?.whatsappNumber || '918912748800').replace(/[^\d]/g, '')}?text=${encodeURIComponent(settings?.whatsappDefaultMessage || 'Hello Vizag Jagan Travels Dispatch')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            WhatsApp Desk
                          </a>
                        </div>
                      </div>

                      <DepotLocationMap
                        lat={settings?.depotLat}
                        lng={settings?.depotLng}
                        companyName={settings?.companyName}
                        address={settings?.businessAddress}
                      />
                    </div>

                    <form
                      onSubmit={handleContactSubmit}
                      className="lg:col-span-6 bg-[#F5F7FA] border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4"
                    >
                      <h3 className="text-lg font-bold text-[#102A43]">Send a Direct Enquiry</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
                          <input
                            type="text"
                            required
                            value={contactName}
                            onChange={(e) => setContactName(e.target.value)}
                            className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Mobile Number *</label>
                          <input
                            type="tel"
                            required
                            value={contactPhone}
                            onChange={(e) => setContactPhone(e.target.value)}
                            className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Email Address</label>
                        <input
                          type="email"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Trip Requirements *</label>
                        <textarea
                          rows={4}
                          required
                          value={contactMessage}
                          onChange={(e) => setContactMessage(e.target.value)}
                          placeholder="Tell us your pickup city, destination, travel dates, and passenger count..."
                          className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg"
                        />
                      </div>

                      {contactStatus && (
                        <p className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2.5">
                          {contactStatus}
                        </p>
                      )}

                      <button
                        type="submit"
                        className="w-full py-3 px-5 bg-[#102A43] hover:bg-[#1a3c5e] active:scale-[0.99] text-white text-sm font-semibold rounded-lg transition-all cursor-pointer"
                      >
                        Submit Travel Enquiry
                      </button>
                    </form>
                  </div>
                </div>
              </motion.section>
            </>
          )}

          {/* DEDICATED VEHICLE LISTING PAGE (Our Vehicles) */}
          {isListingPage && (
            <section className="py-10 bg-[#F5F7FA] min-h-[82vh]">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
                <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-[#102A43]">
                      Complete Company-Owned Fleet
                    </h1>
                    <p className="text-sm text-slate-600 mt-1">
                      Filter by category, seating capacity, AC preference, price ceiling, and live availability.
                    </p>
                  </div>
                </div>

                {/* Filter Bar */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Vehicle Category</label>
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    >
                      <option value="">All Categories</option>
                      {categories.map((c) => (
                        <option key={c.category} value={c.category}>
                          {c.category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Min Seating Capacity</label>
                    <select
                      value={filterMinSeats}
                      onChange={(e) => setFilterMinSeats(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    >
                      <option value={0}>Any Capacity</option>
                      <option value={4}>4+ Passengers</option>
                      <option value={7}>7+ Passengers</option>
                      <option value={12}>12+ Passengers</option>
                      <option value={20}>20+ Passengers</option>
                      <option value={40}>40+ Passengers</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">AC / Non-AC</label>
                    <select
                      value={filterAc}
                      onChange={(e) => setFilterAc(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    >
                      <option value="">AC & Non-AC</option>
                      <option value="true">Air Conditioned (AC)</option>
                      <option value="false">Non-AC</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Max Per-KM Rate</label>
                    <select
                      value={filterMaxPrice}
                      onChange={(e) => setFilterMaxPrice(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    >
                      <option value={0}>No Price Limit</option>
                      <option value={20}>Up to ₹20 / km</option>
                      <option value={35}>Up to ₹35 / km</option>
                      <option value={50}>Up to ₹50 / km</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-xs font-medium text-[#102A43] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filterAvailableOnly}
                        onChange={(e) => setFilterAvailableOnly(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      Available Only
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterCategory('');
                        setFilterAc('');
                        setFilterMinSeats(0);
                        setFilterMaxPrice(0);
                        setFilterAvailableOnly(false);
                      }}
                      className="text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {filteredListingVehicles.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                    <p className="text-base font-bold text-[#102A43]">No vehicles match these filters</p>
                    <p className="text-xs text-slate-500 mt-1">Clear one or more filters to view all owned vehicles.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredListingVehicles.map((v) => (
                      <VehicleCard
                        key={v.id}
                        vehicle={v}
                        onViewDetails={setDetailsVehicle}
                        onBookNow={handleBookVehicle}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* DEDICATED SERVICES PAGE */}
          {activePage === 'services' && (
            <ServicesPage
              services={servicesList}
              settings={settings}
              onBookService={(srv) => {
                setBookingPrefill({
                  tripType: srv.tripType,
                  category: srv.defaultCategory,
                  pickup: heroPickup,
                  drop: heroDrop,
                  journeyDate: heroDate,
                  journeyTime: heroTime,
                  passengers: srv.defaultPassengers,
                });
                setActivePage('booking');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onOpenGallery={(galCat) => {
                setGalleryInitialCategory(galCat || 'All');
                setActivePage('gallery');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onContactDesk={() => handleNavigate('home', 'contact')}
            />
          )}

          {/* DEDICATED FEATURED DESTINATIONS PAGE */}
          {activePage === 'destinations' && (
            <DestinationsPage
              destinations={destinationsList}
              settings={settings}
              onBookDestination={(dest) => {
                setBookingPrefill({
                  category: dest.recommendedCategory,
                  tripType: dest.recommendedTripType,
                  pickup: heroPickup,
                  drop: {
                    address: dest.dropAddress,
                    lat: dest.dropLat,
                    lng: dest.dropLng,
                  },
                  journeyDate: heroDate,
                  journeyTime: heroTime,
                  passengers: dest.recommendedPassengers,
                });
                setActivePage('booking');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onExploreFleet={() => handleNavigate('fleet')}
            />
          )}

          {/* DEDICATED GALLERY PAGE */}
          {activePage === 'gallery' && (
            <GalleryPage
              items={galleryItems}
              initialCategory={galleryInitialCategory}
              settings={settings}
              onBookCategory={(category) => {
                setBookingPrefill({
                  category: category || 'All',
                  pickup: heroPickup,
                  drop: heroDrop,
                  journeyDate: heroDate,
                  journeyTime: heroTime,
                  passengers:
                    category === 'Luxury Buses' || category === 'Large Passenger Buses'
                      ? 40
                      : category === 'Tempo Travellers'
                      ? 14
                      : 4,
                  tripType: 'One Way',
                });
                setActivePage('booking');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onExploreServices={() => handleNavigate('services')}
            />
          )}

          {/* BOOKING WORKFLOW */}
          {activePage === 'booking' && (
            <BookingWizard
              prefill={bookingPrefill}
              categories={activeCategoryNames}
              user={user}
              token={token}
              settings={settings}
              onBookingComplete={() => {
                void loadPublicData();
              }}
              onGoToDashboard={() => handleNavigate('customer')}
            />
          )}

          {/* CUSTOMER DASHBOARD */}
          {activePage === 'customer' && (
            <CustomerDashboard
              user={user}
              token={token}
              settings={settings}
              onUpdateUser={setUser}
              onGoToLogin={() => handleNavigate('login')}
              onBookNewTrip={() => handleNavigate('booking')}
            />
          )}

          {/* ADMIN DASHBOARD */}
          {activePage === 'admin' && token && user?.role === 'admin' && (
            <AdminDashboard
              token={token}
              onFleetUpdated={() => {
                void loadPublicData();
              }}
            />
          )}

          {/* LOGIN / REGISTER / ADMIN SETUP */}
          {activePage === 'login' && (
            <AuthView
              onAuthenticated={(newToken, loggedInUser) => {
                setToken(newToken);
                setUser(loggedInUser);
                setActivePage(loggedInUser.role === 'admin' ? 'admin' : 'customer');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onTrackGuestBooking={() => handleNavigate('customer')}
            />
          )}
              </motion.div>
            </AnimatePresence>
        </main>

        <Footer settings={settings} onNavigate={handleNavigate} />

        <VehicleDetailsModal
          vehicle={detailsVehicle}
          pricing={pricing}
          onClose={() => setDetailsVehicle(null)}
          onBookNow={handleBookVehicle}
        />

        <WhatsAppWidget settings={settings} />
      </div>
    </MapsProvider>
  </MotionConfig>
  );
}
