import React, { useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { WebsiteSettings } from '../types';

export const WhatsAppWidget: React.FC<{ settings?: WebsiteSettings | null }> = ({ settings }) => {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState('Vehicle Availability');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (settings && !settings.showWhatsAppWidget) {
    return null;
  }

  const companyName = settings?.companyName || 'Vizag Jagan Travels';
  const whatsappNumber = (settings?.whatsappNumber || '918912748800').replace(/[^\d]/g, '') || '918912748800';
  const greeting = settings?.whatsappDefaultMessage || `Hello ${companyName} Dispatch`;

  const prefilledText = encodeURIComponent(
    `${greeting}, I would like help with: ${topic}.\nName: ${name || 'Traveller'}\nPhone: ${phone || '-'}\nDetails: ${message || 'Please share available vehicles and rates.'}`
  );
  const waHref = `https://wa.me/${whatsappNumber}?text=${prefilledText}`;

  const handleLogEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    try {
      await apiFetch('/api/enquiries', {
        method: 'POST',
        body: JSON.stringify({
          name,
          phone,
          subject: `WhatsApp: ${topic}`,
          message: message || `Requested ${topic} via WhatsApp desk.`,
          source: 'WhatsApp',
        }),
      });
      setSubmitted(true);
    } catch {
      // Allow direct WhatsApp launch regardless
      setSubmitted(true);
    }
  };

  return (
    <div className="fixed bottom-20 right-4 lg:bottom-4 z-40">
      {open && (
        <div className="mb-3 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden">
          <div className="bg-[#102A43] text-white px-4 py-3.5 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">WhatsApp Travel Desk</p>
              <p className="text-xs text-slate-300">Instant fleet quotes & dispatch help</p>
            </div>
            <button
              type="button"
              aria-label="Close WhatsApp enquiry box"
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleLogEnquiry} className="p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Enquiry Type</label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg text-[#102A43]"
              >
                <option value="Vehicle Availability">Ask Vehicle Availability</option>
                <option value="Custom Quotation">Request Custom Quotation</option>
                <option value="Booking Details">Receive Booking Details</option>
                <option value="Customer Support">24/7 Customer Support</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                placeholder="Your Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-lg text-[#102A43]"
              />
              <input
                type="tel"
                required
                placeholder="Mobile Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-lg text-[#102A43]"
              />
            </div>
            <textarea
              rows={2}
              placeholder="Pickup city, travel date, passenger count..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg text-[#102A43]"
            />

            {submitted && (
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                Logged with dispatch! You can also launch WhatsApp directly below.
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 py-2 px-3 bg-[#F5F7FA] hover:bg-slate-200 text-[#102A43] text-xs font-semibold rounded-lg cursor-pointer"
              >
                Save Enquiry
              </button>
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Open WhatsApp
              </a>
            </div>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open WhatsApp travel enquiry"
        className="h-12 px-4 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg flex items-center gap-2 text-sm font-semibold cursor-pointer transition-transform hover:scale-105"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="hidden sm:inline">WhatsApp Enquiry</span>
      </button>
    </div>
  );
};
