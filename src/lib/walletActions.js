import { supabase } from '$lib/supabaseClient';

/**
 * Every wallet-affecting action goes through a Postgres RPC
 * (see supabase/schema.sql) so the balance update and the ledger
 * row are written atomically. In this sandbox build the RPCs just
 * move numbers around in Postgres; swapping in a real BaaS provider
 * later means changing the SQL function bodies, not this file.
 */

export async function fundWallet(amount) {
	return supabase.rpc('fund_wallet', { p_amount: amount });
}

/**
 * Starts a real Paystack payment for the given naira amount. Returns
 * { data: { authorization_url, reference } } on success — redirect the
 * browser to authorization_url to hand off to Paystack's checkout.
 * The wallet isn't credited here; that happens once /paystack/callback
 * verifies the payment after the user returns from checkout.
 */
export async function initiatePaystackFunding(amount) {
	const {
		data: { session }
	} = await supabase.auth.getSession();
	if (!session) return { error: { message: 'Not authenticated' } };

	const res = await fetch('/api/paystack/initialize', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${session.access_token}`
		},
		body: JSON.stringify({ amount })
	});
	const payload = await res.json();
	if (!res.ok) return { error: { message: payload.error ?? 'Could not start payment.' } };

	return { data: payload };
}

export async function withdrawWallet(amount, bankAccountLast4) {
	return supabase.rpc('withdraw_wallet', {
		p_amount: amount,
		p_description: bankAccountLast4 ? `To bank ••${bankAccountLast4}` : null
	});
}

/**
 * Sends a real payout to a bank account via Paystack Transfers. Debits
 * the wallet immediately (status 'pending'); final status arrives via
 * the webhook, or occasionally immediately if Paystack resolves it inline.
 */
export async function withdrawToBank({ amount, bankName, bankCode, accountNumber, accountName }) {
	const {
		data: { session }
	} = await supabase.auth.getSession();
	if (!session) return { error: { message: 'Not authenticated' } };

	const res = await fetch('/api/paystack/withdraw', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${session.access_token}`
		},
		body: JSON.stringify({ amount, bankName, bankCode, accountNumber, accountName })
	});
	const payload = await res.json();
	if (!res.ok) return { error: { message: payload.error ?? 'Withdrawal could not be started.' } };

	return { data: payload.transaction };
}

export async function transferToBank({ amount, bankName, accountNumber, accountName }) {
	return supabase.rpc('transfer_to_bank', {
		p_amount: amount,
		p_bank_name: bankName,
		p_account_number: accountNumber,
		p_account_name: accountName
	});
}

export async function transferToWallet({ amount, recipientTag }) {
	return supabase.rpc('transfer_to_wallet', {
		p_amount: amount,
		p_recipient_tag: recipientTag
	});
}

export async function buyAirtime({ amount, network, phone }) {
	return supabase.rpc('pay_airtime', { p_amount: amount, p_network: network, p_phone: phone });
}

export async function buyData({ amount, network, phone, bundleLabel }) {
	return supabase.rpc('pay_data', {
		p_amount: amount,
		p_network: network,
		p_phone: phone,
		p_bundle_label: bundleLabel
	});
}

export async function payBill({ amount, billType, provider, customerRef }) {
	return supabase.rpc('pay_bill', {
		p_amount: amount,
		p_bill_type: billType,
		p_provider: provider,
		p_customer_ref: customerRef
	});
}

export async function recordSpend({ amount, category, note }) {
	return supabase.from('spend_records').insert({ amount, category, note });
}
