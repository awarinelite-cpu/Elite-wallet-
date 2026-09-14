<script>
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';

	let fullName = '';
	let email = '';
	let password = '';
	let loading = false;
	let error = '';
	let info = '';

	async function handleSignup() {
		loading = true;
		error = '';
		info = '';
		const { data, error: err } = await supabase.auth.signUp({
			email,
			password,
			options: { data: { full_name: fullName } }
		});
		loading = false;
		if (err) {
			error = err.message;
			return;
		}
		// A DB trigger (handle_new_user in schema.sql) creates the wallet
		// and default spend categories automatically on signup.
		if (data.session) {
			goto('/');
		} else {
			info = 'Check your email to confirm your account, then log in.';
		}
	}
</script>

<svelte:head><title>Create account · Elite Wallet</title></svelte:head>

<div class="flex min-h-screen flex-col justify-center px-6 py-12">
	<div class="mb-10 text-center">
		<div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-card bg-emerald-dim text-2xl">
			₦
		</div>
		<h1 class="font-display text-2xl font-semibold text-ash">Create your wallet</h1>
		<p class="mt-1 text-sm text-ash-muted">Sandbox mode — no real money moves yet</p>
	</div>

	<form on:submit|preventDefault={handleSignup} class="space-y-4">
		<div>
			<label for="name" class="mb-1.5 block text-xs font-medium text-ash-muted">Full name</label>
			<input
				id="name"
				type="text"
				required
				bind:value={fullName}
				class="w-full rounded-card border border-hair bg-surface px-4 py-3 text-sm text-ash outline-none focus:border-emerald"
				placeholder="Ada Eze"
			/>
		</div>
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
				minlength="6"
				bind:value={password}
				class="w-full rounded-card border border-hair bg-surface px-4 py-3 text-sm text-ash outline-none focus:border-emerald"
				placeholder="At least 6 characters"
			/>
		</div>

		{#if error}
			<p class="text-sm text-danger">{error}</p>
		{/if}
		{#if info}
			<p class="text-sm text-emerald-bright">{info}</p>
		{/if}

		<button
			type="submit"
			disabled={loading}
			class="w-full rounded-card bg-emerald py-3.5 text-sm font-semibold text-ink disabled:opacity-60"
		>
			{loading ? 'Creating account…' : 'Create account'}
		</button>
	</form>

	<p class="mt-6 text-center text-sm text-ash-muted">
		Already have a wallet? <a href="/login" class="font-medium text-gold">Log in</a>
	</p>
</div>
