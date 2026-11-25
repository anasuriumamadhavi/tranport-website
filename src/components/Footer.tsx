import React from 'react';
import { WebsiteSettings } from '../types';
import { ActivePage } from './Header';

interface FooterProps {
  settings?: WebsiteSettings | null;
  onNavigate: (page: ActivePage, sectionId?: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ settings, onNavigate }) => {
  const companyName = settings?.companyName || 'Vizag Jagan Travels';
  const logoUrl = settings?.logoUrl || '/assets/aistudio/Vizag_Jagan_Tours___Travels_Emblem_1d2872dc.png';
  const footerDesc =
    settings?.footerDescription ||
    'Direct-owned sedans, executive SUVs, Tempo Travellers, and luxury motorcoaches. Travel with comfort, explore with us.';
  const permitsLine =
    settings?.footerPermitsLine || 'Est. 2020 · All-India Tourist Permit · GPS Monitored Dispatch';
  const phone = settings?.supportPhone || '+91 891 274 8800';
  const email = settings?.supportEmail || 'dispatch@vizagjagantravels.com';
  const address = settings?.businessAddress || 'Dwaraka Nagar Main Road, Visakhapatnam, AP 530016';
  const hours = settings?.workingHours || '24/7 Dispatch Desk';

  const socials = [
    { label: 'Facebook', url: settings?.facebookUrl },
    { label: 'Instagram', url: settings?.instagramUrl },
    { label: 'YouTube', url: settings?.youtubeUrl },
  ].filter((s) => Boolean(s.url));

  return (
    <footer className="bg-[#102A43] text-slate-300 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center gap-3.5">
              <img
                src={logoUrl}
                alt={`${companyName} logo`}
                referrerPolicy="no-referrer"
                className="h-16 w-16 object-contain bg-white rounded-xl p-1 ring-2 ring-[#F59E0B]/40 shadow-md shrink-0"
              />
              <p className="text-xl font-extrabold text-white tracking-tight">
                {(() => {
                  const match = /^(.*?)(\bJagan\b)(.*)$/i.exec(companyName);
                  if (!match) return companyName;
                  return (
                    <>
                      {match[1]}
                      <span className="text-[#F59E0B]">{match[2]}</span>
                      {match[3]}
                    </>
                  );
                })()}
              </p>
            </div>
            <p className="text-sm text-slate-300 mt-3.5 leading-relaxed">{footerDesc}</p>
            <p className="text-xs text-slate-400 mt-4">{permitsLine}</p>
            {socials.length > 0 && (
              <div className="flex flex-wrap items-center gap-4 mt-4 text-xs">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-300 hover:text-white underline underline-offset-4"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-white mb-4">Our Fleet</p>
            <ul className="space-y-2.5 text-sm">
              <li>
                <button type="button" onClick={() => onNavigate('fleet')} className="hover:text-white transition-colors">
                  Our Vehicles Directory
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('services')} className="hover:text-white transition-colors">
                  Transportation Services
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('booking')} className="hover:text-white transition-colors">
                  Book a Vehicle Online
                </button>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-white mb-4">Portals & Support</p>
            <ul className="space-y-2.5 text-sm">
              <li>
                <button type="button" onClick={() => onNavigate('customer')} className="hover:text-white transition-colors">
                  Customer Trip Dashboard
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('login')} className="hover:text-white transition-colors">
                  Sign In / Track Booking
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('services')} className="hover:text-white transition-colors">
                  All & Upcoming Services
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('destinations')} className="hover:text-white transition-colors">
                  Featured Destinations
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('gallery')} className="hover:text-white transition-colors">
                  Fleet Photo Gallery
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('home', 'contact')} className="hover:text-white transition-colors">
                  Request Custom Quote
                </button>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-white mb-4">{hours}</p>
            <ul className="space-y-2.5 text-sm text-slate-300">
              <li className="tabular-nums">{phone}</li>
              <li>{email}</li>
              <li>{address}</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} {companyName}. All rights reserved.</p>
          <p>Transparent owned-fleet operations · Direct booking with no broker markups.</p>
        </div>
      </div>
    </footer>
  );
};
