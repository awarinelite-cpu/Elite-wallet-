import { supabase } from '$lib/supabaseClient';

export const ssr = false;

export async function load() {
	const {
		data: { user }
	} = await supabase.auth.getUser();

	const [{ data: wallet }, { data: transactions }] = await Promise.all([
		supabase.from('wallets').select('*').eq('user_id', user.id).single(),
		supabase
			.from('transactions')
			.select('*')
			.eq('user_id', user.id)
			.order('created_at', { ascending: false })
			.limit(5)
	]);

	return { wallet, transactions: transactions ?? [], user };
}
