import { supabase } from './supabase';

export async function logAuditEvent(user, action, details) {
  try {
    await supabase.from('audit_logs').insert([
      {
        user_id: user?.id || null,
        user_email: user?.email || 'system',
        action,
        details
      }
    ]);
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
}
