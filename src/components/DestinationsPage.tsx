import React, { useState } from 'react';
import { ArrowRight, Check, Clock, MapPin, Navigation } from 'lucide-react';
import { FeaturedDestination, WebsiteSettings } from '../types';

interface DestinationsPageProps {
  destinations: FeaturedDestination[];
  settings?: WebsiteSettings | null;
  onBookDestination: (destination: FeaturedDestination) => void;
  onExploreFleet: () => void;
}

export const DestinationsPage: React.FC<DestinationsPageProps> = ({
  destinations,
  settings,
  onBookDestination,
  onExploreFleet,
}) => {
  const [groupFilter, setGroupFilter] = useState<'All' | 'Cars & SUVs' | 'Vans & Coaches'>('All');
  const [brokenImgs, setBrokenImgs] = useState<Record<string, boolean>>({});
  const companyName = settings?.companyName || 'Vizag Jagan Travels';

  const filtered = destinations.filter((d) => {
    if (groupFilter === 'Cars & SUVs') {
      return ['Cars', 'SUVs', 'Premium Cars'].includes(d.recommendedCategory);
    }
    if (groupFilter === 'Vans & Coaches') {
      return ['Tempo Travellers', 'Mini Buses', 'Luxury Buses', 'Large Passenger Buses'].includes(
        d.recommendedCategory
      );
    }
    return true;
  });

  return (
    <section className="bg-[#F5F7FA] min-h-[85vh] py-10 sm:py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Top Destinations Banner */}
        <div className="bg-[#102A43] text-white rounded-2xl p-7 sm:p-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold tracking-wide text-[#F59E0B]">
              Direct Fleet Corridors · {companyName}
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
              Featured Destinations from Visakhapatnam
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Book private chauffeur-driven cars, SUVs, Tempo Travellers, and luxury buses directly from
              Visakhapatnam to Eastern Ghats hill stations, coastal shrines, and intercity hubs with transparent
              distance estimates.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onExploreFleet}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              Inspect All Vehicles
            </button>
          </div>
        </div>

        {/* Route Vehicle Filter */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            {(['All', 'Cars & SUVs', 'Vans & Coaches'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setGroupFilter(tab)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  groupFilter === tab
                    ? 'bg-[#102A43] text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 tabular-nums">
            Showing {filtered.length} direct-dispatch route{filtered.length === 1 ? '' : 's'}
          </p>
        </div>

        {/* Destinations Grid */}
        {filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <p className="text-base font-bold text-[#102A43]">No destinations match this vehicle filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((dest) => {
              const isBroken = brokenImgs[dest.id];
              return (
                <article
                  key={dest.id}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between transition-shadow hover:shadow-md"
                >
                  <div>
                    <div className="aspect-[4/3] bg-slate-100 overflow-hidden relative">
                      {isBroken ? (
                        <div className="w-full h-full flex items-center justify-center bg-[#102A43] text-white text-xs font-semibold">
                          {dest.name}
                        </div>
                      ) : (
                        <img
                          src={dest.imageUrl}
                          alt={dest.name}
                          referrerPolicy="no-referrer"
                          onError={() => setBrokenImgs((prev) => ({ ...prev, [dest.id]: true }))}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    <div className="p-6 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-[#2563EB] flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {dest.region}
                        </span>
                        <span className="font-medium tabular-nums flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {dest.distanceKm} km · {dest.durationText}
                        </span>
                      </div>

                      <div>
                        <h2 className="text-lg font-bold text-[#102A43]">{dest.name}</h2>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                          <Navigation className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{dest.routeSummary}</span>
                        </p>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">{dest.description}</p>

                      <div className="pt-2 border-t border-slate-100 space-y-1.5">
                        {dest.highlights.map((h) => (
                          <p key={h} className="text-xs text-slate-700 flex items-start gap-2">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{h}</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="px-6 pb-6 pt-3 border-t border-slate-100 bg-slate-50/50 space-y-3">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#102A43]">{dest.recommendedCategory}</span>
                      <span className="font-bold text-[#2563EB] tabular-nums">
                        {dest.startingEstimateLabel}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onBookDestination(dest)}
                      className="w-full py-2.5 px-4 bg-[#102A43] hover:bg-[#1a3c5e] text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
                    >
                      Book Vehicle to {dest.name.split('&')[0].trim()}
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
