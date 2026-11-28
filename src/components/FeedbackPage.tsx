import React, { useEffect, useState } from 'react';
import { CheckCircle2, MapPin, MessageSquareHeart, Star, XCircle } from 'lucide-react';
import { Review } from '../types';
import { apiFetch } from '../lib/api';

interface FeedbackPageProps {
  feedbackToken: string;
  onFeedbackPublished: (review: Review) => void;
  onViewWebsiteReviews: () => void;
}

interface FeedbackCheckResponse {
  status: 'ready' | 'submitted' | 'expired' | 'not_completed' | 'invalid';
  bookingCode?: string;
  customerFirstName?: string;
  vehicleName?: string;
  vehicleCategory?: string;
  tripType?: string;
  journeyDate?: string;
  routeSummary?: string;
  message?: string;
}

export const FeedbackPage: React.FC<FeedbackPageProps> = ({
  feedbackToken,
  onFeedbackPublished,
  onViewWebsiteReviews,
}) => {
  const [checkData, setCheckData] = useState<FeedbackCheckResponse | null>(null);
  const [checking, setChecking] = useState(true);

  const [rating, setRating] = useState<number>(5);
  const [customerName, setCustomerName] = useState('');
  const [roleOrCity, setRoleOrCity] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedReview, setSubmittedReview] = useState<Review | null>(null);

  useEffect(() => {
    setChecking(true);
    apiFetch<FeedbackCheckResponse>(
      `/api/feedback/check?token=${encodeURIComponent(feedbackToken)}`
    )
      .then((res) => setCheckData(res))
      .catch((err) =>
        setCheckData({
          status: 'invalid',
          message: (err as Error).message || 'Invalid or expired feedback link.',
        })
      )
      .finally(() => setChecking(false));
  }, [feedbackToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (comment.trim().length < 3) {
      setError('Please write a brief comment about your trip.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch<{ review: Review; message: string }>('/api/feedback/submit', {
        method: 'POST',
        body: JSON.stringify({
          token: feedbackToken,
          rating,
          customerName: customerName.trim() || undefined,
          roleOrCity: roleOrCity.trim() || undefined,
          comment: comment.trim(),
        }),
      });
      setSubmittedReview(res.review);
      onFeedbackPublished(res.review);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="py-12 bg-[#F5F7FA] min-h-[82vh]">
      <div className="max-w-xl mx-auto px-4">
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-7 shadow-xs space-y-5">
          <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
              <MessageSquareHeart className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#102A43]">Share Your Trip Feedback</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Verified passenger reviews publish directly to the Vizag Jagan Travels website.
              </p>
            </div>
          </div>

          {checking ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Loading your completed trip details...
            </div>
          ) : submittedReview ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-emerald-950">
                    Thank you! Your review is now live on our website.
                  </p>
                  <p className="text-xs text-emerald-800 mt-1">
                    Verified Trip #{submittedReview.bookingCode} · {submittedReview.rating} / 5 Stars
                  </p>
                </div>
              </div>
              <div className="p-4 bg-[#F5F7FA] border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center gap-1 text-[#F59E0B]">
                  {Array.from({ length: submittedReview.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <p className="text-sm text-slate-700">“{submittedReview.comment}”</p>
                <p className="text-xs font-semibold text-[#102A43]">
                  {submittedReview.customerName} · {submittedReview.roleOrCity}
                </p>
              </div>
              <button
                type="button"
                onClick={onViewWebsiteReviews}
                className="w-full py-2.5 px-4 bg-[#102A43] hover:bg-[#1a3c5e] text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                View Live Reviews on Website →
              </button>
            </div>
          ) : checkData?.status !== 'ready' ? (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <XCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-950">
                    {checkData?.status === 'submitted'
                      ? 'Feedback Already Received'
                      : 'Feedback Link Unavailable'}
                  </p>
                  <p className="text-xs text-amber-800 mt-1">
                    {checkData?.message || 'Unable to open this feedback link.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onViewWebsiteReviews}
                className="w-full py-2.5 px-4 bg-[#102A43] hover:bg-[#1a3c5e] text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                Return to Website
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-3.5 bg-[#F5F7FA] border border-slate-200 rounded-lg text-xs text-slate-700 space-y-1">
                <p className="font-mono font-bold text-[#102A43]">
                  Trip #{checkData.bookingCode} · {checkData.journeyDate}
                </p>
                <p className="font-semibold text-[#102A43]">
                  {checkData.vehicleName} ({checkData.tripType})
                </p>
                <p className="flex items-start gap-1.5 text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-[#2563EB] shrink-0 mt-0.5" />
                  <span>{checkData.routeSummary}</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">
                  Overall Service Rating
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                      className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                        rating >= star
                          ? 'bg-amber-50 border-amber-300 text-[#F59E0B]'
                          : 'bg-white border-slate-200 text-slate-300 hover:text-slate-400'
                      }`}
                    >
                      <Star className="w-5 h-5 fill-current" />
                    </button>
                  ))}
                  <span className="ml-2 text-xs font-semibold text-[#102A43]">{rating} / 5</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Display Name (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={checkData.customerFirstName || 'Your name'}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg text-[#102A43]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    City or Role (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={roleOrCity}
                    onChange={(e) => setRoleOrCity(e.target.value)}
                    placeholder="e.g. Family Traveller · Vizag"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg text-[#102A43]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Your Review *
                </label>
                <textarea
                  rows={4}
                  required
                  minLength={3}
                  maxLength={600}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share how our vehicle condition, chauffeur punctuality, and journey experience were..."
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
                disabled={submitting}
                className="w-full py-2.5 px-4 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-sm font-semibold rounded-lg cursor-pointer disabled:opacity-60"
              >
                {submitting ? 'Publishing Review...' : 'Submit & Publish Review to Website'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};
