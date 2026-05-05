import { redirect } from '@sveltejs/kit';
import { unsafeSearchCustomers } from '$lib/server/db';

export async function load({ locals, url }) {
	if (!locals.user) {
		redirect(303, '/login');
	}

	const q = url.searchParams.get('q') ?? '';
	const result = await unsafeSearchCustomers(q);

	return {
		q,
		sql: result.sql,
		customers: result.rows
	};
}

