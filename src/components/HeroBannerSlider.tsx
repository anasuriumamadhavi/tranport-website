import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { HeroSlide, WebsiteSettings } from '../types';
import { ActivePage } from './Header';

interface HeroBannerSliderProps {
  settings: WebsiteSettings | null;
  onNavigate: (page: ActivePage, sectionId?: string) => void;
}

const DEFAULT_FALLBACK_SLIDES: HeroSlide[] = [
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
];

const SLIDE_VARIANTS = {
  enter: (direction: number) => ({
    x: direction >= 0 ? '4%' : '-4%',
    opacity: 0,
    scale: 1.04,
  }),
  center: {
    x: '0%',
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction >= 0 ? '-4%' : '4%',
    opacity: 0,
    scale: 1.01,
  }),
};

export const HeroBannerSlider: React.FC<HeroBannerSliderProps> = ({
  settings,
  onNavigate,
}) => {
  const slides = useMemo<HeroSlide[]>(() => {
    if (settings?.heroSlides && settings.heroSlides.length > 0) {
      return settings.heroSlides.map((sl, index) =>
        index === 0
          ? {
              ...sl,
              eyebrow: settings.tagline || sl.eyebrow,
              headline: settings.heroHeadline || sl.headline,
              subheading: settings.heroSubheading || sl.subheading,
              imageUrl: settings.heroBannerUrl || sl.imageUrl,
            }
          : sl
      );
    }
    if (settings) {
      return [
        {
          ...DEFAULT_FALLBACK_SLIDES[0],
          eyebrow: settings.tagline || DEFAULT_FALLBACK_SLIDES[0].eyebrow,
          headline: settings.heroHeadline || DEFAULT_FALLBACK_SLIDES[0].headline,
          subheading: settings.heroSubheading || DEFAULT_FALLBACK_SLIDES[0].subheading,
          imageUrl: settings.heroBannerUrl || DEFAULT_FALLBACK_SLIDES[0].imageUrl,
        },
        ...DEFAULT_FALLBACK_SLIDES.slice(1),
      ];
    }
    return DEFAULT_FALLBACK_SLIDES;
  }, [settings]);

  const autoplaySeconds = settings?.heroAutoplaySeconds ?? 6;
  const [[activeIndex, direction], setSlideState] = useState<[number, number]>([0, 1]);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [brokenUrls, setBrokenUrls] = useState<Record<string, boolean>>({});
  const swipeStartX = useRef<number | null>(null);

  const safeIndex = activeIndex % slides.length;
  const activeSlide = slides[safeIndex];
  const autoplayActive = autoplaySeconds > 0 && slides.length > 1 && !isPaused && !isHovered;

  const goToSlide = useCallback(
    (nextIdx: number, dir?: number) => {
      const normalized = ((nextIdx % slides.length) + slides.length) % slides.length;
      const resolvedDir = dir ?? (normalized >= safeIndex ? 1 : -1);
      setSlideState([normalized, resolvedDir]);
    },
    [safeIndex, slides.length]
  );

  const handleNext = useCallback(() => {
    goToSlide(safeIndex + 1, 1);
  }, [goToSlide, safeIndex]);

  const handlePrev = useCallback(() => {
    goToSlide(safeIndex - 1, -1);
  }, [goToSlide, safeIndex]);

  useEffect(() => {
    if (!autoplayActive) return;
    const timer = window.setInterval(() => {
      setSlideState(([curr]) => [(curr + 1) % slides.length, 1]);
    }, autoplaySeconds * 1000);
    return () => window.clearInterval(timer);
  }, [autoplayActive, autoplaySeconds, slides.length]);

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a')) return;
    swipeStartX.current = e.clientX;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    if (swipeStartX.current === null) return;
    const delta = e.clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(delta) > 48) {
      if (delta < 0) handleNext();
      else handlePrev();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowRight') {
      handleNext();
    } else if (e.key === 'ArrowLeft') {
      handlePrev();
    }
  };

  const imageBroken = brokenUrls[activeSlide.imageUrl];

  return (
    <section
      aria-label="Featured fleet and service highlights"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative bg-[#102A43] overflow-hidden min-h-[420px] sm:min-h-[480px] lg:min-h-[540px] flex flex-col justify-end select-none sm:select-auto"
    >
      {/* Full-View Sliding Banner Photography Layer */}
      <div className="absolute inset-0">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          {!imageBroken ? (
            <motion.img
              key={activeSlide.id + activeSlide.imageUrl}
              src={activeSlide.imageUrl}
              alt={activeSlide.headline}
              referrerPolicy="no-referrer"
              custom={direction}
              variants={SLIDE_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
                opacity: { duration: 0.38, ease: 'easeOut' },
                scale: { duration: 6.5, ease: 'linear' },
              }}
              onError={() =>
                setBrokenUrls((prev) => ({
                  ...prev,
                  [activeSlide.imageUrl]: true,
                }))
              }
              className="w-full h-full object-cover object-center will-change-transform"
            />
          ) : (
            <motion.div
              key={activeSlide.id + '-fallback'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full bg-gradient-to-br from-[#102A43] via-[#1b3d61] to-[#0b1f33]"
            />
          )}
        </AnimatePresence>
        {/* Measured scrims keeping upper & right vehicle imagery clear while guaranteeing text contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#102A43]/90 via-[#102A43]/30 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#102A43]/75 via-[#102A43]/25 to-transparent pointer-events-none" />
      </div>

      {/* Main Hero Text & Slide Controls */}
      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-10 sm:pb-12">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeSlide.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                <p className="text-xs font-semibold tracking-wide text-[#F59E0B] mb-2.5">
                  {activeSlide.eyebrow}
                </p>
                <h1
                  className="font-extrabold text-white tracking-tight leading-[1.08]"
                  style={{ fontSize: 'clamp(2.15rem, 4vw, 3.65rem)', textWrap: 'balance' }}
                >
                  {activeSlide.headline}
                </h1>
                <p className="text-base sm:text-lg text-slate-100 mt-3.5 max-w-xl leading-relaxed">
                  {activeSlide.subheading}
                </p>
                {activeSlide.ctaLabel && activeSlide.ctaTarget && (
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={() => onNavigate(activeSlide.ctaTarget!)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#102A43] bg-[#F59E0B] hover:bg-amber-400 rounded-lg transition-all duration-150 active:scale-[0.98] cursor-pointer whitespace-nowrap"
                    >
                      <span>{activeSlide.ctaLabel}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Slide Navigation Controls */}
          {slides.length > 1 && (
            <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold text-slate-100 tabular-nums mr-1">
                  {String(safeIndex + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
                </span>
                <button
                  type="button"
                  onClick={() => setIsPaused((p) => !p)}
                  aria-label={isPaused ? 'Resume automatic slide rotation' : 'Pause automatic slide rotation'}
                  className="h-10 w-10 rounded-lg bg-[#102A43]/60 hover:bg-[#102A43]/85 backdrop-blur-sm border border-white/25 text-white flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={handlePrev}
                  aria-label="Previous banner slide"
                  className="h-10 w-10 rounded-lg bg-[#102A43]/60 hover:bg-[#102A43]/85 backdrop-blur-sm border border-white/25 text-white flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  aria-label="Next banner slide"
                  className="h-10 w-10 rounded-lg bg-[#102A43]/60 hover:bg-[#102A43]/85 backdrop-blur-sm border border-white/25 text-white flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Segmented Progress Bars */}
              <div className="flex items-center gap-2" role="tablist" aria-label="Choose banner slide">
                {slides.map((sl, idx) => {
                  const isActive = idx === safeIndex;
                  return (
                    <button
                      key={sl.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-label={`Slide ${idx + 1}: ${sl.headline}`}
                      onClick={() => goToSlide(idx)}
                      className="group py-2 px-0.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#F59E0B] rounded"
                    >
                      <span
                        className={`block h-1.5 rounded-full overflow-hidden transition-all duration-200 ${
                          isActive ? 'w-10 sm:w-12 bg-white/30' : 'w-5 sm:w-6 bg-white/30 group-hover:bg-white/55'
                        }`}
                      >
                        {isActive && (
                          <motion.span
                            key={`${sl.id}-${safeIndex}-${autoplayActive}`}
                            initial={{ scaleX: autoplayActive ? 0 : 1 }}
                            animate={{ scaleX: 1 }}
                            transition={{
                              duration: autoplayActive ? autoplaySeconds : 0.2,
                              ease: 'linear',
                            }}
                            style={{ transformOrigin: 'left' }}
                            className="block w-full h-full bg-[#F59E0B]"
                          />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
