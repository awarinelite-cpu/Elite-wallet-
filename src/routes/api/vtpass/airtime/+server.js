import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { VTPASS_API_KEY, VTPASS_SECRET_KEY, VTPASS_BASE_URL } from '$env/static/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

// serviceID values as specified by VTpass — note '9mobile' is 'etisalat'
// on their side for historical reasons.
const SERVICE_ID = { MTN: 'mtn', Airtel: 'airtel', Glo: 'glo', '9mobile': 'etisalat' };

// VTpass request IDs must be prefixed with the current date/time
// (YYYYMMDDHHmm) — see vtpass.com/documentation/how-to-generate-request-id.
function generateRequestId() {
	const now = new Date();
	const pad = (n) => String(n).padStart(2, '0');
	const stamp =
		now.getFullYear().toString() +
		pad(now.getMonth() + 1) +
		pad(now.getDate()) +
		pad(now.getHours()) +
		pad(now.getMinutes());
	const rand = Math.random().toString(36).slice(2, 10);
	return stamp + rand;
}

/**
 * Buys real MTN/Airtel/Glo/9mobile airtime through VTpass.
 *
 * Same pending-then-resolve shape as the Paystack withdraw route: the
 * wallet is debited FIRST (status 'pending') before VTpass is ever
 * contacted, so the balance can't be spent twice while the request is in
 * flight. VTpass's /api/pay responds synchronously (no webhook for
 * airtime), so we resolve success/failure in the same request — reversing
 * the debit if VTpass rejects it or the request errors out.
 *
 * response_description/code meanings, per VTpass docs:
 *   code '000' + content.transactions.status 'delivered' -> success
 *   anything else -> treat as failed and refund
 * A genuinely ambiguous case (network error / timeout with VTpass) is left
 * 'pending' rather than guessed at, since we can't tell whether VTpass
 * actually processed it — that needs a manual requery against VTpass's
 * status endpoint before it's safe to either resolve or reverse.
 */
export async function POST({ request }) {
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

	const { amount, network, phone } = await request.json();
	const naira = Number(amount);
	if (!naira || naira <= 0) return json({ error: 'Enter a valid amount.' }, { status: 400 });
	const serviceID = SERVICE_ID[network];
	if (!serviceID) return json({ error: 'Unknown network.' }, { status: 400 });
	if (!phone || phone.length < 11) return json({ error: 'Enter a valid phone number.' }, { status: 400 });

	// 1. Debit + hold, before VTpass is ever contacted.
	const { data: tx, error: debitError } = await supabase.rpc('debit_wallet_for_airtime', {
		p_amount: naira,
		p_network: network,
		p_phone: phone
	});
	if (debitError) return json({ error: debitError.message }, { status: 400 });

	async function reverseAndFail(message, status = 502) {
		await supabase.rpc('reverse_wallet_debit', { p_reference: tx.reference });
		return json({ error: message }, { status });
	}

	let payload;
	try {
		const res = await fetch(`${VTPASS_BASE_URL}/pay`, {
			method: 'POST',
			headers: {
				'api-key': VTPASS_API_KEY,
				'secret-key': VTPASS_SECRET_KEY,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				request_id: generateRequestId(),
				serviceID,
				amount: naira,
				phone
			})
		});
		payload = await res.json();
	} catch (err) {
		console.error('[vtpass:airtime] Request to VTpass threw', err);
		// Genuinely ambiguous — leave the debit 'pending' rather than guess.
		return json(
			{ error: `Could not reach VTpass: ${err.message}. Your debit is on hold, not lost — contact support with reference ${tx.reference}.` },
			{ status: 502 }
		);
	}

	const status = payload?.content?.transactions?.status;
	if (payload?.code === '000' && status === 'delivered') {
		await supabase.rpc('resolve_own_transfer_success', { p_reference: tx.reference });
		return json({ transaction: tx });
	}

	if (status === 'pending' || payload?.code === '099') {
		// VTpass itself is still processing — same "don't guess" rule as the
		// network-error case above.
		return json(
			{ error: `Airtime purchase is still processing at VTpass. Your debit is on hold, not lost — reference ${tx.reference}.` },
			{ status: 202 }
		);
	}

	console.error('[vtpass:airtime] VTpass rejected the request', payload);
	return reverseAndFail(payload?.response_description ?? 'Airtime purchase failed.', 502);
}
