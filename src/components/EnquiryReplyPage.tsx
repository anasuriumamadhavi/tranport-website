import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MessageSquare,
  Phone,
  Send,
  Shield,
  User,
  XCircle,
} from 'lucide-react';
import { Enquiry, UserProfile } from '../types';
import { apiFetch } from '../lib/api';

interface EnquiryReplyPageProps {
  replyToken: string;
  user: UserProfile | null;
  token: string | null;
  onAdminAuthenticated: (token: string, user: UserProfile) => void;
  onLogout: () => void;
  onOpenDashboard: () => void;
  onExit: () => void;
}

interface LinkCheckResponse {
  status: 'ready' | 'used' | 'expired' | 'invalid';
  expiresAt?: string;
  message: string;
}

interface EnquiryPreviewResponse {
  targetType: 'enquiry';
  expiresAt: string;
  isExpired: boolean;
  isUsed: boolean;
  usedByEmail?: string;
  enquiry: Enquiry;
}

interface ReplySubmitResponse {
  sent: boolean;
  enquiry: Enquiry | null;
  message: string;
}

function sanitizeTelHref(phone: string): string | null {
  const cleaned = phone.replace(/[^+\d]/g, '');
  return cleaned.length >= 6 ? `tel:${cleaned}` : null;
}

export const EnquiryReplyPage: React.FC<EnquiryReplyPageProps> = ({
  replyToken,
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

  const [preview, setPreview] = useState<EnquiryPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [replySubject, setReplySubject] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<ReplySubmitResponse | null>(null);

  useEffect(() => {
    setCheckingLink(true);
    apiFetch<LinkCheckResponse>(
      `/api/admin/enquiry-reply/check?token=${encodeURIComponent(replyToken)}`
    )
      .then((res) => setLinkCheck(res))
      .catch((err) =>
        setLinkCheck({
          status: 'invalid',
          message: (err as Error).message || 'Invalid or unknown enquiry reply link.',
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
  }, [replyToken]);

  useEffect(() => {
    if (!token || user?.role !== 'admin') {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    apiFetch<EnquiryPreviewResponse>(
      `/api/admin/enquiry-reply/preview?token=${encodeURIComponent(replyToken)}`,
      {},
      token
    )
      .then((res) => {
        setPreview(res);
        setReplySubject(`Re: ${res.enquiry.subject}`);
      })
      .catch((err) => setPreviewError((err as Error).message))
      .finally(() => setPreviewLoading(false));
  }, [replyToken, token, user?.role]);

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

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || user?.role !== 'admin' || !preview?.enquiry) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await apiFetch<ReplySubmitResponse>(
        `/api/admin/enquiries/${encodeURIComponent(preview.enquiry.id)}/reply`,
        {
          method: 'POST',
          body: JSON.stringify({
            subject: replySubject,
            replyMessage,
            actionToken: replyToken,
          }),
        },
        token
      );
      setSendResult(res);
      setPreview((prev) =>
        prev
          ? {
              ...prev,
              isUsed: true,
              enquiry: res.enquiry ?? { ...prev.enquiry, status: 'Replied' },
            }
          : prev
      );
    } catch (err) {
      setSendError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const enquiry = preview?.enquiry;
  const hasValidCustomerEmail = Boolean(
    enquiry?.email?.includes('@') && enquiry.email !== 'not-provided@vizagjagantravels.com'
  );
  const telHref = enquiry ? sanitizeTelHref(enquiry.phone) : null;

  return (
    <section className="py-12 bg-[#F5F7FA] min-h-[82vh]">
      <div className="max-w-2xl mx-auto px-4 space-y-5">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[#102A43]">
                  Customer Enquiry Reply Desk
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Administrator-verified customer response · Vizag Jagan Travels
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
              Validating enquiry reply link...
            </div>
          ) : linkCheck?.status === 'invalid' ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-900">Invalid Enquiry Reply Link</p>
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
                    Customer accounts cannot view or reply to customer enquiries.
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
                  <p className="font-semibold">Enquiry Response Verification</p>
                  <p className="mt-0.5">{linkCheck.message}</p>
                </div>
              )}

              {setupRequired ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-2">
                  <p className="font-bold">First-Run Admin Setup Required</p>
                  <p>
                    Open Login → Admin Console first to set up administrator credentials, then
                    reopen this enquiry reply link.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleAdminSignIn} className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#102A43]">
                    <Lock className="w-4 h-4 text-[#2563EB]" />
                    <span>Sign In with Administrator Credentials to Reply</span>
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
                    {authLoading ? 'Verifying Administrator...' : 'Verify Admin Login & Open Reply Form'}
                  </button>
                </form>
              )}
            </div>
          ) : previewLoading ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Loading enquiry details from MongoDB...
            </div>
          ) : previewError ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-3">
              <p className="font-bold">{previewError}</p>
              <button
                type="button"
                onClick={onOpenDashboard}
                className="px-4 py-2 bg-[#102A43] text-white rounded-lg font-semibold cursor-pointer"
              >
                Open Admin Dashboard
              </button>
            </div>
          ) : enquiry ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F5F7FA] border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-700" />
                  Signed in as <strong className="text-[#102A43]">{user.email}</strong>
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded font-semibold ${
                    enquiry.status === 'New'
                      ? 'bg-blue-100 text-blue-800'
                      : enquiry.status === 'Replied'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-800'
                  }`}
                >
                  Status: {enquiry.status}
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase">
                      {enquiry.source} · {enquiry.createdAt.slice(0, 10)}
                    </p>
                    <p className="text-sm font-bold text-[#102A43]">{enquiry.subject}</p>
                  </div>
                  {telHref && (
                    <a
                      href={telHref}
                      className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      Call Customer ({enquiry.phone})
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-700">
                  <p className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <strong>{enquiry.name}</strong>
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{enquiry.phone}</span>
                  </p>
                  <p className="flex items-center gap-2 sm:col-span-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{hasValidCustomerEmail ? enquiry.email : 'Email not provided'}</span>
                  </p>
                </div>

                <div className="p-3 bg-[#F5F7FA] border border-slate-200 rounded-lg text-xs text-slate-700 leading-relaxed">
                  <p className="font-semibold text-[#102A43] mb-1">Original Customer Message:</p>
                  <p>{enquiry.message}</p>
                </div>
              </div>

              {sendResult ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                    <div className="text-xs text-emerald-950 space-y-1">
                      <p className="text-sm font-bold">{sendResult.message}</p>
                      <p>Enquiry status is now marked Replied in MongoDB and the Admin Dashboard.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenDashboard}
                    className="w-full py-2.5 px-4 bg-[#102A43] hover:bg-[#1a3c5e] text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Open Enquiries in Admin Dashboard
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : preview?.isUsed || preview?.isExpired ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-950 space-y-1">
                      <p className="text-sm font-bold">
                        {preview.isExpired
                          ? 'This email reply link has expired.'
                          : 'A reply has already been dispatched using this link.'}
                      </p>
                      {enquiry.lastReplyMessage && (
                        <p className="text-slate-700 mt-1">
                          <strong>Last Sent Reply:</strong> {enquiry.lastReplyMessage}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenDashboard}
                    className="w-full py-2.5 px-4 bg-[#102A43] hover:bg-[#1a3c5e] text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Open Admin Dashboard for Follow-ups
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : !hasValidCustomerEmail ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3 text-xs text-amber-950">
                  <p className="font-bold">Customer did not provide an email address</p>
                  <p>Please use the Call Customer button above to respond by phone, or manage status from the Admin Dashboard.</p>
                  <button
                    type="button"
                    onClick={onOpenDashboard}
                    className="px-4 py-2 bg-[#102A43] text-white font-semibold rounded-lg cursor-pointer"
                  >
                    Open Admin Dashboard
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSendReply} className="space-y-4 border-t border-slate-100 pt-4">
                  <h2 className="text-sm font-bold text-[#102A43]">Send Custom Email Reply</h2>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Customer Email (To)
                    </label>
                    <input
                      type="email"
                      readOnly
                      value={enquiry.email}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Email Subject
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={180}
                      value={replySubject}
                      onChange={(e) => setReplySubject(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg text-[#102A43]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Your Reply Message
                    </label>
                    <textarea
                      required
                      rows={5}
                      maxLength={4000}
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Write your personalized response, fare quotation, or vehicle availability details..."
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg text-[#102A43]"
                    />
                  </div>

                  {sendError && (
                    <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                      {sendError}
                    </p>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="submit"
                      disabled={sending}
                      className="flex-1 py-2.5 px-5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      <Send className="w-4 h-4" />
                      {sending ? 'Sending Reply...' : 'Send Reply to Customer'}
                    </button>
                    <button
                      type="button"
                      onClick={onOpenDashboard}
                      className="py-2.5 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-[#102A43] text-sm font-semibold rounded-lg cursor-pointer"
                    >
                      Open Dashboard
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};
