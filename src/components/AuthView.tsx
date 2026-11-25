import React, { useEffect, useState } from 'react';
import { Lock, Shield, UserCheck } from 'lucide-react';
import { UserProfile } from '../types';
import { apiFetch } from '../lib/api';

interface AuthViewProps {
  onAuthenticated: (token: string, user: UserProfile) => void;
  onTrackGuestBooking: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  onAuthenticated,
  onTrackGuestBooking,
}) => {
  const [mode, setMode] = useState<'customer-login' | 'customer-register' | 'admin'>('customer-login');
  const [adminSetupRequired, setAdminSetupRequired] = useState(false);
  const [envPasscodeConfigured, setEnvPasscodeConfigured] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<{ setupRequired: boolean; envPasscodeConfigured: boolean }>('/api/auth/admin/status')
      .then((res) => {
        setAdminSetupRequired(res.setupRequired);
        setEnvPasscodeConfigured(res.envPasscodeConfigured);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'customer-login') {
        const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        onAuthenticated(res.token, res.user);
      } else if (mode === 'customer-register') {
        const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, phone, password }),
        });
        onAuthenticated(res.token, res.user);
      } else if (mode === 'admin' && adminSetupRequired) {
        const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/admin/setup', {
          method: 'POST',
          body: JSON.stringify({ name: name || 'Fleet Administrator', email, password }),
        });
        setAdminSetupRequired(false);
        onAuthenticated(res.token, res.user);
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

  return (
    <section className="py-14 bg-[#F5F7FA] min-h-[82vh] flex items-center">
      <div className="max-w-md w-full mx-auto px-4">
        <div className="bg-white border border-slate-200 rounded-xl p-7 shadow-sm">
          <div className="flex items-center gap-1 p-1 bg-[#F5F7FA] rounded-lg mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('customer-login');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md cursor-pointer transition-colors ${
                mode === 'customer-login' ? 'bg-white text-[#102A43] shadow-xs' : 'text-slate-600'
              }`}
            >
              Customer Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('customer-register');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md cursor-pointer transition-colors ${
                mode === 'customer-register' ? 'bg-white text-[#102A43] shadow-xs' : 'text-slate-600'
              }`}
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('admin');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md cursor-pointer transition-colors ${
                mode === 'admin' ? 'bg-white text-[#102A43] shadow-xs' : 'text-slate-600'
              }`}
            >
              Admin Console
            </button>
          </div>

          <div className="mb-5">
            <h1 className="text-xl font-bold text-[#102A43] flex items-center gap-2">
              {mode === 'admin' ? (
                <Shield className="w-5 h-5 text-[#2563EB]" />
              ) : mode === 'customer-register' ? (
                <UserCheck className="w-5 h-5 text-[#2563EB]" />
              ) : (
                <Lock className="w-5 h-5 text-[#2563EB]" />
              )}
              {mode === 'customer-login' && 'Sign In to Your Account'}
              {mode === 'customer-register' && 'Create Passenger Account'}
              {mode === 'admin' &&
                (adminSetupRequired ? 'First-Run Admin Account Setup' : 'Fleet Operations Admin Sign In')}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {mode === 'admin' && adminSetupRequired
                ? 'Claim your administrator credentials to unlock fleet, pricing, driver, and booking management.'
                : mode === 'admin' && envPasscodeConfigured
                ? 'Enter your configured administrator passcode to access the operations dashboard.'
                : 'Access live trip updates, Razorpay receipts, and downloadable invoices.'}
            </p>
          </div>

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
                <label className="block text-xs font-medium text-slate-600 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg text-[#102A43]"
                />
              </div>
            )}

            {mode === 'customer-register' && (
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
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {mode === 'admin' && envPasscodeConfigured
                  ? 'Admin Passcode'
                  : mode === 'admin' && adminSetupRequired
                  ? 'Create Admin Password (min 6 chars)'
                  : 'Password'}
              </label>
              <input
                type="password"
                required
                minLength={mode === 'admin' && envPasscodeConfigured ? 1 : 6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg text-[#102A43]"
              />
            </div>

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
                : mode === 'admin' && adminSetupRequired
                ? 'Claim Admin Access'
                : 'Sign In'}
            </button>
          </form>

          {mode !== 'admin' && (
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
