import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeedbackButton from '../components/FeedbackButton';

describe('FeedbackButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the feedback button', () => {
    render(<FeedbackButton />);
    const button = screen.getByTestId('feedback-button');
    expect(button).toBeDefined();
    expect(button.textContent).toBe('Give Feedback');
  });

  it('has correct aria-label for accessibility', () => {
    render(<FeedbackButton />);
    const button = screen.getByLabelText('Give feedback');
    expect(button).toBeDefined();
  });

  it('applies primary variant styles by default', () => {
    render(<FeedbackButton />);
    const button = screen.getByTestId('feedback-button');
    expect(button.className).toContain('bg-blue-600');
  });

  it('applies secondary variant styles when specified', () => {
    render(<FeedbackButton variant="secondary" />);
    const button = screen.getByTestId('feedback-button');
    expect(button.className).toContain('bg-gray-200');
  });

  it('applies custom className', () => {
    render(<FeedbackButton className="custom-class" />);
    const button = screen.getByTestId('feedback-button');
    expect(button.className).toContain('custom-class');
  });

  it('opens modal when button is clicked', async () => {
    render(<FeedbackButton />);
    const button = screen.getByTestId('feedback-button');

    // Modal should not be visible initially
    expect(screen.queryByTestId('feedback-modal')).toBeNull();

    // Click the button
    fireEvent.click(button);

    // Modal should now be visible
    await waitFor(() => {
      expect(screen.getByTestId('feedback-modal')).toBeDefined();
    });
  });

  it('closes modal when backdrop is clicked', async () => {
    render(<FeedbackButton />);

    // Open modal
    fireEvent.click(screen.getByTestId('feedback-button'));
    await waitFor(() => {
      expect(screen.getByTestId('feedback-modal')).toBeDefined();
    });

    // Click backdrop
    fireEvent.click(screen.getByTestId('feedback-modal-backdrop'));

    // Modal should be closed
    await waitFor(() => {
      expect(screen.queryByTestId('feedback-modal')).toBeNull();
    });
  });

  it('closes modal when cancel button is clicked', async () => {
    render(<FeedbackButton />);

    // Open modal
    fireEvent.click(screen.getByTestId('feedback-button'));
    await waitFor(() => {
      expect(screen.getByTestId('feedback-modal')).toBeDefined();
    });

    // Click cancel button
    fireEvent.click(screen.getByTestId('feedback-cancel'));

    // Modal should be closed
    await waitFor(() => {
      expect(screen.queryByTestId('feedback-modal')).toBeNull();
    });
  });

  it('does not close modal when modal content is clicked', async () => {
    render(<FeedbackButton />);

    // Open modal
    fireEvent.click(screen.getByTestId('feedback-button'));
    await waitFor(() => {
      expect(screen.getByTestId('feedback-modal')).toBeDefined();
    });

    // Click modal content (not backdrop)
    fireEvent.click(screen.getByTestId('feedback-modal'));

    // Modal should still be open
    expect(screen.getByTestId('feedback-modal')).toBeDefined();
  });

  it('updates textarea value when user types', async () => {
    const user = userEvent.setup();
    render(<FeedbackButton />);

    // Open modal
    fireEvent.click(screen.getByTestId('feedback-button'));

    const textarea = screen.getByTestId('feedback-textarea') as HTMLTextAreaElement;
    await user.type(textarea, 'This is my feedback');

    expect(textarea.value).toBe('This is my feedback');
  });

  it('disables submit button when textarea is empty', async () => {
    render(<FeedbackButton />);

    // Open modal
    fireEvent.click(screen.getByTestId('feedback-button'));

    const submitButton = screen.getByTestId('feedback-submit') as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
  });

  it('enables submit button when textarea has text', async () => {
    const user = userEvent.setup();
    render(<FeedbackButton />);

    // Open modal
    fireEvent.click(screen.getByTestId('feedback-button'));

    const textarea = screen.getByTestId('feedback-textarea');
    await user.type(textarea, 'Some feedback');

    const submitButton = screen.getByTestId('feedback-submit') as HTMLButtonElement;
    expect(submitButton.disabled).toBe(false);
  });

  it('submits feedback and shows success message', async () => {
    vi.useFakeTimers();

    render(<FeedbackButton />);

    // Open modal
    fireEvent.click(screen.getByTestId('feedback-button'));

    // Type feedback
    const textarea = screen.getByTestId('feedback-textarea');
    fireEvent.change(textarea, { target: { value: 'Great app!' } });

    // Submit form
    const submitButton = screen.getByTestId('feedback-submit');
    fireEvent.click(submitButton);

    // Wait for submission
    await vi.advanceTimersByTimeAsync(1000);

    // Success message should appear
    expect(screen.getByTestId('feedback-success')).toBeDefined();

    vi.useRealTimers();
  }, 10000);

  it('clears textarea after successful submission', async () => {
    vi.useFakeTimers();

    render(<FeedbackButton />);

    // Open modal
    fireEvent.click(screen.getByTestId('feedback-button'));

    // Type feedback
    const textarea = screen.getByTestId('feedback-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Great app!' } });

    // Submit form
    fireEvent.click(screen.getByTestId('feedback-submit'));

    // Wait for submission
    await vi.advanceTimersByTimeAsync(1000);

    // Textarea should be cleared
    expect(textarea.value).toBe('');

    vi.useRealTimers();
  }, 10000);

  it('disables inputs while submitting', async () => {
    render(<FeedbackButton />);

    // Open modal
    fireEvent.click(screen.getByTestId('feedback-button'));

    // Type feedback
    const textarea = screen.getByTestId('feedback-textarea');
    fireEvent.change(textarea, { target: { value: 'Great app!' } });

    // Submit form
    fireEvent.click(screen.getByTestId('feedback-submit'));

    // Immediately check if inputs are disabled
    const textareaElement = screen.getByTestId('feedback-textarea') as HTMLTextAreaElement;
    const submitButton = screen.getByTestId('feedback-submit') as HTMLButtonElement;
    const cancelButton = screen.getByTestId('feedback-cancel') as HTMLButtonElement;

    expect(textareaElement.disabled).toBe(true);
    expect(submitButton.disabled).toBe(true);
    expect(cancelButton.disabled).toBe(true);
  });

  it('shows "Submitting..." text while submitting', async () => {
    render(<FeedbackButton />);

    // Open modal
    fireEvent.click(screen.getByTestId('feedback-button'));

    // Type feedback
    const textarea = screen.getByTestId('feedback-textarea');
    fireEvent.change(textarea, { target: { value: 'Great app!' } });

    // Submit form
    fireEvent.click(screen.getByTestId('feedback-submit'));

    // Check button text
    const submitButton = screen.getByTestId('feedback-submit');
    expect(submitButton.textContent).toBe('Submitting...');
  });

  it('closes modal after successful submission', async () => {
    vi.useFakeTimers();

    render(<FeedbackButton />);

    // Open modal
    fireEvent.click(screen.getByTestId('feedback-button'));

    // Type and submit feedback
    const textarea = screen.getByTestId('feedback-textarea');
    fireEvent.change(textarea, { target: { value: 'Great app!' } });
    fireEvent.click(screen.getByTestId('feedback-submit'));

    // Wait for submission and auto-close
    await vi.advanceTimersByTimeAsync(3000);

    // Modal should be closed
    expect(screen.queryByTestId('feedback-modal')).toBeNull();

    vi.useRealTimers();
  }, 10000);

  it('has required attribute on textarea', () => {
    render(<FeedbackButton />);
    fireEvent.click(screen.getByTestId('feedback-button'));

    const textarea = screen.getByTestId('feedback-textarea') as HTMLTextAreaElement;
    expect(textarea.required).toBe(true);
  });

  it('displays placeholder text in textarea', () => {
    render(<FeedbackButton />);
    fireEvent.click(screen.getByTestId('feedback-button'));

    const textarea = screen.getByTestId('feedback-textarea') as HTMLTextAreaElement;
    expect(textarea.placeholder).toBe('Tell us what you think...');
  });
});
