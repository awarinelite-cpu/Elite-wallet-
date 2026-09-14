<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { formatNaira } from '$lib/format';
	import { payBill } from '$lib/walletActions';
	import PinConfirm from '$lib/components/PinConfirm.svelte';

	export let data;

	const CATEGORIES = [
		{
			id: 'electricity',
			label: 'Electricity',
			icon: '💡',
			billType: 'bill_electricity',
			providers: ['Ikeja Electric', 'Eko Electric', 'Abuja Electric', 'Port Harcourt Electric'],
			refLabel: 'Meter number'
		},
		{
			id: 'cable',
			label: 'Cable TV',
			icon: '📺',
			billType: 'bill_cable',
			providers: ['DStv', 'GOtv', 'StarTimes'],
			refLabel: 'Smartcard / IUC number'
		},
		{
			id: 'internet',
			label: 'Internet',
			icon: '🌐',
			billType: 'bill_internet',
			providers: ['Spectranet', 'Smile', 'FiberOne'],
			refLabel: 'Account / device number'
		},
		{
			id: 'other',
			label: 'Other',
			icon: '🧾',
			billType: 'bill_other',
			providers: ['Lagos Water Corporation', 'Waste Management Levy', 'National ID (NIMC)'],
			refLabel: 'Reference / customer ID'
		}
	];

	let category = CATEGORIES.find((c) => c.id === $page.url.searchParams.get('type')) ?? null;
	let provider = '';
	let customerRef = '';
	let amount = '';
	let pinOpen = false;
	let loading = false;
	let error = '';

	function selectCategory(c) {
		category = c;
		provider = '';
		customerRef = '';
		amount = '';
		error = '';
	}

	$: valid = category && provider && customerRef && Number(amount) > 0;

	function openPin() {
		error = '';
		if (!valid) {
			error = 'Fill in provider, reference number and amount.';
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
		const { error: err } = await payBill({
			amount: Number(amount),
			billType: category.billType,
			provider,
			customerRef
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

<svelte:head><title>Bills · Elite Wallet</title></svelte:head>

<header class="bg-band px-5 pb-5 pt-6">
	<a href={category ? '#' : '/'} on:click={() => category && selectCategory(null)} class="text-sm text-ash-muted">
		← {category ? 'Bills' : 'Home'}
	</a>
	<h1 class="mt-2 font-display text-xl font-semibold text-ash">
		{category ? category.label : 'Pay a Bill'}
	</h1>
	<p class="mt-1 text-xs text-ash-muted">Balance: {formatNaira(data.wallet?.balance ?? 0)}</p>
</header>

{#if !category}
	<section class="px-5 pt-6">
		<div class="grid grid-cols-2 gap-3">
			{#each CATEGORIES as c}
				<button on:click={() => selectCategory(c)} class="flex flex-col items-center gap-2 rounded-card border border-hair bg-surface py-6">
					<span class="text-2xl">{c.icon}</span>
					<span class="text-sm text-ash">{c.label}</span>
				</button>
			{/each}
		</div>
	</section>
{:else}
	<section class="px-5 pt-6">
		<label for="provider" class="mb-1.5 block text-xs font-medium text-ash-muted">Provider</label>
		<select id="provider" bind:value={provider} class="w-full rounded-card border border-hair bg-surface px-4 py-3 text-sm text-ash outline-none focus:border-emerald">
			<option value="" disabled selected>Select a provider</option>
			{#each category.providers as p}<option value={p}>{p}</option>{/each}
		</select>

		<label for="ref" class="mb-1.5 mt-3 block text-xs font-medium text-ash-muted">{category.refLabel}</label>
		<input id="ref" type="text" bind:value={customerRef} placeholder="Enter {category.refLabel.toLowerCase()}" class="w-full rounded-card border border-hair bg-surface px-4 py-3 text-sm text-ash outline-none focus:border-emerald" />

		<label for="amt" class="mb-1.5 mt-3 block text-xs font-medium text-ash-muted">Amount (₦)</label>
		<input id="amt" type="number" min="1" bind:value={amount} placeholder="0.00" class="w-full rounded-card border border-hair bg-surface px-4 py-3 text-sm text-ash outline-none focus:border-emerald" />

		{#if error}<p class="mt-4 text-sm text-danger">{error}</p>{/if}

		<button on:click={openPin} class="mt-6 w-full rounded-card bg-emerald py-3.5 text-sm font-semibold text-ink">
			Continue
		</button>
	</section>
{/if}

{#if category}
	<PinConfirm
		open={pinOpen}
		{loading}
		summary={`${formatNaira(Number(amount || 0))} ${provider} ${category.label} — ${customerRef}`}
		on:confirm={confirm}
		on:close={() => (pinOpen = false)}
	/>
{/if}
