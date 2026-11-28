import React from 'react';
import { Mail, MapPin, Phone } from 'lucide-react';
import { WebsiteSettings } from '../types';
import { ActivePage } from './Header';
import { SocialMediaSymbols } from './SocialMediaSymbols';

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

  const cleanTel = phone.replace(/[^+\d]/g, '');
  const telHref = cleanTel.length >= 6 ? `tel:${cleanTel}` : undefined;
  const mailHref = email.includes('@') ? `mailto:${email}` : undefined;

  return (
    <footer className="bg-[#102A43] text-slate-300 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-9 pb-10 md:py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-7 md:gap-10">
          {/* Brand Summary */}
          <div>
            <div className="flex items-center gap-3">
              <img
                src={logoUrl}
                alt={`${companyName} logo`}
                referrerPolicy="no-referrer"
                className="h-12 w-12 md:h-16 md:w-16 object-contain bg-white rounded-xl p-1 ring-2 ring-[#F59E0B]/40 shadow-md shrink-0"
              />
              <div className="min-w-0">
                <p className="text-lg md:text-xl font-extrabold text-white tracking-tight leading-snug">
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
                <p className="text-[11px] text-slate-400 mt-0.5 md:hidden">{permitsLine}</p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-3 md:mt-3.5 leading-relaxed">
              {footerDesc}
            </p>
            <p className="hidden md:block text-xs text-slate-400 mt-4">{permitsLine}</p>
            <div className="mt-4 md:mt-5">
              <SocialMediaSymbols settings={settings} variant="dark" showTitle />
            </div>
          </div>

          {/* Mobile 2-Column Nav Wrapper (expands cleanly into Grid Columns 2 & 3 on md+) */}
          <div className="grid grid-cols-2 gap-6 py-5 border-y border-slate-800/90 md:contents md:border-0 md:py-0">
            <div>
              <p className="text-xs md:text-sm font-semibold text-white mb-2.5 md:mb-4">Our Fleet</p>
              <ul className="space-y-1 md:space-y-2.5 text-[13px] md:text-sm">
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('fleet')}
                    className="w-full text-left py-1.5 md:py-0 hover:text-white transition-colors cursor-pointer"
                  >
                    Our Vehicles Directory
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('packages')}
                    className="w-full text-left py-1.5 md:py-0 hover:text-white transition-colors cursor-pointer"
                  >
                    Tour &amp; Travel Packages
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('services')}
                    className="w-full text-left py-1.5 md:py-0 hover:text-white transition-colors cursor-pointer"
                  >
                    Transportation Services
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('booking')}
                    className="w-full text-left py-1.5 md:py-0 hover:text-white transition-colors cursor-pointer"
                  >
                    Book a Vehicle Online
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-xs md:text-sm font-semibold text-white mb-2.5 md:mb-4">
                Portals &amp; Support
              </p>
              <ul className="space-y-1 md:space-y-2.5 text-[13px] md:text-sm">
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('customer')}
                    className="w-full text-left py-1.5 md:py-0 hover:text-white transition-colors cursor-pointer"
                  >
                    Customer Trip Dashboard
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('login')}
                    className="w-full text-left py-1.5 md:py-0 hover:text-white transition-colors cursor-pointer"
                  >
                    Sign In / Track Booking
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('services')}
                    className="w-full text-left py-1.5 md:py-0 hover:text-white transition-colors cursor-pointer"
                  >
                    All &amp; Upcoming Services
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('destinations')}
                    className="w-full text-left py-1.5 md:py-0 hover:text-white transition-colors cursor-pointer"
                  >
                    Featured Destinations
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('gallery')}
                    className="w-full text-left py-1.5 md:py-0 hover:text-white transition-colors cursor-pointer"
                  >
                    Fleet Photo Gallery
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('home', 'contact')}
                    className="w-full text-left py-1.5 md:py-0 hover:text-white transition-colors cursor-pointer"
                  >
                    Request Custom Quote
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Dispatch Desk Contact */}
          <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4 md:bg-transparent md:border-0 md:rounded-none md:p-0">
            <p className="text-xs md:text-sm font-semibold text-white mb-2 md:mb-4">{hours}</p>
            <ul className="space-y-1.5 md:space-y-2.5 text-[13px] md:text-sm text-slate-300">
              <li>
                {telHref ? (
                  <a
                    href={telHref}
                    className="inline-flex items-center gap-2 min-h-[40px] md:min-h-0 text-white md:text-slate-300 hover:text-white font-semibold md:font-normal tabular-nums transition-colors"
                  >
                    <Phone className="w-4 h-4 text-[#F59E0B] shrink-0 md:hidden" />
                    {phone}
                  </a>
                ) : (
                  <span className="tabular-nums">{phone}</span>
                )}
              </li>
              <li>
                {mailHref ? (
                  <a
                    href={mailHref}
                    className="inline-flex items-center gap-2 min-h-[40px] md:min-h-0 break-all hover:text-white transition-colors"
                  >
                    <Mail className="w-4 h-4 text-[#F59E0B] shrink-0 md:hidden" />
                    {email}
                  </a>
                ) : (
                  <span className="break-all">{email}</span>
                )}
              </li>
              <li className="flex items-start gap-2 pt-1 md:pt-0 text-xs md:text-sm text-slate-300 leading-relaxed">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5 md:hidden" />
                <span>{address}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-7 pt-5 md:mt-12 md:pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 text-xs text-slate-400 pr-14 sm:pr-0">
          <p>© {new Date().getFullYear()} {companyName}. All rights reserved.</p>
          <p>Transparent owned-fleet operations · Direct booking with no broker markups.</p>
        </div>
      </div>
    </footer>
  );
};
