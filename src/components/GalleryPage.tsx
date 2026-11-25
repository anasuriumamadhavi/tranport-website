import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Expand,
  X,
} from 'lucide-react';
import {
  GalleryCategory,
  GalleryItem,
  VehicleCategory,
  WebsiteSettings,
} from '../types';

const GALLERY_CATEGORIES: Array<'All' | GalleryCategory> = [
  'All',
  'Fleet Showcase',
  'Airport & Corporate',
  'Weddings & Events',
  'Outstation & Tours',
  'Coach Interiors',
];

interface GalleryPageProps {
  items: GalleryItem[];
  initialCategory?: GalleryCategory | 'All';
  settings?: WebsiteSettings | null;
  onBookCategory: (category?: VehicleCategory) => void;
  onExploreServices: () => void;
}

export const GalleryPage: React.FC<GalleryPageProps> = ({
  items,
  initialCategory = 'All',
  settings,
  onBookCategory,
  onExploreServices,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'All' | GalleryCategory>(initialCategory);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setSelectedCategory(initialCategory);
  }, [initialCategory]);

  const filtered =
    selectedCategory === 'All'
      ? items
      : items.filter((item) => item.category === selectedCategory);

  const activeLightboxItem =
    lightboxIdx !== null && filtered[lightboxIdx] ? filtered[lightboxIdx] : null;

  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxIdx(null);
      } else if (e.key === 'ArrowRight' && filtered.length > 0) {
        setLightboxIdx((prev) => (prev === null ? 0 : (prev + 1) % filtered.length));
      } else if (e.key === 'ArrowLeft' && filtered.length > 0) {
        setLightboxIdx((prev) =>
          prev === null ? 0 : (prev - 1 + filtered.length) % filtered.length
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxIdx, filtered.length]);

  const companyName = settings?.companyName || 'Vizag Jagan Travels';

  return (
    <section className="bg-white min-h-[85vh] py-10 sm:py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Top Gallery Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-200 pb-8">
          <div className="max-w-2xl space-y-2.5">
            <p className="text-xs font-semibold tracking-wide text-[#2563EB]">
              Fleet & Dispatch Photography · {companyName}
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#102A43] tracking-tight">
              Inside Our Owned Fleet & Real Dispatches
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Every photograph captures our own maintained sedans, SUVs, Tempo Travellers, and multi-axle coaches
              across airport transfers, coastal highways, wedding arrivals, and Araku Valley tours.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onExploreServices}
              className="px-4 py-2.5 bg-[#F5F7FA] hover:bg-slate-200 text-[#102A43] text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              View All 9 Services
            </button>
            <button
              type="button"
              onClick={() => onBookCategory()}
              className="px-4 py-2.5 bg-[#102A43] hover:bg-[#1a3c5e] text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              Book a Vehicle
            </button>
          </div>
        </div>

        {/* Category Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {GALLERY_CATEGORIES.map((cat) => {
            const count =
              cat === 'All'
                ? items.length
                : items.filter((i) => i.category === cat).length;
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat);
                  setLightboxIdx(null);
                }}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-[#102A43] text-white'
                    : 'bg-[#F5F7FA] hover:bg-slate-200 text-slate-700'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        {/* Gallery Bento Grid */}
        {filtered.length === 0 ? (
          <div className="bg-[#F5F7FA] border border-slate-200 rounded-xl p-12 text-center">
            <p className="text-base font-bold text-[#102A43]">No photos in this category yet</p>
            <p className="text-xs text-slate-500 mt-1">Select All to inspect our complete fleet portfolio.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((item, idx) => {
              const isWide = Boolean(item.featured) && selectedCategory === 'All';
              const isBroken = brokenImages[item.id];
              return (
                <article
                  key={item.id}
                  className={`group flex flex-col justify-between bg-white border border-slate-200 rounded-xl overflow-hidden transition-shadow hover:shadow-md ${
                    isWide ? 'md:col-span-2' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setLightboxIdx(idx)}
                    className={`relative w-full overflow-hidden bg-slate-100 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB] ${
                      isWide ? 'aspect-[16/9]' : 'aspect-[4/3]'
                    }`}
                    aria-label={`Open full view of ${item.title}`}
                  >
                    {isBroken ? (
                      <div className="w-full h-full flex items-center justify-center bg-[#102A43] text-white text-xs font-semibold p-4 text-center">
                        {item.title}
                      </div>
                    ) : (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setBrokenImages((prev) => ({ ...prev, [item.id]: true }))
                        }
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    )}
                    <span className="absolute bottom-3 right-3 p-2 rounded-lg bg-[#102A43]/80 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <Expand className="w-4 h-4" />
                    </span>
                  </button>

                  <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-medium text-[#2563EB]">
                        {item.category} · {item.routeOrContext}
                      </p>
                      <h2 className="text-base font-bold text-[#102A43] mt-1">{item.title}</h2>
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{item.caption}</p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setLightboxIdx(idx)}
                        className="text-xs font-semibold text-slate-600 hover:text-[#102A43] cursor-pointer"
                      >
                        Inspect Photo
                      </button>
                      {item.recommendedCategory && (
                        <button
                          type="button"
                          onClick={() => onBookCategory(item.recommendedCategory)}
                          className="text-xs font-semibold text-[#2563EB] hover:underline inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                        >
                          Book {item.recommendedCategory}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox Modal */}
      {activeLightboxItem && lightboxIdx !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={activeLightboxItem.title}
          className="fixed inset-0 z-50 bg-[#102A43]/95 backdrop-blur-xs flex flex-col justify-between p-4 sm:p-8"
        >
          <div className="flex items-center justify-between gap-4 text-white max-w-6xl w-full mx-auto">
            <div className="min-w-0">
              <p className="text-xs text-[#F59E0B] font-semibold">
                {activeLightboxItem.category} · {activeLightboxItem.routeOrContext}
              </p>
              <h2 className="text-base sm:text-lg font-bold truncate">
                {activeLightboxItem.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setLightboxIdx(null)}
              aria-label="Close photo lightbox"
              className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center relative max-w-6xl w-full mx-auto my-4 min-h-0">
            {filtered.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setLightboxIdx((lightboxIdx - 1 + filtered.length) % filtered.length)
                }
                aria-label="Previous photo"
                className="hidden sm:flex p-3 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer mr-4 shrink-0"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <div className="max-h-[70vh] w-full flex items-center justify-center overflow-hidden rounded-xl bg-black/30">
              <img
                src={activeLightboxItem.imageUrl}
                alt={activeLightboxItem.title}
                referrerPolicy="no-referrer"
                className="max-h-[70vh] w-auto object-contain rounded-xl"
              />
            </div>

            {filtered.length > 1 && (
              <button
                type="button"
                onClick={() => setLightboxIdx((lightboxIdx + 1) % filtered.length)}
                aria-label="Next photo"
                className="hidden sm:flex p-3 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer ml-4 shrink-0"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          <div className="max-w-6xl w-full mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-white border-t border-white/15 pt-4">
            <p className="text-xs sm:text-sm text-slate-200 max-w-2xl">
              {activeLightboxItem.caption}
            </p>
            <div className="flex items-center gap-3 shrink-0">
              {filtered.length > 1 && (
                <div className="flex sm:hidden items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIdx((lightboxIdx - 1 + filtered.length) % filtered.length)
                    }
                    className="p-2 rounded-lg bg-white/10 text-white"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setLightboxIdx((lightboxIdx + 1) % filtered.length)}
                    className="p-2 rounded-lg bg-white/10 text-white"
                    aria-label="Next photo"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  const rec = activeLightboxItem.recommendedCategory;
                  setLightboxIdx(null);
                  onBookCategory(rec);
                }}
                className="px-4 py-2.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs font-semibold rounded-lg whitespace-nowrap cursor-pointer"
              >
                {activeLightboxItem.recommendedCategory
                  ? `Reserve ${activeLightboxItem.recommendedCategory}`
                  : 'Book Similar Vehicle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
