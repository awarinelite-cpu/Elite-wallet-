<script>
	import { invalidateAll } from '$app/navigation';
	import { formatNaira, formatDate } from '$lib/format';
	import { recordSpend } from '$lib/walletActions';

	export let data;

	const CATEGORIES = [
		{ id: 'Food', icon: '🍽️' },
		{ id: 'Transport', icon: '🚕' },
		{ id: 'Medical', icon: '💊' },
		{ id: 'Shopping', icon: '🛍️' },
		{ id: 'Bills', icon: '🧾' },
		{ id: 'Other', icon: '✨' }
	];

	let open = false;
	let category = 'Food';
	let amount = '';
	let note = '';
	let loading = false;
	let error = '';

	$: totalsByCategory = CATEGORIES.map((c) => ({
		...c,
		total: data.records.filter((r) => r.category === c.id).reduce((sum, r) => sum + Number(r.amount), 0)
	})).filter((c) => c.total > 0);

	$: monthTotal = data.records.reduce((sum, r) => sum + Number(r.amount), 0);

	function openForm() {
		open = true;
		category = 'Food';
		amount = '';
		note = '';
		error = '';
	}

	async function submit() {
		error = '';
		const amt = Number(amount);
		if (!amt || amt <= 0) {
			error = 'Enter a valid amount.';
			return;
		}
		loading = true;
		const { error: err } = await recordSpend({ amount: amt, category, note });
		loading = false;
		if (err) {
			error = err.message;
			return;
		}
		open = false;
		await invalidateAll();
	}
</script>

<svelte:head><title>Spend · Elite Wallet</title></svelte:head>

<header class="bg-band px-5 pb-5 pt-6">
	<a href="/" class="text-sm text-ash-muted">← Home</a>
	<h1 class="mt-2 font-display text-xl font-semibold text-ash">Spend Tracker</h1>
	<p class="mt-1 text-xs text-ash-muted">Total recorded</p>
	<p class="font-display text-2xl font-semibold text-ash">{formatNaira(monthTotal)}</p>
	<button on:click={openForm} class="mt-4 w-full rounded-card bg-emerald py-3 text-sm font-semibold text-ink">
		+ Record Expense
	</button>
</header>

{#if totalsByCategory.length > 0}
	<section class="px-5 pt-6">
		<h2 class="mb-2 text-sm font-medium text-ash-muted">By Category</h2>
		<div class="grid grid-cols-2 gap-2.5">
			{#each totalsByCategory as c}
				<div class="rounded-card border border-hair bg-surface px-4 py-3">
					<p class="text-xs text-ash-muted">{c.icon} {c.id}</p>
					<p class="mt-1 text-sm font-semibold text-ash">{formatNaira(c.total)}</p>
				</div>
			{/each}
		</div>
	</section>
{/if}

<section class="px-5 pt-6">
	<h2 class="mb-2 text-sm font-medium text-ash-muted">Spending History</h2>
	<div class="rounded-card border border-hair bg-surface px-4">
		{#if data.records.length === 0}
			<p class="py-8 text-center text-sm text-ash-faint">No expenses recorded yet.</p>
		{:else}
			{#each data.records as r}
				{@const cat = CATEGORIES.find((c) => c.id === r.category)}
				<div class="flex items-center justify-between gap-3 border-b border-hair py-3.5 last:border-none">
					<div class="flex items-center gap-3">
						<span class="text-lg">{cat?.icon ?? '✨'}</span>
						<div>
							<p class="text-sm font-medium text-ash">{r.category}</p>
							<p class="text-xs text-ash-faint">{r.note || formatDate(r.created_at)}</p>
						</div>
					</div>
					<p class="font-display text-sm font-semibold text-ash">{formatNaira(r.amount)}</p>
				</div>
			{/each}
		{/if}
	</div>
</section>

{#if open}
	<div class="fixed inset-0 z-30 flex items-end justify-center bg-black/50" on:click|self={() => (open = false)}>
		<div class="w-full max-w-md rounded-t-card bg-surface p-5 pb-8">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="font-display text-base font-semibold text-ash">Record Expense</h2>
				<button on:click={() => (open = false)} class="text-ash-muted" aria-label="Close">✕</button>
			</div>

			<label for="cat" class="mb-1.5 block text-xs font-medium text-ash-muted">Category</label>
			<div class="grid grid-cols-3 gap-2">
				{#each CATEGORIES as c}
					<button
						on:click={() => (category = c.id)}
						class="flex flex-col items-center gap-1 rounded-card border py-2.5"
						class:border-emerald={category === c.id}
						class:border-hair={category !== c.id}
					>
						<span>{c.icon}</span>
						<span class="text-[11px] text-ash">{c.id}</span>
					</button>
				{/each}
			</div>

			<label for="amt" class="mb-1.5 mt-4 block text-xs font-medium text-ash-muted">Amount (₦)</label>
			<input id="amt" type="number" min="1" bind:value={amount} placeholder="0.00" class="w-full rounded-card border border-hair bg-surface2 px-4 py-3 text-sm text-ash outline-none focus:border-emerald" />

			<label for="note" class="mb-1.5 mt-3 block text-xs font-medium text-ash-muted">Note (optional)</label>
			<input id="note" type="text" bind:value={note} placeholder="e.g. Lunch with team" class="w-full rounded-card border border-hair bg-surface2 px-4 py-3 text-sm text-ash outline-none focus:border-emerald" />

			{#if error}<p class="mt-3 text-sm text-danger">{error}</p>{/if}

			<button on:click={submit} disabled={loading} class="mt-5 w-full rounded-card bg-emerald py-3.5 text-sm font-semibold text-ink disabled:opacity-60">
				{loading ? 'Saving…' : 'Save Expense'}
			</button>
		</div>
	</div>
{/if}
