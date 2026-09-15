import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { CLUBKONNECT_USERID, CLUBKONNECT_APIKEY, CLUBKONNECT_BASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';

/**
 * ClubKonnect airtime callback — the source of truth for orders that were
 * still 'pending' after the initial request/query in
 * /api/clubkonnect/airtime.
 *
 * Unlike Paystack, ClubKonnect's callback carries no signature — anyone who
 * knows (or guesses) a reference could hit this URL and claim any status.
 * So instead of trusting the callback body, we treat it purely as a
 * "something changed, go check" trigger: we re-query ClubKonnect ourselves
 * via APIQueryV1.asp (authenticated with our own UserID/APIKey) and only
 * ever act on THAT response.
 *
 * Configure this as the CallBackURL — already done automatically per
 * request in the airtime route, no dashboard setup needed for ClubKonnect.
 */
export async function GET({ url }) {
	return handle(url);
}
export async function POST({ url }) {
	return handle(url);
}

async function handle(url) {
	const reference = url.searchParams.get('requestid') || url.searchParams.get('RequestID');
	const orderId = url.searchParams.get('orderid') || url.searchParams.get('OrderID');

	if (!reference && !orderId) {
		return json({ received: true }); // nothing usable — ack and move on
	}

	let queryPayload;
	try {
		const params = new URLSearchParams({
			UserID: CLUBKONNECT_USERID,
			APIKey: CLUBKONNECT_APIKEY,
			...(orderId ? { OrderID: orderId } : { RequestID: reference })
		});
		const res = await fetch(`${CLUBKONNECT_BASE_URL}/APIQueryV1.asp?${params}`);
		queryPayload = await res.json();
	} catch (err) {
		console.error('[clubkonnect:callback] Verification query threw', err);
		return json({ received: true }); // ClubKonnect doesn't retry callbacks; nothing to gain by erroring
	}

	const finalReference = reference || queryPayload?.requestid;
	if (!finalReference) return json({ received: true });

	const relevant = {
		ORDER_COMPLETED: 'successful',
		ORDER_FAILED: 'failed',
		ORDER_CANCELLED: 'failed'
	};
	const mapped = relevant[queryPayload?.status];
	if (!mapped) return json({ received: true }); // still pending, or an unrecognized status — leave as-is

	const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
	const { error } = await supabaseAdmin.rpc('resolve_airtime_webhook', {
		p_reference: finalReference,
		p_status: mapped
	});
	if (error) console.error('[clubkonnect:callback] resolve_airtime_webhook failed:', error.message);

	return json({ received: true });
}
