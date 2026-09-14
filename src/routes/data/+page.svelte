<script>
	import { goto } from '$app/navigation';
	import { formatNaira } from '$lib/format';
	import { buyData } from '$lib/walletActions';
	import PinConfirm from '$lib/components/PinConfirm.svelte';

	export let data;

	const NETWORKS = [
		{ id: 'mtn', label: 'MTN', color: '#FFC700' },
		{ id: 'airtel', label: 'Airtel', color: '#E1523D' },
		{ id: 'glo', label: 'Glo', color: '#1B8A5A' },
		{ id: '9mobile', label: '9mobile', color: '#28B577' }
	];

	const BUNDLES = [
		{ id: 'd1', label: '1GB · 1 Day', amount: 350 },
		{ id: 'd2', label: '2.5GB · 2 Days', amount: 700 },
		{ id: 'd3', label: '5GB · 7 Days', amount: 1500 },
		{ id: 'd4', label: '10GB · 30 Days', amount: 3000 },
		{ id: 'd5', label: '20GB · 30 Days', amount: 5500 },
		{ id: 'd6', label: '40GB · 30 Days', amount: 10000 }
	];

	let network = '';
	let phone = '';
	let bundle = null;
	let pinOpen = false;
	let loading = false;
	let error = '';

	$: networkLabel = NETWORKS.find((n) => n.id === network)?.label ?? '';
	$: valid = network && phone.length >= 11 && bundle;

	function openPin() {
		error = '';
		if (!valid) {
			error = 'Select a network, bundle and enter a valid phone number.';
			return;
		}
		if (bundle.amount > (data.wallet?.balance ?? 0)) {
			error = 'Insufficient wallet balance.';
			return;
		}
		pinOpen = true;
	}

	async function confirm() {
		loading = true;
		const { error: err } = await buyData({
			amount: bundle.amount,
			network: networkLabel,
			phone,
			bundleLabel: bundle.label
		});
		loading = false;
		pinOpen = false;
		if (err) {
			error = err.message;
			return;
		}
		goto('/transactions');
	}
</script>

<svelte:head><title>Data · Elite Wallet</title></svelte:head>

<header class="bg-band px-5 pb-5 pt-6">
	<a href="/" class="text-sm text-ash-muted">← Home</a>
	<h1 class="mt-2 font-display text-xl font-semibold text-ash">Buy Data</h1>
	<p class="mt-1 text-xs text-ash-muted">Balance: {formatNaira(data.wallet?.balance ?? 0)}</p>
</header>

<section class="px-5 pt-6">
	<h2 class="mb-2 text-xs font-medium text-ash-muted">Select network</h2>
	<div class="grid grid-cols-4 gap-2.5">
		{#each NETWORKS as n}
			<button
				on:click={() => (network = n.id)}
				class="flex flex-col items-center gap-2 rounded-card border bg-surface py-3.5"
				class:border-emerald={network === n.id}
				class:border-hair={network !== n.id}
			>
				<span class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-ink" style="background:{n.color}">
					{n.label.charAt(0)}
				</span>
				<span class="text-[11px] text-ash">{n.label}</span>
			</button>
		{/each}
	</div>

	<div class="mt-5">
		<label for="phone" class="mb-1.5 block text-xs font-medium text-ash-muted">Phone number</label>
		<input
			id="phone"
			type="tel"
			inputmode="numeric"
			maxlength="11"
			bind:value={phone}
			placeholder="080xxxxxxxx"
			class="w-full rounded-card border border-hair bg-surface px-4 py-3 text-sm text-ash outline-none focus:border-emerald"
		/>
	</div>

	<div class="mt-4">
		<h2 class="mb-2 text-xs font-medium text-ash-muted">Select bundle</h2>
		<div class="space-y-2">
			{#each BUNDLES as b}
				<button
					on:click={() => (bundle = b)}
					class="flex w-full items-center justify-between rounded-card border bg-surface px-4 py-3.5"
					class:border-emerald={bundle?.id === b.id}
					class:border-hair={bundle?.id !== b.id}
				>
					<span class="text-sm text-ash">{b.label}</span>
					<span class="text-sm font-semibold text-ash">{formatNaira(b.amount)}</span>
				</button>
			{/each}
		</div>
	</div>

	{#if error}<p class="mt-4 text-sm text-danger">{error}</p>{/if}

	<button on:click={openPin} class="mt-6 w-full rounded-card bg-emerald py-3.5 text-sm font-semibold text-ink">
		Continue
	</button>
</section>

<PinConfirm
	open={pinOpen}
	{loading}
	summary={`${bundle ? formatNaira(bundle.amount) : ''} ${networkLabel} ${bundle?.label ?? ''} to ${phone}`}
	on:confirm={confirm}
	on:close={() => (pinOpen = false)}
/>
