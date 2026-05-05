import { redirect } from '@sveltejs/kit';
import { logout } from '$lib/server/db';

export async function GET({ cookies }) {
	await logout(cookies.get('session_id'));
	cookies.delete('session_id', { path: '/' });
	redirect(303, '/');
}

