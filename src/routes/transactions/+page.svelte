<script>
	import { STATUS_META } from '$lib/format';
	import TransactionRow from '$lib/components/TransactionRow.svelte';

	export let data;

	let statusFilter = 'all';

	const STATUS_TABS = [
		{ id: 'all', label: 'All' },
		{ id: 'pending', label: `${STATUS_META.pending.dot} Pending` },
		{ id: 'successful', label: `${STATUS_META.successful.dot} Successful` },
		{ id: 'failed', label: `${STATUS_META.failed.dot} Failed` },
		{ id: 'reversed', label: `${STATUS_META.reversed.dot} Reversed` }
	];

	$: filtered =
		statusFilter === 'all' ? data.transactions : data.transactions.filter((t) => t.status === statusFilter);
</script>

<svelte:head><title>Transactions · Elite Wallet</title></svelte:head>

<header class="bg-band px-5 pb-4 pt-6">
	<a href="/" class="text-sm text-ash-muted">← Home</a>
	<h1 class="mt-2 font-display text-xl font-semibold text-ash">Transactions</h1>
</header>

<div class="flex gap-2 overflow-x-auto px-5 pt-4 pb-1">
	{#each STATUS_TABS as t}
		<button
			on:click={() => (statusFilter = t.id)}
			class="shrink-0 rounded-pill px-3.5 py-1.5 text-xs font-medium"
			class:bg-emerald={statusFilter === t.id}
			class:text-ink={statusFilter === t.id}
			class:bg-surface={statusFilter !== t.id}
			class:text-ash-muted={statusFilter !== t.id}
		>
			{t.label}
		</button>
	{/each}
</div>

<section class="px-5 pt-4">
	<div class="rounded-card border border-hair bg-surface px-4">
		{#if filtered.length === 0}
			<p class="py-10 text-center text-sm text-ash-faint">No transactions in this category.</p>
		{:else}
			{#each filtered as tx}
				<TransactionRow {tx} />
			{/each}
		{/if}
	</div>
</section>
