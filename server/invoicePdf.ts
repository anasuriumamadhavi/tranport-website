import { jsPDF } from 'jspdf';
import { Booking, WebsiteSettings } from '../src/types';

export interface GeneratedInvoicePdf {
  filename: string;
  content: Buffer;
}

function formatInrPlain(amount: number): string {
  const rounded = Math.round(Number(amount) || 0);
  return `Rs. ${rounded.toLocaleString('en-IN')}`;
}

export function generateBookingInvoicePdfBuffer(
  booking: Booking,
  settings?: WebsiteSettings | null
): GeneratedInvoicePdf {
  const doc = new jsPDF();
  const navy = [16, 42, 67] as const;
  const muted = [100, 116, 139] as const;
  const slateText = [51, 65, 85] as const;

  const companyName = settings?.companyName || 'Vizag Jagan Travels';
  const estYear = settings?.establishedYear || 'Est. 2020';
  const supportPhone = settings?.supportPhone || '+91 891 274 8800';
  const supportEmail = settings?.supportEmail || 'jagantravelsvizag@gmail.com';
  const gstNumber = settings?.gstNumber?.trim();
  const footerNote =
    settings?.invoiceFooterNote ||
    `Thank you for travelling with ${companyName} · 24/7 Dispatch: ${supportPhone}`;
  const slug = companyName.replace(/[^A-Za-z0-9]/g, '') || 'VizagJaganTravels';

  // Header Banner
  doc.setFillColor(navy[0], navy[1], navy[2]);
  doc.rect(0, 0, 210, 36, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName.toUpperCase(), 16, 15);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Direct-Owned Car, Bus & Package Fleet · ${estYear}${gstNumber ? ` · GSTIN: ${gstNumber}` : ''}`,
    16,
    22
  );
  doc.text(`Support: ${supportPhone} · ${supportEmail}`, 16, 28);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`INVOICE #${booking.bookingCode}`, 194, 16, { align: 'right' });
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Issued: ${new Date(booking.createdAt || Date.now()).toLocaleDateString('en-IN')}`, 194, 23, {
    align: 'right',
  });

  // Passenger & Service Summary Columns
  let y = 48;
  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Customer & Booking Details', 16, y);
  doc.text('Service & Fleet Allocation', 112, y);

  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text(`Booking ID: ${booking.bookingCode}`, 16, y);
  doc.text(`Service: ${booking.vehicleName}`, 112, y, { maxWidth: 82 });

  y += 6;
  doc.text(`Customer: ${booking.customerName}`, 16, y, { maxWidth: 88 });
  doc.text(`Category: ${booking.vehicleCategory}`, 112, y);

  y += 6;
  doc.text(`Mobile: ${booking.customerPhone}`, 16, y);
  doc.text(`Trip Type: ${booking.tripType} (${booking.passengerCount} pax)`, 112, y);

  y += 6;
  doc.text(`Email: ${booking.customerEmail}`, 16, y, { maxWidth: 88 });
  doc.text(
    `Driver: ${booking.driverName ? `${booking.driverName} (${booking.driverPhone || ''})` : 'Assigned prior to pickup'}`,
    112,
    y,
    { maxWidth: 82 }
  );

  y += 6;
  doc.text(`Booking Status: ${booking.bookingStatus}`, 16, y);
  doc.text(`Payment Status: ${booking.paymentStatus}`, 112, y);

  // Route & Travel Schedule
  y += 11;
  doc.setDrawColor(226, 232, 240);
  doc.line(16, y, 194, y);
  y += 9;

  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Travel Date, Pickup & Destination', 16, y);

  y += 6.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(slateText[0], slateText[1], slateText[2]);

  const pickupLines = doc.splitTextToSize(`Pickup: ${booking.pickupLocation}`, 176) as string[];
  doc.text(pickupLines, 16, y);
  y += pickupLines.length * 5 + 2;

  const dropLines = doc.splitTextToSize(`Destination: ${booking.dropLocation}`, 176) as string[];
  doc.text(dropLines, 16, y);
  y += dropLines.length * 5 + 2;

  doc.text(
    `Travel Date: ${booking.journeyDate} at ${booking.journeyTime}${
      booking.returnDate ? `   |   Return Date: ${booking.returnDate}` : ''
    }`,
    16,
    y
  );
  y += 6;
  doc.text(
    `Estimated Distance: ${booking.estimatedDistanceKm} km (${booking.estimatedDurationText})   |   Payment Mode: ${
      booking.paymentMode || 'Pay Later'
    }`,
    16,
    y
  );

  if (booking.notes?.trim()) {
    y += 6;
    const noteLines = doc.splitTextToSize(`Notes: ${booking.notes.trim()}`, 176) as string[];
    doc.text(noteLines, 16, y);
    y += noteLines.length * 5;
  }

  // Fare Breakdown Table
  y += 8;
  doc.setFillColor(245, 247, 250);
  doc.rect(16, y, 178, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.text('Fare Component', 20, y + 6);
  doc.text('Amount (INR)', 190, y + 6, { align: 'right' });

  const fe = booking.fareEstimate;
  const rows: Array<[string, string]> = [
    [`Base Rental (${fe?.pricingBreakdownNote || booking.vehicleCategory})`, formatInrPlain(fe?.baseFare ?? booking.totalFare)],
    ['Extra Distance / Package Adjustment', formatInrPlain(fe?.extraKmCharges ?? 0)],
    ['Driver Allowance', formatInrPlain(fe?.driverAllowance ?? 0)],
    ['Night Pickup / Operations Charge', formatInrPlain(fe?.nightCharges ?? 0)],
    ['GST / Taxes (5%)', formatInrPlain(fe?.taxAmount ?? 0)],
    ['Total Amount', formatInrPlain(booking.totalFare)],
    ['Amount Paid Online', formatInrPlain(booking.paidAmount)],
    ['Balance Payable', formatInrPlain(Math.max(0, booking.totalFare - booking.paidAmount))],
  ];

  y += 14;
  rows.forEach(([label, val], idx) => {
    if (idx >= 5) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(navy[0], navy[1], navy[2]);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(slateText[0], slateText[1], slateText[2]);
    }
    doc.text(label, 20, y, { maxWidth: 125 });
    doc.text(val, 190, y, { align: 'right' });
    y += 7.5;
  });

  y += 4;
  doc.setDrawColor(226, 232, 240);
  doc.line(16, y, 194, y);
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.text('Additional Charges Payable at Actuals (Not Included Above):', 16, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text(
    `Highway tolls (est. Rs. ${fe?.estimatedTollsExtra ?? 0}), parking charges, and interstate border permits (if applicable).`,
    16,
    y,
    { maxWidth: 176 }
  );

  doc.setFontSize(8.5);
  doc.text(footerNote, 105, 282, { align: 'center' });

  const arrayBuffer = doc.output('arraybuffer');
  return {
    filename: `${slug}-Invoice-${booking.bookingCode}.pdf`,
    content: Buffer.from(arrayBuffer),
  };
}
