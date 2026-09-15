<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { supabase } from '$lib/supabaseClient';

	let status = 'verifying'; // 'verifying' | 'success' | 'error'
	let message = 'Confirming your payment…';

	onMount(async () => {
		const reference =
			$page.url.searchParams.get('reference') ?? $page.url.searchParams.get('trxref');
		if (!reference) {
			status = 'error';
			message = 'No payment reference found.';
			return;
		}

		const {
			data: { session }
		} = await supabase.auth.getSession();
		if (!session) {
			status = 'error';
			message = 'You need to be signed in to confirm this payment.';
			return;
		}

		const res = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(reference)}`, {
			headers: { Authorization: `Bearer ${session.access_token}` }
		});
		const payload = await res.json();

		if (!res.ok) {
			status = 'error';
			message = payload.error ?? 'Could not confirm payment.';
			return;
		}

		status = 'success';
		message = 'Wallet funded successfully.';
		setTimeout(() => goto('/wallet'), 1500);
	});
</script>

<svelte:head><title>Confirming Payment · Elite Wallet</title></svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center px-6 text-center">
	{#if status === 'verifying'}
		<p class="text-sm text-ash-muted">{message}</p>
	{:else if status === 'success'}
		<p class="text-lg font-semibold text-emerald-bright">✓ {message}</p>
		<p class="mt-1 text-xs text-ash-faint">Redirecting to your wallet…</p>
	{:else}
		<p class="text-lg font-semibold text-danger">{message}</p>
		<a href="/wallet" class="mt-4 text-sm text-gold">← Back to Wallet</a>
	{/if}
</div>
