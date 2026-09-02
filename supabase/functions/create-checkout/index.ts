/* =============================================================================
   create-checkout — opens a Stripe Checkout Session for the signed-in account
   -----------------------------------------------------------------------------
   The browser sends nothing but its own session. Not the price, not the
   course, not a coupon — nothing a request could lie about. This function
   reads the amount from the settings table, records the attempt as a purchase
   in `checkout_started`, and hands back a URL on Stripe's domain.

   Deploy:
     supabase functions deploy create-checkout
     supabase secrets set STRIPE_SECRET_KEY=sk_live_… SITE_URL=https://…
   ============================================================================= */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STRIPE_KEY   = Deno.env.get('STRIPE_SECRET_KEY')!;
const SITE_URL     = (Deno.env.get('SITE_URL') ?? '').replace(/\/+$/, '');
const COURSE_SLUG  = Deno.env.get('COURSE_SLUG') ?? 'ai-web-developer';

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });
}

/* Stripe's API is form-encoded. One small helper beats a dependency. */
function form(obj: Record<string, string>) {
  return new URLSearchParams(obj).toString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    /* ---------------------------------------------------------- who is this */
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) return json({ error: 'not signed in' }, 401);

    const asUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await asUser.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'not signed in' }, 401);
    const user = userData.user;

    /* ------------------------------------------------ what does it cost today */
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: priceRow, error: priceErr } = await admin
      .from('settings').select('value').eq('key', 'course_price').single();
    if (priceErr) return json({ error: 'the price is not configured' }, 500);

    const amount   = Number(priceRow.value.amount);
    const currency = String(priceRow.value.currency ?? 'EUR').toLowerCase();
    if (!Number.isInteger(amount) || amount <= 0) {
      return json({ error: 'the price is not configured' }, 500);
    }

    const { data: course, error: courseErr } = await admin
      .from('courses').select('id, title, description').eq('slug', COURSE_SLUG).single();
    if (courseErr) return json({ error: 'unknown course' }, 500);

    /* Already paid? Then there is nothing to sell and we say so plainly. */
    const { data: owned } = await admin
      .from('purchases').select('id').eq('user_id', user.id).eq('status', 'paid').maybeSingle();
    if (owned) return json({ error: 'already_owned' }, 409);

    /* ------------------------------------------------------- open the session */
    const body = form({
      mode: 'payment',
      'payment_method_types[0]': 'card',
      'payment_method_types[1]': 'ideal',
      client_reference_id: user.id,
      customer_email: user.email ?? '',
      'metadata[user_id]': user.id,
      'metadata[course]': COURSE_SLUG,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': currency,
      'line_items[0][price_data][unit_amount]': String(amount),
      'line_items[0][price_data][product_data][name]': course.title,
      'line_items[0][price_data][product_data][description]':
        (course.description ?? '').slice(0, 300),
      success_url: `${SITE_URL}/welcome.html?session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/checkout.html?cancelled=1`,
      'automatic_tax[enabled]': 'false',
      locale: 'auto',
    });

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_KEY}`,
        'content-type': 'application/x-www-form-urlencoded',
        /* Two clicks on one button must not open two sessions. */
        'Idempotency-Key': `km-${user.id}-${Math.floor(Date.now() / 60000)}`,
      },
      body,
    });
    const session = await res.json();
    if (!res.ok) {
      console.error('stripe refused the session', session?.error?.message);
      return json({ error: 'the payment provider refused this request' }, 502);
    }

    /* Record the attempt. open_checkout reads the amount from the database
       again, so even this function cannot write a price of its own. */
    const { error: openErr } = await admin.rpc('open_checkout', {
      p_user_id: user.id,
      p_provider_ref: session.id,
      p_course_slug: COURSE_SLUG,
    });
    if (openErr) {
      console.error('could not record the checkout', openErr.message);
      return json({ error: 'could not start the checkout' }, 500);
    }

    return json({ url: session.url, id: session.id, amount, currency });
  } catch (e) {
    console.error(e);
    return json({ error: 'unexpected error' }, 500);
  }
});
