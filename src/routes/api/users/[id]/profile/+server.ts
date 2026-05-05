import { error, json, redirect } from '@sveltejs/kit';
import { updateUserProfile } from '$lib/server/db';

export async function POST({ locals, params, request }) {
	if (!locals.user) {
		redirect(303, '/login');
	}

	const userId = params.id.trim();
	if (!userId) {
		error(400, 'Invalid user id');
	}

	const form = await request.formData();
	const fullName = String(form.get('fullName') ?? '').trim();
	const email = String(form.get('email') ?? '').trim();
	const roleName = String(form.get('roleName') ?? '').trim();

	if (!fullName || !email) {
		error(400, 'fullName and email are required');
	}

	// Intentional vulnerability for the lab: route id and optional roleName are trusted from the request.
	await updateUserProfile(userId, {
		fullName,
		email,
		roleName: roleName || undefined
	});

	return json({
		ok: true
	});
}
