<script>
	import { formatNaira, formatDate, formatTime, STATUS_META, TX_TYPE_LABEL, DEBIT_TYPES } from '$lib/format';

	export let data;
	$: tx = data.tx;
	$: status = STATUS_META[tx.status] ?? STATUS_META.pending;
	$: isDebit = DEBIT_TYPES.has(tx.type);
</script>

<svelte:head><title>Transaction · Elite Wallet</title></svelte:head>

<header class="bg-band px-5 pb-5 pt-6">
	<a href="/transactions" class="text-sm text-ash-muted">← Transactions</a>
	<h1 class="mt-2 font-display text-xl font-semibold text-ash">Transaction Receipt</h1>
</header>

<section class="px-5 pt-6">
	<div class="rounded-card border border-hair bg-surface p-5 text-center">
		<div
			class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-xl"
			class:bg-emerald-dim={tx.status === 'successful'}
			class:bg-pending={tx.status === 'pending'}
			class:bg-danger={tx.status === 'failed'}
		>
			{status.dot}
		</div>
		<p class="text-sm text-ash-muted">{tx.description || TX_TYPE_LABEL[tx.type] || tx.type}</p>
		<p class="font-display mt-1 text-2xl font-semibold" class:text-danger={isDebit} class:text-ash={!isDebit}>
			{isDebit ? '−' : '+'}{formatNaira(tx.amount)}
		</p>

		<div class="mt-5 space-y-2.5 rounded-card bg-surface2 p-4 text-left text-sm">
			<div class="flex justify-between"><span class="text-ash-faint">Reference</span><span class="text-ash">{tx.reference}</span></div>
			<div class="flex justify-between"><span class="text-ash-faint">Type</span><span class="text-ash">{TX_TYPE_LABEL[tx.type] ?? tx.type}</span></div>
			<div class="flex justify-between"><span class="text-ash-faint">Amount</span><span class="text-ash">{formatNaira(tx.amount)}</span></div>
			<div class="flex justify-between"><span class="text-ash-faint">Fee</span><span class="text-ash">{formatNaira(tx.fee ?? 0)}</span></div>
			<div class="flex justify-between"><span class="text-ash-faint">Status</span><span class="text-ash">{status.dot} {status.label}</span></div>
			<div class="flex justify-between"><span class="text-ash-faint">Date</span><span class="text-ash">{formatDate(tx.created_at)}</span></div>
			<div class="flex justify-between"><span class="text-ash-faint">Time</span><span class="text-ash">{formatTime(tx.created_at)}</span></div>
			{#if tx.counterparty}
				<div class="flex justify-between"><span class="text-ash-faint">Recipient/Provider</span><span class="text-ash">{tx.counterparty}</span></div>
			{/if}
		</div>
	</div>
</section>
