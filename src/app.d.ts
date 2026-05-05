declare global {
	namespace App {
		interface Locals {
			user: {
				id: string;
				username: string;
				full_name: string;
				role: string;
				email: string;
			} | null;
		}

		interface PageData {
			user: Locals['user'];
		}
	}
}

export {};
