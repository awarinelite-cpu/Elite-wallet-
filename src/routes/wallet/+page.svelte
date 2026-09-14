<script>
	import { invalidateAll } from '$app/navigation';
	import { formatNaira } from '$lib/format';
	import { fundWallet, withdrawWallet } from '$lib/walletActions';
	import TransactionRow from '$lib/components/TransactionRow.svelte';

	export let data;

	let mode = null; // 'fund' | 'withdraw' | null
	let amount = '';
	let accountLast4 = '';
	let loading = false;
	let error = '';
	let success = '';

	function openFund() {
		mode = 'fund';
		amount = '';
		error = '';
		success = '';
	}
	function openWithdraw() {
		mode = 'withdraw';
		amount = '';
		accountLast4 = '';
		error = '';
		success = '';
	}
	function close() {
		mode = null;
	}

	async function submit() {
		error = '';
		success = '';
		const numAmount = Number(amount);
		if (!numAmount || numAmount <= 0) {
			error = 'Enter a valid amount.';
			return;
		}
		if (mode === 'withdraw' && numAmount > (data.wallet?.balance ?? 0)) {
			error = 'Insufficient wallet balance.';
			return;
		}
		loading = true;
		const { error: err } =
			mode === 'fund' ? await fundWallet(numAmount) : await withdrawWallet(numAmount, accountLast4);
		loading = false;
		if (err) {
			error = err.message;
			return;
		}
		success = mode === 'fund' ? 'Wallet funded successfully.' : 'Withdrawal initiated.';
		await invalidateAll();
		setTimeout(close, 900);
	}
</script>

<svelte:head><title>Wallet · Elite Wallet</title></svelte:head>

<header class="bg-band px-5 pb-6 pt-6">
	<a href="/" class="text-sm text-ash-muted">← Home</a>
	<h1 class="mt-2 font-display text-xl font-semibold text-ash">Wallet</h1>
	<p class="mt-4 text-xs text-ash-muted">Wallet Balance</p>
	<p class="font-display text-2xl font-semibold text-ash">{formatNaira(data.wallet?.balance ?? 0)}</p>

	<div class="mt-5 grid grid-cols-2 gap-3">
		<button on:click={openFund} class="rounded-card bg-emerald py-3 text-sm font-semibold text-ink">
			Fund Wallet
		</button>
		<button
			id="withdraw"
			on:click={openWithdraw}
			class="rounded-card border border-hair bg-surface/70 py-3 text-sm font-semibold text-ash"
		>
			Withdraw to Bank
		</button>
	</div>
</header>

{#if mode}
	<div class="fixed inset-0 z-30 flex items-end justify-center bg-black/50" on:click|self={close}>
		<div class="w-full max-w-md rounded-t-card bg-surface p-5 pb-8">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="font-display text-base font-semibold text-ash">
					{mode === 'fund' ? 'Fund Wallet' : 'Withdraw to Bank'}
				</h2>
				<button on:click={close} class="text-ash-muted" aria-label="Close">✕</button>
			</div>

			<label for="amount" class="mb-1.5 block text-xs font-medium text-ash-muted">Amount (₦)</label>
			<input
				id="amount"
				type="number"
				min="1"
				bind:value={amount}
				placeholder="0.00"
				class="w-full rounded-card border border-hair bg-surface2 px-4 py-3 text-sm text-ash outline-none focus:border-emerald"
			/>

			{#if mode === 'withdraw'}
				<label for="acct" class="mb-1.5 mt-3 block text-xs font-medium text-ash-muted">
					Bank account (last 4 digits)
				</label>
				<input
					id="acct"
					type="text"
					maxlength="4"
					bind:value={accountLast4}
					placeholder="1234"
					class="w-full rounded-card border border-hair bg-surface2 px-4 py-3 text-sm text-ash outline-none focus:border-emerald"
				/>
			{/if}

			{#if error}<p class="mt-3 text-sm text-danger">{error}</p>{/if}
			{#if success}<p class="mt-3 text-sm text-emerald-bright">{success}</p>{/if}

			<button
				on:click={submit}
				disabled={loading}
				class="mt-5 w-full rounded-card bg-emerald py-3.5 text-sm font-semibold text-ink disabled:opacity-60"
			>
				{loading ? 'Processing…' : mode === 'fund' ? 'Fund Wallet' : 'Withdraw'}
			</button>
			<p class="mt-3 text-center text-[11px] text-ash-faint">
				Sandbox mode — this simulates a transfer with no real bank connection yet.
			</p>
		</div>
	</div>
{/if}

<section class="px-5 pt-6">
	<h2 class="mb-2 text-sm font-medium text-ash-muted">Wallet Statement</h2>
	<div class="rounded-card border border-hair bg-surface px-4">
		{#if data.statement.length === 0}
			<p class="py-8 text-center text-sm text-ash-faint">No funding or withdrawal activity yet.</p>
		{:else}
			{#each data.statement as tx}
				<TransactionRow {tx} />
			{/each}
		{/if}
	</div>
</section>
