import React from 'react';
import { CalendarCheck, Car, Home, Package, ShieldCheck, User } from 'lucide-react';
import { UserProfile } from '../types';
import { ActivePage } from './Header';

interface MobileBottomNavProps {
  activePage: ActivePage;
  user: UserProfile | null;
  onNavigate: (page: ActivePage) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activePage,
  user,
  onNavigate,
}) => {
  const accountTarget: ActivePage = user
    ? user.role === 'admin'
      ? 'admin'
      : 'customer'
    : 'login';

  const accountLabel = user ? (user.role === 'admin' ? 'Admin' : 'My Trips') : 'Account';
  const accountActive = activePage === 'login' || activePage === 'customer' || activePage === 'admin';

  const items: Array<{
    key: string;
    label: string;
    target: ActivePage;
    active: boolean;
    isPrimary?: boolean;
    icon: React.ReactNode;
  }> = [
    {
      key: 'home',
      label: 'Home',
      target: 'home',
      active: activePage === 'home',
      icon: <Home className="w-5 h-5" />,
    },
    {
      key: 'fleet',
      label: 'Fleet',
      target: 'fleet',
      active: activePage === 'fleet',
      icon: <Car className="w-5 h-5" />,
    },
    {
      key: 'booking',
      label: 'Book',
      target: 'booking',
      active: activePage === 'booking',
      isPrimary: true,
      icon: <CalendarCheck className="w-5 h-5" />,
    },
    {
      key: 'packages',
      label: 'Packages',
      target: 'packages',
      active: activePage === 'packages',
      icon: <Package className="w-5 h-5" />,
    },
    {
      key: 'account',
      label: accountLabel,
      target: accountTarget,
      active: accountActive,
      icon: user?.role === 'admin' ? <ShieldCheck className="w-5 h-5" /> : <User className="w-5 h-5" />,
    },
  ];

  return (
    <nav
      aria-label="Mobile bottom navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_rgba(16,42,67,0.08)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto">
        {items.map((item) => {
          if (item.isPrimary) {
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate(item.target)}
                aria-current={item.active ? 'page' : undefined}
                className="relative flex flex-col items-center justify-center gap-0.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB]"
              >
                <span
                  className={`w-11 h-8 rounded-xl flex items-center justify-center transition-all duration-150 ${
                    item.active
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'bg-[#102A43] text-white hover:bg-[#1a3c5e]'
                  }`}
                >
                  {item.icon}
                </span>
                <span
                  className={`text-[11px] font-bold leading-none ${
                    item.active ? 'text-[#2563EB]' : 'text-[#102A43]'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.target)}
              aria-current={item.active ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB] ${
                item.active ? 'text-[#2563EB]' : 'text-slate-500 hover:text-[#102A43]'
              }`}
            >
              {item.active && (
                <span className="absolute top-0 inset-x-4 h-0.5 rounded-b-full bg-[#2563EB]" aria-hidden="true" />
              )}
              {item.icon}
              <span className={`text-[11px] leading-none ${item.active ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
