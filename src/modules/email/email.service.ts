import { Resend } from 'resend';
import { env } from '../../config/env';
import { verificationEmail, passwordResetEmail } from './email.templates';

// In-memory email storage for test mode
interface SentEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const sentEmails: SentEmail[] = [];

// Initialize Resend client (only used in non-test environments)
// Lazy initialization to avoid issues with env loading order
let resend: Resend | null = null;

function getResendClient(): Resend {
  if (env.NODE_ENV === 'test') {
    throw new Error('Resend client should not be used in test mode');
  }
  if (!resend) {
    resend = new Resend(env.RESEND_API_KEY);
  }
  return resend;
}

/**
 * Get sent emails (test mode only)
 * Used by tests to verify emails were sent
 */
export function __getSentEmails(): SentEmail[] {
  if (env.NODE_ENV !== 'test') {
    throw new Error('__getSentEmails() can only be called in test mode');
  }
  return [...sentEmails];
}

/**
 * Clear sent emails (test mode only)
 * Used by tests to reset email state
 */
export function __clearSentEmails(): void {
  if (env.NODE_ENV !== 'test') {
    throw new Error('__clearSentEmails() can only be called in test mode');
  }
  sentEmails.length = 0;
}

/**
 * Send verification email
 */
export async function sendVerificationEmail(
  to: string,
  token: string
): Promise<void> {
  const link = `${env.APP_BASE_URL}${env.EMAIL_VERIFY_PATH}?token=${token}`;
  const emailContent = verificationEmail(link);

  if (env.NODE_ENV === 'test') {
    // In test mode, store email in memory
    sentEmails.push({
      to,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });
    return;
  }

  // In production/development, send via Resend
  try {
    const resendClient = getResendClient();
    await resendClient.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });
  } catch (error) {
    console.error('Failed to send verification email:', error);
    // Provide more detailed error message
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to send verification email: ${errorMessage}`);
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  to: string,
  token: string
): Promise<void> {
  const link = `${env.APP_BASE_URL}${env.EMAIL_RESET_PATH}?token=${token}`;
  const emailContent = passwordResetEmail(link);

  if (env.NODE_ENV === 'test') {
    // In test mode, store email in memory
    sentEmails.push({
      to,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });
    return;
  }

  // In production/development, send via Resend
  try {
    const resendClient = getResendClient();
    await resendClient.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    // Provide more detailed error message
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to send password reset email: ${errorMessage}`);
  }
}
