import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { verifyFirebaseToken } from '../_shared/auth.ts';
import { initAdmin, getAuthInstance } from '../_shared/config.ts';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  try {
    const [user, error] = await verifyFirebaseToken(req);
    if (error) return error;

    if (user?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { uid } = body;
    if (!uid) {
      return new Response(JSON.stringify({ error: 'Missing uid' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    initAdmin();
    const auth = getAuthInstance();
    await auth.deleteUser(uid);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
