import { json, text } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { PAYSTACK_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';

/**
 * Paystack webhook — the source of truth for how a transfer actually
 * resolved. Runs with no user session (Paystack calls this server-to-
 * server), so it authenticates with the Supabase service role key and
 * calls resolve_transfer_webhook, which is itself locked down to only be
 * callable by that role — see schema.sql.
 *
 * Configure this URL in the Paystack dashboard under Settings → API Keys
 * & Webhooks: https://<your-app>.vercel.app/api/paystack/webhook
 */
export async function POST({ request }) {
	const rawBody = await request.text();

	// Signature is an HMAC-SHA512 of the raw body using the secret key —
	// this is what proves the request actually came from Paystack.
	const signature = request.headers.get('x-paystack-signature') ?? '';
	const expected = crypto
		.createHmac('sha512', PAYSTACK_SECRET_KEY)
		.update(rawBody)
		.digest('hex');

	if (
		signature.length !== expected.length ||
		!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
	) {
		return text('Invalid signature', { status: 401 });
	}

	const event = JSON.parse(rawBody);
	const reference = event.data?.reference;

	const relevant = {
		'transfer.success': 'successful',
		'transfer.failed': 'failed',
		'transfer.reversed': 'reversed'
	};

	if (reference && event.event in relevant) {
		const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
		const { error } = await supabaseAdmin.rpc('resolve_transfer_webhook', {
			p_reference: reference,
			p_status: relevant[event.event]
		});
		// Log but still 200 — Paystack retries on non-2xx, and retrying
		// won't fix a bad reference or a DB error.
		if (error) console.error('Paystack webhook resolve failed:', error.message);
	}

	// Always acknowledge with 200 so Paystack doesn't retry events we
	// intentionally ignore (charge events, other transfer states, etc).
	return json({ received: true });
}
