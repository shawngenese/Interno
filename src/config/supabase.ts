import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * C2 (Spark + Supabase Free) client.
 *
 * Firebase Spark keeps Auth/Firestore/Hosting/FCM. Supabase Free (Singapore,
 * no card) provides Edge Functions (trusted server) + Storage (files).
 * Firebase Storage bucket and Cloud Functions are NOT deployed (Blaze-only).
 *
 * Required env (see .env.example):
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY (public anon key only — never the service_role key)
 *
 * The app boots fine without these set; features using Supabase must check
 * `isSupabaseConfigured()` first and show a setup message otherwise.
 */

export const SUPABASE_BUCKETS = {
  DOCUMENTS: 'documents',
  TASKS: 'tasks',
  PROFILES: 'profiles',
} as const;

export type SupabaseBucket = (typeof SUPABASE_BUCKETS)[keyof typeof SUPABASE_BUCKETS];

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return (
    typeof import.meta.env.VITE_SUPABASE_URL === 'string' &&
    import.meta.env.VITE_SUPABASE_URL.length > 0 &&
    typeof import.meta.env.VITE_SUPABASE_ANON_KEY === 'string' &&
    import.meta.env.VITE_SUPABASE_ANON_KEY.length > 0
  );
}

export function getSupabase(): SupabaseClient {
  if (client) return client;
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (Supabase Dashboard > Project Settings > API).',
    );
  }
  client = createClient(
    import.meta.env.VITE_SUPABASE_URL as string,
    import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  );
  return client;
}

/** Base URL for Edge Functions: `${VITE_SUPABASE_URL}/functions/v1/${name}`. */
export function getEdgeFunctionUrl(name: string): string {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Cannot build Edge Function URL.');
  }
  const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
  return `${base}/functions/v1/${name}`;
}

export interface EdgeCallOptions {
  /** Firebase ID token of the caller; edge verifies it via Admin SDK. */
  idToken?: string;
}

/**
 * Call a Supabase Edge Function with the caller's Firebase ID token.
 * Used by Step 3+ (`set_user_role`, `write_audit`, QR, DTR, upload, FCM).
 *
 * The Firebase token is sent in the request body (not the Authorization
 * header) to avoid Supabase's platform-level JWT verification, which only
 * accepts Supabase-format JWTs. Edge Functions verify the Firebase token
 * internally via Admin SDK.
 */
export async function callEdgeFunction<TResponse>(
  name: string,
  body: Record<string, unknown>,
  options: EdgeCallOptions = {},
): Promise<TResponse> {
  const response = await fetch(getEdgeFunctionUrl(name), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify({
      ...body,
      ...(options.idToken ? { _firebase_token: options.idToken } : {}),
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Edge function '${name}' failed (${response.status})${detail ? `: ${detail}` : ''}`);
  }
  return (await response.json()) as TResponse;
}
