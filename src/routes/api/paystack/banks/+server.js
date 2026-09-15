import { json } from '@sveltejs/kit';
import { PAYSTACK_SECRET_KEY } from '$env/static/private';

/** List Nigerian banks with their Paystack bank codes, for the transfer form. */
export async function GET() {
	const res = await fetch('https://api.paystack.co/bank?currency=NGN&type=nuban', {
		headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
	});
	const payload = await res.json();
	if (!res.ok || !payload.status) {
		return json({ error: payload.message ?? 'Could not load bank list.' }, { status: 502 });
	}

	const banks = payload.data.map((b) => ({ name: b.name, code: b.code }));
	return json({ banks });
}
