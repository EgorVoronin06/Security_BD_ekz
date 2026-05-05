import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import pg from 'pg';

const { Pool } = pg;

const connectionString = env.DATABASE_URL ?? 'postgresql://app_user:app_user@localhost:5432/training_lab';

export const pool = new Pool({
	connectionString
});

export type AppUser = {
	id: string;
	username: string;
	full_name: string;
	role: string;
	email: string;
};

type LoginResult = {
	session_id: string;
	user_id: string;
	username: string;
	full_name: string;
	role: string;
	email: string;
};

export async function getUserBySession(sessionId: string | undefined): Promise<AppUser | null> {
	if (!sessionId) {
		return null;
	}

	const result = await pool.query<AppUser>(
		`
			SELECT u.id, u.username, u.full_name, u.role, u.email
			FROM training.sessions s
			JOIN training.app_users u ON u.id = s.user_id
			WHERE s.id = $1
		`,
		[sessionId]
	);

	return result.rows[0] ?? null;
}

export async function login(username: string, password: string): Promise<LoginResult | null> {
	const result = await pool.query<LoginResult>(
		`
			WITH matched_user AS (
				SELECT id, username, full_name, role, email
				FROM training.app_users
				WHERE username = $1
				  AND password = $2
			),
			new_session AS (
				INSERT INTO training.sessions (user_id)
				SELECT id FROM matched_user
				RETURNING id, user_id
			)
			SELECT
				new_session.id AS session_id,
				matched_user.id AS user_id,
				matched_user.username,
				matched_user.full_name,
				matched_user.role,
				matched_user.email
			FROM new_session
			JOIN matched_user ON matched_user.id = new_session.user_id
		`,
		[username, password]
	);

	return result.rows[0] ?? null;
}

export async function logout(sessionId: string | undefined): Promise<void> {
	if (!sessionId) {
		return;
	}

	await pool.query('DELETE FROM training.sessions WHERE id = $1', [sessionId]);
}

export async function getDashboardStats() {
	const [users, customers, invoices, audits] = await Promise.all([
		pool.query('SELECT COUNT(*)::int AS count FROM training.app_users'),
		pool.query('SELECT COUNT(*)::int AS count FROM training.customers'),
		pool.query('SELECT COUNT(*)::int AS count FROM training.invoices'),
		pool.query('SELECT COUNT(*)::int AS count FROM training.audit_events')
	]);

	return {
		users: users.rows[0].count,
		customers: customers.rows[0].count,
		invoices: invoices.rows[0].count,
		audits: audits.rows[0].count
	};
}

export async function unsafeSearchCustomers(search: string) {
	const normalized = search.trim();

	if (!normalized) {
		return {
			sql: '',
			rows: []
		};
	}

	// Intentional vulnerability for the lab: user input is concatenated into SQL.
	const sql = `SELECT id, full_name, email, tier, owner_user_id
		FROM training.customers
		WHERE email ILIKE '%${normalized}%'
		ORDER BY id`;

	const result = await pool.query(sql);
	return { sql, rows: result.rows };
}

export async function getInvoiceById(id: string) {
	const result = await pool.query(
		`
			SELECT
				i.id,
				i.amount,
				i.status,
				i.card_hint,
				i.notes,
				i.created_at,
				c.full_name AS customer_name,
				c.email AS customer_email,
				u.username AS owner_username
			FROM training.invoices i
			JOIN training.customers c ON c.id = i.customer_id
			JOIN training.app_users u ON u.id = i.owner_user_id
			WHERE i.id = $1
		`,
		[id]
	);

	return result.rows[0] ?? null;
}

export async function listUsers() {
	const result = await pool.query(
		`
			SELECT id, username, full_name, role, email
			FROM training.app_users
			ORDER BY id
		`
	);

	return result.rows;
}

export async function updateUserRole(userId: string, roleName: string) {
	await pool.query('UPDATE training.app_users SET role = $1 WHERE id = $2', [roleName, userId]);
}

export async function getUserById(userId: string) {
	const result = await pool.query(
		`
			SELECT id, username, full_name, role, email
			FROM training.app_users
			WHERE id = $1
		`,
		[userId]
	);

	return result.rows[0] ?? null;
}

export async function updateUserProfile(
	userId: string,
	fields: {
		fullName: string;
		email: string;
		roleName?: string;
	}
) {
	const roleName = fields.roleName?.trim();

	if (roleName) {
		await pool.query(
			`
				UPDATE training.app_users
				SET full_name = $1,
				    email = $2,
				    role = $3
				WHERE id = $4
			`,
			[fields.fullName, fields.email, roleName, userId]
		);

		return;
	}

	await pool.query(
		`
			UPDATE training.app_users
			SET full_name = $1,
			    email = $2
			WHERE id = $3
		`,
		[fields.fullName, fields.email, userId]
	);
}

export async function listAuditEvents() {
	const result = await pool.query(
		`
			SELECT id, actor_username, action, details, created_at
			FROM training.audit_events
			ORDER BY created_at DESC
			LIMIT 50
		`
	);

	return result.rows;
}

export async function runCustomReport(whereClause: string) {
	if (!whereClause.trim()) {
		error(400, 'WHERE clause is required');
	}

	const result = await pool.query('SELECT * FROM training.run_custom_report($1)', [whereClause]);
	return result.rows;
}
