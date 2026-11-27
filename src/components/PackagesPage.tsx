import React, { useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Check,
  MapPin,
  Package,
  Users,
} from 'lucide-react';
import { PackageType, TravelPackage, WebsiteSettings } from '../types';
import { formatINR } from '../lib/api';

interface PackagesPageProps {
  packages: TravelPackage[];
  settings?: WebsiteSettings | null;
  onBookPackage: (pkg: TravelPackage) => void;
  onContactDesk: () => void;
}

const PACKAGE_FILTERS: Array<'All' | PackageType> = [
  'All',
  'City & Sightseeing',
  'Hill Station & Nature',
  'Pilgrimage Tour',
  'Weekend & Coastal',
  'Corporate & Group',
];

export const PackagesPage: React.FC<PackagesPageProps> = ({
  packages,
  settings,
  onBookPackage,
  onContactDesk,
}) => {
  const [typeFilter, setTypeFilter] = useState<'All' | PackageType>('All');
  const [brokenImgs, setBrokenImgs] = useState<Record<string, boolean>>({});
  const companyName = settings?.companyName || 'Vizag Jagan Travels';

  const visiblePackages = packages.filter((pkg) => {
    if (!pkg.active) return false;
    return typeFilter === 'All' || pkg.packageType === typeFilter;
  });

  return (
    <section className="bg-[#F5F7FA] min-h-[85vh] py-10 sm:py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Header Banner */}
        <div className="bg-[#102A43] text-white rounded-2xl p-7 sm:p-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold tracking-wide text-[#F59E0B] flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" />
              Curated Travel Packages · {companyName}
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
              All-Inclusive City, Hill Station & Pilgrimage Packages
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Pre-planned itineraries operated exclusively with our company-owned fleet. Fixed transparent base tariffs,
              verified local drivers, and instant route prefill into booking.
            </p>
          </div>
          <button
            type="button"
            onClick={onContactDesk}
            className="px-5 py-2.5 bg-[#F59E0B] hover:bg-amber-400 text-[#102A43] text-xs sm:text-sm font-bold rounded-lg whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            Request Custom Itinerary
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {PACKAGE_FILTERS.map((tab) => {
            const active = typeFilter === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setTypeFilter(tab)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#102A43] text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {tab === 'All' ? 'All Packages' : tab}
              </button>
            );
          })}
        </div>

        {/* Packages Grid */}
        {visiblePackages.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <p className="text-base font-bold text-[#102A43]">No packages found in this category</p>
            <p className="text-xs text-slate-500 mt-1">Switch filters or request a custom group itinerary from our desk.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visiblePackages.map((pkg) => {
              const isBroken = brokenImgs[pkg.id];
              return (
                <article
                  key={pkg.id}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow"
                >
                  <div>
                    <div className="aspect-[16/10] bg-slate-100 overflow-hidden">
                      {isBroken || !pkg.imageUrl ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-[#102A43] text-white p-4 text-center">
                          <MapPin className="w-6 h-6 text-[#F59E0B] mb-2" />
                          <span className="text-xs font-semibold">{pkg.title}</span>
                        </div>
                      ) : (
                        <img
                          src={pkg.imageUrl}
                          alt={pkg.title}
                          referrerPolicy="no-referrer"
                          onError={() => setBrokenImgs((prev) => ({ ...prev, [pkg.id]: true }))}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    <div className="p-6 space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[#2563EB]">{pkg.packageType}</span>
                        <span className="text-slate-500 font-medium inline-flex items-center gap-1 tabular-nums">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {pkg.durationLabel}
                        </span>
                      </div>

                      <div>
                        <h2 className="text-lg font-bold text-[#102A43] leading-snug">{pkg.title}</h2>
                        <p className="text-xs text-slate-500 mt-1">{pkg.subtitle}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-1 tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-[#2563EB]" />
                          Up to {pkg.passengerCount} Pax
                        </span>
                        <span className="text-slate-300">·</span>
                        <span>{pkg.distanceKm} km circuit</span>
                        <span className="text-slate-300">·</span>
                        <span>{pkg.recommendedCategory}</span>
                      </div>

                      <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
                        <p className="text-[11px] font-semibold text-[#102A43]">Itinerary Highlights</p>
                        {pkg.itineraryHighlights.slice(0, 3).map((item) => (
                          <p key={item} className="text-xs text-slate-600 flex items-start gap-2">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-slate-500">{pkg.priceUnitLabel}</p>
                      <p className="text-lg font-extrabold text-[#102A43] tabular-nums">
                        {formatINR(pkg.packagePriceInr)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onBookPackage(pkg)}
                      className="px-4 py-2.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
                    >
                      Book Package
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
