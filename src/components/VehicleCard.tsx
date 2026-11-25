import React, { useState } from 'react';
import { Car } from 'lucide-react';
import { motion } from 'motion/react';
import { Vehicle } from '../types';
import { formatINR } from '../lib/api';

export interface EnrichedVehicle extends Vehicle {
  perKmRate?: number;
  startingHalfDay?: number;
  perDayBusRate?: number;
  driverInfo?: {
    id: string;
    name: string;
    experienceYears: number;
    languages: string[];
  } | null;
}

interface VehicleCardProps {
  vehicle: EnrichedVehicle;
  onViewDetails: (vehicle: EnrichedVehicle) => void;
  onBookNow: (vehicle: EnrichedVehicle) => void;
}

export const VehicleCard: React.FC<VehicleCardProps> = ({
  vehicle,
  onViewDetails,
  onBookNow,
}) => {
  const [imgError, setImgError] = useState(false);
  const primaryImage = vehicle.images?.[0];

  const startingPriceLabel =
    vehicle.fleetGroup === 'Bus' && vehicle.perDayBusRate
      ? `${formatINR(vehicle.perDayBusRate)} / day`
      : `${formatINR(vehicle.perKmRate ?? 14)} / km`;

  return (
    <motion.article
      whileHover={{ y: -4 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="group bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md rounded-xl overflow-hidden flex flex-col transition-shadow duration-200"
    >
      <div className="aspect-[4/3] bg-[#F5F7FA] relative overflow-hidden">
        {primaryImage && !imgError ? (
          <img
            src={primaryImage}
            alt={vehicle.name}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#F5F7FA] to-slate-200 text-[#102A43] p-4 text-center">
            <Car className="w-10 h-10 text-[#2563EB] mb-2" />
            <span className="text-sm font-semibold">{vehicle.name}</span>
          </div>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#2563EB]">
            {vehicle.category}
            <span className="mx-1.5 text-slate-300" aria-hidden="true">·</span>
            <span className={vehicle.status === 'Available' ? 'text-emerald-700' : 'text-amber-700'}>
              {vehicle.status}
            </span>
          </p>

          <h3 className="text-lg font-bold text-[#102A43] mt-1 leading-snug">
            {vehicle.name}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{vehicle.model}</p>

          <p className="text-xs text-slate-600 mt-3 leading-relaxed tabular-nums">
            {vehicle.seatingCapacity} Passengers
            <span className="mx-1.5 text-slate-300" aria-hidden="true">·</span>
            {vehicle.luggageCapacity} Bags
            <span className="mx-1.5 text-slate-300" aria-hidden="true">·</span>
            {vehicle.ac ? 'AC' : 'Non-AC'}
            <span className="mx-1.5 text-slate-300" aria-hidden="true">·</span>
            {vehicle.transmission}
          </p>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Starting from</p>
            <p className="text-base font-bold text-[#102A43] tabular-nums">{startingPriceLabel}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onViewDetails(vehicle)}
              className="px-3 py-2 text-xs font-semibold text-[#102A43] bg-[#F5F7FA] hover:bg-slate-200 active:scale-[0.98] rounded-lg whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer"
            >
              View Details
            </button>
            <button
              type="button"
              onClick={() => onBookNow(vehicle)}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1d4ed8] active:scale-[0.98] rounded-lg whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer"
            >
              Book Now
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
};
