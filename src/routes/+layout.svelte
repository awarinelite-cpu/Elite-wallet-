<script>
	import '../app.css';
	import { page } from '$app/stores';
	import BottomNav from '$lib/components/BottomNav.svelte';

	export let data;

	$: isAuthPage = $page.url.pathname === '/login' || $page.url.pathname === '/signup';
</script>

<div class="mx-auto min-h-screen max-w-md bg-ink pb-24">
	<slot />
</div>

{#if data.session && !isAuthPage}
	<BottomNav />
{/if}
