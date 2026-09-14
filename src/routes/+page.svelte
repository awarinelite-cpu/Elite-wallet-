<script>
	import { formatNaira } from '$lib/format';
	import TransactionRow from '$lib/components/TransactionRow.svelte';

	export let data;

	let hidden = false;
	$: balanceDisplay = hidden ? '₦ • • • • • •' : formatNaira(data.wallet?.balance ?? 0);

	const quickServices = [
		{ href: '/airtime', label: 'Airtime', icon: '📱' },
		{ href: '/data', label: 'Data', icon: '🌐' },
		{ href: '/bills?type=electricity', label: 'Electricity', icon: '💡' },
		{ href: '/bills?type=cable', label: 'Cable TV', icon: '📺' },
		{ href: '/bills?type=internet', label: 'Internet', icon: '🌐' },
		{ href: '/bills', label: 'More Bills', icon: '🎁' }
	];
</script>

<svelte:head><title>Elite Wallet</title></svelte:head>

<header class="bg-band px-5 pb-7 pt-7">
	<div class="flex items-center justify-between">
		<div>
			<p class="text-xs uppercase tracking-wide text-ash-muted">Welcome back</p>
			<p class="font-display text-base font-semibold text-ash">
				{data.user?.user_metadata?.full_name ?? 'there'}
			</p>
		</div>
		<div class="flex h-10 w-10 items-center justify-center rounded-full bg-surface/60 text-sm font-semibold text-ash">
			{(data.user?.user_metadata?.full_name ?? 'E').charAt(0)}
		</div>
	</div>

	<div class="mt-6">
		<p class="text-xs text-ash-muted">Available Balance</p>
		<div class="mt-1 flex items-center gap-2.5">
			<p class="font-display text-3xl font-semibold text-ash">{balanceDisplay}</p>
			<button
				on:click={() => (hidden = !hidden)}
				aria-label={hidden ? 'Show balance' : 'Hide balance'}
				class="text-ash-muted"
			>
				{#if hidden}
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.5 5.2A9.8 9.8 0 0 1 12 5c5 0 9 4 10 7a11.6 11.6 0 0 1-2.6 3.7M6.6 6.6C4.6 8 3.2 10 2 12c1 3 5 7 10 7 1.3 0 2.5-.2 3.6-.6" /></svg>
				{:else}
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
				{/if}
			</button>
		</div>
	</div>

	<div class="mt-6 grid grid-cols-4 gap-2">
		<a href="/wallet" class="flex flex-col items-center gap-1.5 rounded-card bg-surface/70 py-3 text-ash">
			<span class="text-lg">＋</span><span class="text-[11px]">Add Money</span>
		</a>
		<a href="/transfer" class="flex flex-col items-center gap-1.5 rounded-card bg-surface/70 py-3 text-ash">
			<span class="text-lg">↗</span><span class="text-[11px]">Transfer</span>
		</a>
		<a href="/wallet#withdraw" class="flex flex-col items-center gap-1.5 rounded-card bg-surface/70 py-3 text-ash">
			<span class="text-lg">↓</span><span class="text-[11px]">Withdraw</span>
		</a>
		<a href="/spend" class="flex flex-col items-center gap-1.5 rounded-card bg-surface/70 py-3 text-ash">
			<span class="text-lg">💳</span><span class="text-[11px]">Spend</span>
		</a>
	</div>
</header>

<div class="perforated"></div>

<section class="px-5 pt-6">
	<h2 class="mb-3 text-sm font-medium text-ash-muted">Quick Services</h2>
	<div class="grid grid-cols-3 gap-3">
		{#each quickServices as s}
			<a
				href={s.href}
				class="flex flex-col items-center gap-2 rounded-card border border-hair bg-surface py-4 text-center"
			>
				<span class="text-xl">{s.icon}</span>
				<span class="text-xs text-ash-muted">{s.label}</span>
			</a>
		{/each}
	</div>
</section>

<section class="px-5 pt-7">
	<div class="mb-1 flex items-center justify-between">
		<h2 class="text-sm font-medium text-ash-muted">Recent Transactions</h2>
		<a href="/transactions" class="text-xs font-medium text-gold">View All →</a>
	</div>
	<div class="rounded-card border border-hair bg-surface px-4">
		{#if data.transactions.length === 0}
			<p class="py-8 text-center text-sm text-ash-faint">No transactions yet. Fund your wallet to get started.</p>
		{:else}
			{#each data.transactions as tx}
				<TransactionRow {tx} />
			{/each}
		{/if}
	</div>
</section>
