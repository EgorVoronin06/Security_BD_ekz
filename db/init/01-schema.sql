DO
$$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
		CREATE ROLE app_user LOGIN PASSWORD 'app_user';
	END IF;
END;
$$;

ALTER ROLE app_user BYPASSRLS;

CREATE SCHEMA IF NOT EXISTS training AUTHORIZATION postgres;

CREATE TABLE IF NOT EXISTS training.app_users (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	username text NOT NULL UNIQUE,
	password text NOT NULL,
	full_name text NOT NULL,
	role text NOT NULL CHECK (role IN ('student', 'manager', 'admin')),
	email text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS training.sessions (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id uuid NOT NULL REFERENCES training.app_users(id) ON DELETE CASCADE,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training.customers (
	id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	owner_user_id uuid NOT NULL REFERENCES training.app_users(id) ON DELETE CASCADE,
	full_name text NOT NULL,
	email text NOT NULL,
	tier text NOT NULL,
	profile_note text NOT NULL
);

CREATE TABLE IF NOT EXISTS training.invoices (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	customer_id integer NOT NULL REFERENCES training.customers(id) ON DELETE CASCADE,
	owner_user_id uuid NOT NULL REFERENCES training.app_users(id) ON DELETE CASCADE,
	amount numeric(12, 2) NOT NULL,
	status text NOT NULL,
	card_hint text NOT NULL,
	notes text NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training.audit_events (
	id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	actor_username text NOT NULL,
	action text NOT NULL,
	details text NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE training.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_isolation ON training.customers;
CREATE POLICY customer_isolation
	ON training.customers
	USING (
		owner_user_id = COALESCE(NULLIF(current_setting('app.current_user_id', true), ''), '00000000-0000-0000-0000-000000000000')::uuid
	);

CREATE OR REPLACE FUNCTION training.run_custom_report(raw_where_clause text)
RETURNS TABLE (
	customer_name text,
	amount numeric,
	owner_name text,
	card_hint text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS
$$
BEGIN
	RETURN QUERY EXECUTE format(
		'SELECT c.full_name, i.amount, u.full_name, i.card_hint
		 FROM training.invoices i
		 JOIN training.customers c ON c.id = i.customer_id
		 JOIN training.app_users u ON u.id = i.owner_user_id
		 WHERE %s
		 ORDER BY i.id',
		raw_where_clause
	);
END;
$$;

GRANT USAGE ON SCHEMA training TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA training TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA training TO app_user;
GRANT EXECUTE ON FUNCTION training.run_custom_report(text) TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA training
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
