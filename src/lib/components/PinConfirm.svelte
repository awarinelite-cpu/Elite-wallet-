<script>
	import { createEventDispatcher } from 'svelte';

	export let open = false;
	export let summary = ''; // e.g. "₦2,000 MTN Airtime to 0803 123 4567"
	export let loading = false;

	const dispatch = createEventDispatcher();
	let digits = ['', '', '', ''];
	let inputs = [];

	function onInput(i, e) {
		const v = e.target.value.replace(/\D/g, '').slice(-1);
		digits[i] = v;
		digits = [...digits];
		if (v && i < 3) inputs[i + 1]?.focus();
		if (digits.every((d) => d !== '')) {
			dispatch('confirm', { pin: digits.join('') });
		}
	}

	function onKeydown(i, e) {
		if (e.key === 'Backspace' && !digits[i] && i > 0) inputs[i - 1]?.focus();
	}

	function close() {
		digits = ['', '', '', ''];
		dispatch('close');
	}
</script>

{#if open}
	<div class="fixed inset-0 z-40 flex items-end justify-center bg-black/50" on:click|self={close}>
		<div class="w-full max-w-md rounded-t-card bg-surface p-5 pb-8">
			<div class="mb-1 flex items-center justify-between">
				<h2 class="font-display text-base font-semibold text-ash">Confirm with PIN</h2>
				<button on:click={close} class="text-ash-muted" aria-label="Close">✕</button>
			</div>
			<p class="mb-5 text-sm text-ash-muted">{summary}</p>

			<div class="flex justify-center gap-3">
				{#each digits as d, i}
					<input
						bind:this={inputs[i]}
						type="password"
						inputmode="numeric"
						maxlength="1"
						value={d}
						on:input={(e) => onInput(i, e)}
						on:keydown={(e) => onKeydown(i, e)}
						disabled={loading}
						class="h-14 w-12 rounded-card border border-hair bg-surface2 text-center text-xl text-ash outline-none focus:border-emerald"
					/>
				{/each}
			</div>
			{#if loading}<p class="mt-4 text-center text-sm text-ash-muted">Processing…</p>{/if}
			<p class="mt-5 text-center text-[11px] text-ash-faint">Sandbox PIN — any 4 digits will confirm this payment.</p>
		</div>
	</div>
{/if}
