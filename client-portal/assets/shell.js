// ═══════════════════════════════════════════════════════
//  NovahFalcons Portal — Shared Shell Builder
// ═══════════════════════════════════════════════════════
import { supabase, getProfile, signOut, logActivity } from './supabase.js';

export async function initShell(activePage) {
  // Auth guard
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = '/client-portal/'; return null; }

  const user    = session.user;
  const role    = user.user_metadata?.role || 'client';
  const profile = await getProfile(user.id).catch(() => null);

  const name    = profile?.full_name  || user.email;
  const avatar  = profile?.avatar     || name.slice(0,2).toUpperCase();
  const isAdmin = role === 'admin';

  // Redirect if wrong role tries to access wrong section
  const onAdminPage  = window.location.pathname.includes('/admin/');
  const onPortalPage = window.location.pathname.includes('/portal/');
  if (isAdmin && onPortalPage) { window.location.href = '../admin/dashboard.html'; return null; }
  if (!isAdmin && onAdminPage) { window.location.href = '../portal/dashboard.html'; return null; }

  const adminNav = `
    <div class="sb-sec">Overview</div>
    <a class="sb-it ${activePage==='dashboard'?'active':''}" href="./dashboard.html">&#9635; Dashboard</a>
    <a class="sb-it ${activePage==='projects'?'active':''}"  href="./projects.html">&#9672; Projects</a>
    <div class="sb-sec">Management</div>
    <a class="sb-it ${activePage==='clients'?'active':''}"   href="./clients.html">&#11044; Clients</a>
    <a class="sb-it ${activePage==='invoices'?'active':''}"  href="./invoices.html">&#9678; Invoices</a>
    <a class="sb-it ${activePage==='payments'?'active':''}"  href="./payments.html">&#9670; Payments</a>
    <a class="sb-it ${activePage==='meetings'?'active':''}"  href="./meetings.html">&#9719; Meetings</a>
    <div class="sb-sec">Setup</div>
    <a class="sb-it ${activePage==='services'?'active':''}"  href="./services.html">&#10022; Services</a>
    <a class="sb-it ${activePage==='documents'?'active':''}" href="./documents.html">&#9643; Documents</a>
    <a class="sb-it ${activePage==='activity'?'active':''}"  href="./activity.html">&#9681; Activity Log</a>`;

  const clientNav = `
    <div class="sb-sec">My Portal</div>
    <a class="sb-it ${activePage==='dashboard'?'active':''}" href="./dashboard.html">&#9635; Dashboard</a>
    <a class="sb-it ${activePage==='project'?'active':''}"   href="./project.html">&#9672; Project Status</a>
    <a class="sb-it ${activePage==='invoices'?'active':''}"  href="./invoices.html">&#9678; Invoices</a>
    <a class="sb-it ${activePage==='payments'?'active':''}"  href="./payments.html">&#9670; Payments</a>
    <a class="sb-it ${activePage==='meetings'?'active':''}"  href="./meetings.html">&#9719; Meetings</a>
    <a class="sb-it ${activePage==='documents'?'active':''}" href="./documents.html">&#9643; Documents</a>
    <a class="sb-it ${activePage==='chat'?'active':''}"      href="./chat.html">&#9677; Chat</a>
    <a class="sb-it ${activePage==='signoff'?'active':''}"   href="./signoff.html">&#10022; Sign-Off</a>`;

  document.getElementById('app').innerHTML = `
    <nav class="sb" id="sb">
      <div class="sb-hd">
        <div class="sb-logo">
          <div class="sb-mark"><img src="../assets/logo.png" alt="NovahFalcons"></div>
          <div>
            <div class="sb-br">NOVAH<span>FALCONS</span></div>
            <div class="sb-tag">${isAdmin ? 'ADMIN' : 'CLIENT'} PORTAL</div>
          </div>
        </div>
      </div>
      <div class="sb-nav">${isAdmin ? adminNav : clientNav}</div>
      <div class="sb-usr">
        <div class="u-av">${avatar}</div>
        <div><div class="u-nm">${escHtml(name)}</div><div class="u-rl">${role.toUpperCase()}</div></div>
        <button class="u-out" id="logout-btn" title="Sign out">&#9167;</button>
      </div>
    </nav>
    <div class="mn">
      <div class="tpb">
        <button id="mbtn" style="display:none;background:none;border:none;font-size:20px;cursor:pointer;color:var(--t3);margin-right:4px" onclick="document.getElementById('sb').classList.toggle('open')">&#9776;</button>
        <div class="tpb-title" id="page-title">Dashboard</div>
        <div class="tpb-r" id="topbar-actions"></div>
      </div>
      <div class="cnt" id="page-content">
        <div style="display:flex;align-items:center;justify-content:center;height:200px">
          <div style="text-align:center"><div style="width:32px;height:32px;border:3px solid var(--teal-md);border-top-color:var(--teal);border-radius:50%;animation:sp .6s linear infinite;margin:0 auto 12px"></div><div style="font-size:13px;color:var(--t3)">Loading...</div></div>
        </div>
      </div>
    </div>`;

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await logActivity(user.id, 'LOGOUT', 'Auth', 'User signed out');
    await signOut();
  });

  // Responsive
  function checkMobile() {
    const b = document.getElementById('mbtn');
    if(b) b.style.display = window.innerWidth < 768 ? 'block' : 'none';
  }
  checkMobile();
  window.addEventListener('resize', checkMobile);

  // Modal helpers
  window.openM  = id => document.getElementById(id)?.classList.add('open');
  window.closeM = id => document.getElementById(id)?.classList.remove('open');
  document.addEventListener('keydown', e => {
    if(e.key==='Escape') document.querySelectorAll('.mov.open').forEach(m=>m.classList.remove('open'));
  });

  return { user, profile, role, isAdmin };
}

export function setTitle(title) {
  document.getElementById('page-title').textContent = title;
  document.title = title + ' — NovahFalcons Portal';
}

export function setContent(html) {
  document.getElementById('page-content').innerHTML = html;
}

export function setTopbarActions(html) {
  document.getElementById('topbar-actions').innerHTML = html;
}

export function escHtml(s) {
  if(!s) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

export function fmt(n) { return Number(n||0).toLocaleString(); }

export function badge(status) {
  const map = {
    active:'bt', completed:'bg', pending:'bam', approved:'bg',
    rejected:'br', paused:'bgr', low:'rl', medium:'rm', high:'rh',
    paid:'bg', partially_paid:'bam', overdue:'br', draft:'bgr',
    upcoming:'bt', sent:'bbl'
  };
  return `<span class="b ${map[status]||'bgr'}">${status?.replace(/_/g,' ')}</span>`;
}

export function progressBar(pct) {
  return `<div class="pw"><div class="pb" style="width:${pct}%"></div></div>`;
}

export function timeAgo(dateStr) {
  const d = new Date(dateStr), now = new Date();
  const diff = Math.floor((now-d)/1000);
  if(diff<60) return 'just now';
  if(diff<3600) return Math.floor(diff/60)+'m ago';
  if(diff<86400) return Math.floor(diff/3600)+'h ago';
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
}
