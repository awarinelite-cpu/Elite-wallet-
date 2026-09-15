import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PAYSTACK_SECRET_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

/**
 * Sends money out to a bank account via Paystack Transfers.
 *
 * Order of operations matters here: the wallet is debited FIRST (status
 * 'pending'), before any call to Paystack, so the balance can never be
 * spent twice while a transfer is in flight. If anything after that fails
 * — recipient creation, transfer initiation — we reverse the debit in the
 * same request via reverse_wallet_debit. If the transfer is accepted, the
 * transaction stays 'pending' until /api/paystack/webhook hears back from
 * Paystack with the final outcome.
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

	const { amount, bankName, bankCode, accountNumber, accountName } = await request.json();
	const naira = Number(amount);
	if (!naira || naira <= 0) return json({ error: 'Enter a valid amount.' }, { status: 400 });
	if (!bankCode || !accountNumber || !accountName || !bankName) {
		return json({ error: 'Missing bank details.' }, { status: 400 });
	}

	// 1. Debit + hold, before Paystack is ever contacted.
	const { data: tx, error: debitError } = await supabase.rpc('debit_wallet_for_transfer', {
		p_amount: naira,
		p_bank_name: bankName,
		p_account_number: accountNumber,
		p_account_name: accountName
	});
	if (debitError) return json({ error: debitError.message }, { status: 400 });

	async function reverseAndFail(message, status = 502) {
		await supabase.rpc('reverse_wallet_debit', { p_reference: tx.reference });
		return json({ error: message }, { status });
	}

	let recipientPayload, transferPayload;
	try {
		// 2. Create (or reuse) a Paystack transfer recipient for this account.
		const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				type: 'nuban',
				name: accountName,
				account_number: accountNumber,
				bank_code: bankCode,
				currency: 'NGN'
			})
		});
		recipientPayload = await recipientRes.json();
		if (!recipientRes.ok || !recipientPayload.status) {
			console.error('[paystack:withdraw] recipient creation rejected', recipientRes.status, recipientPayload);
			return reverseAndFail(recipientPayload.message ?? 'Could not verify that recipient.', 400);
		}

		// 3. Initiate the transfer, tagged with our own reference so the
		// webhook can find its way back to this exact transaction.
		const transferRes = await fetch('https://api.paystack.co/transfer', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				source: 'balance',
				amount: Math.round(naira * 100),
				recipient: recipientPayload.data.recipient_code,
				reason: 'Elite Wallet withdrawal',
				reference: tx.reference
			})
		});
		transferPayload = await transferRes.json();
		if (!transferRes.ok || !transferPayload.status) {
			console.error('[paystack:withdraw] transfer rejected', transferRes.status, transferPayload);
			return reverseAndFail(transferPayload.message ?? 'Transfer could not be started.', 502);
		}
	} catch (err) {
		console.error('[paystack:withdraw] Request to Paystack threw', err);
		return reverseAndFail(`Transfer could not be started: ${err.message}`, 502);
	}

	// Some Paystack accounts (or `source: balance` with OTP fully disabled)
	// can return an immediate final status instead of 'pending' — resolve
	// right away if so, rather than waiting on a webhook that may not fire.
	const immediateStatus = transferPayload.data.status;
	if (immediateStatus === 'success') {
		await supabase.rpc('resolve_own_transfer_success', { p_reference: tx.reference });
	} else if (immediateStatus === 'failed' || immediateStatus === 'reversed') {
		return reverseAndFail('Transfer failed at Paystack.', 502);
	}

	return json({ transaction: tx });
}
