import React, { useState } from 'react';
import { Check, Info, ShieldCheck, X } from 'lucide-react';
import { PricingConfig } from '../types';
import { EnrichedVehicle } from './VehicleCard';
import { formatINR } from '../lib/api';

interface VehicleDetailsModalProps {
  vehicle: EnrichedVehicle | null;
  pricing: PricingConfig | null;
  onClose: () => void;
  onBookNow: (vehicle: EnrichedVehicle) => void;
}

export const VehicleDetailsModal: React.FC<VehicleDetailsModalProps> = ({
  vehicle,
  pricing,
  onClose,
  onBookNow,
}) => {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  if (!vehicle) return null;

  const photos = vehicle.images?.length ? vehicle.images : ['/src/assets/images/fleet_executive_sedan_1795608170835.jpg'];
  const rule = pricing?.rules.find((r) => r.category === vehicle.category);
  const charges = pricing?.additionalCharges;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#102A43]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vehicle-modal-title"
    >
      <div className="bg-white rounded-xl border border-slate-200 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-[#2563EB]">
              {vehicle.category} · Unit {vehicle.registrationNumber}
            </p>
            <h2 id="vehicle-modal-title" className="text-xl font-bold text-[#102A43]">
              {vehicle.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close vehicle details"
            className="p-2 rounded-lg text-slate-500 hover:bg-[#F5F7FA] hover:text-[#102A43] min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Gallery + Core Specs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-7 space-y-3">
              <div className="aspect-[4/3] rounded-xl overflow-hidden bg-[#F5F7FA] border border-slate-200">
                <img
                  src={photos[activePhotoIndex] || photos[0]}
                  alt={`${vehicle.name} view ${activePhotoIndex + 1}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              {photos.length > 1 && (
                <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                  {photos.map((src, idx) => (
                    <button
                      key={`${src}-${idx}`}
                      type="button"
                      onClick={() => setActivePhotoIndex(idx)}
                      className={`w-20 h-14 rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer transition-colors ${
                        activePhotoIndex === idx ? 'border-[#2563EB]' : 'border-slate-200 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <img src={src} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-5 flex flex-col justify-between space-y-5">
              <div>
                <p className="text-sm text-slate-600 leading-relaxed">{vehicle.description}</p>

                <dl className="grid grid-cols-2 gap-3 mt-5 pt-5 border-t border-slate-100 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">Seating Capacity</dt>
                    <dd className="font-semibold text-[#102A43] tabular-nums">{vehicle.seatingCapacity} Passengers</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Luggage Space</dt>
                    <dd className="font-semibold text-[#102A43] tabular-nums">{vehicle.luggageCapacity} Standard Bags</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Climate Control</dt>
                    <dd className="font-semibold text-[#102A43]">{vehicle.ac ? 'Full AC Cabin' : 'Ventilated Non-AC'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Transmission / Fuel</dt>
                    <dd className="font-semibold text-[#102A43]">{vehicle.transmission} · {vehicle.fuelType}</dd>
                  </div>
                </dl>

                {vehicle.driverInfo && (
                  <div className="mt-5 p-3.5 rounded-lg bg-[#F5F7FA] border border-slate-200">
                    <p className="text-xs font-semibold text-[#102A43] flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
                      Primary Assigned Chauffeur
                    </p>
                    <p className="text-sm font-medium text-[#102A43] mt-1">
                      {vehicle.driverInfo.name} · {vehicle.driverInfo.experienceYears} yrs experience
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Languages: {vehicle.driverInfo.languages.join(', ')}
                    </p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => onBookNow(vehicle)}
                className="w-full py-3 px-4 bg-[#102A43] hover:bg-[#1a3c5e] text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Proceed to Book This Vehicle
              </button>
            </div>
          </div>

          {/* Dynamic Rental Pricing Table */}
          {rule && (
            <div className="pt-6 border-t border-slate-200">
              <h3 className="text-base font-bold text-[#102A43] mb-3">
                Transparent Rental Tariff ({vehicle.category})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3.5 rounded-lg bg-[#F5F7FA]">
                  <p className="text-xs text-slate-500">Per Kilometre</p>
                  <p className="text-base font-bold text-[#102A43] tabular-nums mt-0.5">
                    {formatINR(vehicle.customPerKmRate ?? rule.perKmRate)} / km
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-[#F5F7FA]">
                  <p className="text-xs text-slate-500">Half-Day (4h / 40km)</p>
                  <p className="text-base font-bold text-[#102A43] tabular-nums mt-0.5">
                    {formatINR(rule.halfDayRate)}
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-[#F5F7FA]">
                  <p className="text-xs text-slate-500">Full-Day (8h / 80km)</p>
                  <p className="text-base font-bold text-[#102A43] tabular-nums mt-0.5">
                    {formatINR(rule.fullDayRate)}
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-[#F5F7FA]">
                  <p className="text-xs text-slate-500">
                    {vehicle.fleetGroup === 'Bus' ? 'Bus Daily Minimum' : 'Outstation / Day'}
                  </p>
                  <p className="text-base font-bold text-[#102A43] tabular-nums mt-0.5">
                    {vehicle.fleetGroup === 'Bus'
                      ? formatINR(vehicle.customPerDayRate ?? rule.perDayBusRate)
                      : `${rule.outstationMinKmPerDay} km min`}
                  </p>
                </div>
              </div>

              {charges && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-5">
                  <div>
                    <p className="text-xs font-semibold text-emerald-800 mb-2">Included in Displayed Fare</p>
                    <ul className="space-y-1.5 text-xs text-slate-600">
                      {charges.includedSummary.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-amber-800 mb-2">Additional / Payable as Actuals</p>
                    <ul className="space-y-1.5 text-xs text-slate-600">
                      <li className="flex items-start gap-2">
                        <Info className="w-3.5 h-3.5 text-[#F59E0B] shrink-0 mt-0.5" />
                        <span>Driver allowance: {formatINR(rule.driverAllowancePerDay)}/day (outstation) · Night charge: {formatINR(rule.nightCharge)}</span>
                      </li>
                      {charges.additionalSummary.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <Info className="w-3.5 h-3.5 text-[#F59E0B] shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Features, Services & Terms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-200">
            <div>
              <h4 className="text-sm font-bold text-[#102A43] mb-2">Cabin Features & Supported Services</h4>
              <ul className="space-y-1.5 text-xs text-slate-600">
                {vehicle.features.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
              <p className="text-xs text-slate-500 mt-3">
                Services: {vehicle.services.join(' · ')}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#102A43] mb-2">Rental Terms & Conditions</h4>
              <ul className="space-y-1.5 text-xs text-slate-600">
                {vehicle.terms.map((t) => (
                  <li key={t}>• {t}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
