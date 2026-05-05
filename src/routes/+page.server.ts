import { getDashboardStats } from '$lib/server/db';

export async function load() {
	return {
		stats: await getDashboardStats(),
		demoUsers: [
			{ username: 'alice', password: 'alice123' },
		]
	};
}
