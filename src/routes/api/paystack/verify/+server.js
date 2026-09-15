import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PAYSTACK_SECRET_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

/**
 * Verifies a Paystack reference server-side, then credits the wallet
 * through fund_wallet_paystack — called with the caller's own token, so
 * auth.uid() still ties the credit to the right wallet.
 *
 * The amount credited always comes from Paystack's verify response, never
 * from anything the client sends — so a forged request can't credit an
 * arbitrary amount. The metadata.user_id check below stops one user from
 * taking a reference that belongs to someone else's payment and using it
 * to credit their own wallet instead.
 */
export async function GET({ url, request }) {
	const reference = url.searchParams.get('reference');
	if (!reference) return json({ error: 'Missing reference' }, { status: 400 });

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

	let verifyPayload;
	try {
		const verifyRes = await fetch(
			`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
			{ headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
		);
		verifyPayload = await verifyRes.json();

		if (!verifyRes.ok || !verifyPayload.status) {
			console.error('[paystack:verify] Paystack rejected the request', verifyRes.status, verifyPayload);
			return json({ error: verifyPayload.message ?? 'Verification failed.' }, { status: 502 });
		}
	} catch (err) {
		console.error('[paystack:verify] Request to Paystack threw', err);
		return json({ error: `Verification failed: ${err.message}` }, { status: 502 });
	}

	const tx = verifyPayload.data;

	if (tx.metadata?.user_id !== user.id) {
		return json({ error: 'This reference does not belong to your account.' }, { status: 403 });
	}
	if (tx.status !== 'success') {
		return json({ error: `Payment not successful (status: ${tx.status}).` }, { status: 400 });
	}

	const { data: credited, error: rpcError } = await supabase.rpc('fund_wallet_paystack', {
		p_amount: tx.amount / 100,
		p_provider_reference: reference
	});
	if (rpcError) return json({ error: rpcError.message }, { status: 500 });

	return json({ transaction: credited });
}
