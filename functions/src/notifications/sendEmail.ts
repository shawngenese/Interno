import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';

export interface SendEmailRequest {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface SendEmailResponse {
  success: boolean;
  id: string;
}

/** Roles allowed to send email through the `sendEmail` callable. */
export const EMAIL_SENDER_ROLES = ['admin', 'supervisor', 'coordinator'] as const;

/** Guard for the `sendEmail` callable: coordinators must be able to trigger emails (document reviews, invites). */
export function assertCanSendEmail(role: string | undefined): void {
  if (!role || !(EMAIL_SENDER_ROLES as readonly string[]).includes(role)) {
    throw new HttpsError('permission-denied', 'Required role: admin, supervisor, or coordinator');
  }
}

/** Core Brevo (SMTP API v3) send — shared by the sendEmail callable and internal callers. */
export async function sendEmailMessage(
  payload: SendEmailRequest
): Promise<SendEmailResponse> {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;

  if (!apiKey || !fromEmail) {
    throw new HttpsError('failed-precondition', 'Email not configured (BREVO_API_KEY or EMAIL_FROM missing)');
  }

  const { to, subject, html, text, replyTo } = payload;

  if (!to || !subject || !html) {
    throw new HttpsError('invalid-argument', 'Missing required fields: to, subject, html');
  }

  const recipients = Array.isArray(to) ? to : [to];

  const emailPayload: Record<string, unknown> = {
    sender: { email: fromEmail, name: process.env.EMAIL_FROM_NAME || 'Interno' },
    to: recipients.map((email) => ({ email })),
    subject,
    htmlContent: html,
  };

  if (text) emailPayload.textContent = text;
  if (replyTo) emailPayload.replyTo = { email: replyTo };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(emailPayload),
  });

  const result = await response.json() as Record<string, unknown>;

  if (!response.ok) {
    console.error('Brevo API error:', result);
    throw new HttpsError('internal', (result.message as string) || 'Email send failed');
  }

  return {
    success: true,
    id: String(result.messageId ?? result.id ?? ''),
  };
}

export async function sendEmailHandler(
  request: CallableRequest<SendEmailRequest>
): Promise<SendEmailResponse> {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  return sendEmailMessage(request.data);
}
