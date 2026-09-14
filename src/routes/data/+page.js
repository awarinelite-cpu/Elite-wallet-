import { supabase } from '$lib/supabaseClient';

export const ssr = false;

export async function load() {
	const {
		data: { user }
	} = await supabase.auth.getUser();
	const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', user.id).single();
	return { wallet };
}
