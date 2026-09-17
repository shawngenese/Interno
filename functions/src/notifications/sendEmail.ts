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

export async function sendEmailHandler(
  request: CallableRequest<SendEmailRequest>
): Promise<SendEmailResponse> {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;

  if (!apiKey || !fromEmail) {
    throw new HttpsError('failed-precondition', 'Email not configured (RESEND_API_KEY or EMAIL_FROM missing)');
  }

  const { to, subject, html, text, replyTo } = request.data;

  if (!to || !subject || !html) {
    throw new HttpsError('invalid-argument', 'Missing required fields: to, subject, html');
  }

  const recipients = Array.isArray(to) ? to : [to];

  const emailPayload: Record<string, unknown> = {
    from: fromEmail,
    to: recipients,
    subject,
    html,
  };

  if (text) emailPayload.text = text;
  if (replyTo) emailPayload.reply_to = replyTo;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emailPayload),
  });

  const result = await response.json() as Record<string, unknown>;

  if (!response.ok) {
    console.error('Resend API error:', result);
    throw new HttpsError('internal', (result.message as string) || 'Email send failed');
  }

  return {
    success: true,
    id: result.id as string,
  };
}
