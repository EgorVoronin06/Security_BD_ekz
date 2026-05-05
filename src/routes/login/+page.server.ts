import { fail, redirect } from '@sveltejs/kit';
import { login } from '$lib/server/db';

export async function load({ locals }) {
	if (locals.user) {
		redirect(303, '/');
	}
}

export const actions = {
	default: async ({ cookies, request }) => {
		const form = await request.formData();
		const username = String(form.get('username') ?? '').trim();
		const password = String(form.get('password') ?? '');

		if (!username || !password) {
			return fail(400, { error: 'Username and password are required.' });
		}

		const session = await login(username, password);
		if (!session) {
			return fail(401, { error: 'Invalid credentials.' });
		}

		cookies.set('session_id', session.session_id, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: false,
			maxAge: 60 * 60 * 8
		});

		redirect(303, '/');
	}
};

