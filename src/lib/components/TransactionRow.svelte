<script>
	import { formatNaira, formatDate, STATUS_META, TX_TYPE_LABEL, DEBIT_TYPES } from '$lib/format';

	/** @type {any} */
	export let tx;

	$: isDebit = DEBIT_TYPES.has(tx.type);
	$: status = STATUS_META[tx.status] ?? STATUS_META.pending;
	$: label = tx.description || TX_TYPE_LABEL[tx.type] || tx.type;
</script>

<a
	href={`/transactions/${tx.id}`}
	class="flex items-center justify-between gap-3 py-3.5 first:pt-0 border-b border-hair last:border-none"
>
	<div class="flex min-w-0 items-center gap-3">
		<span class="status-dot {status.class} shrink-0" aria-hidden="true"></span>
		<div class="min-w-0">
			<p class="truncate text-sm font-medium text-ash">{label}</p>
			<p class="text-xs text-ash-faint">{formatDate(tx.created_at)} · {status.label}</p>
		</div>
	</div>
	<div class="shrink-0 text-right">
		<p class="font-display text-sm font-semibold" class:text-danger={isDebit} class:text-emerald-bright={!isDebit}>
			{isDebit ? '−' : '+'}{formatNaira(tx.amount)}
		</p>
		{#if tx.fee > 0}
			<p class="text-[11px] text-ash-faint">Fee {formatNaira(tx.fee)}</p>
		{/if}
	</div>
</a>
