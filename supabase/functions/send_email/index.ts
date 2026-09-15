/**
 * Edge Function: send_email
 *
 * Sends emails via Resend free tier (3,000 emails/month, no card required).
 * Supabase blocks ports 25/587, so we use Resend's HTTPS API.
 *
 * Env secrets required:
 *   RESEND_API_KEY - Resend API key (from resend.com dashboard)
 *   EMAIL_FROM - Sender email (must be verified in Resend, e.g. "Interno <noreply@yourdomain.com>")
 *
 * Body:
 * {
 *   to: string | string[],      // recipient email(s)
 *   subject: string,
 *   html: string,               // HTML body
 *   text?: string,              // plain text fallback
 *   replyTo?: string,           // reply-to address
 * }
 *
 * Returns:
 * {
 *   success: boolean,
 *   id: string,                 // Resend message ID
 * }
 */
import { serve } from 'std/http/server.ts';
import { corsResponse, errorResponse } from '../_shared/cors.ts';

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return corsResponse({ ok: true });
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('EMAIL_FROM');

    if (!apiKey || !fromEmail) {
      return errorResponse('Email not configured (RESEND_API_KEY or EMAIL_FROM missing)', 500);
    }

    const { to, subject, html, text, replyTo } = await req.json();

    if (!to || !subject || !html) {
      return errorResponse('Missing required fields: to, subject, html', 400);
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

    const result = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', result);
      return errorResponse(result.message || 'Email send failed', response.status);
    }

    return corsResponse({
      success: true,
      id: result.id,
    });
  } catch (err) {
    console.error('send_email error:', err);
    return errorResponse('Internal server error', 500);
  }
});
