/**
 * Shared CORS utilities for Edge Functions.
 *
 * Set ALLOWED_ORIGIN env var to restrict origins (e.g., "https://interno-cec9f.web.app").
 * Defaults to "*" for development.
 */

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*';

export function getCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, apikey',
  };
}

export function corsResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message: string, status: number): Response {
  return corsResponse({ error: message }, status);
}

/**
 * Extract the Firebase ID token from the request body.
 * Client sends it as `_firebase_token` to avoid Supabase's platform-level
 * JWT verification (which only accepts Supabase-format JWTs).
 */
export async function extractFirebaseToken(req: Request): Promise<string | null> {
  try {
    const body = await req.clone().json();
    return (body as Record<string, unknown>)._firebase_token as string || null;
  } catch {
    return null;
  }
}
