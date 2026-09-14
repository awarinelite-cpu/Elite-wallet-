import { supabase } from '$lib/supabaseClient';

export const ssr = false;

export async function load() {
	const {
		data: { user }
	} = await supabase.auth.getUser();

	const [{ data: wallet }, { data: statement }] = await Promise.all([
		supabase.from('wallets').select('*').eq('user_id', user.id).single(),
		supabase
			.from('transactions')
			.select('*')
			.eq('user_id', user.id)
			.in('type', ['fund', 'withdraw'])
			.order('created_at', { ascending: false })
			.limit(20)
	]);

	return { wallet, statement: statement ?? [] };
}
