import React, { useState } from 'react';

interface FeedbackButtonProps {
  className?: string;
  variant?: 'primary' | 'secondary';
}

const FeedbackButton: React.FC<FeedbackButtonProps> = ({
  className = '',
  variant = 'primary'
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!feedback.trim()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // In a real implementation, this would call the backend API
      // await axios.post('/api/feedback', { feedback });

      setSubmitStatus('success');
      setFeedback('');

      // Close modal after 2 seconds
      setTimeout(() => {
        setIsModalOpen(false);
        setSubmitStatus('idle');
      }, 2000);
    } catch (error) {
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const baseButtonClasses = 'px-4 py-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  const variantClasses = variant === 'primary'
    ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
    : 'bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-500';

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`${baseButtonClasses} ${variantClasses} ${className}`}
        data-testid="feedback-button"
        aria-label="Give feedback"
      >
        Give Feedback
      </button>

      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setIsModalOpen(false)}
          data-testid="feedback-modal-backdrop"
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
            data-testid="feedback-modal"
          >
            <h2 className="text-2xl font-bold mb-4 text-gray-900">
              Send Feedback
            </h2>

            {submitStatus === 'success' ? (
              <div
                className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4"
                data-testid="feedback-success"
                role="alert"
              >
                Thank you for your feedback!
              </div>
            ) : submitStatus === 'error' ? (
              <div
                className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
                data-testid="feedback-error"
                role="alert"
              >
                Failed to submit feedback. Please try again.
              </div>
            ) : null}

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label
                  htmlFor="feedback-text"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Your Feedback
                </label>
                <textarea
                  id="feedback-text"
                  data-testid="feedback-textarea"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={5}
                  placeholder="Tell us what you think..."
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={isSubmitting}
                  data-testid="feedback-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
                  disabled={isSubmitting || !feedback.trim()}
                  data-testid="feedback-submit"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default FeedbackButton;
