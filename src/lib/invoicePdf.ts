import { jsPDF } from 'jspdf';
import { Booking, WebsiteSettings } from '../types';

export function downloadBookingInvoicePdf(booking: Booking, settings?: WebsiteSettings | null): void {
  const doc = new jsPDF();
  const navy = [16, 42, 67] as const;
  const muted = [100, 116, 139] as const;

  const companyName = settings?.companyName || 'Vizag Jagan Travels';
  const estYear = settings?.establishedYear || 'Est. 2020';
  const supportPhone = settings?.supportPhone || '+91 891 274 8800';
  const gstNumber = settings?.gstNumber?.trim();
  const footerNote =
    settings?.invoiceFooterNote ||
    `Thank you for travelling with ${companyName} · 24/7 Dispatch: ${supportPhone}`;
  const slug = companyName.replace(/[^A-Za-z0-9]/g, '') || 'VizagJaganTravels';

  // Header bar
  doc.setFillColor(navy[0], navy[1], navy[2]);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName.toUpperCase(), 16, 16);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Owned Car & Bus Fleet Services · ${estYear}${gstNumber ? ` · GSTIN: ${gstNumber}` : ''}`,
    16,
    23
  );
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`INVOICE #${booking.bookingCode}`, 194, 18, { align: 'right' });

  let y = 46;
  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Passenger & Booking Summary', 16, y);
  doc.text('Trip & Fleet Allocation', 112, y);

  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text(`Customer: ${booking.customerName}`, 16, y);
  doc.text(`Vehicle: ${booking.vehicleName}`, 112, y);
  y += 6;
  doc.text(`Mobile: ${booking.customerPhone}`, 16, y);
  doc.text(`Category: ${booking.vehicleCategory}`, 112, y);
  y += 6;
  doc.text(`Email: ${booking.customerEmail}`, 16, y);
  doc.text(`Driver: ${booking.driverName || 'Assigned prior to pickup'}`, 112, y);
  y += 6;
  doc.text(`Booking Status: ${booking.bookingStatus}`, 16, y);
  doc.text(`Payment Status: ${booking.paymentStatus}`, 112, y);

  y += 12;
  doc.setDrawColor(226, 232, 240);
  doc.line(16, y, 194, y);
  y += 9;

  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('Route & Schedule', 16, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(`Pickup: ${booking.pickupLocation}`, 16, y, { maxWidth: 175 });
  y += 7;
  doc.text(`Drop: ${booking.dropLocation}`, 16, y, { maxWidth: 175 });
  y += 7;
  doc.text(
    `Journey: ${booking.journeyDate} at ${booking.journeyTime}${booking.returnDate ? `  |  Return: ${booking.returnDate}` : ''}  |  Passengers: ${booking.passengerCount}  |  Type: ${booking.tripType}`,
    16,
    y
  );
  y += 6;
  doc.text(`Estimated Distance: ${booking.estimatedDistanceKm} km (${booking.estimatedDurationText})`, 16, y);

  y += 12;
  doc.setFillColor(245, 247, 250);
  doc.rect(16, y, 178, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.text('Fare Component', 20, y + 6);
  doc.text('Amount (INR)', 190, y + 6, { align: 'right' });

  const rows: Array<[string, string]> = [
    [`Base Rental (${booking.fareEstimate.pricingBreakdownNote})`, `Rs. ${booking.fareEstimate.baseFare.toLocaleString('en-IN')}`],
    ['Extra Distance / Package Adjustment', `Rs. ${booking.fareEstimate.extraKmCharges.toLocaleString('en-IN')}`],
    ['Driver Allowance', `Rs. ${booking.fareEstimate.driverAllowance.toLocaleString('en-IN')}`],
    ['Night Pickup / Operations Charge', `Rs. ${booking.fareEstimate.nightCharges.toLocaleString('en-IN')}`],
    ['GST / Taxes (5%)', `Rs. ${booking.fareEstimate.taxAmount.toLocaleString('en-IN')}`],
    ['Total Estimated Fare', `Rs. ${booking.totalFare.toLocaleString('en-IN')}`],
    ['Amount Paid Online', `Rs. ${booking.paidAmount.toLocaleString('en-IN')}`],
    ['Balance Payable on Trip Completion', `Rs. ${Math.max(0, booking.totalFare - booking.paidAmount).toLocaleString('en-IN')}`],
  ];

  y += 14;
  doc.setFont('helvetica', 'normal');
  rows.forEach(([label, val], idx) => {
    if (idx >= 5) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(navy[0], navy[1], navy[2]);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
    }
    doc.text(label, 20, y, { maxWidth: 125 });
    doc.text(val, 190, y, { align: 'right' });
    y += 8;
  });

  y += 6;
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
    `Highway tolls (est. Rs. ${booking.fareEstimate.estimatedTollsExtra}), parking charges, and interstate border permits (if applicable).`,
    16,
    y,
    { maxWidth: 176 }
  );

  doc.setFontSize(8.5);
  doc.text(footerNote, 105, 282, { align: 'center' });
  doc.save(`${slug}-Invoice-${booking.bookingCode}.pdf`);
}

export function downloadAdminReportPdf(
  title: string,
  headers: string[],
  rows: Array<Array<string | number>>,
  settings?: WebsiteSettings | null
): void {
  const companyName = settings?.companyName || 'Vizag Jagan Travels';
  const slug = companyName.replace(/[^A-Za-z0-9]/g, '') || 'VizagJaganTravels';
  const doc = new jsPDF();
  doc.setFillColor(16, 42, 67);
  doc.rect(0, 0, 210, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`${companyName} · ${title}`, 14, 16);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated ${new Date().toLocaleDateString()}`, 196, 16, { align: 'right' });

  let y = 38;
  const colWidth = 182 / headers.length;
  doc.setFillColor(245, 247, 250);
  doc.rect(14, y - 5, 182, 8, 'F');
  doc.setTextColor(16, 42, 67);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  headers.forEach((h, i) => {
    doc.text(String(h), 16 + i * colWidth, y);
  });

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  rows.forEach((row) => {
    if (y > 275) {
      doc.addPage();
      y = 20;
    }
    row.forEach((cell, i) => {
      doc.text(String(cell).slice(0, 26), 16 + i * colWidth, y);
    });
    y += 7;
  });

  doc.save(`${slug}-${title.replace(/\s+/g, '-')}.pdf`);
}

export function downloadCsvReport(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>
): void {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
