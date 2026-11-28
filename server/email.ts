import crypto from 'crypto';
import { Resend } from 'resend';
import { Booking, BookingStatus, Enquiry, WebsiteSettings } from '../src/types';
import { AdminActionTokenRecord, db } from './db';
import { generateBookingInvoicePdfBuffer } from './invoicePdf';

const DEFAULT_ADMIN_EMAIL = 'jagantravelsvizag@gmail.com';
const DEFAULT_FROM_EMAIL = 'Vizag Jagan Travels <onboarding@resend.dev>';
const ACTION_LINK_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

const inFlightNotifications = new Set<string>();

export function hashAdminActionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function sanitizeBaseUrl(candidate?: string): string {
  const candidates = [candidate, process.env.APP_URL];
  for (const item of candidates) {
    const trimmed = item?.trim();
    if (!trimmed || trimmed === 'MY_APP_URL') continue;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return `${parsed.protocol}//${parsed.host}`;
      }
    } catch {
      // ignore invalid URL
    }
  }
  return 'http://localhost:3000';
}

async function createActionLinksForTarget(
  targetType: 'booking' | 'enquiry',
  targetId: string,
  baseUrl?: string
): Promise<{ confirmUrl: string; rejectUrl: string }> {
  const origin = sanitizeBaseUrl(baseUrl);
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + ACTION_LINK_TTL_MS).toISOString();

  const confirmRaw = crypto.randomBytes(32).toString('hex');
  const rejectRaw = crypto.randomBytes(32).toString('hex');

  const records: AdminActionTokenRecord[] = [
    {
      id: `act-${now}-c-${crypto.randomBytes(4).toString('hex')}`,
      tokenHash: hashAdminActionToken(confirmRaw),
      targetType,
      targetId,
      action: 'confirm',
      expiresAt,
      createdAt,
    },
    {
      id: `act-${now}-r-${crypto.randomBytes(4).toString('hex')}`,
      tokenHash: hashAdminActionToken(rejectRaw),
      targetType,
      targetId,
      action: 'reject',
      expiresAt,
      createdAt,
    },
  ];

  await Promise.all(records.map((rec) => db.insertOne('adminActionTokens', rec)));

  return {
    confirmUrl: `${origin}/?adminAction=${confirmRaw}`,
    rejectUrl: `${origin}/?adminAction=${rejectRaw}`,
  };
}

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

function buildActionButtonsHtml(params: {
  confirmUrl: string;
  rejectUrl: string;
  confirmLabel: string;
  rejectLabel: string;
}): string {
  return `
    <div style="margin:20px 0 12px;padding:16px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#102a43;">
        Quick Dispatch Decision (Administrator Verification Required)
      </p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;">
        <tr>
          <td bgcolor="#047857" style="border-radius:6px;background-color:#047857;">
            <a href="${escapeHtml(params.confirmUrl)}" target="_blank" rel="noopener noreferrer"
               style="display:inline-block;padding:12px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:6px;background-color:#047857;">
              ${escapeHtml(params.confirmLabel)}
            </a>
          </td>
          <td width="12" style="width:12px;">&nbsp;</td>
          <td bgcolor="#b91c1c" style="border-radius:6px;background-color:#b91c1c;">
            <a href="${escapeHtml(params.rejectUrl)}" target="_blank" rel="noopener noreferrer"
               style="display:inline-block;padding:12px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:6px;background-color:#b91c1c;">
              ${escapeHtml(params.rejectLabel)}
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:10px 0 0;font-size:11px;color:#64748b;">
        Single-use secure action links valid for 48 hours. Clicking either button opens the secure Admin Confirmation page.
      </p>
    </div>
  `;
}

function buildAdminNewBookingHtml(
  booking: Booking,
  settings?: WebsiteSettings | null,
  actionLinks?: { confirmUrl: string; rejectUrl: string } | null
): string {
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
        ${
          actionLinks
            ? buildActionButtonsHtml({
                confirmUrl: actionLinks.confirmUrl,
                rejectUrl: actionLinks.rejectUrl,
                confirmLabel: 'Confirm Booking',
                rejectLabel: 'Reject Booking',
              })
            : ''
        }
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

export async function dispatchNewBookingEmails(
  bookingId: string,
  baseUrl?: string
): Promise<{
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
        const actionLinks =
          booking.bookingStatus === 'Pending'
            ? await createActionLinksForTarget('booking', booking.id, baseUrl)
            : null;
        const result = await resend.emails.send({
          from: fromEmail,
          to: [adminEmail],
          subject: `New Booking #${booking.bookingCode} (${booking.vehicleCategory}) · ${booking.customerName}`,
          html: buildAdminNewBookingHtml(booking, settings, actionLinks),
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
  newStatus: BookingStatus,
  options?: { notifyAdminWithInvoice?: boolean }
): Promise<{ sent: boolean; adminSent?: boolean; skipped?: boolean; error?: string }> {
  const lockKey = `status:${bookingId}:${newStatus}`;
  if (inFlightNotifications.has(lockKey)) {
    return { sent: false, skipped: true };
  }
  inFlightNotifications.add(lockKey);

  try {
    const [bookings, settings, adminEmail] = await Promise.all([
      db.getAll('bookings'),
      db.getSettings(),
      resolveAdminEmail(),
    ]);
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
    const pdfBuffer = attachInvoice ? generateBookingInvoicePdfBuffer(booking, settings) : null;
    const attachments = pdfBuffer
      ? [{ filename: pdfBuffer.filename, content: pdfBuffer.content }]
      : undefined;

    const fromEmail = resolveFromEmail(settings);
    const errors: string[] = [];
    let customerSent = false;
    let adminSent = false;

    try {
      const result = await resend.emails.send({
        from: fromEmail,
        to: [booking.customerEmail],
        subject: `Booking #${booking.bookingCode} ${newStatus} · ${settings.companyName || 'Vizag Jagan Travels'}`,
        html: buildStatusUpdateHtml(booking, newStatus, settings),
        attachments,
      });

      if (result.error) {
        errors.push(`Customer status email error: ${result.error.message}`);
      } else {
        customerSent = true;
      }
    } catch (err) {
      errors.push(`Customer status email exception: ${(err as Error).message}`);
    }

    const shouldNotifyAdminInvoice =
      attachInvoice &&
      Boolean(options?.notifyAdminWithInvoice || newStatus === 'Confirmed') &&
      Boolean(adminEmail?.includes('@'));

    if (shouldNotifyAdminInvoice) {
      try {
        const adminResult = await resend.emails.send({
          from: fromEmail,
          to: [adminEmail],
          subject: `Confirmed Invoice Copy · Booking #${booking.bookingCode} (${booking.customerName})`,
          html: `
            <div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
              <div style="background:#047857;color:#ffffff;padding:20px 24px;">
                <h2 style="margin:0;font-size:18px;">Booking #${escapeHtml(booking.bookingCode)} Confirmed</h2>
                <p style="margin:5px 0 0;font-size:13px;color:#ecfdf5;">${escapeHtml(settings.companyName || 'Vizag Jagan Travels')} · Official Invoice Copy</p>
              </div>
              <div style="padding:24px;">
                <p style="margin:0 0 12px;font-size:14px;color:#334155;">
                  Booking <strong>#${escapeHtml(booking.bookingCode)}</strong> for <strong>${escapeHtml(booking.customerName)}</strong> is now <strong>${escapeHtml(newStatus)}</strong>. The official PDF invoice is attached for admin records.
                </p>
                ${buildBookingSummaryRowsHtml(booking)}
              </div>
            </div>
          `,
          attachments,
        });
        if (adminResult.error) {
          errors.push(`Admin invoice email error: ${adminResult.error.message}`);
        } else {
          adminSent = true;
        }
      } catch (err) {
        errors.push(`Admin invoice email exception: ${(err as Error).message}`);
      }
    }

    const nowIso = new Date().toISOString();
    await db.updateOneById('bookings', booking.id, {
      emailNotifications: {
        ...prevMeta,
        invoiceGeneratedAt: attachInvoice ? nowIso : prevMeta.invoiceGeneratedAt,
        lastStatusNotified: customerSent ? newStatus : prevMeta.lastStatusNotified,
        lastStatusNotifiedAt: customerSent ? nowIso : prevMeta.lastStatusNotifiedAt,
        lastError: errors.length > 0 ? errors.join(' | ') : undefined,
      },
    });

    if (errors.length > 0) {
      console.warn(`[Email] Status email issues for ${booking.bookingCode}:`, errors.join(' | '));
    }

    return {
      sent: customerSent,
      adminSent,
      error: errors.length > 0 ? errors.join(' | ') : undefined,
    };
  } catch (err) {
    console.warn(`[Email] Status email exception:`, (err as Error).message);
    return { sent: false, error: (err as Error).message };
  } finally {
    inFlightNotifications.delete(lockKey);
  }
}

function sanitizeTelHref(phone: string): string | null {
  const cleaned = phone.replace(/[^+\d]/g, '');
  return cleaned.length >= 6 ? `tel:${cleaned}` : null;
}

async function createEnquiryReplyLink(enquiryId: string, baseUrl?: string): Promise<string> {
  const origin = sanitizeBaseUrl(baseUrl);
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + ACTION_LINK_TTL_MS).toISOString();
  const rawToken = crypto.randomBytes(32).toString('hex');

  const record: AdminActionTokenRecord = {
    id: `act-${now}-e-${crypto.randomBytes(4).toString('hex')}`,
    tokenHash: hashAdminActionToken(rawToken),
    targetType: 'enquiry',
    targetId: enquiryId,
    action: 'reply',
    expiresAt,
    createdAt,
  };
  await db.insertOne('adminActionTokens', record);
  return `${origin}/?enquiryReply=${rawToken}`;
}

function buildAdminNewEnquiryHtml(
  enquiry: Enquiry,
  settings: WebsiteSettings | null,
  replyUrl: string | null
): string {
  const company = settings?.companyName || 'Vizag Jagan Travels';
  const hasRealEmail = Boolean(enquiry.email && enquiry.email !== 'not-provided@vizagjagantravels.com');
  const telHref = sanitizeTelHref(enquiry.phone || '');
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
      <div style="background:#1e3a8a;color:#ffffff;padding:20px 24px;">
        <h2 style="margin:0;font-size:18px;">New Customer Enquiry · ${escapeHtml(enquiry.subject)}</h2>
        <p style="margin:5px 0 0;font-size:13px;color:#dbeafe;">${escapeHtml(company)} · General Enquiry Desk</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 12px;font-size:14px;color:#334155;">
          A customer submitted an enquiry via <strong>${escapeHtml(enquiry.source)}</strong>. Review the details below and reply or call directly.
        </p>
        <table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:14px;color:#1e293b;">
          <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">Customer Name</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:700;text-align:right;">${escapeHtml(enquiry.name)}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">Phone Number</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:700;text-align:right;">${escapeHtml(enquiry.phone)}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">Customer Email</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:right;">${escapeHtml(hasRealEmail ? enquiry.email : 'Not provided')}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">Enquiry Subject</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600;text-align:right;">${escapeHtml(enquiry.subject)}</td></tr>
          ${enquiry.bookingCode ? `<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">Ref Code</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:700;text-align:right;">${escapeHtml(enquiry.bookingCode)}</td></tr>` : ''}
          <tr><td style="padding:8px 0;color:#64748b;">Status</td><td style="padding:8px 0;font-weight:700;color:#1e3a8a;text-align:right;">${escapeHtml(enquiry.status)}</td></tr>
        </table>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;margin:14px 0;font-size:13px;color:#1e293b;line-height:1.55;">
          <strong>Customer Message:</strong><br/>${escapeHtml(enquiry.message)}
        </div>
        <div style="margin:20px 0 8px;padding:16px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;">
          <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#102a43;">
            Enquiry Response Actions
          </p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;">
            <tr>
              ${
                replyUrl
                  ? `<td bgcolor="#2563EB" style="border-radius:6px;background-color:#2563EB;">
                      <a href="${escapeHtml(replyUrl)}" target="_blank" rel="noopener noreferrer"
                         style="display:inline-block;padding:12px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:6px;background-color:#2563EB;">
                        Reply to Customer
                      </a>
                    </td>
                    <td width="12" style="width:12px;">&nbsp;</td>`
                  : ''
              }
              ${
                telHref
                  ? `<td bgcolor="#047857" style="border-radius:6px;background-color:#047857;">
                      <a href="${escapeHtml(telHref)}"
                         style="display:inline-block;padding:12px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:6px;background-color:#047857;">
                        Call Customer (${escapeHtml(enquiry.phone)})
                      </a>
                    </td>`
                  : ''
              }
            </tr>
          </table>
          <p style="margin:10px 0 0;font-size:11px;color:#64748b;">
            Clicking Reply to Customer opens the verified Admin Email Reply form (48-hour link).
          </p>
        </div>
      </div>
    </div>
  `;
}

export async function dispatchNewEnquiryAdminEmail(
  enquiryId: string,
  baseUrl?: string
): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  const lockKey = `new-enq:${enquiryId}`;
  if (inFlightNotifications.has(lockKey)) {
    return { sent: false, skipped: true };
  }
  inFlightNotifications.add(lockKey);

  try {
    const [enquiries, settings, adminEmail] = await Promise.all([
      db.getAll('enquiries'),
      db.getSettings(),
      resolveAdminEmail(),
    ]);
    const enquiry = enquiries.find((e) => e.id === enquiryId);
    if (!enquiry || !adminEmail?.includes('@')) {
      return { sent: false, skipped: true };
    }

    const prevMeta = enquiry.emailNotifications || {};
    if (prevMeta.adminNotificationSentAt) {
      return { sent: false, skipped: true };
    }

    const resend = getResendClient();
    if (!resend) {
      const msg = 'RESEND_API_KEY is not configured in server environment';
      await db.updateOneById('enquiries', enquiry.id, {
        emailNotifications: { ...prevMeta, lastError: msg },
      });
      return { sent: false, error: msg };
    }

    const replyUrl = await createEnquiryReplyLink(enquiry.id, baseUrl);
    const fromEmail = resolveFromEmail(settings);
    const result = await resend.emails.send({
      from: fromEmail,
      to: [adminEmail],
      subject: `New Enquiry · ${enquiry.name} · ${enquiry.subject}`,
      html: buildAdminNewEnquiryHtml(enquiry, settings, replyUrl),
    });

    const nowIso = new Date().toISOString();
    if (result.error) {
      await db.updateOneById('enquiries', enquiry.id, {
        emailNotifications: { ...prevMeta, lastError: result.error.message },
      });
      return { sent: false, error: result.error.message };
    }

    await db.updateOneById('enquiries', enquiry.id, {
      emailNotifications: {
        ...prevMeta,
        adminNotificationSentAt: nowIso,
        lastError: undefined,
      },
    });
    return { sent: true };
  } catch (err) {
    console.warn(`[Email] dispatchNewEnquiryAdminEmail exception:`, (err as Error).message);
    return { sent: false, error: (err as Error).message };
  } finally {
    inFlightNotifications.delete(lockKey);
  }
}

export async function sendEnquiryReplyEmail(params: {
  enquiryId: string;
  subject: string;
  replyMessage: string;
  adminEmail?: string;
}): Promise<{ sent: boolean; enquiry?: Enquiry | null; error?: string }> {
  const lockKey = `enq-reply:${params.enquiryId}`;
  if (inFlightNotifications.has(lockKey)) {
    return { sent: false, error: 'A reply for this enquiry is already being sent.' };
  }
  inFlightNotifications.add(lockKey);

  try {
    const [enquiries, settings] = await Promise.all([db.getAll('enquiries'), db.getSettings()]);
    const enquiry = enquiries.find((e) => e.id === params.enquiryId);
    if (!enquiry) {
      return { sent: false, error: 'Enquiry not found.' };
    }
    if (!enquiry.email?.includes('@') || enquiry.email === 'not-provided@vizagjagantravels.com') {
      return {
        sent: false,
        error: 'This customer did not provide a valid email address. Use Call Customer instead.',
      };
    }

    const resend = getResendClient();
    if (!resend) {
      return { sent: false, error: 'RESEND_API_KEY is not configured in server environment.' };
    }

    const company = settings.companyName || 'Vizag Jagan Travels';
    const supportPhone = settings.supportPhone || '+91 891 274 8800';
    const supportEmail = settings.supportEmail || DEFAULT_ADMIN_EMAIL;
    const replySubject = params.subject.trim() || `Re: ${enquiry.subject}`;
    const safeReplyHtml = escapeHtml(params.replyMessage).replace(/\r?\n/g, '<br/>');

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
        <div style="background:#102a43;color:#ffffff;padding:20px 24px;">
          <h2 style="margin:0;font-size:18px;">${escapeHtml(company)}</h2>
          <p style="margin:5px 0 0;font-size:13px;color:#cbd5e1;">Response to Your Travel Enquiry</p>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 12px;font-size:15px;color:#0f172a;">Dear <strong>${escapeHtml(enquiry.name)}</strong>,</p>
          <div style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#1e293b;">
            ${safeReplyHtml}
          </div>
          <div style="background:#f8fafc;border-left:3px solid #2563EB;padding:12px 14px;margin:16px 0;font-size:12px;color:#475569;">
            <div style="font-weight:700;color:#102a43;margin-bottom:4px;">Your Original Enquiry (${escapeHtml(enquiry.subject)}):</div>
            <div>${escapeHtml(enquiry.message)}</div>
          </div>
          <p style="margin:16px 0 0;font-size:13px;color:#475569;">
            Need immediate assistance? Call our 24/7 dispatch desk at <strong>${escapeHtml(supportPhone)}</strong> or reply to <strong>${escapeHtml(supportEmail)}</strong>.
          </p>
        </div>
      </div>
    `;

    const result = await resend.emails.send({
      from: resolveFromEmail(settings),
      to: [enquiry.email],
      replyTo: supportEmail,
      subject: replySubject,
      html,
    });

    const prevMeta = enquiry.emailNotifications || {};
    if (result.error) {
      await db.updateOneById('enquiries', enquiry.id, {
        emailNotifications: { ...prevMeta, lastError: result.error.message },
      });
      return { sent: false, error: result.error.message };
    }

    const nowIso = new Date().toISOString();
    const updated = await db.updateOneById('enquiries', enquiry.id, {
      status: 'Replied',
      repliedAt: nowIso,
      repliedByEmail: params.adminEmail,
      lastReplySubject: replySubject,
      lastReplyMessage: params.replyMessage.trim().slice(0, 2000),
      emailNotifications: {
        ...prevMeta,
        lastReplySentAt: nowIso,
        lastError: undefined,
      },
      updatedAt: nowIso,
    });

    return { sent: true, enquiry: updated };
  } catch (err) {
    console.warn('[Email] sendEnquiryReplyEmail exception:', (err as Error).message);
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

export async function dispatchBookingCompletedFeedbackEmail(
  bookingId: string,
  baseUrl?: string
): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  const lockKey = `completed-feedback:${bookingId}`;
  if (inFlightNotifications.has(lockKey)) {
    return { sent: false, skipped: true };
  }
  inFlightNotifications.add(lockKey);

  try {
    const [bookings, settings] = await Promise.all([db.getAll('bookings'), db.getSettings()]);
    const booking = bookings.find((b) => b.id === bookingId);
    if (
      !booking ||
      booking.bookingStatus !== 'Completed' ||
      booking.feedbackSubmittedAt ||
      !booking.customerEmail?.includes('@')
    ) {
      return { sent: false, skipped: true };
    }

    const prevMeta = booking.emailNotifications || {};
    if (prevMeta.lastStatusNotified === 'Completed') {
      return { sent: false, skipped: true };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const feedbackTokenHash = hashAdminActionToken(rawToken);
    const feedbackTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const origin = sanitizeBaseUrl(baseUrl);
    const feedbackUrl = `${origin}/?feedback=${rawToken}`;

    await db.updateOneById('bookings', booking.id, {
      feedbackTokenHash,
      feedbackTokenExpiresAt,
    });

    const resend = getResendClient();
    if (!resend) {
      return { sent: false, error: 'RESEND_API_KEY is not configured in server environment' };
    }

    const company = settings.companyName || 'Vizag Jagan Travels';
    const supportPhone = settings.supportPhone || '+91 891 274 8800';
    const pdf = generateBookingInvoicePdfBuffer(booking, settings);

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
        <div style="background:#102a43;color:#ffffff;padding:22px 24px;">
          <h2 style="margin:0;font-size:19px;">Thank You for Travelling with ${escapeHtml(company)}</h2>
          <p style="margin:5px 0 0;font-size:13px;color:#cbd5e1;">Trip Completed · Booking #${escapeHtml(booking.bookingCode)}</p>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 12px;font-size:15px;color:#0f172a;">Dear <strong>${escapeHtml(booking.customerName)}</strong>,</p>
          <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#334155;">
            Your trip in <strong>${escapeHtml(booking.vehicleName)}</strong> (${escapeHtml(booking.pickupLocation)} &rarr; ${escapeHtml(booking.dropLocation)}) has been marked <strong>Completed</strong>. We would love to hear how your journey went—your verified review publishes directly to our website!
          </p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;">
            <tr>
              <td bgcolor="#2563EB" style="border-radius:6px;background-color:#2563EB;">
                <a href="${escapeHtml(feedbackUrl)}" target="_blank" rel="noopener noreferrer"
                   style="display:inline-block;padding:13px 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:6px;background-color:#2563EB;">
                  Rate &amp; Review Your Trip
                </a>
              </td>
            </tr>
          </table>
          <p style="margin:0 0 14px;font-size:12px;color:#64748b;">
            Your final trip PDF invoice is also attached for your records. Need anything else? Call <strong>${escapeHtml(supportPhone)}</strong>.
          </p>
        </div>
      </div>
    `;

    const result = await resend.emails.send({
      from: resolveFromEmail(settings),
      to: [booking.customerEmail],
      subject: `Trip Completed · Share Feedback for #${booking.bookingCode} · ${company}`,
      html,
      attachments: [{ filename: pdf.filename, content: pdf.content }],
    });

    if (result.error) {
      await db.updateOneById('bookings', booking.id, {
        emailNotifications: { ...prevMeta, lastError: result.error.message },
      });
      return { sent: false, error: result.error.message };
    }

    const nowIso = new Date().toISOString();
    await db.updateOneById('bookings', booking.id, {
      emailNotifications: {
        ...prevMeta,
        invoiceGeneratedAt: prevMeta.invoiceGeneratedAt || nowIso,
        lastStatusNotified: 'Completed',
        lastStatusNotifiedAt: nowIso,
        lastError: undefined,
      },
    });

    return { sent: true };
  } catch (err) {
    console.warn('[Email] dispatchBookingCompletedFeedbackEmail error:', (err as Error).message);
    return { sent: false, error: (err as Error).message };
  } finally {
    inFlightNotifications.delete(lockKey);
  }
}

