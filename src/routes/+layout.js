import { redirect } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export const ssr = false; // pure client-side app for the sandbox build

export async function load({ url }) {
	const {
		data: { session }
	} = await supabase.auth.getSession();

	const publicRoutes = ['/login', '/signup'];
	const isPublic = publicRoutes.includes(url.pathname);

	if (!session && !isPublic) {
		throw redirect(303, '/login');
	}
	if (session && isPublic) {
		throw redirect(303, '/');
	}

	return { session };
}
