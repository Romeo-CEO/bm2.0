import sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const DEFAULT_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_FROM || 'no-reply@businessmanager.local';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

const isEmailEnabled = (): boolean => Boolean(SENDGRID_API_KEY);

export const sendPasswordResetEmail = async (to: string, resetUrl: string, expiresAt: Date): Promise<void> => {
  const subject = 'Reset your Business Manager password';
  const humanExpiry = expiresAt.toLocaleString('en-US', { timeZone: 'UTC', hour12: false }) + ' UTC';
  const html = `
    <p>Hello,</p>
    <p>We received a request to reset your Business Manager password. Click the button below to reset it.</p>
    <p><a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background-color:#173c5f;color:#ffffff;text-decoration:none;border-radius:4px;">Reset Password</a></p>
    <p>If you did not request this reset, you can ignore this email. The link expires at ${humanExpiry}.</p>
    <p>Thanks,<br/>Business Manager Security Team</p>
  `;

  if (!isEmailEnabled()) {
    console.log('[EmailService] Password reset email suppressed (SendGrid key missing).', { to, resetUrl });
    return;
  }

  try {
    await sgMail.send({
      to,
      from: DEFAULT_FROM_EMAIL,
      subject,
      html,
    });
  } catch (error) {
    console.error('Failed to send password reset email', error);
    throw error;
  }
};

export const emailService = {
  isEnabled: isEmailEnabled(),
  sendPasswordResetEmail,
};
