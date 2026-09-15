import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { CLUBKONNECT_USERID, CLUBKONNECT_APIKEY, CLUBKONNECT_BASE_URL } from '$env/static/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

// ClubKonnect MobileNetwork codes — see clubkonnect.com/APIParaGetAirTimeV1.asp
const NETWORK_ID = { MTN: '01', Glo: '02', '9mobile': '03', Airtel: '04' };

/**
 * Buys real MTN/Airtel/Glo/9mobile airtime through ClubKonnect.
 *
 * Same pending-then-resolve shape as the old VTpass route: the wallet is
 * debited FIRST (status 'pending') before ClubKonnect is ever contacted.
 *
 * Unlike VTpass, ClubKonnect's /APIAirtimeV1.asp does NOT respond with a
 * final result — it only confirms the order was accepted ("ORDER_RECEIVED"),
 * then processes asynchronously. To resolve promptly we immediately query
 * /APIQueryV1.asp by the returned OrderID. If ClubKonnect hasn't finished
 * processing yet, we leave the debit 'pending' rather than guessing — the
 * /api/clubkonnect/callback route (set as CallBackURL below) resolves it
 * once ClubKonnect finishes, and it can also be resolved manually via
 * OrderID/RequestID using APIQueryV1.asp.
 *
 * We send our own tx.reference as ClubKonnect's RequestID (rather than a
 * separate generated id) so the callback route can look the transaction up
 * by reference directly, with no extra column needed.
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

	const { amount, network, phone } = await request.json();
	const naira = Number(amount);
	if (!naira || naira < 50) return json({ error: 'Minimum airtime amount is ₦50.' }, { status: 400 });
	const networkId = NETWORK_ID[network];
	if (!networkId) return json({ error: 'Unknown network.' }, { status: 400 });
	if (!phone || phone.length < 11) return json({ error: 'Enter a valid phone number.' }, { status: 400 });

	// 1. Debit + hold, before ClubKonnect is ever contacted.
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

	const callbackUrl = `${url.origin}/api/clubkonnect/callback`;

	let payload;
	try {
		const params = new URLSearchParams({
			UserID: CLUBKONNECT_USERID,
			APIKey: CLUBKONNECT_APIKEY,
			MobileNetwork: networkId,
			Amount: String(naira),
			MobileNumber: phone,
			RequestID: tx.reference,
			CallBackURL: callbackUrl
		});
		const res = await fetch(`${CLUBKONNECT_BASE_URL}/APIAirtimeV1.asp?${params}`);
		payload = await res.json();
	} catch (err) {
		console.error('[clubkonnect:airtime] Request to ClubKonnect threw', err);
		return json(
			{
				error: `Could not reach ClubKonnect: ${err.message}. Your debit is on hold, not lost — contact support with reference ${tx.reference}.`
			},
			{ status: 502 }
		);
	}

	// A handful of failures are returned immediately instead of an orderid
	// (bad credentials, invalid amount, invalid recipient, etc).
	if (!payload?.orderid) {
		console.error('[clubkonnect:airtime] ClubKonnect rejected the request outright', payload);
		return reverseAndFail(payload?.status ?? 'Airtime purchase failed.', 502);
	}

	// 2. Order was accepted — immediately query it once for a fast-resolving
	// result (ClubKonnect often completes within a second or two).
	try {
		const queryParams = new URLSearchParams({
			UserID: CLUBKONNECT_USERID,
			APIKey: CLUBKONNECT_APIKEY,
			OrderID: payload.orderid
		});
		const queryRes = await fetch(`${CLUBKONNECT_BASE_URL}/APIQueryV1.asp?${queryParams}`);
		const queryPayload = await queryRes.json();

		if (queryPayload?.status === 'ORDER_COMPLETED') {
			await supabase.rpc('resolve_own_transfer_success', { p_reference: tx.reference });
			return json({ transaction: tx });
		}

		if (queryPayload?.status === 'ORDER_FAILED' || queryPayload?.status === 'ORDER_CANCELLED') {
			return reverseAndFail(queryPayload?.remark ?? 'Airtime purchase failed.', 502);
		}
	} catch (err) {
		// Query failing doesn't mean the order failed — ClubKonnect still has
		// it and the callback (or a manual query later) will resolve it.
		console.error('[clubkonnect:airtime] Follow-up query threw', err);
	}

	// Still processing at ClubKonnect — leave 'pending'. The callback route
	// will resolve it; support can also query manually by orderid.
	return json(
		{
			error: `Airtime purchase is still processing. Your debit is on hold, not lost — reference ${tx.reference} (ClubKonnect order ${payload.orderid}).`
		},
		{ status: 202 }
	);
}
