import { createClient } from 'npm:@supabase/supabase-js@2.111.0';

const roles = ['viewer', 'treasurer', 'super_admin'];
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store'
};

function reply(status: number, message?: string) {
  return Response.json(message ? { error: message } : { ok: true }, { status, headers: cors });
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return reply(405, 'Use POST.');
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return reply(401, 'Sign in to continue.');

  const url = Deno.env.get('SUPABASE_URL')!;
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    ...options, global: { headers: { Authorization: authorization } }
  });
  const { data: { user }, error: authError } = await caller.auth.getUser(authorization.slice(7));
  if (authError || !user) return reply(401, 'Sign in again.');
  const { data: callerRole, error: callerRoleError } = await caller.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
  if (callerRoleError) return reply(503, 'Could not verify your treasury role. Try again.');
  if (callerRole?.role !== 'super_admin') return reply(403, 'Super Admin access is required.');

  const body = await request.json().catch(() => null);
  if (!body || !['create', 'reset'].includes(body.action)) return reply(400, 'Choose an account action.');
  if (typeof body.password !== 'string' || body.password.length < 6 || new TextEncoder().encode(body.password).length > 72) {
    return reply(400, 'Enter a password of at least six characters and at most 72 bytes.');
  }

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, options);
  if (body.action === 'reset') {
    if (typeof body.target_user_id !== 'string' || !uuid.test(body.target_user_id)) return reply(400, 'Select a user.');
    const { data: target, error: targetError } = await caller.from('user_roles').select('user_id')
      .eq('user_id', body.target_user_id).maybeSingle();
    if (targetError) return reply(500, 'Could not look up the account.');
    if (!target) return reply(404, 'Treasury account not found.');
    const { error } = await admin.auth.admin.updateUserById(target.user_id, { password: body.password });
    return error ? reply(400, error.message) : reply(200);
  }

  if (typeof body.email !== 'string' || typeof body.member_id !== 'string' || !uuid.test(body.member_id) || !roles.includes(body.role)) {
    return reply(400, 'Enter an email and select a member and role.');
  }
  const { data: member, error: memberError } = await caller.from('members').select('name')
    .eq('id', body.member_id).eq('status', 'active').maybeSingle();
  if (memberError) return reply(500, 'Could not look up the member.');
  if (!member) return reply(404, 'Active member not found.');

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: body.email.trim(), password: body.password, email_confirm: true
  });
  if (createError) return reply(400, createError.message);
  const { error: roleError } = await caller.from('user_roles').insert({
    user_id: created.user.id, role: body.role, display_name: member.name
  });
  if (!roleError) return reply(201);

  // A lost response can leave a successfully assigned role in the database.
  const { data: assigned, error: verificationError } = await admin.from('user_roles')
    .select('role').eq('user_id', created.user.id).maybeSingle();
  if (verificationError) {
    console.error('Could not verify role assignment', created.user.id, verificationError.code);
    return reply(503, 'Account created. Check User Management before retrying.');
  }
  if (assigned) return reply(201);

  const { error: cleanupError } = await admin.auth.admin.deleteUser(created.user.id);
  if (cleanupError) {
    console.error('Failed to remove unassigned account', created.user.id, cleanupError.message);
    return reply(500, 'Role assignment failed. The unassigned Auth account requires administrator cleanup.');
  }
  return reply(409, 'Role assignment failed. Account creation was rolled back.');
});
