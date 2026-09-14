import { supabase } from '$lib/supabaseClient';

export const ssr = false;

export async function load() {
	const {
		data: { user }
	} = await supabase.auth.getUser();

	const [{ data: wallet }, { data: beneficiaries }] = await Promise.all([
		supabase.from('wallets').select('*').eq('user_id', user.id).single(),
		supabase
			.from('beneficiaries')
			.select('*')
			.eq('user_id', user.id)
			.order('created_at', { ascending: false })
	]);

	return { wallet, beneficiaries: beneficiaries ?? [] };
}
