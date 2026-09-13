/**
 * Edge Function test: write_audit
 *
 * Run with Supabase CLI:
 *   npx supabase functions serve write_audit --env-file .env.local
 *   deno test --allow-net --allow-env supabase/functions/write_audit/test.ts
 *
 * Requires env:
 *   SUPABASE_URL, SUPABASE_ANON_KEY, FIREBASE_ID_TOKEN (from sign-in)
 */
import { assertEquals, assertExists, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'http://localhost:54321';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const ID_TOKEN = Deno.env.get('FIREBASE_ID_TOKEN') ?? '';

const EDGE_URL = `${SUPABASE_URL}/functions/v1/write_audit`;

async function callEdge(body: Record<string, unknown>, token = ID_TOKEN) {
  return fetch(EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

Deno.test('CORS preflight returns 200', async () => {
  const res = await fetch(EDGE_URL, { method: 'OPTIONS' });
  assertEquals(res.status, 200);
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), '*');
});

Deno.test('Missing auth header returns 401', async () => {
  const res = await fetch(EDGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ userId: 'u1', action: 'create', entityType: 'user', entityId: 'e1' }),
  });
  assertEquals(res.status, 401);
  const json = await res.json();
  assertStringIncludes(json.error, 'Authorization');
});

Deno.test('Missing required fields returns 400', async () => {
  const res = await callEdge({ userId: 'u1' });
  assertEquals(res.status, 400);
  const json = await res.json();
  assertStringIncludes(json.error, 'required');
});

Deno.test('Invalid action returns 400', async () => {
  const res = await callEdge({
    userId: 'u1',
    action: 'invalid_action',
    entityType: 'user',
    entityId: 'e1',
  });
  assertEquals(res.status, 400);
  const json = await res.json();
  assertStringIncludes(json.error, 'Invalid action');
});

Deno.test('Invalid entityType returns 400', async () => {
  const res = await callEdge({
    userId: 'u1',
    action: 'create',
    entityType: 'invalid_type',
    entityId: 'e1',
  });
  assertEquals(res.status, 400);
  const json = await res.json();
  assertStringIncludes(json.error, 'Invalid entityType');
});

Deno.test('Successful write returns logId', async () => {
  const res = await callEdge({
    userId: 'test-user-edge',
    action: 'create',
    entityType: 'user',
    entityId: `test-${Date.now()}`,
    metadata: { source: 'edge-test' },
  });
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.success, true);
  assertExists(json.logId);
});

Deno.test('Write with originalValue and newValue succeeds', async () => {
  const res = await callEdge({
    userId: 'test-user-edge',
    action: 'update',
    entityType: 'user',
    entityId: `test-update-${Date.now()}`,
    originalValue: { status: 'pending' },
    newValue: { status: 'active' },
    metadata: { source: 'edge-test' },
  });
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.success, true);
});

Deno.test('Missing token returns 401', async () => {
  const res = await callEdge(
    { userId: 'u1', action: 'create', entityType: 'user', entityId: 'e1' },
    '',
  );
  assertEquals(res.status, 401);
});
