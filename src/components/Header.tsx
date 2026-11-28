import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { UserProfile, WebsiteSettings } from '../types';

export type ActivePage =
  | 'home'
  | 'fleet'
  | 'packages'
  | 'services'
  | 'destinations'
  | 'gallery'
  | 'booking'
  | 'customer'
  | 'admin'
  | 'admin-action'
  | 'login';

interface HeaderProps {
  activePage: ActivePage;
  user: UserProfile | null;
  settings?: WebsiteSettings | null;
  onNavigate: (page: ActivePage, sectionId?: string) => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activePage,
  user,
  settings,
  onNavigate,
  onLogout,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const companyName = settings?.companyName || 'Vizag Jagan Travels';
  const logoUrl = settings?.logoUrl || '/assets/aistudio/Vizag_Jagan_Tours___Travels_Emblem_1d2872dc.png';

  const handleNav = (page: ActivePage, sectionId?: string) => {
    setMobileOpen(false);
    onNavigate(page, sectionId);
  };

  const navLinkClass = (isActive: boolean) =>
    `text-[13px] xl:text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 ${
      isActive
        ? 'text-[#2563EB] underline underline-offset-8 decoration-2'
        : 'text-slate-600 hover:text-[#102A43] hover:underline hover:underline-offset-8'
    }`;

  const renderBrandWordmark = (name: string) => {
    const match = /^(.*?)(\bJagan\b)(.*)$/i.exec(name);
    if (!match) {
      return <span>{name}</span>;
    }
    return (
      <span>
        {match[1]}
        <span className="text-[#B45309]">{match[2]}</span>
        {match[3]}
      </span>
    );
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between gap-4">
        {/* Zone 1: Brand logo & single-line wordmark */}
        <button
          type="button"
          onClick={() => handleNav('home')}
          className="group flex items-center gap-2.5 text-lg xl:text-xl font-extrabold tracking-tight text-[#102A43] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB] rounded-lg"
        >
          <img
            src={logoUrl}
            alt={`${companyName} logo`}
            referrerPolicy="no-referrer"
            className="h-12 w-12 xl:h-[52px] xl:w-[52px] object-contain shrink-0 rounded-xl bg-white p-0.5 ring-1 ring-[#102A43]/15 shadow-xs transition-transform duration-200 group-hover:scale-105"
          />
          {renderBrandWordmark(companyName)}
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav className="hidden lg:flex items-center gap-3.5 xl:gap-5">
          <button type="button" onClick={() => handleNav('home')} className={navLinkClass(activePage === 'home')}>
            Home
          </button>
          <button type="button" onClick={() => handleNav('fleet')} className={navLinkClass(activePage === 'fleet')}>
            Our Vehicles
          </button>
          <button type="button" onClick={() => handleNav('packages')} className={navLinkClass(activePage === 'packages')}>
            Packages
          </button>
          <button type="button" onClick={() => handleNav('services')} className={navLinkClass(activePage === 'services')}>
            Services
          </button>
          <button type="button" onClick={() => handleNav('destinations')} className={navLinkClass(activePage === 'destinations')}>
            Destinations
          </button>
          <button type="button" onClick={() => handleNav('gallery')} className={navLinkClass(activePage === 'gallery')}>
            Gallery
          </button>
          <button type="button" onClick={() => handleNav('home', 'about')} className={navLinkClass(false)}>
            About Us
          </button>
          <button type="button" onClick={() => handleNav('home', 'contact')} className={navLinkClass(false)}>
            Contact Us
          </button>
        </nav>

        {/* Zone 3: Auth & Primary CTA */}
        <div className="hidden lg:flex items-center gap-4 shrink-0">
          {user ? (
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => handleNav(user.role === 'admin' ? 'admin' : 'customer')}
                className={navLinkClass(activePage === 'admin' || activePage === 'customer')}
              >
                {user.role === 'admin' ? 'Admin Console' : 'My Account'}
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="text-sm font-medium text-slate-500 hover:text-[#102A43] whitespace-nowrap shrink-0 transition-colors"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleNav('login')}
              className={navLinkClass(activePage === 'login')}
            >
              Login
            </button>
          )}

          <button
            type="button"
            onClick={() => handleNav('booking')}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#102A43] hover:bg-[#1a3c5e] rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB]"
          >
            Book Now
          </button>
        </div>

        {/* Mobile menu trigger */}
        <div className="flex lg:hidden items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleNav('booking')}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#102A43] rounded-lg whitespace-nowrap shrink-0"
          >
            Book Now
          </button>
          <button
            type="button"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="p-2 text-[#102A43] hover:bg-[#F5F7FA] rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="lg:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-1 shadow-md"
          >
            {[
              { label: 'Home', page: 'home' as ActivePage },
              { label: 'Our Vehicles', page: 'fleet' as ActivePage },
              { label: 'Packages', page: 'packages' as ActivePage },
              { label: 'Services', page: 'services' as ActivePage },
              { label: 'Destinations', page: 'destinations' as ActivePage },
              { label: 'Gallery', page: 'gallery' as ActivePage },
              { label: 'About Us', page: 'home' as ActivePage, section: 'about' },
              { label: 'Contact Us', page: 'home' as ActivePage, section: 'contact' },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => handleNav(item.page, item.section)}
                className="block w-full text-left px-3 py-2.5 text-sm font-medium text-[#102A43] hover:bg-[#F5F7FA] rounded-lg min-h-[44px]"
              >
                {item.label}
              </button>
            ))}
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-1">
              {user ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleNav(user.role === 'admin' ? 'admin' : 'customer')}
                    className="w-full text-left px-3 py-2.5 text-sm font-semibold text-[#2563EB] hover:bg-[#F5F7FA] rounded-lg min-h-[44px]"
                  >
                    {user.role === 'admin' ? 'Admin Console' : 'Customer Dashboard'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      onLogout();
                    }}
                    className="w-full text-left px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-[#F5F7FA] rounded-lg min-h-[44px]"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => handleNav('login')}
                  className="w-full text-left px-3 py-2.5 text-sm font-semibold text-[#2563EB] hover:bg-[#F5F7FA] rounded-lg min-h-[44px]"
                >
                  Login / Customer & Admin Portal
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
