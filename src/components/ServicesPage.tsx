import React, { useState } from 'react';
import {
  ArrowRight,
  Bell,
  CalendarClock,
  Camera,
  Check,
  Users,
  X,
} from 'lucide-react';
import {
  GalleryCategory,
  TravelService,
  WebsiteSettings,
} from '../types';
import { apiFetch } from '../lib/api';

interface ServicesPageProps {
  services: TravelService[];
  settings?: WebsiteSettings | null;
  onBookService: (service: TravelService) => void;
  onOpenGallery: (category?: GalleryCategory) => void;
  onContactDesk: () => void;
}

export const ServicesPage: React.FC<ServicesPageProps> = ({
  services,
  settings,
  onBookService,
  onOpenGallery,
  onContactDesk,
}) => {
  const [brokenImgs, setBrokenImgs] = useState<Record<string, boolean>>({});
  const [notifyService, setNotifyService] = useState<TravelService | null>(null);
  const [reqName, setReqName] = useState('');
  const [reqPhone, setReqPhone] = useState('');
  const [reqEmail, setReqEmail] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [reqSaving, setReqSaving] = useState(false);
  const [reqDone, setReqDone] = useState<string | null>(null);
  const [reqError, setReqError] = useState<string | null>(null);

  const companyName = settings?.companyName || 'Vizag Jagan Travels';
  const activeServices = services.filter((s) => s.status === 'Active');
  const upcomingServices = services.filter((s) => s.status === 'Upcoming');

  const handleOpenNotify = (srv: TravelService) => {
    setNotifyService(srv);
    setReqNotes(`Interested in pre-booking / launch updates for: ${srv.title} (${srv.launchWindow || 'Upcoming'}).`);
    setReqDone(null);
    setReqError(null);
  };

  const handleSubmitInterest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifyService) return;
    setReqSaving(true);
    setReqError(null);
    try {
      const res = await apiFetch<{ message: string }>('/api/enquiries', {
        method: 'POST',
        body: JSON.stringify({
          name: reqName,
          phone: reqPhone,
          email: reqEmail,
          subject: `Upcoming Service Pre-Registration: ${notifyService.title}`,
          message: reqNotes,
          source: 'Custom Quote',
        }),
      });
      setReqDone(res.message || 'Interest registered. Dispatch will notify you ahead of launch.');
      setReqName('');
      setReqPhone('');
      setReqEmail('');
    } catch (err) {
      setReqError((err as Error).message);
    } finally {
      setReqSaving(false);
    }
  };

  return (
    <section className="bg-[#F5F7FA] min-h-[85vh] py-10 sm:py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header Banner */}
        <div className="bg-[#102A43] text-white rounded-2xl p-7 sm:p-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold tracking-wide text-[#F59E0B]">
              Owned Fleet Services · {companyName}
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
              Dedicated Car & Bus Services for Every Journey
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Every service is dispatched directly from our company-owned fleet depot in Visakhapatnam—never
              outsourced to unverified brokers. Book active lines immediately or register priority access for
              upcoming fleet expansions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onOpenGallery()}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <Camera className="w-4 h-4 text-[#F59E0B]" />
              Browse Fleet Gallery
            </button>
            <button
              type="button"
              onClick={onContactDesk}
              className="px-4 py-2.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              Request Custom Charter
            </button>
          </div>
        </div>

        {/* Active Services Showcase Grid */}
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#102A43] tracking-tight">
                Active Fleet Services ({activeServices.length})
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Ready for immediate online reservation across local city, outstation, airport, and charter routes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeServices.map((srv) => {
              const isBroken = brokenImgs[srv.id];
              return (
                <article
                  key={srv.id}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between transition-shadow hover:shadow-md"
                >
                  <div>
                    <div className="aspect-[16/10] bg-slate-100 overflow-hidden relative">
                      {isBroken ? (
                        <div className="w-full h-full flex items-center justify-center bg-[#102A43] text-white text-xs font-semibold">
                          {srv.idealFleet}
                        </div>
                      ) : (
                        <img
                          src={srv.imageUrl}
                          alt={`${srv.title} — ${companyName}`}
                          referrerPolicy="no-referrer"
                          onError={() => setBrokenImgs((prev) => ({ ...prev, [srv.id]: true }))}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    <div className="p-6 space-y-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-mono font-bold text-[#2563EB]">{srv.num}.</span>
                        <span className="text-xs font-medium text-slate-500 flex items-center gap-1 tabular-nums">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          {srv.passengerRange}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-lg font-bold text-[#102A43]">{srv.title}</h3>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">{srv.tagline}</p>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">{srv.desc}</p>

                      <div className="pt-2 border-t border-slate-100 space-y-1.5">
                        {srv.highlights.map((h) => (
                          <p key={h} className="text-xs text-slate-700 flex items-start gap-2">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{h}</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="px-6 pb-6 pt-3 border-t border-slate-100 space-y-3 bg-slate-50/50">
                    <p className="text-[11px] font-medium text-slate-500 truncate">
                      Fleet: <span className="text-[#102A43] font-semibold">{srv.idealFleet}</span>
                    </p>
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => onBookService(srv)}
                        className="flex-1 py-2.5 px-4 bg-[#102A43] hover:bg-[#1a3c5e] text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
                      >
                        Book Service
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenGallery(srv.galleryCategory)}
                        className="py-2.5 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-[#102A43] text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                      >
                        Photos
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {/* Upcoming Services & Fleet Expansions Section */}
        {upcomingServices.length > 0 && (
          <div className="space-y-6 pt-4 border-t border-slate-200">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#F59E0B] flex items-center gap-1.5">
                  <CalendarClock className="w-4 h-4" />
                  Fleet Expansion Roadmap
                </p>
                <h2 className="text-2xl font-bold text-[#102A43] tracking-tight mt-1">
                  Upcoming Services ({upcomingServices.length})
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  New vehicle lines and dedicated express corridors joining the {companyName} fleet soon. Register early interest for corporate & group priority.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingServices.map((srv) => {
                const isBroken = brokenImgs[srv.id];
                return (
                  <article
                    key={srv.id}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div className="aspect-[16/10] bg-slate-100 overflow-hidden relative">
                        {isBroken ? (
                          <div className="w-full h-full flex items-center justify-center bg-[#102A43] text-white text-xs font-semibold">
                            {srv.idealFleet}
                          </div>
                        ) : (
                          <img
                            src={srv.imageUrl}
                            alt={`${srv.title} preview`}
                            referrerPolicy="no-referrer"
                            onError={() => setBrokenImgs((prev) => ({ ...prev, [srv.id]: true }))}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>

                      <div className="p-6 space-y-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-mono font-bold text-[#F59E0B]">
                            {srv.num} · {srv.launchWindow || 'Launching Soon'}
                          </span>
                          <span className="text-xs font-medium text-slate-500 tabular-nums">
                            {srv.passengerRange}
                          </span>
                        </div>

                        <div>
                          <h3 className="text-lg font-bold text-[#102A43]">{srv.title}</h3>
                          <p className="text-xs font-medium text-slate-500 mt-0.5">{srv.tagline}</p>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">{srv.desc}</p>

                        <div className="pt-2 border-t border-slate-100 space-y-1.5">
                          {srv.highlights.map((h) => (
                            <p key={h} className="text-xs text-slate-700 flex items-start gap-2">
                              <Check className="w-3.5 h-3.5 text-[#2563EB] shrink-0 mt-0.5" />
                              <span>{h}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="px-6 pb-6 pt-3 border-t border-slate-100 space-y-3 bg-[#F5F7FA]">
                      <p className="text-[11px] font-medium text-slate-500 truncate">
                        Planned Fleet: <span className="text-[#102A43] font-semibold">{srv.idealFleet}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => handleOpenNotify(srv)}
                        className="w-full py-2.5 px-4 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
                      >
                        <Bell className="w-3.5 h-3.5" />
                        Register Priority / Notify Me
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* Custom Corporate & Wedding Dispatch Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-[#102A43]">Need Multi-Vehicle Coordination or Monthly Contracts?</h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Combine sedans, SUVs, Tempo Travellers, and 45-seater coaches on a single itinerary with one dispatch team.
            </p>
          </div>
          <button
            type="button"
            onClick={onContactDesk}
            className="px-5 py-2.5 bg-[#102A43] hover:bg-[#1a3c5e] text-white text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            Request Dispatch Quote
          </button>
        </div>
      </div>

      {/* Upcoming Service Pre-Interest Modal */}
      {notifyService && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Register interest for ${notifyService.title}`}
          className="fixed inset-0 z-50 bg-[#102A43]/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#F59E0B]">
                  {notifyService.launchWindow || 'Upcoming Launch'}
                </p>
                <h3 className="text-lg font-bold text-[#102A43] mt-0.5">{notifyService.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setNotifyService(null)}
                aria-label="Close modal"
                className="p-1.5 text-slate-500 hover:bg-[#F5F7FA] rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reqDone ? (
              <div className="space-y-4">
                <p className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg p-3.5">
                  {reqDone}
                </p>
                <button
                  type="button"
                  onClick={() => setNotifyService(null)}
                  className="w-full py-2.5 bg-[#102A43] text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitInterest} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={reqName}
                    onChange={(e) => setReqName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Mobile Number *</label>
                    <input
                      type="tel"
                      required
                      value={reqPhone}
                      onChange={(e) => setReqPhone(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                    <input
                      type="email"
                      value={reqEmail}
                      onChange={(e) => setReqEmail(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Requirements / Group Size</label>
                  <textarea
                    rows={3}
                    required
                    value={reqNotes}
                    onChange={(e) => setReqNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                {reqError && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {reqError}
                  </p>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setNotifyService(null)}
                    className="px-4 py-2 text-xs font-semibold bg-[#F5F7FA] text-[#102A43] rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reqSaving}
                    className="px-4 py-2 text-xs font-semibold bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-lg cursor-pointer disabled:opacity-60"
                  >
                    {reqSaving ? 'Submitting...' : 'Submit Priority Request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
