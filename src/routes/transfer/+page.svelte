<script>
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { formatNaira, formatDate, formatTime } from '$lib/format';
	import { withdrawToBank, transferToWallet } from '$lib/walletActions';
	import { supabase } from '$lib/supabaseClient';

	export let data;

	let tab = 'bank'; // 'bank' | 'wallet' | 'beneficiaries'

	// Bank transfer form
	let banks = []; // [{ name, code }]
	let bankCode = '';
	let accountNumber = '';
	let resolvedAccountName = ''; // set only by a successful resolve — the source of truth sent to Paystack
	let resolving = false;
	let resolveError = '';
	let bankAmount = '';
	let saveBeneficiary = false;

	// Wallet transfer form
	let recipientTag = '';
	let walletAmount = '';

	let loading = false;
	let error = '';
	let receipt = null; // holds the last transfer for the receipt view

	$: selectedBankName = banks.find((b) => b.code === bankCode)?.name ?? '';

	onMount(async () => {
		const res = await fetch('/api/paystack/banks');
		const payload = await res.json();
		if (res.ok) banks = payload.banks;
	});

	async function resolveAccount() {
		resolvedAccountName = '';
		resolveError = '';
		if (!bankCode || accountNumber.length !== 10) return;

		resolving = true;
		const {
			data: { session }
		} = await supabase.auth.getSession();
		const res = await fetch(
			`/api/paystack/resolve-account?account_number=${accountNumber}&bank_code=${bankCode}`,
			{ headers: { Authorization: `Bearer ${session.access_token}` } }
		);
		const payload = await res.json();
		resolving = false;

		if (!res.ok) {
			resolveError = payload.error ?? 'Could not verify that account.';
			return;
		}
		resolvedAccountName = payload.account_name;
	}

	function useBeneficiary(b) {
		tab = 'bank';
		bankCode = b.bank_code;
		accountNumber = b.account_number;
		resolvedAccountName = b.account_name;
		resolveError = '';
	}

	async function submitBankTransfer() {
		error = '';
		const amt = Number(bankAmount);
		if (!amt || amt <= 0) return (error = 'Enter a valid amount.');
		if (!bankCode || accountNumber.length !== 10) return (error = 'Select a bank and enter a valid account number.');
		if (!resolvedAccountName) return (error = 'Account could not be verified — check the details and try again.');
		if (amt > (data.wallet?.balance ?? 0)) return (error = 'Insufficient wallet balance.');

		loading = true;
		const { data: tx, error: err } = await withdrawToBank({
			amount: amt,
			bankName: selectedBankName,
			bankCode,
			accountNumber,
			accountName: resolvedAccountName
		});
		loading = false;
		if (err) return (error = err.message);

		if (saveBeneficiary) {
			await supabase.from('beneficiaries').insert({
				type: 'bank',
				bank_name: selectedBankName,
				bank_code: bankCode,
				account_number: accountNumber,
				account_name: resolvedAccountName
			});
		}

		receipt = {
			type: 'Bank Transfer',
			amount: amt,
			to: `${resolvedAccountName} · ${selectedBankName} (••${accountNumber.slice(-4)})`,
			reference: tx?.reference,
			status: tx?.status ?? 'pending',
			time: new Date().toISOString()
		};
		bankAmount = '';
		accountNumber = '';
		bankCode = '';
		resolvedAccountName = '';
		await invalidateAll();
	}


	async function submitWalletTransfer() {
		error = '';
		const amt = Number(walletAmount);
		if (!amt || amt <= 0) return (error = 'Enter a valid amount.');
		if (!recipientTag) return (error = 'Enter a wallet tag, phone or email.');
		if (amt > (data.wallet?.balance ?? 0)) return (error = 'Insufficient wallet balance.');

		loading = true;
		const { data: result, error: err } = await transferToWallet({ amount: amt, recipientTag });
		loading = false;
		if (err) return (error = err.message);

		receipt = {
			type: 'Wallet Transfer',
			amount: amt,
			to: recipientTag,
			reference: result?.[0]?.reference ?? result?.reference,
			time: new Date().toISOString()
		};
		walletAmount = '';
		recipientTag = '';
		await invalidateAll();
	}

	function newTransfer() {
		receipt = null;
	}
</script>

<svelte:head><title>Transfer · Elite Wallet</title></svelte:head>

<header class="bg-band px-5 pb-5 pt-6">
	<a href="/" class="text-sm text-ash-muted">← Home</a>
	<h1 class="mt-2 font-display text-xl font-semibold text-ash">Transfer</h1>
	<p class="mt-1 text-xs text-ash-muted">Balance: {formatNaira(data.wallet?.balance ?? 0)}</p>
</header>

{#if receipt}
	<!-- 🧾 Transaction receipt -->
	<section class="px-5 pt-6">
		<div class="rounded-card border border-hair bg-surface p-5 text-center">
			<div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-dim text-xl">✓</div>
			<p class="text-sm text-ash-muted">{receipt.type} {receipt.status === 'pending' ? 'Initiated' : 'Successful'}</p>
			<p class="font-display mt-1 text-2xl font-semibold text-ash">{formatNaira(receipt.amount)}</p>

			<div class="mt-5 space-y-2.5 rounded-card bg-surface2 p-4 text-left text-sm">
				<div class="flex justify-between"><span class="text-ash-faint">To</span><span class="text-ash">{receipt.to}</span></div>
				<div class="flex justify-between"><span class="text-ash-faint">Reference</span><span class="text-ash">{receipt.reference ?? '—'}</span></div>
				<div class="flex justify-between"><span class="text-ash-faint">Date</span><span class="text-ash">{formatDate(receipt.time)}</span></div>
				<div class="flex justify-between"><span class="text-ash-faint">Time</span><span class="text-ash">{formatTime(receipt.time)}</span></div>
				<div class="flex justify-between">
					<span class="text-ash-faint">Status</span>
					{#if receipt.status === 'pending'}
						<span class="text-gold">🟡 Processing</span>
					{:else}
						<span class="text-emerald-bright">🟢 Successful</span>
					{/if}
				</div>
			</div>

			<button on:click={newTransfer} class="mt-5 w-full rounded-card bg-emerald py-3 text-sm font-semibold text-ink">
				Make Another Transfer
			</button>
		</div>
	</section>
{:else}
	<div class="flex gap-2 px-5 pt-5">
		{#each [['bank', 'To Bank'], ['wallet', 'To Wallet'], ['beneficiaries', 'Beneficiaries']] as [key, label]}
			<button
				on:click={() => (tab = key)}
				class="rounded-pill px-3.5 py-1.5 text-xs font-medium"
				class:bg-emerald={tab === key}
				class:text-ink={tab === key}
				class:bg-surface={tab !== key}
				class:text-ash-muted={tab !== key}
			>
				{label}
			</button>
		{/each}
	</div>

	<section class="px-5 pt-5">
		{#if error}<p class="mb-3 text-sm text-danger">{error}</p>{/if}

		{#if tab === 'bank'}
			<div class="space-y-3">
				<div>
					<label for="bank" class="mb-1.5 block text-xs font-medium text-ash-muted">Bank</label>
					<select
						id="bank"
						bind:value={bankCode}
						on:change={resolveAccount}
						class="w-full rounded-card border border-hair bg-surface px-4 py-3 text-sm text-ash outline-none focus:border-emerald"
					>
						<option value="" disabled selected>Select a bank</option>
						{#each banks as b}<option value={b.code}>{b.name}</option>{/each}
					</select>
				</div>
				<div>
					<label for="accno" class="mb-1.5 block text-xs font-medium text-ash-muted">Account number</label>
					<input
						id="accno"
						type="text"
						inputmode="numeric"
						maxlength="10"
						bind:value={accountNumber}
						on:blur={resolveAccount}
						placeholder="0123456789"
						class="w-full rounded-card border border-hair bg-surface px-4 py-3 text-sm text-ash outline-none focus:border-emerald"
					/>
				</div>
				<div>
					<span class="mb-1.5 block text-xs font-medium text-ash-muted">Account name</span>
					<div class="w-full rounded-card border border-hair bg-surface2 px-4 py-3 text-sm">
						{#if resolving}
							<span class="text-ash-faint">Verifying…</span>
						{:else if resolvedAccountName}
							<span class="text-emerald-bright">✓ {resolvedAccountName}</span>
						{:else if resolveError}
							<span class="text-danger">{resolveError}</span>
						{:else}
							<span class="text-ash-faint">Select a bank and account number to verify</span>
						{/if}
					</div>
				</div>
				<div>
					<label for="bamt" class="mb-1.5 block text-xs font-medium text-ash-muted">Amount (₦)</label>
					<input id="bamt" type="number" min="1" bind:value={bankAmount} placeholder="0.00" class="w-full rounded-card border border-hair bg-surface px-4 py-3 text-sm text-ash outline-none focus:border-emerald" />
				</div>
				<label class="flex items-center gap-2 text-sm text-ash-muted">
					<input type="checkbox" bind:checked={saveBeneficiary} class="h-4 w-4 rounded border-hair bg-surface" />
					Save as beneficiary
				</label>
				<button
					on:click={submitBankTransfer}
					disabled={loading || resolving || !resolvedAccountName}
					class="w-full rounded-card bg-emerald py-3.5 text-sm font-semibold text-ink disabled:opacity-60"
				>
					{loading ? 'Sending…' : 'Send Transfer'}
				</button>
			</div>
		{:else if tab === 'wallet'}
			<div class="space-y-3">
				<div>
					<label for="tag" class="mb-1.5 block text-xs font-medium text-ash-muted">Recipient wallet tag, phone or email</label>
					<input id="tag" type="text" bind:value={recipientTag} placeholder="@ada or 080xxxxxxxx" class="w-full rounded-card border border-hair bg-surface px-4 py-3 text-sm text-ash outline-none focus:border-emerald" />
				</div>
				<div>
					<label for="wamt" class="mb-1.5 block text-xs font-medium text-ash-muted">Amount (₦)</label>
					<input id="wamt" type="number" min="1" bind:value={walletAmount} placeholder="0.00" class="w-full rounded-card border border-hair bg-surface px-4 py-3 text-sm text-ash outline-none focus:border-emerald" />
				</div>
				<p class="text-[11px] text-ash-faint">Wallet-to-wallet transfers are instant and fee-free in this build.</p>
				<button on:click={submitWalletTransfer} disabled={loading} class="w-full rounded-card bg-emerald py-3.5 text-sm font-semibold text-ink disabled:opacity-60">
					{loading ? 'Sending…' : 'Send to Wallet'}
				</button>
			</div>
		{:else}
			<div class="space-y-2">
				{#if data.beneficiaries.length === 0}
					<p class="py-8 text-center text-sm text-ash-faint">No saved beneficiaries yet. Add one from a bank transfer.</p>
				{:else}
					{#each data.beneficiaries as b}
						<button
							on:click={() => useBeneficiary(b)}
							class="flex w-full items-center justify-between rounded-card border border-hair bg-surface px-4 py-3.5 text-left"
						>
							<div>
								<p class="text-sm font-medium text-ash">{b.account_name}</p>
								<p class="text-xs text-ash-faint">{b.bank_name} · ••{b.account_number.slice(-4)}</p>
							</div>
							<span class="text-xs text-gold">Use →</span>
						</button>
					{/each}
				{/if}
			</div>
		{/if}
	</section>
{/if}
