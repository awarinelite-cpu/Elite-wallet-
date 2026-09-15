import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PAYSTACK_SECRET_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

/**
 * Resolves account_number + bank_code to the real account holder name via
 * Paystack, so the user (and the app) can confirm they're sending money to
 * the right person before anything is debited.
 */
export async function GET({ url, request }) {
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

	const accountNumber = url.searchParams.get('account_number');
	const bankCode = url.searchParams.get('bank_code');
	if (!accountNumber || !bankCode) {
		return json({ error: 'Missing account_number or bank_code' }, { status: 400 });
	}

	const res = await fetch(
		`https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
		{ headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
	);
	const payload = await res.json();
	if (!res.ok || !payload.status) {
		return json({ error: payload.message ?? 'Could not verify that account.' }, { status: 400 });
	}

	return json({ account_name: payload.data.account_name });
}
