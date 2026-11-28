import { Resend } from 'resend';
import { Booking, BookingStatus, WebsiteSettings } from '../src/types';
import { db } from './db';
import { generateBookingInvoicePdfBuffer } from './invoicePdf';

const DEFAULT_ADMIN_EMAIL = 'jagantravelsvizag@gmail.com';
const DEFAULT_FROM_EMAIL = 'Vizag Jagan Travels <onboarding@resend.dev>';

const inFlightNotifications = new Set<string>();

function escapeHtml(value: unknown): string {
  const str = String(value ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatInr(amount: number): string {
  return `₹${Math.round(Number(amount) || 0).toLocaleString('en-IN')}`;
}

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  return new Resend(apiKey);
}

async function resolveAdminEmail(): Promise<string> {
  const envAdmin = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  if (envAdmin && envAdmin.includes('@')) {
    return envAdmin;
  }
  try {
    const creds = await db.getAll('adminCredentials');
    if (creds.length > 0 && creds[0].email?.includes('@')) {
      return creds[0].email;
    }
  } catch {
    // ignore and use default
  }
  return DEFAULT_ADMIN_EMAIL;
}

function resolveFromEmail(settings?: WebsiteSettings | null): string {
  const configured = process.env.RESEND_FROM_EMAIL?.trim();
  if (configured) return configured;
  const company = (settings?.companyName || 'Vizag Jagan Travels').replace(/[<>]/g, '').trim();
  return `${company} <onboarding@resend.dev>` || DEFAULT_FROM_EMAIL;
}

function buildBookingSummaryRowsHtml(booking: Booking): string {
  const balance = Math.max(0, booking.totalFare - booking.paidAmount);
  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;color:#1e293b;">
      <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">Booking ID</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:700;text-align:right;">${escapeHtml(booking.bookingCode)}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">Service / Fleet</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600;text-align:right;">${escapeHtml(booking.vehicleName)} (${escapeHtml(booking.vehicleCategory)})</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">Trip Type &amp; Pax</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:right;">${escapeHtml(booking.tripType)} · ${escapeHtml(booking.passengerCount)} Passengers</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">Travel Date &amp; Time</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600;text-align:right;">${escapeHtml(booking.journeyDate)} at ${escapeHtml(booking.journeyTime)}${booking.returnDate ? ` (Return: ${escapeHtml(booking.returnDate)})` : ''}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">Pickup</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:right;">${escapeHtml(booking.pickupLocation)}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">Destination</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:right;">${escapeHtml(booking.dropLocation)}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">Total Amount</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:700;text-align:right;">${escapeHtml(formatInr(booking.totalFare))}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">Payment Status</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600;text-align:right;">${escapeHtml(booking.paymentStatus)} (Paid: ${escapeHtml(formatInr(booking.paidAmount))}, Balance: ${escapeHtml(formatInr(balance))})</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;">Booking Status</td><td style="padding:8px 0;font-weight:700;color:#102a43;text-align:right;">${escapeHtml(booking.bookingStatus)}</td></tr>
    </table>
  `;
}

function buildCustomerConfirmationHtml(booking: Booking, settings?: WebsiteSettings | null): string {
  const company = settings?.companyName || 'Vizag Jagan Travels';
  const supportPhone = settings?.supportPhone || '+91 891 274 8800';
  const supportEmail = settings?.supportEmail || DEFAULT_ADMIN_EMAIL;
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
      <div style="background:#102a43;color:#ffffff;padding:22px 24px;">
        <h2 style="margin:0;font-size:20px;">${escapeHtml(company)}</h2>
        <p style="margin:6px 0 0;font-size:13px;color:#cbd5e1;">Booking Confirmation &amp; Invoice #${escapeHtml(booking.bookingCode)}</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 12px;font-size:15px;color:#0f172a;">Dear <strong>${escapeHtml(booking.customerName)}</strong>,</p>
        <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#334155;">
          Thank you for booking with ${escapeHtml(company)}. Your reservation details are summarized below, and your official PDF booking invoice is attached to this email.
        </p>
        ${buildBookingSummaryRowsHtml(booking)}
        ${
          booking.driverName
            ? `<p style="margin:12px 0;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;color:#1e293b;"><strong>Assigned Chauffeur:</strong> ${escapeHtml(booking.driverName)} (${escapeHtml(booking.driverPhone || '')})</p>`
            : ''
        }
        <p style="margin:16px 0 0;font-size:13px;color:#475569;">
          For trip updates or changes, contact our 24/7 dispatch desk at <strong>${escapeHtml(supportPhone)}</strong> or reply to <strong>${escapeHtml(supportEmail)}</strong>.
        </p>
      </div>
    </div>
  `;
}

function buildAdminNewBookingHtml(booking: Booking, settings?: WebsiteSettings | null): string {
  const company = settings?.companyName || 'Vizag Jagan Travels';
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
      <div style="background:#102a43;color:#ffffff;padding:20px 24px;">
        <h2 style="margin:0;font-size:18px;">New Fleet Booking Received · ${escapeHtml(booking.bookingCode)}</h2>
        <p style="margin:5px 0 0;font-size:13px;color:#cbd5e1;">${escapeHtml(company)} Dispatch Alert</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 12px;font-size:14px;color:#334155;">
          A new reservation has been submitted. The PDF booking invoice is attached.
        </p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;margin-bottom:14px;font-size:13px;color:#1e293b;">
          <div><strong>Customer:</strong> ${escapeHtml(booking.customerName)}</div>
          <div><strong>Phone:</strong> ${escapeHtml(booking.customerPhone)}</div>
          <div><strong>Email:</strong> ${escapeHtml(booking.customerEmail)}</div>
          ${booking.notes ? `<div><strong>Notes:</strong> ${escapeHtml(booking.notes)}</div>` : ''}
        </div>
        ${buildBookingSummaryRowsHtml(booking)}
      </div>
    </div>
  `;
}

function buildStatusUpdateHtml(
  booking: Booking,
  status: BookingStatus,
  settings?: WebsiteSettings | null
): string {
  const company = settings?.companyName || 'Vizag Jagan Travels';
  const supportPhone = settings?.supportPhone || '+91 891 274 8800';
  const isApproved = status === 'Confirmed' || status === 'Driver Assigned';
  const isRejected = status === 'Rejected' || status === 'Cancelled';
  const accentColor = isApproved ? '#047857' : isRejected ? '#b91c1c' : '#1d4ed8';
  const headline = isApproved
    ? `Your Booking ${booking.bookingCode} is ${status}`
    : isRejected
    ? `Update on Booking ${booking.bookingCode}: ${status}`
    : `Booking Status Updated: ${status}`;

  const bodyCopy = isApproved
    ? `Great news! Our fleet dispatch team has verified and approved your booking. Your updated PDF invoice is attached for your records.`
    : isRejected
    ? `Your booking request (${booking.bookingCode}) has been marked as ${status}. If you paid online or need an alternative vehicle, please contact our dispatch desk.`
    : `Your booking status has been updated to ${status}.`;

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
      <div style="background:${accentColor};color:#ffffff;padding:20px 24px;">
        <h2 style="margin:0;font-size:19px;">${escapeHtml(headline)}</h2>
        <p style="margin:5px 0 0;font-size:13px;color:#f1f5f9;">${escapeHtml(company)}</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 12px;font-size:15px;color:#0f172a;">Dear <strong>${escapeHtml(booking.customerName)}</strong>,</p>
        <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#334155;">${escapeHtml(bodyCopy)}</p>
        ${
          booking.driverName
            ? `<p style="margin:12px 0;padding:12px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;font-size:13px;color:#065f46;"><strong>Assigned Driver:</strong> ${escapeHtml(booking.driverName)} (${escapeHtml(booking.driverPhone || '')})</p>`
            : ''
        }
        ${buildBookingSummaryRowsHtml(booking)}
        <p style="margin:16px 0 0;font-size:13px;color:#475569;">
          Need assistance? Call <strong>${escapeHtml(supportPhone)}</strong> anytime.
        </p>
      </div>
    </div>
  `;
}

export async function dispatchNewBookingEmails(bookingId: string): Promise<{
  skipped?: boolean;
  customerSent: boolean;
  adminSent: boolean;
  invoiceGenerated: boolean;
  error?: string;
}> {
  const lockKey = `new:${bookingId}`;
  if (inFlightNotifications.has(lockKey)) {
    return { skipped: true, customerSent: false, adminSent: false, invoiceGenerated: false };
  }
  inFlightNotifications.add(lockKey);

  try {
    const [bookings, settings, adminEmail] = await Promise.all([
      db.getAll('bookings'),
      db.getSettings(),
      resolveAdminEmail(),
    ]);
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) {
      return { skipped: true, customerSent: false, adminSent: false, invoiceGenerated: false };
    }

    const prevMeta = booking.emailNotifications || {};
    const needCustomer = !prevMeta.customerConfirmationSentAt && Boolean(booking.customerEmail?.includes('@'));
    const needAdmin = !prevMeta.adminNotificationSentAt && Boolean(adminEmail?.includes('@'));

    if (!needCustomer && !needAdmin) {
      return { skipped: true, customerSent: false, adminSent: false, invoiceGenerated: false };
    }

    const resend = getResendClient();
    if (!resend) {
      const msg = 'RESEND_API_KEY is not configured in server environment';
      console.warn(`[Email] Skipping notifications for ${booking.bookingCode}: ${msg}`);
      await db.updateOneById('bookings', booking.id, {
        emailNotifications: {
          ...prevMeta,
          lastError: msg,
        },
      });
      return { customerSent: false, adminSent: false, invoiceGenerated: false, error: msg };
    }

    const pdf = generateBookingInvoicePdfBuffer(booking, settings);
    const nowIso = new Date().toISOString();
    const fromEmail = resolveFromEmail(settings);
    const attachment = [{ filename: pdf.filename, content: pdf.content }];

    let customerSent = false;
    let adminSent = false;
    const errors: string[] = [];

    if (needCustomer) {
      try {
        const result = await resend.emails.send({
          from: fromEmail,
          to: [booking.customerEmail],
          subject: `Booking Confirmation & Invoice #${booking.bookingCode} · ${settings.companyName || 'Vizag Jagan Travels'}`,
          html: buildCustomerConfirmationHtml(booking, settings),
          attachments: attachment,
        });
        if (result.error) {
          errors.push(`Customer email error: ${result.error.message}`);
        } else {
          customerSent = true;
        }
      } catch (err) {
        errors.push(`Customer email exception: ${(err as Error).message}`);
      }
    }

    if (needAdmin) {
      try {
        const result = await resend.emails.send({
          from: fromEmail,
          to: [adminEmail],
          subject: `New Booking #${booking.bookingCode} (${booking.vehicleCategory}) · ${booking.customerName}`,
          html: buildAdminNewBookingHtml(booking, settings),
          attachments: attachment,
        });
        if (result.error) {
          errors.push(`Admin email error: ${result.error.message}`);
        } else {
          adminSent = true;
        }
      } catch (err) {
        errors.push(`Admin email exception: ${(err as Error).message}`);
      }
    }

    await db.updateOneById('bookings', booking.id, {
      emailNotifications: {
        ...prevMeta,
        invoiceGeneratedAt: prevMeta.invoiceGeneratedAt || nowIso,
        customerConfirmationSentAt: customerSent ? nowIso : prevMeta.customerConfirmationSentAt,
        adminNotificationSentAt: adminSent ? nowIso : prevMeta.adminNotificationSentAt,
        lastError: errors.length > 0 ? errors.join(' | ') : undefined,
      },
    });

    if (errors.length > 0) {
      console.warn(`[Email] Partial/failed send for ${booking.bookingCode}:`, errors.join(' | '));
    }

    return {
      customerSent,
      adminSent,
      invoiceGenerated: true,
      error: errors.length > 0 ? errors.join(' | ') : undefined,
    };
  } catch (err) {
    console.warn(`[Email] Unexpected error in dispatchNewBookingEmails:`, (err as Error).message);
    return {
      customerSent: false,
      adminSent: false,
      invoiceGenerated: false,
      error: (err as Error).message,
    };
  } finally {
    inFlightNotifications.delete(lockKey);
  }
}

export async function dispatchBookingStatusEmail(
  bookingId: string,
  newStatus: BookingStatus
): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  const lockKey = `status:${bookingId}:${newStatus}`;
  if (inFlightNotifications.has(lockKey)) {
    return { sent: false, skipped: true };
  }
  inFlightNotifications.add(lockKey);

  try {
    const [bookings, settings] = await Promise.all([db.getAll('bookings'), db.getSettings()]);
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking || !booking.customerEmail?.includes('@')) {
      return { sent: false, skipped: true };
    }

    const prevMeta = booking.emailNotifications || {};
    if (prevMeta.lastStatusNotified === newStatus) {
      return { sent: false, skipped: true };
    }

    const resend = getResendClient();
    if (!resend) {
      const msg = 'RESEND_API_KEY is not configured in server environment';
      console.warn(`[Email] Skipping status update email for ${booking.bookingCode}: ${msg}`);
      return { sent: false, error: msg };
    }

    const attachInvoice = newStatus === 'Confirmed' || newStatus === 'Driver Assigned';
    const attachments = attachInvoice
      ? [generateBookingInvoicePdfBuffer(booking, settings)]
      : undefined;

    const fromEmail = resolveFromEmail(settings);
    const result = await resend.emails.send({
      from: fromEmail,
      to: [booking.customerEmail],
      subject: `Booking #${booking.bookingCode} ${newStatus} · ${settings.companyName || 'Vizag Jagan Travels'}`,
      html: buildStatusUpdateHtml(booking, newStatus, settings),
      attachments: attachments?.map((a) => ({ filename: a.filename, content: a.content })),
    });

    if (result.error) {
      await db.updateOneById('bookings', booking.id, {
        emailNotifications: {
          ...prevMeta,
          lastError: `Status email error: ${result.error.message}`,
        },
      });
      console.warn(`[Email] Status email error for ${booking.bookingCode}:`, result.error.message);
      return { sent: false, error: result.error.message };
    }

    const nowIso = new Date().toISOString();
    await db.updateOneById('bookings', booking.id, {
      emailNotifications: {
        ...prevMeta,
        invoiceGeneratedAt: attachInvoice ? nowIso : prevMeta.invoiceGeneratedAt,
        lastStatusNotified: newStatus,
        lastStatusNotifiedAt: nowIso,
        lastError: undefined,
      },
    });

    return { sent: true };
  } catch (err) {
    console.warn(`[Email] Status email exception:`, (err as Error).message);
    return { sent: false, error: (err as Error).message };
  } finally {
    inFlightNotifications.delete(lockKey);
  }
}

export async function sendPasswordResetOtpEmail(params: {
  to: string;
  name: string;
  code: string;
  role: 'customer' | 'admin';
}): Promise<{ sent: boolean; error?: string }> {
  const resend = getResendClient();
  if (!resend) {
    return { sent: false, error: 'RESEND_API_KEY is not configured on the server.' };
  }

  try {
    const settings = await db.getSettings();
    const company = settings.companyName || 'Vizag Jagan Travels';
    const supportPhone = settings.supportPhone || '+91 891 274 8800';
    const fromEmail = resolveFromEmail(settings);
    const title =
      params.role === 'admin' ? 'Administrator Password Reset Code' : 'Password Reset Verification Code';

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
        <div style="background:#102a43;color:#ffffff;padding:20px 24px;">
          <h2 style="margin:0;font-size:19px;">${escapeHtml(company)}</h2>
          <p style="margin:5px 0 0;font-size:13px;color:#cbd5e1;">${escapeHtml(title)}</p>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 12px;font-size:15px;color:#0f172a;">Hello <strong>${escapeHtml(params.name || 'Valued User')}</strong>,</p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155;">
            Use the 6-character verification code below to reset your ${params.role === 'admin' ? 'administrator' : 'customer'} password. This code expires in <strong>15 minutes</strong>.
          </p>
          <div style="margin:18px 0;padding:16px;background:#f8fafc;border:1px dashed #94a3b8;border-radius:8px;text-align:center;">
            <span style="font-family:monospace;font-size:26px;font-weight:700;letter-spacing:6px;color:#102a43;">${escapeHtml(params.code)}</span>
          </div>
          <p style="margin:14px 0 0;font-size:12px;color:#64748b;">
            If you did not request a password reset, you can safely ignore this email or contact support at ${escapeHtml(supportPhone)}.
          </p>
        </div>
      </div>
    `;

    const result = await resend.emails.send({
      from: fromEmail,
      to: [params.to],
      subject: `${title} · ${company}`,
      html,
    });

    if (result.error) {
      return { sent: false, error: result.error.message };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, error: (err as Error).message };
  }
}
