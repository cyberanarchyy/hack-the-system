// Clip Heist backend (Cloudflare Worker).
// Static files are served straight from ./clip-heist; only /api/* reaches this code.
//
// Stripe is the source of truth for who has paid, so there is no database:
//  - Subscriptions: the customer has an active/trialing subscription.
//  - Lifetime: the customer has metadata lifetime=true (set after a paid one-time checkout).
//
// Secrets (Cloudflare → Workers → clip-heist → Settings → Variables and Secrets):
//   STRIPE_SECRET_KEY      required for payments
//   SESSION_SECRET         required: any long random string, signs Pro passes
//   STRIPE_WEBHOOK_SECRET  optional: makes lifetime purchases stick even if the tab is closed
//   RESEND_API_KEY         optional: enables "restore on another device" login emails

const PASS_DAYS = 30;        // how long a signed Pro pass is valid before re-checking
const LOGIN_MINUTES = 20;    // login link lifetime

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      const route = `${request.method} ${url.pathname}`;
      switch (route) {
        case 'GET /api/health': return json({ ok: true, payments: !!env.STRIPE_SECRET_KEY, login: !!env.RESEND_API_KEY, prices: priceIds(env) });
        case 'POST /api/checkout': return await checkout(request, env, url);
        case 'POST /api/checkout/complete': return await checkoutComplete(request, env);
        case 'POST /api/me': return await me(request, env);
        case 'POST /api/portal': return await portal(request, env, url);
        case 'POST /api/login': return await login(request, env, url);
        case 'POST /api/login/verify': return await loginVerify(request, env);
        case 'POST /api/stripe-webhook': return await webhook(request, env);
        default: return json({ error: 'Not found' }, 404);
      }
    } catch (e) {
      console.error(e);
      return json({ error: e.expose ? e.message : 'Something went wrong. Please try again.' }, e.status || 500);
    }
  },
};

// ---------- helpers ----------
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
function fail(message, status = 400) { const e = new Error(message); e.status = status; e.expose = true; throw e; }
async function body(request) { try { return await request.json(); } catch { return {}; } }
const origin = (env, url) => env.PUBLIC_URL || url.origin;
// The three plans. If no Price ID is configured, the server finds (or creates) the
// product in Stripe by its lookup key, so nothing has to be set up by hand.
const PLANS = {
  month: { env: 'PRICE_MONTHLY', lookup: 'clip_heist_pro_monthly', product: 'Clip Heist Pro', amount: 699, interval: 'month' },
  year: { env: 'PRICE_YEARLY', lookup: 'clip_heist_pro_yearly', product: 'Clip Heist Pro (Yearly)', amount: 4900, interval: 'year' },
  lifetime: { env: 'PRICE_LIFETIME', lookup: 'clip_heist_founder_lifetime', product: 'Clip Heist Founding Member', amount: 7900 },
};
const DESCRIPTION = 'Unlimited 1080p exports, every highlight, streamer layout, captions and effects.';
const priceIds = (env) => Object.fromEntries(Object.entries(PLANS).map(([k, v]) => [k, env[v.env] || (env.STRIPE_SECRET_KEY ? 'auto' : '')]));
const priceCache = {};

async function resolvePrice(env, plan) {
  const cfg = PLANS[plan];
  if (!cfg) fail('That plan isn’t available.');
  if (env[cfg.env]) return env[cfg.env];
  if (priceCache[plan]) return priceCache[plan];
  const found = await stripe(env, 'GET', 'prices', { 'lookup_keys[0]': cfg.lookup, active: 'true', limit: 1 });
  if (found.data[0]) return (priceCache[plan] = found.data[0].id);
  const product = await stripe(env, 'POST', 'products', { name: cfg.product, description: DESCRIPTION, 'metadata[app]': 'clip-heist' });
  const params = { product: product.id, currency: 'usd', unit_amount: cfg.amount, lookup_key: cfg.lookup, transfer_lookup_key: 'true' };
  if (cfg.interval) params['recurring[interval]'] = cfg.interval;
  const price = await stripe(env, 'POST', 'prices', params);
  return (priceCache[plan] = price.id);
}
const validEmail = (e) => typeof e === 'string' && e.length < 200 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlText = (s) => b64url(new TextEncoder().encode(s));
const unb64url = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function sign(env, payload) {
  if (!env.SESSION_SECRET) fail('Server is missing SESSION_SECRET.', 500);
  const data = b64urlText(JSON.stringify(payload));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env.SESSION_SECRET), new TextEncoder().encode(data));
  return `${data}.${b64url(sig)}`;
}
async function verify(env, token, purpose) {
  if (!env.SESSION_SECRET || typeof token !== 'string' || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  let ok = false;
  try {
    const raw = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    ok = await crypto.subtle.verify('HMAC', await hmacKey(env.SESSION_SECRET), raw, new TextEncoder().encode(data));
  } catch { return null; }
  if (!ok) return null;
  const p = JSON.parse(unb64url(data));
  if (p.purpose !== purpose || p.exp < Date.now()) return null;
  return p;
}

// Minimal Stripe client (form-encoded REST API).
function form(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}
async function stripe(env, method, path, params) {
  if (!env.STRIPE_SECRET_KEY) fail('Payments aren’t set up yet.', 503);
  const base = env.STRIPE_API_BASE || 'https://api.stripe.com';
  let url = `${base}/v1/${path}`;
  const init = { method, headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } };
  if (params && method === 'GET') url += '?' + form(params).toString();
  else if (params) { init.body = form(params); init.headers['content-type'] = 'application/x-www-form-urlencoded'; }
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) { console.error('Stripe error', path, data?.error?.message); fail(data?.error?.message || 'Payment provider error.', 502); }
  return data;
}

// What does this customer currently have?
async function entitlement(env, customerId) {
  const subs = await stripe(env, 'GET', 'subscriptions', { customer: customerId, status: 'all', limit: 20 });
  const live = subs.data.find((s) => ['active', 'trialing', 'past_due'].includes(s.status));
  if (live) {
    const item = live.items?.data?.[0];
    return {
      pro: true,
      plan: item?.price?.recurring?.interval === 'year' ? 'year' : 'month',
      status: live.status,
      renewsAt: (item?.current_period_end || live.current_period_end || 0) * 1000,
      cancelAtPeriodEnd: !!live.cancel_at_period_end,
    };
  }
  const cust = await stripe(env, 'GET', `customers/${customerId}`);
  if (cust?.metadata?.lifetime === 'true') return { pro: true, plan: 'lifetime', status: 'active' };
  return { pro: false, plan: null, status: subs.data[0]?.status || 'none' };
}

async function passFor(env, customerId, email) {
  const ent = await entitlement(env, customerId);
  const pass = await sign(env, { purpose: 'pass', cid: customerId, email, exp: Date.now() + PASS_DAYS * 864e5 });
  return { pass, email, ...ent, checkedAt: Date.now() };
}

// ---------- routes ----------
async function checkout(request, env, url) {
  const { plan, email } = await body(request);
  const price = await resolvePrice(env, plan);
  const base = origin(env, url);
  const params = {
    mode: plan === 'lifetime' ? 'payment' : 'subscription',
    'line_items[0][price]': price,
    'line_items[0][quantity]': 1,
    success_url: `${base}/app/?checkout={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/app/?checkout=cancelled`,
    allow_promotion_codes: 'true',
    client_reference_id: 'clip-heist',
  };
  if (plan === 'lifetime') params.customer_creation = 'always';
  else params['subscription_data[trial_period_days]'] = env.TRIAL_DAYS || 7;
  if (validEmail(email)) params.customer_email = email;
  const session = await stripe(env, 'POST', 'checkout/sessions', params);
  return json({ url: session.url });
}

async function checkoutComplete(request, env) {
  const { sessionId } = await body(request);
  if (typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) fail('Invalid checkout session.');
  const s = await stripe(env, 'GET', `checkout/sessions/${sessionId}`);
  if (s.status !== 'complete' || !s.customer) fail('Checkout isn’t finished yet.', 402);
  if (s.mode === 'payment' && s.payment_status === 'paid') {
    await stripe(env, 'POST', `customers/${s.customer}`, { 'metadata[lifetime]': 'true' });
  }
  const email = s.customer_details?.email || s.customer_email || '';
  return json(await passFor(env, s.customer, email));
}

async function me(request, env) {
  const { pass } = await body(request);
  const p = await verify(env, pass, 'pass');
  if (!p) fail('Please sign in again.', 401);
  return json(await passFor(env, p.cid, p.email));
}

async function portal(request, env, url) {
  const { pass } = await body(request);
  const p = await verify(env, pass, 'pass');
  if (!p) fail('Please sign in again.', 401);
  const s = await stripe(env, 'POST', 'billing_portal/sessions', { customer: p.cid, return_url: `${origin(env, url)}/app/#settings` });
  return json({ url: s.url });
}

async function login(request, env, url) {
  const { email } = await body(request);
  if (!validEmail(email)) fail('Enter a valid email address.');
  if (!env.RESEND_API_KEY) fail('Restoring on another device isn’t available yet.', 503);
  const list = await stripe(env, 'GET', 'customers', { email: email.toLowerCase(), limit: 1 });
  // Same answer whether or not the email has bought, so nobody can probe for customers.
  if (list.data[0]) {
    const t = await sign(env, { purpose: 'login', cid: list.data[0].id, email, exp: Date.now() + LOGIN_MINUTES * 6e4 });
    const link = `${origin(env, url)}/app/?login=${encodeURIComponent(t)}`;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: env.EMAIL_FROM || 'Clip Heist <login@getclipheist.app>',
        to: email,
        subject: 'Your Clip Heist sign-in link',
        html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px">
          <h2 style="margin:0 0 12px">Sign in to Clip Heist</h2>
          <p>Tap the button to unlock Pro on this device. The link works for ${LOGIN_MINUTES} minutes.</p>
          <p><a href="${link}" style="display:inline-block;background:#ff3ea5;color:#16000c;font-weight:700;padding:12px 20px;border-radius:10px;text-decoration:none">Unlock Pro</a></p>
          <p style="color:#888;font-size:13px">If you didn’t ask for this, you can ignore this email.</p></div>`,
      }),
    });
    if (!res.ok) { console.error('Resend error', res.status, await res.text()); fail('Couldn’t send the email. Try again soon.', 502); }
  }
  return json({ ok: true });
}

async function loginVerify(request, env) {
  const { token } = await body(request);
  const p = await verify(env, token, 'login');
  if (!p) fail('That link has expired. Request a new one.', 401);
  return json(await passFor(env, p.cid, p.email));
}

// Stripe webhook: marks lifetime purchases even if the buyer never returns to the site.
async function webhook(request, env) {
  if (!env.STRIPE_WEBHOOK_SECRET) return json({ ignored: true });
  const raw = await request.text();
  const header = request.headers.get('stripe-signature') || '';
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=')));
  const t = parts.t, v1 = header.split(',').filter((x) => x.startsWith('v1=')).map((x) => x.slice(3));
  if (!t || !v1.length || Math.abs(Date.now() / 1000 - Number(t)) > 300) return json({ error: 'bad signature' }, 400);
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env.STRIPE_WEBHOOK_SECRET), new TextEncoder().encode(`${t}.${raw}`));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (!v1.includes(hex)) return json({ error: 'bad signature' }, 400);
  const event = JSON.parse(raw);
  if (event.type === 'checkout.session.completed') {
    const s = event.data.object;
    if (s.mode === 'payment' && s.payment_status === 'paid' && s.customer) {
      await stripe(env, 'POST', `customers/${s.customer}`, { 'metadata[lifetime]': 'true' });
    }
  }
  return json({ received: true });
}
