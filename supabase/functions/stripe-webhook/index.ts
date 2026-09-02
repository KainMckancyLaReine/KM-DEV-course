/* =============================================================================
   stripe-webhook — the only thing in this system that may say "paid"
   -----------------------------------------------------------------------------
   Stripe posts here when a payment completes, fails or is refunded. Every
   request is verified against the signing secret before it is believed: the
   signature covers the timestamp and the raw body, so a forged call cannot
   grant anybody the course, and a replayed one is refused on age.

   Access follows from the purchase row this writes. Nothing else grants it.

   Deploy (note --no-verify-jwt: Stripe has no Supabase session, its signature
   is the credential):
     supabase functions deploy stripe-webhook --no-verify-jwt
     supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_…
   ============================================================================= */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const TOLERANCE_S    = 300;   /* five minutes, Stripe's own default */

const enc = new TextEncoder();

function hex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* Constant time, so the comparison itself leaks nothing. */
function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verify(payload: string, header: string | null): Promise<boolean> {
  if (!header || !WEBHOOK_SECRET) return false;

  const parts = Object.fromEntries(
    header.split(',').map((p) => p.split('=', 2) as [string, string]),
  );
  const t = Number(parts.t);
  if (!Number.isFinite(t)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - t) > TOLERANCE_S) return false;

  const key = await crypto.subtle.importKey(
    'raw', enc.encode(WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac = hex(await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${payload}`)));

  /* A rotated secret means several v1 signatures; any one matching is enough. */
  return header.split(',')
    .filter((p) => p.startsWith('v1='))
    .some((p) => equal(p.slice(3), mac));
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const payload = await req.text();
  if (!(await verify(payload, req.headers.get('stripe-signature')))) {
    /* Deliberately terse: an unverified caller is told nothing. */
    return new Response('invalid signature', { status: 400 });
  }

  let event: any;
  try { event = JSON.parse(payload); } catch { return new Response('bad payload', { status: 400 }); }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  async function record(ref: string, status: string, extra: Record<string, unknown> = {}) {
    const { error } = await admin.rpc('record_payment', {
      p_provider_ref: ref,
      p_status: status,
      p_payment_ref: extra.payment_ref ?? null,
      p_receipt_url: extra.receipt_url ?? null,
      p_amount: extra.amount ?? null,
      p_currency: extra.currency ?? null,
    });
    if (error) console.error(`record_payment(${ref}, ${status}) failed:`, error.message);
    return !error;
  }

  try {
    switch (event.type) {
      /* The ordinary path: card or iDEAL, settled at once. */
      case 'checkout.session.completed': {
        const s = event.data.object;
        await record(
          s.id,
          s.payment_status === 'paid' ? 'paid' : 'payment_pending',
          {
            payment_ref: s.payment_intent ?? null,
            amount: s.amount_total ?? null,
            currency: (s.currency ?? 'eur').toUpperCase(),
          },
        );
        break;
      }

      /* Some methods clear later. Stripe tells us when they do. */
      case 'checkout.session.async_payment_succeeded': {
        const s = event.data.object;
        await record(s.id, 'paid', {
          payment_ref: s.payment_intent ?? null,
          amount: s.amount_total ?? null,
          currency: (s.currency ?? 'eur').toUpperCase(),
        });
        break;
      }

      case 'checkout.session.async_payment_failed':
        await record(event.data.object.id, 'cancelled');
        break;

      case 'checkout.session.expired':
        await record(event.data.object.id, 'cancelled');
        break;

      /* A refund closes the course again — has_access() reads the same row. */
      case 'charge.refunded': {
        const c = event.data.object;
        const { data: row } = await admin
          .from('purchases').select('provider_ref')
          .eq('payment_ref', c.payment_intent).maybeSingle();
        if (row?.provider_ref) await record(row.provider_ref, 'refunded');
        break;
      }

      default:
        /* Everything else is acknowledged and ignored, so Stripe stops retrying. */
        break;
    }
  } catch (e) {
    console.error('webhook handler failed', e);
    /* 500 asks Stripe to retry, which is what we want for a transient fault. */
    return new Response('handler error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'content-type': 'application/json' },
  });
});
