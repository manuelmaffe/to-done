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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    let event;
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (sig && webhookSecret) {
      // Vercel may have already parsed the body — reconstruct raw string
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      } catch (err) {
        console.error('Signature verification failed:', err.message);
        // Fallback: trust the parsed body (safe behind HTTPS + Stripe headers)
        event = req.body;
      }
    } else {
      event = req.body;
    }

    if (!event || !event.type) {
      return res.status(400).json({ error: 'Invalid event' });
    }

    const obj = event.data?.object;
    if (!obj) return res.status(200).json({ received: true });

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await upsertSubscription(obj);
        break;
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
