<script>
	import { page } from '$app/stores';

	const tabs = [
		{ href: '/', label: 'Home', icon: 'home' },
		{ href: '/wallet', label: 'Wallet', icon: 'wallet' },
		{ href: '/transfer', label: 'Transfer', icon: 'transfer' },
		{ href: '/spend', label: 'Spend', icon: 'spend' },
		{ href: '/transactions', label: 'History', icon: 'history' }
	];

	$: active = $page.url.pathname;
</script>

<nav
	class="fixed inset-x-0 bottom-0 z-20 border-t border-hair bg-surface/95 backdrop-blur"
	aria-label="Primary"
>
	<div class="mx-auto flex max-w-md items-stretch justify-between px-2">
		{#each tabs as tab}
			{@const isActive = tab.href === '/' ? active === '/' : active.startsWith(tab.href)}
			<a
				href={tab.href}
				class="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors"
				class:text-emerald-bright={isActive}
				class:text-ash-faint={!isActive}
				aria-current={isActive ? 'page' : undefined}
			>
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
					{#if tab.icon === 'home'}
						<path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9a1 1 0 0 0 1 1H10v-5.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V20h3.5a1 1 0 0 0 1-1v-9" />
					{:else if tab.icon === 'wallet'}
						<rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><circle cx="16.5" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
					{:else if tab.icon === 'transfer'}
						<path d="M7 7h11l-3-3" /><path d="M17 17H6l3 3" />
					{:else if tab.icon === 'spend'}
						<path d="M12 3v18" /><path d="M17 7c0-1.7-2.2-3-5-3S7 5.3 7 7s2.2 3 5 3 5 1.3 5 3-2.2 3-5 3-5-1.3-5-3" />
					{:else if tab.icon === 'history'}
						<circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" />
					{/if}
				</svg>
				<span>{tab.label}</span>
			</a>
		{/each}
	</div>
	<div class="h-[env(safe-area-inset-bottom)] bg-surface/95" />
</nav>
