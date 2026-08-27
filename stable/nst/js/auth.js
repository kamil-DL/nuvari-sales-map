import { supabase } from './supabase-client.js';
import { LOGO } from './logo.js';

// Beta and Stable (dev vs prod) share the same origin, so a fixed key here would let a session
// cached in one environment get treated as valid (or get wiped as "stale") in the other. Scoping
// by project means both can stay signed in independently in the same browser — matching
// supabase-client.js's env-scoped storageKey and map.html's own copy of this same cache.
const envTag = supabase.supabaseUrl.split('//')[1].split('.')[0];
const SESSION_KEY = `nst-session-v1-${envTag}`;
const USER_KEY    = `nst-user-v1-${envTag}`;

function saveSession(session, user) {
  if (session?.access_token) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      access_token:  session.access_token,
      refresh_token: session.refresh_token
    }));
  }
  if (user?.id) {
    localStorage.setItem(USER_KEY, JSON.stringify({ id: user.id, email: user.email }));
  }
}

function loadUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
}
function loadTokens() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}

function clearAll() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(`nst-auth-${envTag}`);
  // Clear any Supabase default storage keys
  const sbKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('sb-')) sbKeys.push(k);
  }
  sbKeys.forEach(k => localStorage.removeItem(k));
}

// Restore Supabase client auth state in background so DB queries work
async function restoreClientSession() {
  const tokens = loadTokens();
  if (!tokens) return;
  const { error } = await supabase.auth.setSession(tokens);
  if (error) {
    // Try refresh
    const { data, error: re } = await supabase.auth.refreshSession({ refresh_token: tokens.refresh_token });
    if (!re && data.session) saveSession(data.session, data.session.user);
  }
}

// Supabase silently rotates the refresh token on every use (incl. its own background
// auto-refresh ~hourly). Without this listener, SESSION_KEY/USER_KEY go stale after the
// first rotation — restoreClientSession() above would then hand Supabase an already-used
// refresh token, which it rejects, leaving the client unauthenticated (so RLS-gated writes
// fail) even though the UI still shows the user as signed in. Keep the cache in sync with
// whatever Supabase's client currently considers the live session.
supabase.auth.onAuthStateChange((_event, session) => {
  if (session) saveSession(session, session.user);
});

let _resolveAuth = null;

function injectModal() {
  if (document.getElementById('nst-auth-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'nst-auth-modal';
  modal.innerHTML = `
<div class="nst-auth-backdrop">
  <div class="nst-auth-box">
    <img id="nst-auth-logo" class="nst-auth-logo" alt="Nuvari"/>
    <div id="nst-auth-signin">
      <div class="nst-auth-title">歡迎來到Nuvari業務工具套件</div>
      <div class="nst-auth-sub">Welcome to the Nuvari Sales Tool</div>
      <div class="nst-auth-sub">請登入以繼續 · Sign in to continue</div>
      <label class="nst-field-label">電子郵件 Email</label>
      <input id="nst-auth-email" type="email" class="nst-input" placeholder="you@example.com" autocomplete="email"/>
      <label class="nst-field-label">密碼 Password</label>
      <input id="nst-auth-password" type="password" class="nst-input" placeholder="Password" autocomplete="current-password"/>
      <div style="text-align:right;margin-top:6px">
        <a id="nst-auth-forgot-link" href="#" style="font-size:12.5px;color:var(--nst-accent-dark);font-weight:600">忘記密碼？Forgot password?</a>
      </div>
      <div id="nst-auth-error" class="nst-auth-error"></div>
      <button id="nst-auth-submit" class="nst-btn nst-btn-primary nst-btn-full">登入 Sign in</button>
    </div>
    <div id="nst-auth-forgot" style="display:none">
      <div class="nst-auth-title">重設密碼 Reset password</div>
      <div class="nst-auth-sub">輸入您的電子郵件，我們會寄送重設密碼連結給您</div>
      <div class="nst-auth-sub">Enter your email and we'll send you a reset link</div>
      <label class="nst-field-label">電子郵件 Email</label>
      <input id="nst-auth-forgot-email" type="email" class="nst-input" placeholder="you@example.com" autocomplete="email"/>
      <div id="nst-auth-forgot-error" class="nst-auth-error"></div>
      <div id="nst-auth-forgot-sent" style="display:none;font-size:13px;color:var(--nst-accent-dark);font-weight:600;margin-top:10px">
        ✓ 已寄出重設連結，請至信箱查看 Reset link sent — check your inbox
      </div>
      <button id="nst-auth-forgot-submit" class="nst-btn nst-btn-primary nst-btn-full">傳送重設連結 Send reset link</button>
      <div style="text-align:center;margin-top:10px">
        <a id="nst-auth-back-to-signin" href="#" style="font-size:12.5px;color:var(--nst-gray);font-weight:600">← 返回登入 Back to sign in</a>
      </div>
    </div>
    <div id="nst-auth-setpw" style="display:none">
      <div class="nst-auth-title">設定密碼 Set password</div>
      <div class="nst-auth-sub">請設定您的登入密碼 Please set your password</div>
      <label class="nst-field-label">新密碼 New password</label>
      <input id="nst-auth-newpw" type="password" class="nst-input" placeholder="At least 8 characters"/>
      <label class="nst-field-label">確認密碼 Confirm password</label>
      <input id="nst-auth-newpw2" type="password" class="nst-input" placeholder="Repeat password"/>
      <div id="nst-auth-setpw-error" class="nst-auth-error"></div>
      <button id="nst-auth-setpw-submit" class="nst-btn nst-btn-primary nst-btn-full">設定密碼 Set password</button>
    </div>
  </div>
</div>`;
  modal.style.display = 'none';
  document.body.appendChild(modal);
  document.getElementById('nst-auth-logo').src = LOGO;

  document.getElementById('nst-auth-email').addEventListener('keydown', e => { if (e.key === 'Enter') doSignIn(); });
  document.getElementById('nst-auth-password').addEventListener('keydown', e => { if (e.key === 'Enter') doSignIn(); });
  document.getElementById('nst-auth-submit').addEventListener('click', doSignIn);
  document.getElementById('nst-auth-setpw-submit').addEventListener('click', doSetPassword);

  document.getElementById('nst-auth-forgot-link').addEventListener('click', e => {
    e.preventDefault();
    showForgotPassword();
  });
  document.getElementById('nst-auth-back-to-signin').addEventListener('click', e => {
    e.preventDefault();
    showSignIn();
  });
  document.getElementById('nst-auth-forgot-email').addEventListener('keydown', e => { if (e.key === 'Enter') doForgotPassword(); });
  document.getElementById('nst-auth-forgot-submit').addEventListener('click', doForgotPassword);
}

function showSignIn() {
  document.getElementById('nst-auth-signin').style.display = '';
  document.getElementById('nst-auth-forgot').style.display = 'none';
  document.getElementById('nst-auth-setpw').style.display = 'none';
  document.getElementById('nst-auth-modal').style.display = '';
  setTimeout(() => document.getElementById('nst-auth-email').focus(), 50);
}

function showForgotPassword() {
  document.getElementById('nst-auth-forgot-email').value = document.getElementById('nst-auth-email').value.trim();
  document.getElementById('nst-auth-forgot-error').textContent = '';
  document.getElementById('nst-auth-forgot-sent').style.display = 'none';
  document.getElementById('nst-auth-forgot-submit').style.display = '';
  document.getElementById('nst-auth-signin').style.display = 'none';
  document.getElementById('nst-auth-forgot').style.display = '';
  document.getElementById('nst-auth-modal').style.display = '';
  setTimeout(() => document.getElementById('nst-auth-forgot-email').focus(), 50);
}

function showSetPassword() {
  document.getElementById('nst-auth-signin').style.display = 'none';
  document.getElementById('nst-auth-forgot').style.display = 'none';
  document.getElementById('nst-auth-setpw').style.display = '';
  document.getElementById('nst-auth-modal').style.display = '';
  setTimeout(() => document.getElementById('nst-auth-newpw').focus(), 50);
}

function hideModal() {
  const m = document.getElementById('nst-auth-modal');
  if (m) m.style.display = 'none';
}

async function doSignIn() {
  const email = document.getElementById('nst-auth-email').value.trim();
  const password = document.getElementById('nst-auth-password').value;
  const errEl = document.getElementById('nst-auth-error');
  errEl.textContent = '';
  if (!email || !password) { errEl.textContent = 'Please enter email and password.'; return; }
  const btn = document.getElementById('nst-auth-submit');
  btn.disabled = true; btn.textContent = '登入中… Signing in…';
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  btn.disabled = false; btn.textContent = '登入 Sign in';
  if (error) { errEl.textContent = '電子郵件或密碼錯誤 Incorrect email or password.'; return; }
  // Fetch session if not in response
  let session = data.session;
  if (!session) {
    const { data: sd } = await supabase.auth.getSession();
    session = sd.session;
  }
  saveSession(session, data.user);
  hideModal();
  location.href = '../../index.html';
}

// Sends a Supabase recovery email. The link it contains redirects back to whatever page/env the
// user requested from (redirectTo below) with #access_token=...&type=recovery in the hash —
// requireAuth()'s existing isInviteOrRecovery check already detects that and opens the "set
// password" view, so no separate landing page is needed. That redirect only actually lands on
// this app if the target URL is allow-listed in Supabase's Auth > URL Configuration; until that's
// set (see the dev/prod Site URL + Redirect URLs setup), Supabase silently falls back to its
// default Site URL instead.
async function doForgotPassword() {
  const email = document.getElementById('nst-auth-forgot-email').value.trim();
  const errEl = document.getElementById('nst-auth-forgot-error');
  const sentEl = document.getElementById('nst-auth-forgot-sent');
  errEl.textContent = '';
  sentEl.style.display = 'none';
  if (!email) { errEl.textContent = '請輸入電子郵件 Please enter your email.'; return; }
  const btn = document.getElementById('nst-auth-forgot-submit');
  btn.disabled = true; btn.textContent = '傳送中… Sending…';
  const redirectTo = window.location.origin + window.location.pathname + window.location.search;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  btn.disabled = false; btn.textContent = '傳送重設連結 Send reset link';
  if (error) { errEl.textContent = 'Error: ' + error.message; return; }
  // Supabase doesn't reveal whether the email actually exists (avoids leaking which addresses
  // are registered) — this same success message shows either way, matching that behavior.
  sentEl.style.display = '';
  btn.style.display = 'none';
}

async function doSetPassword() {
  const pw1 = document.getElementById('nst-auth-newpw').value;
  const pw2 = document.getElementById('nst-auth-newpw2').value;
  const errEl = document.getElementById('nst-auth-setpw-error');
  errEl.textContent = '';
  if (!pw1 || pw1.length < 8) { errEl.textContent = 'Password must be at least 8 characters.'; return; }
  if (pw1 !== pw2) { errEl.textContent = '密碼不一致 Passwords do not match.'; return; }
  const btn = document.getElementById('nst-auth-setpw-submit');
  btn.disabled = true; btn.textContent = '設定中… Setting…';
  const { data, error } = await supabase.auth.updateUser({ password: pw1 });
  btn.disabled = false; btn.textContent = '設定密碼 Set password';
  if (error) { errEl.textContent = 'Error: ' + error.message; return; }
  const { data: sd } = await supabase.auth.getSession();
  if (sd.session) saveSession(sd.session, data.user);
  hideModal();
  location.href = '../../index.html';
}

export function requireAuth() {
  return new Promise(async resolve => {
    injectModal();

    const hash = window.location.hash || '';
    const isInviteOrRecovery = /type=(invite|recovery)/.test(hash);

    // 1. Check Supabase native session
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      saveSession(session, session.user);
      if (isInviteOrRecovery) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
        _resolveAuth = resolve;
        showSetPassword();
      } else {
        resolve({ id: session.user.id, email: session.user.email });
      }
      return;
    }

    // 2. Fall back to stored user identity, but wait for the client session to
    // actually be restored — otherwise callers query the DB as `anon` right after
    // requireAuth() resolves, and RLS silently returns empty results (not an error).
    const storedUser = loadUser();
    if (storedUser?.id) {
      await restoreClientSession();
      resolve({ id: storedUser.id, email: storedUser.email });
      return;
    }

    // 3. No session anywhere — show login
    _resolveAuth = resolve;
    showSignIn();
  });
}

export async function signOut() {
  clearAll();
  await supabase.auth.signOut();
  location.href = location.pathname.includes('/nst/') ? 'index.html' : 'nst/index.html';
}
