import React from 'react';
import { WebsiteSettings } from '../types';

interface SocialMediaSymbolsProps {
  settings?: WebsiteSettings | null;
  variant?: 'dark' | 'light';
  showTitle?: boolean;
}

export const SocialMediaSymbols: React.FC<SocialMediaSymbolsProps> = ({
  settings,
  variant = 'dark',
  showTitle = false,
}) => {
  const whatsappClean = (settings?.whatsappNumber || '918912748800').replace(/[^\d]/g, '') || '918912748800';
  const whatsappText = encodeURIComponent(
    settings?.whatsappDefaultMessage || 'Hello Vizag Jagan Travels Dispatch'
  );

  const links = [
    {
      name: 'Instagram',
      href: settings?.instagramUrl?.trim() || 'https://www.instagram.com/vizagjagantravels',
      hoverClass:
        variant === 'dark'
          ? 'hover:bg-pink-600 hover:border-pink-500 hover:text-white'
          : 'hover:bg-pink-50 hover:border-pink-400 hover:text-pink-600',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
          <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
        </svg>
      ),
    },
    {
      name: 'Facebook',
      href: settings?.facebookUrl?.trim() || 'https://www.facebook.com/vizagjagantravels',
      hoverClass:
        variant === 'dark'
          ? 'hover:bg-[#1877F2] hover:border-[#1877F2] hover:text-white'
          : 'hover:bg-blue-50 hover:border-[#1877F2] hover:text-[#1877F2]',
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
          <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.5 1.6-1.5h1.6V4.9c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1V11H7.5v3h2.8v8h3.2z" />
        </svg>
      ),
    },
    {
      name: 'YouTube',
      href: settings?.youtubeUrl?.trim() || 'https://www.youtube.com/@vizagjagantravels',
      hoverClass:
        variant === 'dark'
          ? 'hover:bg-red-600 hover:border-red-500 hover:text-white'
          : 'hover:bg-red-50 hover:border-red-500 hover:text-red-600',
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
          <path d="M21.58 7.19a2.75 2.75 0 0 0-1.94-1.95C17.93 4.78 12 4.78 12 4.78s-5.93 0-7.64.46A2.75 2.75 0 0 0 2.42 7.2 28.6 28.6 0 0 0 2 12a28.6 28.6 0 0 0 .42 4.81 2.75 2.75 0 0 0 1.94 1.95c1.71.46 7.64.46 7.64.46s5.93 0 7.64-.46a2.75 2.75 0 0 0 1.94-1.95A28.6 28.6 0 0 0 22 12a28.6 28.6 0 0 0-.42-4.81zM10 15V9l5.2 3-5.2 3z" />
        </svg>
      ),
    },
    {
      name: 'X (Twitter)',
      href: settings?.twitterUrl?.trim() || 'https://x.com/vizagjagantravel',
      hoverClass:
        variant === 'dark'
          ? 'hover:bg-slate-700 hover:border-slate-500 hover:text-white'
          : 'hover:bg-slate-100 hover:border-slate-400 hover:text-[#102A43]',
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      name: 'WhatsApp',
      href: `https://wa.me/${whatsappClean}?text=${whatsappText}`,
      hoverClass:
        variant === 'dark'
          ? 'hover:bg-emerald-600 hover:border-emerald-500 hover:text-white'
          : 'hover:bg-emerald-50 hover:border-emerald-500 hover:text-emerald-700',
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
          <path d="M12.03 2a9.94 9.94 0 0 0-8.44 15.17L2 22l4.97-1.53A9.95 9.95 0 1 0 12.03 2zm5.77 14.12c-.24.68-1.41 1.3-1.95 1.38-.51.07-1.15.11-1.86-.12-.44-.14-.99-.33-1.71-.64-3-1.29-4.96-4.32-5.11-4.52-.15-.2-1.22-1.62-1.22-3.09 0-1.47.77-2.2 1.04-2.5.27-.3.59-.38.79-.38h.57c.18 0 .43-.07.67.51.24.59.84 2.04.91 2.19.07.15.12.33.02.53-.1.2-.15.33-.3.5-.15.18-.32.4-.45.54-.15.15-.31.31-.13.61.18.3.79 1.31 1.71 2.12 1.18 1.05 2.17 1.38 2.47 1.53.3.15.48.12.66-.07.18-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.27.1 1.75.82 2.05.97.3.15.5.22.57.34.08.13.08.73-.16 1.41z" />
        </svg>
      ),
    },
  ];

  const baseButtonClass =
    variant === 'dark'
      ? 'bg-white/10 border-white/15 text-slate-200'
      : 'bg-white border-slate-200 text-[#102A43] shadow-xs';

  return (
    <div className="space-y-2">
      {showTitle && (
        <p className={`text-xs font-semibold ${variant === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
          Follow & Connect With Us
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2.5" aria-label="Social media channels">
        {links.map((item) => (
          <a
            key={item.name}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            title={`Visit ${item.name}`}
            aria-label={`Open ${item.name} in a new tab`}
            className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-all duration-150 hover:-translate-y-0.5 active:scale-95 ${baseButtonClass} ${item.hoverClass}`}
          >
            {item.icon}
          </a>
        ))}
      </div>
    </div>
  );
};
