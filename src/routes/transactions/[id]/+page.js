import { error as kitError } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export const ssr = false;

export async function load({ params }) {
	const { data: tx, error: err } = await supabase
		.from('transactions')
		.select('*')
		.eq('id', params.id)
		.single();

	if (err || !tx) {
		throw kitError(404, 'Transaction not found');
	}

	return { tx };
}
