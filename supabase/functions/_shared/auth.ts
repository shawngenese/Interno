/**
 * Shared Firebase token verification for Edge Functions.
 *
 * The client sends the Firebase ID token as `_firebase_token` in the request
 * body (not the Authorization header) to avoid Supabase's platform-level JWT
 * verification which only accepts Supabase-format JWTs.
 */
import { initAdmin, getAuthInstance } from './config.ts';
import { corsResponse, errorResponse } from './cors.ts';

export interface VerifiedUser {
  uid: string;
  role?: string;
  [key: string]: unknown;
}

/**
 * Verify the Firebase ID token from a pre-parsed body or Request and return decoded claims.
 * Returns [null, Response] on failure (the Response is the error to return).
 *
 * Callers should parse the body ONCE and pass the object in. This avoids
 * consuming the Request body stream twice (once here, once in the handler).
 */
export async function verifyFirebaseToken(
  bodyOrReq: Record<string, unknown> | Request,
): Promise<[VerifiedUser | null, Response | null]> {
  initAdmin();
  const auth = getAuthInstance();

  let body: Record<string, unknown>;
  if (bodyOrReq instanceof Request) {
    try {
      body = await bodyOrReq.json();
    } catch {
      return [null, errorResponse('Invalid JSON body', 400)];
    }
  } else {
    body = bodyOrReq;
  }

  const idToken = body._firebase_token as string | undefined;
  if (!idToken) {
    return [null, errorResponse('Missing _firebase_token in request body', 401)];
  }

  try {
    const decoded = await auth.verifyIdToken(idToken);
    return [decoded as VerifiedUser, null];
  } catch (err) {
    return [null, errorResponse(
      `Invalid Firebase token: ${err instanceof Error ? err.message : 'unknown'}`,
      401,
    )];
  }
}
