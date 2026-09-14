<script>
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';

	let email = '';
	let password = '';
	let loading = false;
	let error = '';

	async function handleLogin() {
		loading = true;
		error = '';
		const { error: err } = await supabase.auth.signInWithPassword({ email, password });
		loading = false;
		if (err) {
			error = err.message;
			return;
		}
		goto('/');
	}
</script>

<svelte:head><title>Log in · Elite Wallet</title></svelte:head>

<div class="flex min-h-screen flex-col justify-center px-6 py-12">
	<div class="mb-10 text-center">
		<div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-card bg-emerald-dim text-2xl">
			₦
		</div>
		<h1 class="font-display text-2xl font-semibold text-ash">Elite Wallet</h1>
		<p class="mt-1 text-sm text-ash-muted">Your everyday payment hub</p>
	</div>

	<form on:submit|preventDefault={handleLogin} class="space-y-4">
		<div>
			<label for="email" class="mb-1.5 block text-xs font-medium text-ash-muted">Email</label>
			<input
				id="email"
				type="email"
				required
				bind:value={email}
				class="w-full rounded-card border border-hair bg-surface px-4 py-3 text-sm text-ash outline-none focus:border-emerald"
				placeholder="you@example.com"
			/>
		</div>
		<div>
			<label for="password" class="mb-1.5 block text-xs font-medium text-ash-muted">Password</label>
			<input
				id="password"
				type="password"
				required
				bind:value={password}
				class="w-full rounded-card border border-hair bg-surface px-4 py-3 text-sm text-ash outline-none focus:border-emerald"
				placeholder="••••••••"
			/>
		</div>

		{#if error}
			<p class="text-sm text-danger">{error}</p>
		{/if}

		<button
			type="submit"
			disabled={loading}
			class="w-full rounded-card bg-emerald py-3.5 text-sm font-semibold text-ink disabled:opacity-60"
		>
			{loading ? 'Signing in…' : 'Log in'}
		</button>
	</form>

	<p class="mt-6 text-center text-sm text-ash-muted">
		New here? <a href="/signup" class="font-medium text-gold">Create an account</a>
	</p>
</div>
