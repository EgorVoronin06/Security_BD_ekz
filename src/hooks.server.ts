import type { Handle } from '@sveltejs/kit';
import { getUserBySession } from '$lib/server/db';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get('session_id');
	event.locals.user = await getUserBySession(sessionId);

	return resolve(event);
};

