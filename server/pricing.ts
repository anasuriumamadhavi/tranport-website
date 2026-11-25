import {
  AdditionalChargesConfig,
  CategoryPricingRule,
  FareEstimate,
  PricingConfig,
  TripType,
  Vehicle,
} from '../src/types';

export function calculateFareEstimate(params: {
  vehicle: Vehicle;
  pricing: PricingConfig;
  tripType: TripType;
  distanceKm: number;
  journeyDate: string;
  journeyTime: string;
  returnDate?: string;
  localPackageHours?: number;
}): FareEstimate {
  const {
    vehicle,
    pricing,
    tripType,
    distanceKm,
    journeyDate,
    journeyTime,
    returnDate,
    localPackageHours = 8,
  } = params;

  const rule: CategoryPricingRule =
    pricing.rules.find((r) => r.category === vehicle.category) || pricing.rules[0];
  const charges: AdditionalChargesConfig = pricing.additionalCharges;

  const effectivePerKm = vehicle.customPerKmRate ?? rule.perKmRate;
  const effectiveOutstationPerKm = vehicle.customPerKmRate ?? rule.outstationPerKmRate;
  const effectiveBusPerDay = vehicle.customPerDayRate ?? rule.perDayBusRate;

  const start = new Date(`${journeyDate}T00:00:00`);
  const end = returnDate ? new Date(`${returnDate}T00:00:00`) : start;
  const diffDays = Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
    ? 1
    : Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  const safeDistance = Math.max(10, Math.round(distanceKm));
  let baseFare = 0;
  let extraKmCharges = 0;
  let driverAllowance = 0;
  let nightCharges = 0;
  let breakdownNote = '';

  const hourNum = Number((journeyTime || '09:00').split(':')[0]);
  const isNightPickup = !Number.isNaN(hourNum) && (hourNum >= 22 || hourNum < 6);
  if (isNightPickup) {
    nightCharges = rule.nightCharge;
  }

  if (tripType === 'Local Rental') {
    if (localPackageHours <= 4) {
      baseFare = rule.halfDayRate;
      const includedKm = 40;
      if (safeDistance > includedKm) {
        extraKmCharges = (safeDistance - includedKm) * rule.extraKmRate;
      }
      breakdownNote = `Half-day package (4 hrs / 40 km) at ₹${rule.halfDayRate.toLocaleString('en-IN')}`;
    } else {
      baseFare = rule.fullDayRate;
      const includedKm = 80;
      if (safeDistance > includedKm) {
        extraKmCharges = (safeDistance - includedKm) * rule.extraKmRate;
      }
      breakdownNote = `Full-day package (8 hrs / 80 km) at ₹${rule.fullDayRate.toLocaleString('en-IN')}`;
    }
    driverAllowance = 0;
  } else if (tripType === 'Airport Transfer') {
    const minAirportKm = 25;
    const billedKm = Math.max(minAirportKm, safeDistance);
    baseFare = Math.max(rule.halfDayRate, billedKm * effectivePerKm);
    breakdownNote = `Airport transfer (${billedKm} km billed at ₹${effectivePerKm}/km, min ₹${rule.halfDayRate.toLocaleString('en-IN')})`;
  } else {
    // One Way or Round Trip / Outstation
    const totalTravelKm = tripType === 'Round Trip' ? safeDistance * 2 : safeDistance;
    const minBillableKm = diffDays * rule.outstationMinKmPerDay;
    const billableKm = Math.max(totalTravelKm, minBillableKm);

    if (vehicle.fleetGroup === 'Bus') {
      const kmCharge = billableKm * effectiveOutstationPerKm;
      const dayCharge = diffDays * effectiveBusPerDay;
      baseFare = Math.max(kmCharge, dayCharge);
      breakdownNote = `${diffDays} day(s) · ${billableKm} km billed (min ${rule.outstationMinKmPerDay} km/day @ ₹${effectiveOutstationPerKm}/km or ₹${effectiveBusPerDay.toLocaleString('en-IN')}/day)`;
    } else {
      baseFare = billableKm * effectiveOutstationPerKm;
      breakdownNote = `${diffDays} day(s) · ${billableKm} km billed (min ${rule.outstationMinKmPerDay} km/day @ ₹${effectiveOutstationPerKm}/km)`;
    }
    driverAllowance = diffDays * rule.driverAllowancePerDay;
  }

  const subtotal = Math.round(baseFare + extraKmCharges + driverAllowance + nightCharges);
  const taxAmount = Math.round((subtotal * charges.taxPercent) / 100);
  const totalEstimatedFare = subtotal + taxAmount;
  const advancePayable = Math.round((totalEstimatedFare * charges.advancePaymentPercent) / 100);

  const estimatedTollsExtra = Math.round((safeDistance / 100) * charges.estimatedTollPer100Km * (tripType === 'Round Trip' ? 2 : 1));
  const estimatedStatePermitExtra = safeDistance > 180 ? charges.statePermitEstimate : 0;

  const requiresCustomQuote = Boolean(
    rule.customQuotationRequiredOverKm && safeDistance >= rule.customQuotationRequiredOverKm
  );

  return {
    baseFare: Math.round(baseFare),
    extraKmCharges: Math.round(extraKmCharges),
    driverAllowance: Math.round(driverAllowance),
    nightCharges: Math.round(nightCharges),
    taxAmount,
    subtotal,
    totalEstimatedFare,
    advancePayable,
    estimatedTollsExtra,
    estimatedStatePermitExtra,
    pricingBreakdownNote: breakdownNote,
    includedItems: charges.includedSummary,
    additionalItems: charges.additionalSummary,
    requiresCustomQuote,
  };
}
