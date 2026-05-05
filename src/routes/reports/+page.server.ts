import { fail, redirect } from '@sveltejs/kit';
import { runCustomReport } from '$lib/server/db';

export async function load({ locals }) {
	if (!locals.user) {
		redirect(303, '/login');
	}

	return {
		results: [],
		whereClause: "u.username = 'alice'"
	};
}

export const actions = {
	default: async ({ locals, request }) => {
		if (!locals.user) {
			redirect(303, '/login');
		}

		const form = await request.formData();
		const whereClause = String(form.get('whereClause') ?? '').trim();

		try {
			const results = await runCustomReport(whereClause);
			return {
				results,
				whereClause
			};
		} catch (err) {
			return fail(400, {
				whereClause,
				error: err instanceof Error ? err.message : 'Unknown SQL error'
			});
		}
	}
};
