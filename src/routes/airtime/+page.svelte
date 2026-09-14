<script>
	import { goto } from '$app/navigation';
	import { formatNaira } from '$lib/format';
	import { buyAirtime } from '$lib/walletActions';
	import PinConfirm from '$lib/components/PinConfirm.svelte';

	export let data;

	const NETWORKS = [
		{ id: 'mtn', label: 'MTN', color: '#FFC700' },
		{ id: 'airtel', label: 'Airtel', color: '#E1523D' },
		{ id: 'glo', label: 'Glo', color: '#1B8A5A' },
		{ id: '9mobile', label: '9mobile', color: '#28B577' }
	];
	const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

	let network = '';
	let phone = '';
	let amount = '';
	let pinOpen = false;
	let loading = false;
	let error = '';

	$: networkLabel = NETWORKS.find((n) => n.id === network)?.label ?? '';
	$: valid = network && phone.length >= 11 && Number(amount) > 0;

	function openPin() {
		error = '';
		if (!valid) {
			error = 'Select a network, enter a valid phone number and amount.';
			return;
		}
		if (Number(amount) > (data.wallet?.balance ?? 0)) {
			error = 'Insufficient wallet balance.';
			return;
		}
		pinOpen = true;
	}

	async function confirm() {
		loading = true;
		const { error: err } = await buyAirtime({ amount: Number(amount), network: networkLabel, phone });
		loading = false;
		pinOpen = false;
		if (err) {
			error = err.message;
			return;
		}
		goto('/transactions');
	}
</script>

<svelte:head><title>Airtime · Elite Wallet</title></svelte:head>

<header class="bg-band px-5 pb-5 pt-6">
	<a href="/" class="text-sm text-ash-muted">← Home</a>
	<h1 class="mt-2 font-display text-xl font-semibold text-ash">Buy Airtime</h1>
	<p class="mt-1 text-xs text-ash-muted">Balance: {formatNaira(data.wallet?.balance ?? 0)}</p>
</header>

<section class="px-5 pt-6">
	<h2 class="mb-2 text-xs font-medium text-ash-muted">Select network</h2>
	<div class="grid grid-cols-4 gap-2.5">
		{#each NETWORKS as n}
			<button
				on:click={() => (network = n.id)}
				class="flex flex-col items-center gap-2 rounded-card border py-3.5"
				class:border-emerald={network === n.id}
				class:border-hair={network !== n.id}
				class:bg-surface={true}
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
		<h2 class="mb-2 text-xs font-medium text-ash-muted">Select amount</h2>
		<div class="grid grid-cols-3 gap-2.5">
			{#each QUICK_AMOUNTS as a}
				<button
					on:click={() => (amount = String(a))}
					class="rounded-card border py-3 text-sm"
					class:border-emerald={Number(amount) === a}
					class:text-emerald-bright={Number(amount) === a}
					class:border-hair={Number(amount) !== a}
					class:text-ash={Number(amount) !== a}
				>
					{formatNaira(a)}
				</button>
			{/each}
		</div>
		<input
			type="number"
			min="1"
			bind:value={amount}
			placeholder="Or enter custom amount"
			class="mt-2.5 w-full rounded-card border border-hair bg-surface px-4 py-3 text-sm text-ash outline-none focus:border-emerald"
		/>
	</div>

	{#if error}<p class="mt-4 text-sm text-danger">{error}</p>{/if}

	<button on:click={openPin} class="mt-6 w-full rounded-card bg-emerald py-3.5 text-sm font-semibold text-ink">
		Continue
	</button>
</section>

<PinConfirm
	open={pinOpen}
	{loading}
	summary={`${formatNaira(Number(amount || 0))} ${networkLabel} airtime to ${phone}`}
	on:confirm={confirm}
	on:close={() => (pinOpen = false)}
/>
