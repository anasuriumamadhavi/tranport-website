import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  Phone,
  Shield,
  User,
  XCircle,
} from 'lucide-react';
import { Booking, Enquiry, UserProfile } from '../types';
import { apiFetch, formatINR } from '../lib/api';

interface AdminActionPageProps {
  actionToken: string;
  user: UserProfile | null;
  token: string | null;
  onAdminAuthenticated: (token: string, user: UserProfile) => void;
  onLogout: () => void;
  onOpenDashboard: (preferredTab: 'bookings' | 'enquiries') => void;
  onExit: () => void;
}

interface LinkCheckResponse {
  status: 'ready' | 'used' | 'expired' | 'invalid';
  targetType?: 'booking' | 'enquiry';
  action?: 'confirm' | 'reject';
  expiresAt?: string;
  message: string;
}

interface ActionPreviewResponse {
  targetType: 'booking' | 'enquiry';
  action: 'confirm' | 'reject';
  expiresAt: string;
  isExpired: boolean;
  isUsed: boolean;
  alreadyProcessed: boolean;
  decisionResult?: string;
  usedByEmail?: string;
  conflictError?: string | null;
  booking?: Booking;
  enquiry?: Enquiry;
}

interface ActionExecuteResponse {
  executed: boolean;
  targetType: 'booking' | 'enquiry';
  action: 'confirm' | 'reject';
  booking?: Booking;
  enquiry?: Enquiry;
  message: string;
  emailStatus?: {
    sent?: boolean;
    adminSent?: boolean;
    error?: string;
  } | null;
}

export const AdminActionPage: React.FC<AdminActionPageProps> = ({
  actionToken,
  user,
  token,
  onAdminAuthenticated,
  onLogout,
  onOpenDashboard,
  onExit,
}) => {
  const [linkCheck, setLinkCheck] = useState<LinkCheckResponse | null>(null);
  const [checkingLink, setCheckingLink] = useState(true);

  const [envPasscodeConfigured, setEnvPasscodeConfigured] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [maskedAdminEmail, setMaskedAdminEmail] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [preview, setPreview] = useState<ActionPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [executing, setExecuting] = useState(false);
  const [executeError, setExecuteError] = useState<string | null>(null);
  const [executeResult, setExecuteResult] = useState<ActionExecuteResponse | null>(null);

  useEffect(() => {
    setCheckingLink(true);
    apiFetch<LinkCheckResponse>(
      `/api/admin/action-links/check?token=${encodeURIComponent(actionToken)}`
    )
      .then((res) => setLinkCheck(res))
      .catch((err) =>
        setLinkCheck({
          status: 'invalid',
          message: (err as Error).message || 'Invalid or unknown action link.',
        })
      )
      .finally(() => setCheckingLink(false));

    apiFetch<{
      setupRequired: boolean;
      envPasscodeConfigured: boolean;
      maskedAdminEmail?: string | null;
    }>('/api/auth/admin/status')
      .then((res) => {
        setSetupRequired(res.setupRequired);
        setEnvPasscodeConfigured(res.envPasscodeConfigured);
        setMaskedAdminEmail(res.maskedAdminEmail || null);
      })
      .catch(() => {});
  }, [actionToken]);

  useEffect(() => {
    if (!token || user?.role !== 'admin') {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    apiFetch<ActionPreviewResponse>(
      `/api/admin/action-links/preview?token=${encodeURIComponent(actionToken)}`,
      {},
      token
    )
      .then((res) => setPreview(res))
      .catch((err) => setPreviewError((err as Error).message))
      .finally(() => setPreviewLoading(false));
  }, [actionToken, token, user?.role]);

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      onAdminAuthenticated(res.token, res.user);
      setPassword('');
    } catch (err) {
      setAuthError((err as Error).message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleExecuteAction = async () => {
    if (!token || user?.role !== 'admin') return;
    setExecuting(true);
    setExecuteError(null);
    try {
      const res = await apiFetch<ActionExecuteResponse>(
        '/api/admin/action-links/execute',
        {
          method: 'POST',
          body: JSON.stringify({ token: actionToken }),
        },
        token
      );
      setExecuteResult(res);
      setPreview((prev) =>
        prev
          ? {
              ...prev,
              isUsed: true,
              alreadyProcessed: true,
              booking: res.booking ?? prev.booking,
              enquiry: res.enquiry ?? prev.enquiry,
            }
          : prev
      );
    } catch (err) {
      setExecuteError((err as Error).message);
    } finally {
      setExecuting(false);
    }
  };

  const targetTab: 'bookings' | 'enquiries' =
    (executeResult?.targetType || preview?.targetType || linkCheck?.targetType) === 'enquiry'
      ? 'enquiries'
      : 'bookings';

  const isConfirmAction =
    (preview?.action || linkCheck?.action) === 'confirm';

  return (
    <section className="py-12 bg-[#F5F7FA] min-h-[82vh]">
      <div className="max-w-2xl mx-auto px-4 space-y-5">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[#102A43]">
                  Secure Dispatch Action Verification
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Single-use administrator approval &amp; rejection workflow · Vizag Jagan Travels
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onExit}
              className="text-xs font-semibold text-slate-500 hover:text-[#102A43] cursor-pointer"
            >
              Back to Home
            </button>
          </div>

          {checkingLink ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Validating secure action link...
            </div>
          ) : linkCheck?.status === 'invalid' ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-900">Invalid Action Link</p>
                <p className="text-xs text-red-700 mt-1">{linkCheck.message}</p>
              </div>
            </div>
          ) : user && user.role !== 'admin' ? (
            <div className="p-5 bg-red-50 border border-red-200 rounded-lg space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-900">
                    Access Denied · Administrator Permission Required
                  </p>
                  <p className="text-xs text-red-800 mt-1">
                    You are currently signed in as <strong>{user.email}</strong> (Customer role).
                    Customer accounts cannot confirm or reject bookings or enquiries.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="px-4 py-2 bg-[#102A43] hover:bg-[#1a3c5e] text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Sign Out &amp; Sign In as Administrator
              </button>
            </div>
          ) : !token || !user ? (
            <div className="space-y-4">
              {linkCheck && (
                <div
                  className={`p-3.5 rounded-lg border text-xs ${
                    linkCheck.status === 'ready'
                      ? 'bg-blue-50/70 border-blue-200 text-[#102A43]'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <p className="font-semibold">
                    Requested Action:{' '}
                    <span className="uppercase">
                      {linkCheck.action} {linkCheck.targetType}
                    </span>
                  </p>
                  <p className="mt-0.5">{linkCheck.message}</p>
                </div>
              )}

              {setupRequired ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-2">
                  <p className="font-bold">First-Run Admin Setup Required</p>
                  <p>
                    No administrator account has been claimed yet. Open Login → Admin Console first
                    to set up your administrator credentials, then reopen this action link.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleAdminSignIn} className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#102A43]">
                    <Lock className="w-4 h-4 text-[#2563EB]" />
                    <span>Sign In with Administrator Credentials to Continue</span>
                  </div>

                  {maskedAdminEmail && !envPasscodeConfigured && (
                    <p className="text-xs text-slate-600 bg-[#F5F7FA] border border-slate-200 rounded-lg px-3 py-2">
                      Registered Admin Account:{' '}
                      <span className="font-mono font-semibold text-[#102A43]">
                        {maskedAdminEmail}
                      </span>
                    </p>
                  )}

                  {!envPasscodeConfigured && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Administrator Email
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="jagantravelsvizag@gmail.com"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg text-[#102A43]"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      {envPasscodeConfigured ? 'Admin Passcode' : 'Administrator Password'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 pr-10 text-sm border border-slate-200 rounded-lg text-[#102A43]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-[#102A43] cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {authError && (
                    <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                      {authError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-2.5 px-4 bg-[#102A43] hover:bg-[#1a3c5e] text-white text-sm font-semibold rounded-lg cursor-pointer disabled:opacity-60"
                  >
                    {authLoading ? 'Verifying Administrator...' : 'Verify Admin Login & Review'}
                  </button>
                </form>
              )}
            </div>
          ) : previewLoading ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Loading record details from MongoDB...
            </div>
          ) : previewError ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-3">
              <p className="font-bold">{previewError}</p>
              <button
                type="button"
                onClick={() => onOpenDashboard(targetTab)}
                className="px-4 py-2 bg-[#102A43] text-white rounded-lg font-semibold cursor-pointer"
              >
                Open Admin Dashboard
              </button>
            </div>
          ) : preview ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F5F7FA] border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs">
                <span className="text-slate-600">
                  Signed in as <strong className="text-[#102A43]">{user.email}</strong> (Role:{' '}
                  <strong className="uppercase text-emerald-700">{user.role}</strong>)
                </span>
                <span
                  className={`px-2 py-0.5 rounded font-semibold ${
                    isConfirmAction
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  Action: {preview.action === 'confirm' ? 'Confirm' : 'Reject'}{' '}
                  {preview.targetType === 'booking' ? 'Booking' : 'Enquiry'}
                </span>
              </div>

              {preview.targetType === 'booking' && preview.booking && (
                <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 uppercase">Booking ID</p>
                      <p className="text-base font-mono font-bold text-[#102A43]">
                        {preview.booking.bookingCode}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase">
                        Current Status
                      </p>
                      <span className="inline-block mt-0.5 px-2.5 py-0.5 rounded text-xs font-bold bg-slate-100 text-[#102A43]">
                        {preview.booking.bookingStatus}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
                    <div className="flex items-start gap-2">
                      <User className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-[#102A43]">{preview.booking.customerName}</p>
                        <p className="text-slate-500">{preview.booking.passengerCount} Passengers</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <p>{preview.booking.customerPhone}</p>
                        <p className="text-slate-500">{preview.booking.customerEmail}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 sm:col-span-2">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <p>
                        <strong className="text-[#102A43]">{preview.booking.pickupLocation}</strong>{' '}
                        → <strong className="text-[#102A43]">{preview.booking.dropLocation}</strong>
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Calendar className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <p>
                        {preview.booking.journeyDate} at {preview.booking.journeyTime} ·{' '}
                        {preview.booking.tripType}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-semibold text-[#102A43]">
                        {preview.booking.vehicleName} ({preview.booking.vehicleCategory})
                      </p>
                      <p className="font-bold text-sm text-[#102A43] tabular-nums">
                        Total: {formatINR(preview.booking.totalFare)} ({preview.booking.paymentStatus})
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {preview.targetType === 'enquiry' && preview.enquiry && (
                <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 uppercase">Enquiry</p>
                      <p className="text-sm font-bold text-[#102A43]">{preview.enquiry.subject}</p>
                      <p className="text-[11px] font-mono text-slate-500">{preview.enquiry.id}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase">
                        Current Status
                      </p>
                      <span className="inline-block mt-0.5 px-2.5 py-0.5 rounded text-xs font-bold bg-slate-100 text-[#102A43]">
                        {preview.enquiry.status}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-700">
                    <p className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <strong>{preview.enquiry.name}</strong> · {preview.enquiry.source}
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {preview.enquiry.phone}
                    </p>
                    <p className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {preview.enquiry.email}
                    </p>
                    <div className="mt-2 p-3 bg-[#F5F7FA] rounded-lg text-slate-700">
                      {preview.enquiry.message}
                    </div>
                  </div>
                </div>
              )}

              {executeResult ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                    <div className="text-xs text-emerald-950 space-y-1">
                      <p className="text-sm font-bold">{executeResult.message}</p>
                      {executeResult.emailStatus?.error && (
                        <p className="text-amber-800">
                          Status saved in MongoDB. Email note: {executeResult.emailStatus.error}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenDashboard(targetTab)}
                    className="w-full py-2.5 px-4 bg-[#102A43] hover:bg-[#1a3c5e] text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Open Admin Dashboard
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : preview.alreadyProcessed || preview.isExpired || preview.isUsed ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-950 space-y-1">
                      <p className="text-sm font-bold">
                        {preview.isExpired
                          ? 'This action link has expired.'
                          : 'Action Already Completed · Duplicate Action Blocked'}
                      </p>
                      <p>
                        {preview.targetType === 'booking' && preview.booking
                          ? `Booking #${preview.booking.bookingCode} is currently ${preview.booking.bookingStatus}.`
                          : preview.targetType === 'enquiry' && preview.enquiry
                          ? `This enquiry is currently ${preview.enquiry.status}.`
                          : 'This single-use link can no longer be executed.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenDashboard(targetTab)}
                    className="w-full py-2.5 px-4 bg-[#102A43] hover:bg-[#1a3c5e] text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Open Admin Dashboard
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {preview.conflictError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 font-medium">
                      {preview.conflictError}
                    </div>
                  )}
                  {executeError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 font-medium">
                      {executeError}
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      disabled={executing || Boolean(preview.conflictError)}
                      onClick={() => void handleExecuteAction()}
                      className={`flex-1 py-3 px-5 text-white text-sm font-semibold rounded-lg cursor-pointer disabled:opacity-50 ${
                        isConfirmAction
                          ? 'bg-emerald-700 hover:bg-emerald-800'
                          : 'bg-red-700 hover:bg-red-800'
                      }`}
                    >
                      {executing
                        ? 'Processing & Sending Notification...'
                        : preview.targetType === 'booking'
                        ? isConfirmAction
                          ? 'Confirm Booking & Send PDF Invoice'
                          : 'Reject Booking & Notify Customer'
                        : isConfirmAction
                        ? 'Confirm Enquiry & Notify Customer'
                        : 'Reject Enquiry & Notify Customer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenDashboard(targetTab)}
                      className="py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-[#102A43] text-sm font-semibold rounded-lg cursor-pointer"
                    >
                      Open Dashboard
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};
