import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Send, CheckCircle2 } from 'lucide-react';

export function FeedbackForm() {
  const [feedbackText, setFeedbackText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;

    setSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('planzie_token');
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text: feedbackText })
      });

      if (res.ok) {
        setSubmitted(true);
        setFeedbackText('');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to submit feedback');
      }
    } catch (err) {
      setError('Network error submitting feedback');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="feedback-form-container" className="bg-white p-6 rounded-xl border border-teal-100 shadow-sm flex flex-col justify-between">
      <div>
        <h3 className="text-lg font-semibold text-teal-950 mb-1 font-sans">Share Your Thoughts</h3>
        <p className="text-xs text-slate-500 mb-4">We are constantly refining the Intake & Plan Z escalation pipelines. Your notes help shape Planzie.</p>

        {submitted ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-8 text-center"
          >
            <CheckCircle2 className="w-12 h-12 text-teal-600 mb-3" />
            <p className="text-sm font-medium text-teal-950 font-sans">Thanks for the feedback!</p>
            <button 
              onClick={() => setSubmitted(false)}
              className="mt-4 text-xs text-teal-700 hover:text-teal-800 font-medium underline"
            >
              Send another note
            </button>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="How is Planzie working for you? Any suggestions?"
                className="w-full h-24 p-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 focus:bg-white resize-none"
                required
              />
            </div>

            {error && (
              <p className="text-xs text-rose-600 font-medium">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !feedbackText.trim()}
              className="w-full flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm py-2 px-4 rounded-lg font-medium shadow-sm transition"
            >
              {submitting ? 'Sending...' : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Feedback</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
