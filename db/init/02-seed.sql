TRUNCATE TABLE training.audit_events, training.invoices, training.customers, training.sessions, training.app_users RESTART IDENTITY CASCADE;

INSERT INTO training.app_users (id, username, password, full_name, role, email)
VALUES
	('8b8dea67-7624-4e41-9452-100cb4256805', 'alice', 'alice123', 'Alice Student', 'student', 'alice@corp.local'),
	('8ce21d94-2285-4cfa-9462-8d886261a847', 'bob', 'bob123', 'Bob Manager', 'manager', 'bob@corp.local'),
	('c6710eaa-49cf-4fb5-b5f2-5db37748e1cc', 'carol', 'carol123', 'Carol Admin', 'admin', 'carol@corp.local');

INSERT INTO training.customers (owner_user_id, full_name, email, tier, profile_note)
VALUES
	('8b8dea67-7624-4e41-9452-100cb4256805', 'Ivan Petrov', 'ivan.petrov@example.org', 'Standard', 'Student-owned record with ordinary visibility.'),
	('8b8dea67-7624-4e41-9452-100cb4256805', 'Olga Sidorova', 'olga.sidorova@example.org', 'Premium', 'Contains a note that should stay private to Alice.'),
	('8ce21d94-2285-4cfa-9462-8d886261a847', 'Denis Morozov', 'denis.morozov@example.org', 'Enterprise', 'Managed by Bob and used in privilege escalation tasks.'),
	('c6710eaa-49cf-4fb5-b5f2-5db37748e1cc', 'Natalia Volkova', 'natalia.volkova@example.org', 'VIP', 'Admin-owned customer for cross-tenant tests.');

INSERT INTO training.invoices (id, customer_id, owner_user_id, amount, status, card_hint, notes)
VALUES
	('f11d0794-51d4-4824-8c4e-7d79c42f1275', 1, '8b8dea67-7624-4e41-9452-100cb4256805', 1800.00, 'paid', '4242', 'Alice can normally justify access only to this invoice.'),
	('25c3318b-9a6b-463c-bdd5-b6b94b4953d5', 2, '8b8dea67-7624-4e41-9452-100cb4256805', 9500.00, 'overdue', '1881', 'Contains overdue debt details for another exercise.'),
	('45e7035b-689d-41a4-b3b9-8940e3740bf9', 3, '8ce21d94-2285-4cfa-9462-8d886261a847', 15250.00, 'pending', '7003', 'Bob uses this invoice in manager workflows.'),
	('004f7c74-a6e1-4f4b-ab8d-e2e4f7164339', 4, 'c6710eaa-49cf-4fb5-b5f2-5db37748e1cc', 49999.00, 'draft', '9911', 'Admin-only draft with sensitive internal comments.');

INSERT INTO training.audit_events (actor_username, action, details)
VALUES
	('postgres', 'bootstrap', 'Database initialized with intentionally unsafe grants and BYPASSRLS.'),
	('alice', 'login_failed', 'Wrong password from 172.20.0.15'),
	('bob', 'ddl', 'Executed CREATE TEMP TABLE tmp_report AS SELECT * FROM training.invoices'),
	('carol', 'role_change', 'Changed alice from student to manager during a prior exercise.');
