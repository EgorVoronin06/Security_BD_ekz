import { redirect } from '@sveltejs/kit';
import { getUserById } from '$lib/server/db';

export async function load({ locals }) {
	if (!locals.user) {
		redirect(303, '/login');
	}

	const profile = await getUserById(locals.user.id);

	return {
		profile
	};
}

