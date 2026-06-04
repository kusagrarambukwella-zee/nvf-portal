// ═══════════════════════════════════════════════════════
//  NovahFalcons Portal — Supabase Configuration
//  Replace these values after creating your Supabase project
// ═══════════════════════════════════════════════════════

const SUPABASE_URL  = 'https://nplxdqhnracszrdlkeap.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wbHhkcWhucmFjc3pyZGxrZWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MDMxODMsImV4cCI6MjA5NjA3OTE4M30.p4JrSYvUHWYvQhc4ykMWyRZcfrRk5ntOeJC8PMx7kN4';

// Import from CDN (no build step needed)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Auth helpers ─────────────────────────────────────
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = '/client-portal/';
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ── Profile helpers ───────────────────────────────────
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

// ── Project helpers ───────────────────────────────────
export async function getMyProject(clientId) {
  const { data, error } = await supabase
    .from('projects')
    .select('*, manager:profiles!projects_manager_id_fkey(full_name, avatar)')
    .eq('client_id', clientId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data, error };
}

export async function getAllProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*, client:profiles!projects_client_id_fkey(full_name, company_name), manager:profiles!projects_manager_id_fkey(full_name)')
    .order('updated_at', { ascending: false });
  return { data, error };
}

// ── Payment helpers ───────────────────────────────────
export async function uploadPaymentSlip(file, projectId, userId) {
  const ext  = file.name.split('.').pop();
  const path = `slips/${userId}/${projectId}_${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from('payment-slips').upload(path, file);
  if (upErr) throw upErr;
  const { data: { publicUrl } } = supabase.storage.from('payment-slips').getPublicUrl(path);
  return publicUrl;
}

export async function submitPayment(payload) {
  const { data, error } = await supabase.from('payments').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function getPendingPayments() {
  const { data, error } = await supabase
    .from('payments')
    .select('*, client:profiles!payments_client_id_fkey(full_name, company_name), project:projects(code)')
    .eq('status', 'pending')
    .order('submitted_at', { ascending: false });
  return { data, error };
}

export async function updatePaymentStatus(id, status) {
  const { error } = await supabase
    .from('payments')
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ── Meetings helpers ──────────────────────────────────
export async function getMeetings(projectId) {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('project_id', projectId)
    .order('meeting_date', { ascending: true });
  return { data, error };
}

// ── Messages (Realtime) ───────────────────────────────
export async function getMessages(projectId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*, sender:profiles!messages_sender_id_fkey(full_name, avatar)')
    .eq('project_id', projectId)
    .order('sent_at', { ascending: true })
    .limit(100);
  return { data, error };
}

export async function sendMessage(projectId, senderId, message) {
  const { error } = await supabase
    .from('messages')
    .insert({ project_id: projectId, sender_id: senderId, message });
  if (error) throw error;
}

export function subscribeToMessages(projectId, callback) {
  return supabase
    .channel('messages:' + projectId)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `project_id=eq.${projectId}` },
      payload => callback(payload.new)
    )
    .subscribe();
}

// ── Documents helpers ─────────────────────────────────
export async function getDocuments(projectId) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('project_id', projectId)
    .neq('visibility', 'internal')
    .order('uploaded_at', { ascending: false });
  return { data, error };
}

// ── Invoices helpers ──────────────────────────────────
export async function getInvoices(projectId) {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  return { data, error };
}

// ── Notifications ──────────────────────────────────────
export async function getNotifications(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  return { data, error };
}

// ── Activity log ──────────────────────────────────────
export async function logActivity(userId, action, module, detail) {
  await supabase.from('activity_log').insert({ user_id: userId, action, module, detail });
}
