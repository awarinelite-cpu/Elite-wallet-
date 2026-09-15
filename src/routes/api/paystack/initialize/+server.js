import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PAYSTACK_SECRET_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

/**
 * Starts a Paystack transaction for the signed-in user and returns the
 * checkout URL to redirect to. PAYSTACK_SECRET_KEY is a server-only env
 * var (no PUBLIC_ prefix) — it never reaches the browser.
 */
export async function POST({ request, url }) {
	const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
	if (!token) return json({ error: 'Not authenticated' }, { status: 401 });

	const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		global: { headers: { Authorization: `Bearer ${token}` } }
	});
	const {
		data: { user },
		error: userError
	} = await supabase.auth.getUser();
	if (userError || !user) return json({ error: 'Not authenticated' }, { status: 401 });

	const { amount } = await request.json();
	const naira = Number(amount);
	if (!naira || naira <= 0) {
		return json({ error: 'Enter a valid amount.' }, { status: 400 });
	}

	const psRes = await fetch('https://api.paystack.co/transaction/initialize', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			email: user.email,
			amount: Math.round(naira * 100), // Paystack expects kobo
			callback_url: `${url.origin}/paystack/callback`,
			metadata: { user_id: user.id }
		})
	});
	const payload = await psRes.json();

	if (!psRes.ok || !payload.status) {
		return json({ error: payload.message ?? 'Could not start payment.' }, { status: 502 });
	}

	return json({
		authorization_url: payload.data.authorization_url,
		reference: payload.data.reference
	});
}
