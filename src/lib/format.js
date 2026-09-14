/** Format kobo-free naira amounts consistently as ₦ with thousands separators. */
export function formatNaira(amount) {
	const n = Number(amount ?? 0);
	return (
		'₦' +
		n.toLocaleString('en-NG', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		})
	);
}

export function formatDate(isoString) {
	if (!isoString) return '—';
	return new Date(isoString).toLocaleDateString('en-NG', {
		day: '2-digit',
		month: 'short',
		year: 'numeric'
	});
}

export function formatTime(isoString) {
	if (!isoString) return '—';
	return new Date(isoString).toLocaleTimeString('en-NG', {
		hour: '2-digit',
		minute: '2-digit'
	});
}

export const STATUS_META = {
	pending: { label: 'Pending', dot: '🟡', class: 'status-pending' },
	successful: { label: 'Successful', dot: '🟢', class: 'status-successful' },
	failed: { label: 'Failed', dot: '🔴', class: 'status-failed' },
	reversed: { label: 'Reversed', dot: '↩️', class: 'status-reversed' }
};

export const TX_TYPE_LABEL = {
	fund: 'Wallet Funding',
	withdraw: 'Withdrawal',
	transfer_bank: 'Bank Transfer',
	transfer_wallet: 'Wallet Transfer',
	airtime: 'Airtime',
	data: 'Data Bundle',
	bill_electricity: 'Electricity',
	bill_cable: 'Cable TV',
	bill_internet: 'Internet',
	bill_other: 'Bill Payment'
};

/** Transaction types that reduce the wallet balance, for +/- display. */
export const DEBIT_TYPES = new Set([
	'withdraw',
	'transfer_bank',
	'transfer_wallet',
	'airtime',
	'data',
	'bill_electricity',
	'bill_cable',
	'bill_internet',
	'bill_other'
]);
