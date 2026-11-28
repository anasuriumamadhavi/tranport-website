import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Shield,
  UserCheck,
} from 'lucide-react';
import { UserProfile } from '../types';
import { apiFetch } from '../lib/api';

interface AuthViewProps {
  onAuthenticated: (token: string, user: UserProfile) => void;
  onTrackGuestBooking: () => void;
}

type AuthMode =
  | 'customer-login'
  | 'customer-register'
  | 'customer-forgot'
  | 'admin'
  | 'admin-forgot';

type CustomerVerifyType = 'email_otp' | 'pin' | 'booking' | 'reset_code';
type AdminVerifyType = 'email_otp' | 'recovery_key';

export const AuthView: React.FC<AuthViewProps> = ({
  onAuthenticated,
  onTrackGuestBooking,
}) => {
  const [mode, setMode] = useState<AuthMode>('customer-login');
  const [adminSetupRequired, setAdminSetupRequired] = useState(false);
  const [envPasscodeConfigured, setEnvPasscodeConfigured] = useState(false);
  const [maskedAdminEmail, setMaskedAdminEmail] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryPin, setRecoveryPin] = useState('');
  const [customRecoveryKey, setCustomRecoveryKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password states
  const [verifyType, setVerifyType] = useState<CustomerVerifyType>('email_otp');
  const [adminVerifyType, setAdminVerifyType] = useState<AdminVerifyType>('email_otp');
  const [resetCode, setResetCode] = useState('');
  const [bookingCode, setBookingCode] = useState('');
  const [adminRecoveryProof, setAdminRecoveryProof] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);

  // First-run admin setup one-time recovery key display
  const [pendingAdminSession, setPendingAdminSession] = useState<{
    token: string;
    user: UserProfile;
    recoveryKey: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadAdminStatus = () => {
    apiFetch<{
      setupRequired: boolean;
      envPasscodeConfigured: boolean;
      hasClaimedAdmin?: boolean;
      maskedAdminEmail?: string | null;
    }>('/api/auth/admin/status')
      .then((res) => {
        setAdminSetupRequired(res.setupRequired);
        setEnvPasscodeConfigured(res.envPasscodeConfigured);
        setMaskedAdminEmail(res.maskedAdminEmail || null);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadAdminStatus();
  }, []);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    setPassword('');
    setConfirmPassword('');
    setResetCode('');
    setSendingOtp(false);
  };

  const handleCopyKey = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      // clipboard blocked fallback
    }
  };

  const handleRequestEmailOtp = async (role: 'customer' | 'admin') => {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter your registered email address first.');
      return;
    }
    setError(null);
    setNotice(null);
    setSendingOtp(true);
    try {
      const endpoint =
        role === 'admin'
          ? '/api/auth/admin/forgot-password/request-code'
          : '/api/auth/forgot-password/request-code';
      const res = await apiFetch<{ message: string }>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setNotice(res.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      if (mode === 'customer-login') {
        const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        onAuthenticated(res.token, res.user);
      } else if (mode === 'customer-register') {
        if (recoveryPin && recoveryPin.trim().length < 4) {
          throw new Error('Recovery PIN must be at least 4 characters (or leave blank to set later).');
        }
        const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            name,
            email,
            phone,
            password,
            ...(recoveryPin.trim() ? { recoveryPin: recoveryPin.trim() } : {}),
          }),
        });
        onAuthenticated(res.token, res.user);
      } else if (mode === 'customer-forgot') {
        if (password.length < 6) {
          throw new Error('New password must be at least 6 characters.');
        }
        if (password !== confirmPassword) {
          throw new Error('New password and confirmation do not match.');
        }
        const res = await apiFetch<{ message: string }>('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({
            email,
            verificationType: verifyType,
            recoveryPin: verifyType === 'pin' ? recoveryPin : undefined,
            resetCode: verifyType === 'reset_code' || verifyType === 'email_otp' ? resetCode : undefined,
            phone: verifyType === 'booking' ? phone : undefined,
            bookingCode: verifyType === 'booking' ? bookingCode : undefined,
            newPassword: password,
          }),
        });
        switchMode('customer-login');
        setNotice(res.message);
      } else if (mode === 'admin' && adminSetupRequired) {
        if (customRecoveryKey.trim() && customRecoveryKey.trim().length < 6) {
          throw new Error('Custom Recovery Key must be at least 6 characters (or leave blank to auto-generate).');
        }
        const res = await apiFetch<{ token: string; user: UserProfile; recoveryKey?: string }>(
          '/api/auth/admin/setup',
          {
            method: 'POST',
            body: JSON.stringify({
              name: name || 'Fleet Administrator',
              email,
              password,
              ...(customRecoveryKey.trim() ? { recoveryKey: customRecoveryKey.trim() } : {}),
            }),
          }
        );
        setAdminSetupRequired(false);
        loadAdminStatus();
        if (res.recoveryKey) {
          setPendingAdminSession({
            token: res.token,
            user: res.user,
            recoveryKey: res.recoveryKey,
          });
        } else {
          onAuthenticated(res.token, res.user);
        }
      } else if (mode === 'admin-forgot') {
        if (password.length < 6) {
          throw new Error('New password must be at least 6 characters.');
        }
        if (password !== confirmPassword) {
          throw new Error('New password and confirmation do not match.');
        }
        const res = await apiFetch<{ message: string }>('/api/auth/admin/forgot-password', {
          method: 'POST',
          body: JSON.stringify({
            email,
            verificationType: adminVerifyType,
            recoveryKeyOrPasscode: adminVerifyType === 'recovery_key' ? adminRecoveryProof : undefined,
            resetCode: adminVerifyType === 'email_otp' ? resetCode : undefined,
            newPassword: password,
          }),
        });
        switchMode('admin');
        setNotice(res.message);
      } else {
        const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/admin/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        onAuthenticated(res.token, res.user);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (pendingAdminSession) {
    return (
      <section className="py-14 bg-[#F5F7FA] min-h-[82vh] flex items-center">
        <div className="max-w-md w-full mx-auto px-4">
          <div className="bg-white border border-slate-200 rounded-xl p-7 shadow-sm space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[#102A43]">Admin Account Claimed</h1>
                <p className="text-xs text-slate-600 mt-1">
                  Save your one-time <strong>Admin Recovery Key</strong> below. You will need it if you ever use{' '}
                  <em>Forgot Admin Password</em>. It is not shown again after you leave this screen.
                </p>
              </div>
            </div>

            <div className="bg-[#F5F7FA] border border-slate-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                <span>ADMIN EMAIL</span>
                <span className="font-mono text-[#102A43]">{pendingAdminSession.user.email}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500">ADMIN RECOVERY KEY</p>
                  <p className="text-base font-mono font-bold text-[#102A43] tracking-wider mt-0.5">
                    {pendingAdminSession.recoveryKey}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyKey(pendingAdminSession.recoveryKey)}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-[#102A43] rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onAuthenticated(pendingAdminSession.token, pendingAdminSession.user)}
              className="w-full py-2.5 px-4 bg-[#102A43] hover:bg-[#1a3c5e] text-white text-sm font-semibold rounded-lg cursor-pointer"
            >
              I Have Saved My Recovery Key · Enter Admin Console →
            </button>
          </div>
        </div>
      </section>
    );
  }

  const isCustomerTab =
    mode === 'customer-login' || mode === 'customer-register' || mode === 'customer-forgot';
  const isAdminTab = mode === 'admin' || mode === 'admin-forgot';

  return (
    <section className="py-14 bg-[#F5F7FA] min-h-[82vh] flex items-center">
      <div className="max-w-md w-full mx-auto px-4">
        <div className="bg-white border border-slate-200 rounded-xl p-7 shadow-sm">
          <div className="flex items-center gap-1 p-1 bg-[#F5F7FA] rounded-lg mb-6">
            <button
              type="button"
              onClick={() => switchMode('customer-login')}
              className={`flex-1 py-2 text-xs font-semibold rounded-md cursor-pointer transition-colors ${
                mode === 'customer-login' || mode === 'customer-forgot'
                  ? 'bg-white text-[#102A43] shadow-xs'
                  : 'text-slate-600'
              }`}
            >
              Customer Login
            </button>
            <button
              type="button"
              onClick={() => switchMode('customer-register')}
              className={`flex-1 py-2 text-xs font-semibold rounded-md cursor-pointer transition-colors ${
                mode === 'customer-register' ? 'bg-white text-[#102A43] shadow-xs' : 'text-slate-600'
              }`}
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => switchMode('admin')}
              className={`flex-1 py-2 text-xs font-semibold rounded-md cursor-pointer transition-colors ${
                isAdminTab ? 'bg-white text-[#102A43] shadow-xs' : 'text-slate-600'
              }`}
            >
              Admin Console
            </button>
          </div>

          <div className="mb-5">
            <h1 className="text-xl font-bold text-[#102A43] flex items-center gap-2">
              {isAdminTab ? (
                <Shield className="w-5 h-5 text-[#2563EB]" />
              ) : mode === 'customer-register' ? (
                <UserCheck className="w-5 h-5 text-[#2563EB]" />
              ) : mode === 'customer-forgot' ? (
                <KeyRound className="w-5 h-5 text-[#2563EB]" />
              ) : (
                <Lock className="w-5 h-5 text-[#2563EB]" />
              )}
              {mode === 'customer-login' && 'Sign In to Your Account'}
              {mode === 'customer-register' && 'Create Passenger Account'}
              {mode === 'customer-forgot' && 'Reset Customer Password'}
              {mode === 'admin' &&
                (adminSetupRequired ? 'First-Run Admin Account Setup' : 'Fleet Operations Admin Sign In')}
              {mode === 'admin-forgot' && 'Reset Administrator Password'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {mode === 'admin' && adminSetupRequired
                ? 'Create your administrator login and receive a one-time Recovery Key for future password resets.'
                : mode === 'admin' && envPasscodeConfigured
                ? 'Administrator access is configured via server environment passcode.'
                : mode === 'admin-forgot'
                ? 'Receive a verification code via email or use your Admin Recovery Key to set a new password.'
                : mode === 'customer-forgot'
                ? 'Request a 6-character code to your email or choose another verification method below.'
                : 'Access live trip updates, payment receipts, and downloadable invoices.'}
            </p>
          </div>

          {mode === 'admin' && !adminSetupRequired && !envPasscodeConfigured && maskedAdminEmail && (
            <div className="mb-4 px-3.5 py-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-[#102A43]">
              <span className="font-semibold">Registered Admin Account:</span>{' '}
              <span className="font-mono">{maskedAdminEmail}</span>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Signed-in admins can update email, password & recovery keys under Credentials & Security.
              </p>
            </div>
          )}

          {notice && (
            <div className="mb-4 text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2.5">
              {notice}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {(mode === 'customer-register' || (mode === 'admin' && adminSetupRequired)) && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={mode === 'admin' ? 'Fleet Operations Manager' : 'Your full name'}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg text-[#102A43]"
                />
              </div>
            )}

            {!(mode === 'admin' && envPasscodeConfigured) && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {isAdminTab ? 'Administrator Email' : 'Email Address'}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isAdminTab ? 'jagantravelsvizag@gmail.com' : 'you@domain.com'}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg text-[#102A43]"
                />
              </div>
            )}

            {mode === 'customer-register' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98450 00000"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg text-[#102A43]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Recovery PIN (4–8 digits/chars · Recommended)
                  </label>
                  <input
                    type="text"
                    maxLength={16}
                    value={recoveryPin}
                    onChange={(e) => setRecoveryPin(e.target.value)}
                    placeholder="e.g. 4829 (for self-service password reset)"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg text-[#102A43]"
                  />
                </div>
              </>
            )}

            {mode === 'customer-forgot' && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Verification Method
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-[#F5F7FA] p-1 rounded-lg">
                    {[
                      { id: 'email_otp', label: 'Email OTP' },
                      { id: 'pin', label: 'Recovery PIN' },
                      { id: 'booking', label: 'Booking ID' },
                      { id: 'reset_code', label: 'Desk Code' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setVerifyType(opt.id as CustomerVerifyType);
                          setError(null);
                        }}
                        className={`py-1.5 px-2 text-[11px] font-semibold rounded-md cursor-pointer transition-colors ${
                          verifyType === opt.id
                            ? 'bg-white text-[#102A43] shadow-xs'
                            : 'text-slate-600 hover:text-[#102A43]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {verifyType === 'email_otp' && (
                  <div className="space-y-2.5">
                    <button
                      type="button"
                      disabled={sendingOtp}
                      onClick={() => void handleRequestEmailOtp('customer')}
                      className="w-full py-2 px-3 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-60 transition-colors"
                    >
                      {sendingOtp ? 'Sending Verification Code...' : 'Send 6-Char Code to Email'}
                    </button>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Email Verification Code *
                      </label>
                      <input
                        type="text"
                        required
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value.toUpperCase())}
                        placeholder="Enter 6-char code from your email"
                        className="w-full px-3.5 py-2.5 text-sm font-mono uppercase border border-slate-200 rounded-lg text-[#102A43]"
                      />
                    </div>
                  </div>
                )}

                {verifyType === 'pin' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Account Recovery PIN
                    </label>
                    <input
                      type="text"
                      required
                      value={recoveryPin}
                      onChange={(e) => setRecoveryPin(e.target.value)}
                      placeholder="Enter PIN set at registration or profile"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg text-[#102A43]"
                    />
                  </div>
                )}

                {verifyType === 'booking' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Registered Mobile
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98450..."
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg text-[#102A43]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Booking Ref ID
                      </label>
                      <input
                        type="text"
                        required
                        value={bookingCode}
                        onChange={(e) => setBookingCode(e.target.value.toUpperCase())}
                        placeholder="VF-2026-1042"
                        className="w-full px-3 py-2.5 text-sm font-mono border border-slate-200 rounded-lg text-[#102A43]"
                      />
                    </div>
                  </div>
                )}

                {verifyType === 'reset_code' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      6-Character Dispatch Reset Code
                    </label>
                    <input
                      type="text"
                      required
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value.toUpperCase())}
                      placeholder="6-char code from 24/7 dispatch desk"
                      className="w-full px-3.5 py-2.5 text-sm font-mono uppercase border border-slate-200 rounded-lg text-[#102A43]"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Need a code? Contact our 24/7 dispatch desk and an administrator can issue a 15-minute reset code.
                    </p>
                  </div>
                )}
              </div>
            )}

            {mode === 'admin-forgot' && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Admin Verification Method
                  </label>
                  <div className="grid grid-cols-2 gap-1 bg-[#F5F7FA] p-1 rounded-lg">
                    {[
                      { id: 'email_otp', label: 'Email OTP' },
                      { id: 'recovery_key', label: 'Recovery Key' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setAdminVerifyType(opt.id as AdminVerifyType);
                          setError(null);
                        }}
                        className={`py-1.5 px-2 text-[11px] font-semibold rounded-md cursor-pointer transition-colors ${
                          adminVerifyType === opt.id
                            ? 'bg-white text-[#102A43] shadow-xs'
                            : 'text-slate-600 hover:text-[#102A43]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {adminVerifyType === 'email_otp' ? (
                  <div className="space-y-2.5">
                    <button
                      type="button"
                      disabled={sendingOtp}
                      onClick={() => void handleRequestEmailOtp('admin')}
                      className="w-full py-2 px-3 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-60 transition-colors"
                    >
                      {sendingOtp ? 'Sending Verification Code...' : 'Send 6-Char Code to Admin Email'}
                    </button>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Email Verification Code *
                      </label>
                      <input
                        type="text"
                        required
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value.toUpperCase())}
                        placeholder="Enter 6-char code from admin inbox"
                        className="w-full px-3.5 py-2.5 text-sm font-mono uppercase border border-slate-200 rounded-lg text-[#102A43]"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Admin Recovery Key *
                    </label>
                    <input
                      type="text"
                      required
                      value={adminRecoveryProof}
                      onChange={(e) => setAdminRecoveryProof(e.target.value)}
                      placeholder="VJT-XXXX-XXXX"
                      className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-200 rounded-lg text-[#102A43]"
                    />
                  </div>
                )}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-600">
                  {mode === 'admin' && envPasscodeConfigured
                    ? 'Admin Passcode'
                    : mode === 'admin' && adminSetupRequired
                    ? 'Create Admin Password (min 6 chars)'
                    : mode === 'customer-forgot' || mode === 'admin-forgot'
                    ? 'New Password (min 6 chars)'
                    : 'Password'}
                </label>

                {mode === 'customer-login' && (
                  <button
                    type="button"
                    onClick={() => switchMode('customer-forgot')}
                    className="text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                )}

                {mode === 'admin' && !adminSetupRequired && !envPasscodeConfigured && (
                  <button
                    type="button"
                    onClick={() => switchMode('admin-forgot')}
                    className="text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
                  >
                    Forgot Admin Password?
                  </button>
                )}
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={mode === 'admin' && envPasscodeConfigured ? 1 : 6}
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

            {(mode === 'customer-forgot' || mode === 'admin-forgot') && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Confirm New Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg text-[#102A43]"
                />
              </div>
            )}

            {mode === 'admin' && adminSetupRequired && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Custom Recovery Key (Optional · auto-generated if blank)
                </label>
                <input
                  type="text"
                  value={customRecoveryKey}
                  onChange={(e) => setCustomRecoveryKey(e.target.value)}
                  placeholder="Leave blank to generate VJT-XXXX-XXXX"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg text-[#102A43]"
                />
              </div>
            )}

            {error && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#102A43] hover:bg-[#1a3c5e] text-white text-sm font-semibold rounded-lg cursor-pointer disabled:opacity-60"
            >
              {loading
                ? 'Verifying...'
                : mode === 'customer-register'
                ? 'Create Account'
                : mode === 'customer-forgot' || mode === 'admin-forgot'
                ? 'Verify & Reset Password'
                : mode === 'admin' && adminSetupRequired
                ? 'Claim Admin Access'
                : 'Sign In'}
            </button>

            {(mode === 'customer-forgot' || mode === 'admin-forgot') && (
              <button
                type="button"
                onClick={() => switchMode(mode === 'admin-forgot' ? 'admin' : 'customer-login')}
                className="w-full py-2 text-xs font-semibold text-slate-600 hover:text-[#102A43] inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {mode === 'admin-forgot' ? 'Back to Admin Sign In' : 'Back to Customer Sign In'}
              </button>
            )}
          </form>

          {isCustomerTab && mode !== 'customer-forgot' && (
            <div className="mt-5 pt-4 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={onTrackGuestBooking}
                className="text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
              >
                Booked without an account? Track Booking by ID →
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
