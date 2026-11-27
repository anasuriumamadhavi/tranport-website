import React, { useEffect, useState } from 'react';
import {
  Calendar,
  CreditCard,
  Download,
  FileText,
  HelpCircle,
  Search,
  User,
  X,
} from 'lucide-react';
import { Booking, PaymentRecord, UserProfile, WebsiteSettings } from '../types';
import { apiFetch, formatINR } from '../lib/api';
import { downloadBookingInvoicePdf } from '../lib/invoicePdf';

interface CustomerDashboardProps {
  user: UserProfile | null;
  token: string | null;
  settings?: WebsiteSettings | null;
  onUpdateUser: (user: UserProfile) => void;
  onGoToLogin: () => void;
  onBookNewTrip: () => void;
}

type CustomerTab =
  | 'upcoming'
  | 'history'
  | 'cancellations'
  | 'payments'
  | 'profile'
  | 'support';

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  user,
  token,
  settings,
  onUpdateUser,
  onGoToLogin,
  onBookNewTrip,
}) => {
  const [activeTab, setActiveTab] = useState<CustomerTab>('upcoming');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Guest booking lookup
  const [lookupCode, setLookupCode] = useState('');
  const [lookupContact, setLookupContact] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Profile form
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profilePhone, setProfilePhone] = useState(user?.phone || '');
  const [profileAddress, setProfileAddress] = useState(user?.address || '');

  // Security & Recovery PIN form
  const [newRecoveryPin, setNewRecoveryPin] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Support form
  const [supportSubject, setSupportSubject] = useState('');
  const [supportBookingCode, setSupportBookingCode] = useState('');
  const [supportMessage, setSupportMessage] = useState('');

  useEffect(() => {
    if (user) {
      setProfileName(user.name);
      setProfilePhone(user.phone);
      setProfileAddress(user.address || '');
    }
  }, [user]);

  const loadCustomerData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [bkgRes, payRes] = await Promise.all([
        apiFetch<{ bookings: Booking[] }>('/api/bookings/my', {}, token),
        apiFetch<{ payments: PaymentRecord[] }>('/api/payments/my', {}, token),
      ]);
      setBookings(bkgRes.bookings);
      setPayments(payRes.payments);
    } catch {
      // handled silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      void loadCustomerData();
    }
  }, [token]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    try {
      const res = await apiFetch<{ booking: Booking }>(
        `/api/bookings/lookup?bookingCode=${encodeURIComponent(lookupCode)}&contact=${encodeURIComponent(lookupContact)}`
      );
      setBookings([res.booking]);
      setSelectedBooking(res.booking);
    } catch (err) {
      setLookupError((err as Error).message);
    }
  };

  const handleCancelRequest = async (booking: Booking) => {
    try {
      const res = await apiFetch<{ booking: Booking }>(
        `/api/bookings/${booking.id}/cancel-request`,
        {
          method: 'POST',
          body: JSON.stringify({
            reason: cancelReason || 'Change of travel plan',
            email: booking.customerEmail,
          }),
        },
        token
      );
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? res.booking : b)));
      setCancelTargetId(null);
      setCancelReason('');
      setStatusMessage(`Cancellation request submitted for ${booking.bookingCode}.`);
    } catch (err) {
      setStatusMessage((err as Error).message);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await apiFetch<{ user: UserProfile }>(
        '/api/auth/profile',
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: profileName,
            phone: profilePhone,
            address: profileAddress,
          }),
        },
        token
      );
      onUpdateUser(res.user);
      setStatusMessage('Profile details updated.');
    } catch (err) {
      setStatusMessage((err as Error).message);
    }
  };

  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!newRecoveryPin.trim() && !newPassword) {
      setStatusMessage('Enter a new Recovery PIN or a new password to update.');
      return;
    }
    if (newRecoveryPin.trim() && newRecoveryPin.trim().length < 4) {
      setStatusMessage('Recovery PIN must be at least 4 characters.');
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setStatusMessage('New password must be at least 6 characters.');
      return;
    }
    if (newPassword && newPassword !== confirmNewPassword) {
      setStatusMessage('New password and confirmation do not match.');
      return;
    }
    try {
      const res = await apiFetch<{ user: UserProfile }>(
        '/api/auth/profile',
        {
          method: 'PATCH',
          body: JSON.stringify({
            ...(newRecoveryPin.trim() ? { recoveryPin: newRecoveryPin.trim() } : {}),
            ...(newPassword ? { currentPassword, newPassword } : {}),
          }),
        },
        token
      );
      onUpdateUser(res.user);
      setNewRecoveryPin('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setStatusMessage('Account security & recovery settings updated.');
    } catch (err) {
      setStatusMessage((err as Error).message);
    }
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/enquiries', {
        method: 'POST',
        body: JSON.stringify({
          name: user?.name || 'Customer',
          email: user?.email || '',
          phone: user?.phone || lookupContact || 'N/A',
          subject: supportSubject || 'Trip Support Request',
          bookingCode: supportBookingCode || undefined,
          message: supportMessage,
          source: 'Support',
        }),
      });
      setSupportSubject('');
      setSupportBookingCode('');
      setSupportMessage('');
      setStatusMessage('Support ticket logged with our 24/7 dispatch desk.');
    } catch (err) {
      setStatusMessage((err as Error).message);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const upcomingBookings = bookings.filter(
    (b) =>
      b.journeyDate >= today &&
      !['Completed', 'Cancelled', 'Rejected'].includes(b.bookingStatus)
  );
  const historyBookings = bookings.filter(
    (b) =>
      b.journeyDate < today ||
      ['Completed', 'Cancelled', 'Rejected'].includes(b.bookingStatus)
  );
  const cancellationBookings = bookings.filter((b) =>
    ['Cancellation Requested', 'Cancelled'].includes(b.bookingStatus)
  );

  if (!user && bookings.length === 0) {
    return (
      <section className="py-14 bg-[#F5F7FA] min-h-[80vh]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          <div className="bg-white border border-slate-200 rounded-xl p-7 flex flex-col justify-between">
            <div>
              <h1 className="text-xl font-bold text-[#102A43]">Customer Trip Dashboard</h1>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Sign in to access all your upcoming trips, past booking history, Razorpay payment receipts, profile settings, and PDF invoices.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onGoToLogin}
                className="px-5 py-2.5 bg-[#102A43] hover:bg-[#1a3c5e] text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                Sign In / Create Account
              </button>
              <button
                type="button"
                onClick={onBookNewTrip}
                className="px-5 py-2.5 bg-[#F5F7FA] hover:bg-slate-200 text-[#102A43] text-sm font-semibold rounded-lg cursor-pointer"
              >
                New Booking
              </button>
            </div>
          </div>

          <form
            onSubmit={handleLookup}
            className="bg-white border border-slate-200 rounded-xl p-7 space-y-4"
          >
            <div>
              <h2 className="text-lg font-bold text-[#102A43]">Track Guest Booking</h2>
              <p className="text-xs text-slate-500 mt-1">
                Try sample booking <span className="font-mono text-[#102A43]">VF-2026-1042</span> with{' '}
                <span className="font-mono text-[#102A43]">karthik.s@example.com</span>
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Booking Reference ID</label>
              <input
                type="text"
                required
                value={lookupCode}
                onChange={(e) => setLookupCode(e.target.value)}
                placeholder="e.g. VF-2026-1042"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg text-[#102A43]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Registered Email or Mobile</label>
              <input
                type="text"
                required
                value={lookupContact}
                onChange={(e) => setLookupContact(e.target.value)}
                placeholder="karthik.s@example.com"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg text-[#102A43]"
              />
            </div>
            {lookupError && <p className="text-xs text-red-700">{lookupError}</p>}
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <Search className="w-4 h-4" />
              Find Booking & Invoice
            </button>
          </form>
        </div>
      </section>
    );
  }

  const tabs: Array<{ id: CustomerTab; label: string; icon: React.ReactNode }> = [
    { id: 'upcoming', label: `Upcoming Trips (${upcomingBookings.length})`, icon: <Calendar className="w-4 h-4" /> },
    { id: 'history', label: `Booking History (${historyBookings.length})`, icon: <FileText className="w-4 h-4" /> },
    { id: 'cancellations', label: 'Cancellations', icon: <X className="w-4 h-4" /> },
    { id: 'payments', label: 'Payment History', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
    { id: 'support', label: 'Contact Support', icon: <HelpCircle className="w-4 h-4" /> },
  ];

  const renderBookingRows = (list: Booking[]) => {
    if (loading) {
      return <p className="text-sm text-slate-500 py-8 text-center">Loading your trips...</p>;
    }
    if (list.length === 0) {
      return (
        <div className="py-10 text-center">
          <p className="text-sm text-slate-500">No bookings in this view yet.</p>
          <button
            type="button"
            onClick={onBookNewTrip}
            className="mt-3 px-4 py-2 bg-[#2563EB] text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            Book a Car or Bus
          </button>
        </div>
      );
    }
    return (
      <div className="divide-y divide-slate-100">
        {list.map((b) => (
          <div key={b.id} className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-[#2563EB] font-mono">
                {b.bookingCode}
                <span className="mx-2 text-slate-300 font-sans">·</span>
                <span className="font-sans text-[#102A43]">{b.bookingStatus}</span>
                <span className="mx-2 text-slate-300 font-sans">·</span>
                <span className="font-sans text-slate-600">{b.paymentStatus}</span>
              </p>
              <h3 className="text-base font-bold text-[#102A43]">{b.vehicleName}</h3>
              <p className="text-xs text-slate-600">
                {b.pickupLocation} → {b.dropLocation}
              </p>
              <p className="text-xs text-slate-500 tabular-nums">
                {b.journeyDate} at {b.journeyTime} · {b.tripType} · {b.passengerCount} Passengers
                {b.driverName ? ` · Driver: ${b.driverName} (${b.driverPhone})` : ''}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <div className="text-right mr-2">
                <p className="text-xs text-slate-500">Total / Paid</p>
                <p className="text-sm font-bold text-[#102A43] tabular-nums">
                  {formatINR(b.totalFare)} / <span className="text-emerald-700">{formatINR(b.paidAmount)}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(b)}
                className="px-3 py-2 text-xs font-semibold bg-[#F5F7FA] hover:bg-slate-200 text-[#102A43] rounded-lg cursor-pointer"
              >
                Details
              </button>
              <button
                type="button"
                onClick={() => downloadBookingInvoicePdf(b, settings)}
                className="px-3 py-2 text-xs font-semibold bg-[#102A43] hover:bg-[#1a3c5e] text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Invoice
              </button>
              {!['Completed', 'Cancelled', 'Rejected', 'Cancellation Requested'].includes(b.bookingStatus) && (
                <button
                  type="button"
                  onClick={() => setCancelTargetId(b.id)}
                  className="px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                >
                  Request Cancel
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <section className="py-10 bg-[#F5F7FA] min-h-[82vh]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#102A43]">
              {user ? `Welcome, ${user.name}` : 'Booking Details & Support'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {user ? `${user.email} · ${user.phone}` : 'Guest Booking View'}
            </p>
          </div>
          <button
            type="button"
            onClick={onBookNewTrip}
            className="px-4 py-2.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-sm font-semibold rounded-lg cursor-pointer"
          >
            Book Another Trip
          </button>
        </div>

        {statusMessage && (
          <div className="bg-blue-50 border border-blue-200 text-[#102A43] px-4 py-3 rounded-xl text-sm flex items-center justify-between">
            <span>{statusMessage}</span>
            <button type="button" onClick={() => setStatusMessage(null)} className="text-xs font-semibold underline cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 border border-slate-200 rounded-xl">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === t.id
                  ? 'bg-[#102A43] text-white'
                  : 'text-slate-600 hover:bg-[#F5F7FA] hover:text-[#102A43]'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          {activeTab === 'upcoming' && renderBookingRows(upcomingBookings)}
          {activeTab === 'history' && renderBookingRows(historyBookings)}
          {activeTab === 'cancellations' && renderBookingRows(cancellationBookings)}

          {activeTab === 'payments' && (
            <div>
              <h2 className="text-base font-bold text-[#102A43] mb-4">Razorpay Payment History</h2>
              {payments.length === 0 ? (
                <p className="text-sm text-slate-500 py-6">No online transactions recorded on your account yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs text-slate-500">
                      <tr>
                        <th className="py-2.5 pr-4">Date</th>
                        <th className="py-2.5 pr-4">Booking ID</th>
                        <th className="py-2.5 pr-4">Payment ID</th>
                        <th className="py-2.5 pr-4">Type</th>
                        <th className="py-2.5 pr-4">Status</th>
                        <th className="py-2.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.map((p) => (
                        <tr key={p.id}>
                          <td className="py-3 pr-4 text-xs text-slate-600 tabular-nums">{p.createdAt.slice(0, 10)}</td>
                          <td className="py-3 pr-4 font-mono text-xs text-[#102A43]">{p.bookingCode}</td>
                          <td className="py-3 pr-4 font-mono text-xs text-slate-500">{p.razorpayPaymentId || p.razorpayOrderId}</td>
                          <td className="py-3 pr-4 text-xs">{p.paymentType}</td>
                          <td className="py-3 pr-4 text-xs font-semibold text-emerald-700">{p.status}</td>
                          <td className="py-3 text-right font-bold tabular-nums">{formatINR(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <h2 className="text-base font-bold text-[#102A43]">Passenger Profile</h2>
                {!user ? (
                  <p className="text-sm text-slate-500">Sign in to manage your saved profile details.</p>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Mobile Number</label>
                      <input
                        type="tel"
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Default Pickup / Billing Address
                      </label>
                      <input
                        type="text"
                        value={profileAddress}
                        onChange={(e) => setProfileAddress(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-[#102A43] text-white text-sm font-semibold rounded-lg cursor-pointer"
                    >
                      Save Profile
                    </button>
                  </>
                )}
              </form>

              {user && (
                <form
                  onSubmit={handleSaveSecurity}
                  className="space-y-4 pt-6 lg:pt-0 lg:border-l lg:border-slate-100 lg:pl-8"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-[#102A43]">Password & Recovery PIN</h2>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                        user.hasRecoveryPin
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {user.hasRecoveryPin ? 'Recovery PIN Active' : 'No Recovery PIN'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Set a Recovery PIN so you can reset your password instantly anytime using Forgot Password.
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      {user.hasRecoveryPin ? 'Update Recovery PIN (4+ chars)' : 'Set Recovery PIN (4+ chars)'}
                    </label>
                    <input
                      type="text"
                      maxLength={16}
                      value={newRecoveryPin}
                      onChange={(e) => setNewRecoveryPin(e.target.value)}
                      placeholder="e.g. 4829"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div className="pt-2 border-t border-slate-100 space-y-3">
                    <p className="text-xs font-semibold text-[#102A43]">Change Account Password (Optional)</p>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Current Password</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Required when changing password"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">New Password</label>
                        <input
                          type="password"
                          minLength={6}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Min 6 chars"
                          className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Confirm New Password</label>
                        <input
                          type="password"
                          minLength={6}
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          placeholder="Repeat password"
                          className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-sm font-semibold rounded-lg cursor-pointer"
                  >
                    Update Security Settings
                  </button>
                </form>
              )}
            </div>
          )}

          {activeTab === 'support' && (
            <form onSubmit={handleSupportSubmit} className="max-w-lg space-y-4">
              <h2 className="text-base font-bold text-[#102A43]">Contact Dispatch & Customer Support</h2>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Related Booking ID (Optional)</label>
                <input
                  type="text"
                  value={supportBookingCode}
                  onChange={(e) => setSupportBookingCode(e.target.value)}
                  placeholder="VF-2026-..."
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={supportSubject}
                  onChange={(e) => setSupportSubject(e.target.value)}
                  placeholder="Pickup timing change, invoice copy, luggage request..."
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Message</label>
                <textarea
                  rows={4}
                  required
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#2563EB] text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                Send to Support Desk
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {cancelTargetId && (
        <div className="fixed inset-0 z-50 bg-[#102A43]/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-[#102A43]">Request Trip Cancellation</h3>
            <p className="text-xs text-slate-600">
              Our dispatch team will verify the cancellation and process any eligible Razorpay refund.
            </p>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelTargetId(null)}
                className="px-4 py-2 text-xs font-semibold bg-[#F5F7FA] text-[#102A43] rounded-lg cursor-pointer"
              >
                Keep Booking
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = bookings.find((b) => b.id === cancelTargetId);
                  if (target) void handleCancelRequest(target);
                }}
                className="px-4 py-2 text-xs font-semibold bg-red-600 text-white rounded-lg cursor-pointer"
              >
                Submit Cancellation Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Details Drawer Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 bg-[#102A43]/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-xl w-full p-6 space-y-4 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <p className="text-xs font-mono text-[#2563EB]">{selectedBooking.bookingCode}</p>
                <h3 className="text-lg font-bold text-[#102A43]">{selectedBooking.vehicleName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="p-2 text-slate-500 hover:bg-[#F5F7FA] rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-[#F5F7FA] p-4 rounded-lg">
              <div>
                <p className="text-slate-500">Journey Date & Time</p>
                <p className="font-semibold text-[#102A43] tabular-nums">
                  {selectedBooking.journeyDate} · {selectedBooking.journeyTime}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Trip Type / Distance</p>
                <p className="font-semibold text-[#102A43] tabular-nums">
                  {selectedBooking.tripType} · {selectedBooking.estimatedDistanceKm} km
                </p>
              </div>
              <div>
                <p className="text-slate-500">Booking Status</p>
                <p className="font-semibold text-[#102A43]">{selectedBooking.bookingStatus}</p>
              </div>
              <div>
                <p className="text-slate-500">Payment Status</p>
                <p className="font-semibold text-emerald-700">{selectedBooking.paymentStatus}</p>
              </div>
            </div>

            <div className="text-xs space-y-1.5 text-slate-600">
              <p><strong className="text-[#102A43]">Pickup:</strong> {selectedBooking.pickupLocation}</p>
              <p><strong className="text-[#102A43]">Destination:</strong> {selectedBooking.dropLocation}</p>
              {selectedBooking.driverName && (
                <p>
                  <strong className="text-[#102A43]">Assigned Driver:</strong> {selectedBooking.driverName} ({selectedBooking.driverPhone})
                </p>
              )}
            </div>

            <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Total Fare / Paid</p>
                <p className="text-base font-bold text-[#102A43] tabular-nums">
                  {formatINR(selectedBooking.totalFare)} / {formatINR(selectedBooking.paidAmount)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => downloadBookingInvoicePdf(selectedBooking, settings)}
                className="px-4 py-2 bg-[#102A43] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download Invoice PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
