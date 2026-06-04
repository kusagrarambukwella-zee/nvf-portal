import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const { data: profile } = await anonClient.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return new Response(JSON.stringify({ error: 'Admins only' }), { status: 403, headers: corsHeaders });

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { full_name, company_name, phone, email, password } = await req.json();
    if (!email || !full_name) return new Response(JSON.stringify({ error: 'email and full_name are required' }), { status: 400, headers: corsHeaders });

    let result;

    if (password) {
      // Create account with password directly — no email needed
      result = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, company_name, phone, role: 'client' }
      });
    } else {
      // Send magic link invitation email
      result = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { full_name, company_name, phone, role: 'client' },
        redirectTo: 'https://novahfalcons.com/client-portal/'
      });
    }

    if (result.error) return new Response(JSON.stringify({ error: result.error.message }), { status: 400, headers: corsHeaders });
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
