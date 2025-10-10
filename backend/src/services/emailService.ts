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

interface InvitationEmailOptions {
  companyName?: string | null;
  invitedByName?: string | null;
  expiresAt?: Date | null;
}

export const sendCompanyInvitationEmail = async (
  to: string,
  inviteUrl: string,
  options: InvitationEmailOptions = {}
): Promise<void> => {
  const { companyName, invitedByName, expiresAt } = options;
  const subject = companyName
    ? `You're invited to join ${companyName} on Business Manager`
    : `You're invited to join Business Manager`;

  const inviterText = invitedByName ? ` by ${invitedByName}` : '';
  const expiryText = expiresAt
    ? ` This invitation link will expire on ${expiresAt.toLocaleString('en-US', { timeZone: 'UTC', hour12: false })} UTC.`
    : '';

  const html = `
    <p>Hello,</p>
    <p>You have been invited${inviterText} to join${companyName ? ` <strong>${companyName}</strong>` : ' a company'} on Business Manager.</p>
    <p>Please click the button below to accept the invitation and create your account.</p>
    <p><a href="${inviteUrl}" style="display:inline-block;padding:10px 16px;background-color:#173c5f;color:#ffffff;text-decoration:none;border-radius:4px;">Accept Invitation</a></p>
    <p>If the button above does not work, copy and paste this link into your browser:<br />
      <a href="${inviteUrl}">${inviteUrl}</a>
    </p>
    <p>${expiryText}</p>
    <p>Thanks,<br/>Business Manager Team</p>
  `;

  if (!isEmailEnabled()) {
    console.log('[EmailService] Invitation email suppressed (SendGrid key missing).', { to, inviteUrl });
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
    console.error('Failed to send company invitation email', error);
    throw error;
  }
};

interface TemporaryPasswordOptions {
  companyName?: string | null;
  firstName?: string | null;
}

export const sendTemporaryPasswordEmail = async (
  to: string,
  temporaryPassword: string,
  options: TemporaryPasswordOptions = {}
): Promise<void> => {
  const { companyName, firstName } = options;
  const subject = companyName
    ? `Your temporary Business Manager password for ${companyName}`
    : `Your temporary Business Manager password`;

  const greetingName = firstName ? ` ${firstName}` : '';
  const companyBlurb = companyName
    ? ` to access <strong>${companyName}</strong>`
    : '';

  const html = `
    <p>Hello${greetingName},</p>
    <p>A company administrator created an account for you${companyBlurb}. Please use the temporary password below to sign in and update your credentials.</p>
    <p style="font-size:18px;font-weight:bold;letter-spacing:1px;">${temporaryPassword}</p>
    <p>For security, please change this password immediately after logging in.</p>
    <p>Thanks,<br/>Business Manager Team</p>
  `;

  if (!isEmailEnabled()) {
    console.log('[EmailService] Temporary password email suppressed (SendGrid key missing).', {
      to,
    });
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
    console.error('Failed to send temporary password email', error);
    throw error;
  }
};

export const emailService = {
  isEnabled: isEmailEnabled(),
  sendPasswordResetEmail,
  sendCompanyInvitationEmail,
  sendTemporaryPasswordEmail,
};

export const sendNotificationEmail = async (
  to: string,
  subject: string,
  htmlBody: string
): Promise<void> => {
  if (!isEmailEnabled()) {
    console.log('[EmailService] Notification email suppressed (SendGrid key missing).', { to, subject });
    return;
  }

  try {
    await sgMail.send({
      to,
      from: DEFAULT_FROM_EMAIL,
      subject,
      html: htmlBody,
    });
  } catch (error) {
    console.error('Failed to send notification email', error);
    throw error;
  }
};
