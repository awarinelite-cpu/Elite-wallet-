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

export async function withdrawWallet(amount, bankAccountLast4) {
	return supabase.rpc('withdraw_wallet', {
		p_amount: amount,
		p_description: bankAccountLast4 ? `To bank ••${bankAccountLast4}` : null
	});
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
