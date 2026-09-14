import { supabase } from '$lib/supabaseClient';

export const ssr = false;

export async function load() {
	const {
		data: { user }
	} = await supabase.auth.getUser();

	const { data: transactions } = await supabase
		.from('transactions')
		.select('*')
		.eq('user_id', user.id)
		.order('created_at', { ascending: false });

	return { transactions: transactions ?? [] };
}
