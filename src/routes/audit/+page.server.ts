import { redirect } from '@sveltejs/kit';
import { listAuditEvents } from '$lib/server/db';

export async function load({ locals }) {
	if (!locals.user) {
		redirect(303, '/login');
	}

	return {
		events: await listAuditEvents()
	};
}

