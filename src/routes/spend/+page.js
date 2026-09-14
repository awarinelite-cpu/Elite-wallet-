import { supabase } from '$lib/supabaseClient';

export const ssr = false;

export async function load() {
	const {
		data: { user }
	} = await supabase.auth.getUser();

	const { data: records } = await supabase
		.from('spend_records')
		.select('*')
		.eq('user_id', user.id)
		.order('created_at', { ascending: false })
		.limit(50);

	return { records: records ?? [] };
}
