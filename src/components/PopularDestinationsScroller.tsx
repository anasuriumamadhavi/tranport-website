import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { FeaturedDestination } from '../types';

interface PopularDestinationsScrollerProps {
  destinations: FeaturedDestination[];
  selectedDropAddress?: string;
  onSelectDestination: (destination: FeaturedDestination) => void;
  onBookDestination: (destination: FeaturedDestination) => void;
  onExploreAll: () => void;
}

export const PopularDestinationsScroller: React.FC<PopularDestinationsScrollerProps> = ({
  destinations,
  selectedDropAddress,
  onSelectDestination,
  onBookDestination,
  onExploreAll,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [activeDest, setActiveDest] = useState<FeaturedDestination | null>(null);

  const visibleDestinations = destinations.filter((d) => d.active !== false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const raf = window.requestAnimationFrame(updateScrollState);
    const timer = window.setTimeout(updateScrollState, 180);
    const onResize = () => updateScrollState();
    window.addEventListener('resize', onResize);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, [updateScrollState, visibleDestinations.length]);

  const scrollByAmount = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const step = Math.max(280, Math.round(el.clientWidth * 0.65));
    el.scrollBy({
      left: direction === 'left' ? -step : step,
      behavior: 'smooth',
    });
  };

  if (visibleDestinations.length === 0) return null;

  return (
    <motion.section
      aria-label="Our Popular Destinations"
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="py-12 bg-white border-b border-slate-100"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#102A43] tracking-tight">
              Our Popular Destinations
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Click any destination circle to auto-fill your Drop Location above, or scroll sideways to browse routes.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => scrollByAmount('left')}
              disabled={!canScrollLeft}
              aria-label="Scroll destinations left"
              className="h-10 w-10 rounded-full border border-slate-200 bg-white hover:bg-[#F5F7FA] text-[#102A43] disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => scrollByAmount('right')}
              disabled={!canScrollRight}
              aria-label="Scroll destinations right"
              className="h-10 w-10 rounded-full border border-slate-200 bg-white hover:bg-[#F5F7FA] text-[#102A43] disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onExploreAll}
              className="ml-1 text-sm font-semibold text-[#2563EB] hover:underline whitespace-nowrap cursor-pointer"
            >
              View All →
            </button>
          </div>
        </div>

        {/* Manual Horizontal Circular Scroller */}
        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="flex items-start gap-6 sm:gap-8 overflow-x-auto pb-3 scroll-smooth snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {visibleDestinations.map((dest, idx) => {
            const isSelected =
              selectedDropAddress === dest.dropAddress || activeDest?.id === dest.id;
            const imgFailed = brokenImages[dest.imageUrl];

            return (
              <motion.button
                key={dest.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.18), ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setActiveDest(dest);
                  onSelectDestination(dest);
                }}
                className="group shrink-0 w-[136px] sm:w-[152px] snap-start flex flex-col items-center text-center cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB] rounded-xl py-1"
              >
                <div
                  className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden border-2 transition-all duration-200 shadow-xs ${
                    isSelected
                      ? 'border-[#2563EB] ring-4 ring-[#2563EB]/20'
                      : 'border-slate-200 group-hover:border-[#2563EB]'
                  }`}
                >
                  {!imgFailed && dest.imageUrl ? (
                    <img
                      src={dest.imageUrl}
                      alt={dest.name}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setBrokenImages((prev) => ({
                          ...prev,
                          [dest.imageUrl]: true,
                        }))
                      }
                      className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#F5F7FA] to-slate-200 text-[#102A43]">
                      <MapPin className="w-7 h-7 text-[#2563EB]" />
                    </div>
                  )}
                </div>

                <h3
                  className={`text-sm font-bold leading-snug mt-3 line-clamp-2 transition-colors ${
                    isSelected ? 'text-[#2563EB]' : 'text-[#102A43] group-hover:text-[#2563EB]'
                  }`}
                >
                  {dest.name}
                </h3>
                <p className="text-xs text-slate-500 mt-1 tabular-nums">
                  {dest.distanceKm} km · {dest.recommendedCategory}
                </p>
              </motion.button>
            );
          })}
        </div>

        {activeDest && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <p className="text-slate-600">
              Drop Location updated to <strong className="text-[#102A43]">{activeDest.name}</strong> ({activeDest.distanceKm} km · {activeDest.durationText})
            </p>
            <button
              type="button"
              onClick={() => onBookDestination(activeDest)}
              className="font-semibold text-[#2563EB] hover:underline cursor-pointer whitespace-nowrap"
            >
              Book directly to {activeDest.name} →
            </button>
          </div>
        )}
      </div>
    </motion.section>
  );
};
