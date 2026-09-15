import { json } from '@sveltejs/kit';
import { PAYSTACK_SECRET_KEY } from '$env/static/private';

/** List Nigerian banks with their Paystack bank codes, for the transfer form. */
export async function GET() {
	try {
		const res = await fetch('https://api.paystack.co/bank?currency=NGN&type=nuban', {
			headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
		});
		const payload = await res.json();
		if (!res.ok || !payload.status) {
			console.error('[paystack:banks] Paystack rejected the request', res.status, payload);
			return json({ error: payload.message ?? 'Could not load bank list.' }, { status: 502 });
		}

		const banks = payload.data.map((b) => ({ name: b.name, code: b.code }));
		return json({ banks });
	} catch (err) {
		console.error('[paystack:banks] Request to Paystack threw', err);
		return json({ error: `Could not load bank list: ${err.message}` }, { status: 502 });
	}
}
