import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function upsertSubscription(subscription) {
  const userId = subscription.metadata?.supabase_user_id;
  if (!userId) return;

  const { error } = await supabase.from('subscriptions').upsert({
    user_id: userId,
    stripe_customer_id: subscription.customer,
    stripe_subscription_id: subscription.id,
    status: subscription.status,
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end || false,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  if (error) console.error('Supabase upsert error:', error);
}

// Use Web API (Request/Response) to get raw body — avoids Vercel body parsing
export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const rawBody = await req.text();
    const sig = req.headers.get('stripe-signature');

    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Signature verification failed:', err.message);
      return new Response(JSON.stringify({ error: err.message }), { status: 400 });
    }

    const obj = event.data?.object;
    if (!obj) return new Response(JSON.stringify({ received: true }), { status: 200 });

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await upsertSubscription(obj);
        break;
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
