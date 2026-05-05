import { error, redirect } from '@sveltejs/kit';
import { getInvoiceById } from '$lib/server/db';

export async function load({ locals, params }) {
	if (!locals.user) {
		redirect(303, '/login');
	}

	const invoice = await getInvoiceById(params.id);
	if (!invoice) {
		error(404, 'Invoice not found');
	}

	return { invoice };
}

