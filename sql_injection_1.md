# SQL-инъекция №1: поиск клиентов на странице `/catalog`

Учебный стенд: [DB_SEC_SITE](https://github.com/Wheatgrh/DB_SEC_SITE)  
Раздел интерфейса: **Клиенты** → `http://localhost:3000/catalog`  
Тип уязвимости: **SQL Injection** (конкатенация пользовательского ввода в SQL-запрос)

---

## Краткое описание

На странице каталога клиентов поле поиска по email передаёт значение параметра `q` напрямую в SQL-строку без параметризации и экранирования. Злоумышленник может изменить логику запроса, получить чужие записи и извлечь данные из других таблиц (в том числе пароли пользователей).

Пользователь `alice` (роль `student`) по задумке должен видеть только своих клиентов. Через инъекцию он получает доступ ко всем записям в `training.customers` и к таблице `training.app_users`.

---

## Затронутые файлы

| Файл | Роль в уязвимости |
|------|-------------------|
| `src/lib/server/db.ts` | Функция `unsafeSearchCustomers` — **основной источник**: конкатенация `search` в SQL |
| `src/routes/catalog/+page.server.ts` | Передаёт `url.searchParams.get('q')` в уязвимую функцию |
| `src/routes/catalog/+page.svelte` | Форма GET с полем `name="q"` |
| `db/init/01-schema.sql` | RLS на `customers` не защищает: у `app_user` стоит `BYPASSRLS`, контекст `app.current_user_id` не выставляется |

---

## Как устроена уязвимость

### 1. Пользовательский ввод

Форма на странице отправляет GET-запрос:

```
GET /catalog?q=<ввод_пользователя>
```

Код загрузки страницы (`src/routes/catalog/+page.server.ts`):

```typescript
const q = url.searchParams.get('q') ?? '';
const result = await unsafeSearchCustomers(q);
```

### 2. Небезопасная сборка SQL

Функция `unsafeSearchCustomers` в `src/lib/server/db.ts` вставляет ввод в середину строкового литерала:

```typescript
const sql = `SELECT id, full_name, email, tier, owner_user_id
    FROM training.customers
    WHERE email ILIKE '%${normalized}%'
    ORDER BY id`;

const result = await pool.query(sql);
```

**Проблема:** вместо параметра `$1` значение `normalized` склеивается с текстом запроса. Символы `'`, `--`, `UNION` и т.д. становятся частью SQL, а не данными.

### 3. Пример «сломанного» запроса

При вводе `' OR '1'='1` сервер выполняет:

```sql
SELECT id, full_name, email, tier, owner_user_id
FROM training.customers
WHERE email ILIKE '%' OR '1'='1%'
ORDER BY id
```

Условие `'1'='1'` всегда истинно → возвращаются **все** строки таблицы.

### 4. Почему RLS не спасает

В `db/init/01-schema.sql` включён Row Level Security:

```sql
CREATE POLICY customer_isolation ON training.customers
USING (
    owner_user_id = current_setting('app.current_user_id', true)::uuid
);
```

Но защита не работает по двум причинам:

1. Роль приложения `app_user` имеет `ALTER ROLE app_user BYPASSRLS` — обходит любые политики RLS.
2. Приложение **нигде** не вызывает `SET app.current_user_id = ...` перед запросами к `customers`.

Даже после исправления SQL-инъекции RLS останется неэффективным, пока не убрать `BYPASSRLS` и не задавать контекст сессии.

---

## Предусловия для проверки

1. Запущен стенд: `docker compose up --build`
2. Приложение доступно: http://localhost:3000
3. Выполнен вход: логин `alice`, пароль `alice123`

---

## Пошаговая проверка уязвимости

### Шаг 1. Легитимный поиск (контрольный тест)

1. Откройте http://localhost:3000/catalog
2. В поле **Email** введите: `ivan.petrov@example.org`
3. Нажмите **Искать**

**Ожидаемый результат:** 1 строка — Ivan Petrov.

Это подтверждает, что поиск в обычном режиме работает.

---

### Шаг 2. Обход фильтра символом `%`

1. В поле **Email** введите: `%`
2. Нажмите **Искать**

Или откройте URL:

```
http://localhost:3000/catalog?q=%25
```

**Ожидаемый результат:** 4 строки в таблице:

| ФИО | Email | Примечание |
|-----|-------|------------|
| Ivan Petrov | ivan.petrov@example.org | клиент alice |
| Olga Sidorova | olga.sidorova@example.org | клиент alice |
| Denis Morozov | denis.morozov@example.org | клиент **bob** |
| Natalia Volkova | natalia.volkova@example.org | клиент **carol** |

**Вывод:** студент `alice` видит чужие записи — изоляция данных нарушена.

---

### Шаг 3. Классическая SQL-инъекция

В поле **Email** введите:

```
' OR '1'='1
```

URL (закодированный):

```
http://localhost:3000/catalog?q='%20OR%20'1'='1
```

**Ожидаемый результат:** снова все 4 клиента.

**Вывод:** ввод меняет логику SQL-запроса — это SQL-инъекция, а не просто «широкий поиск».

---

### Шаг 4. Извлечение паролей через UNION

В поле **Email** введите:

```
' UNION SELECT 1, username, password, role, id FROM training.app_users--
```

**Ожидаемый результат:** в таблице появятся дополнительные строки (колонки переиспользуются):

| ФИО (full_name) | Email | Tier (role) |
|-----------------|-------|-------------|
| alice | alice123 | student |
| bob | bob123 | manager |
| carol | carol123 | admin |

Пароли отображаются в колонке **Email**, потому что UNION подставляет поля `username`, `password`, `role` вместо `full_name`, `email`, `tier`.

**Вывод:** инъекция позволяет читать произвольные таблицы, к которым у роли `app_user` есть доступ.

---

### Шаг 5. Доказательство в DevTools

1. Откройте инструменты разработчика (F12) → вкладка **Network**
2. Выполните поиск с payload из шага 3
3. Откройте ответ на запрос `/catalog`
4. В теле ответа (JSON) найдите поле `sql` — там виден полный сформированный запрос с внедрённым вводом

Пример фрагмента ответа:

```json
{
  "sql": "SELECT id, full_name, email, tier, owner_user_id\n\t\tFROM training.customers\n\t\tWHERE email ILIKE '%' OR '1'='1%'\n\t\tORDER BY id",
  "customers": [ ... ]
}
```

Это прямое доказательство конкатенации ввода в SQL.

---

## Сводная таблица payload'ов

| Payload | Цель | Ожидаемый эффект |
|---------|------|------------------|
| `ivan.petrov@example.org` | Контроль | 1 запись |
| `%` | Обход LIKE-фильтра | Все клиенты |
| `' OR '1'='1` | Инъекция в WHERE | Все клиенты |
| `' UNION SELECT 1, username, password, role, id FROM training.app_users--` | Эксфильтрация | Пароли пользователей |

---

## Влияние (Impact)

- **Конфиденциальность:** утечка PII клиентов всех пользователей
- **Конфиденциальность:** утечка учётных данных (`password` в открытом виде)
- **Целостность:** при наличии прав `INSERT`/`UPDATE`/`DELETE` у `app_user` возможны более тяжёлые атаки (в схеме эти права выданы намеренно)

---

## Как исправить

Исправление должно затронуть **три уровня**: запрос, приложение, база данных.

---

### Исправление 1. Параметризованный запрос (обязательно)

**Файл:** `src/lib/server/db.ts`

**Что сделать:** заменить конкатенацию на плейсхолдер `$1`. Пользовательский ввод не должен попадать в текст SQL.

**Было:**

```typescript
export async function unsafeSearchCustomers(search: string) {
    const normalized = search.trim();
    if (!normalized) {
        return { sql: '', rows: [] };
    }
    const sql = `SELECT id, full_name, email, tier, owner_user_id
        FROM training.customers
        WHERE email ILIKE '%${normalized}%'
        ORDER BY id`;
    const result = await pool.query(sql);
    return { sql, rows: result.rows };
}
```

**Стало:**

```typescript
export async function searchCustomers(search: string, ownerUserId: string) {
    const normalized = search.trim();
    if (!normalized) {
        return { rows: [] };
    }

    const result = await pool.query(
        `SELECT id, full_name, email, tier, owner_user_id
         FROM training.customers
         WHERE owner_user_id = $1
           AND email ILIKE $2
         ORDER BY id`,
        [ownerUserId, `%${normalized}%`]
    );

    return { rows: result.rows };
}
```

**Почему это работает:** СУБД получает запрос и параметры отдельно; `' OR '1'='1` обрабатывается как обычная строка для `ILIKE`, а не как код SQL.

**Дополнительно:** переименовать функцию (убрать `unsafe`), не возвращать `sql` в ответ клиенту — это утечка внутренней реализации.

---

### Исправление 2. Фильтрация по владельцу в обработчике страницы

**Файл:** `src/routes/catalog/+page.server.ts`

**Что сделать:** передавать ID текущего пользователя в безопасную функцию поиска; убрать поле `sql` из ответа.

**Было:**

```typescript
import { unsafeSearchCustomers } from '$lib/server/db';

const q = url.searchParams.get('q') ?? '';
const result = await unsafeSearchCustomers(q);

return {
    q,
    sql: result.sql,
    customers: result.rows
};
```

**Стало:**

```typescript
import { searchCustomers } from '$lib/server/db';

const q = url.searchParams.get('q') ?? '';
const result = await searchCustomers(q, locals.user.id);

return {
    q,
    customers: result.rows
};
```

**Почему:** даже при ошибке в RLS приложение явно ограничивает выборку `owner_user_id = текущий пользователь`.

---

### Исправление 3. Контекст сессии для RLS (защита на уровне БД)

**Файл:** `src/hooks.server.ts`

**Что добавить:** перед обработкой запроса выставлять `app.current_user_id` в соединении с БД (или в middleware пула).

Пример — вспомогательная функция в `src/lib/server/db.ts`:

```typescript
export async function setSessionUserContext(userId: string | null): Promise<void> {
    if (userId) {
        await pool.query(`SELECT set_config('app.current_user_id', $1, false)`, [userId]);
    } else {
        await pool.query(`SELECT set_config('app.current_user_id', '', false)`);
    }
}
```

В `src/hooks.server.ts`:

```typescript
import { getUserBySession, setSessionUserContext } from '$lib/server/db';

export const handle: Handle = async ({ event, resolve }) => {
    const sessionId = event.cookies.get('session_id');
    event.locals.user = await getUserBySession(sessionId);
    await setSessionUserContext(event.locals.user?.id ?? null);
    return resolve(event);
};
```

**Важно:** при пуле соединений `set_config(..., false)` действует на всё соединение. Для production лучше `set_config(..., true)` (локально для транзакции) и оборачивать каждый запрос в `BEGIN` / `COMMIT`, либо использовать отдельное соединение на запрос.

---

### Исправление 4. Убрать обход RLS у роли приложения

**Файл:** `db/init/01-schema.sql`

**Что изменить:** удалить или закомментировать строку:

```sql
-- УДАЛИТЬ для production:
ALTER ROLE app_user BYPASSRLS;
```

После этого политика `customer_isolation` начнёт применяться — **при условии**, что `app.current_user_id` выставляется (исправление 3).

**Пересоздание БД после изменения схемы:**

```bash
docker compose down -v
docker compose up --build
```

---

### Исправление 5. Ограничить привилегии роли (рекомендуется)

**Файл:** `db/init/01-schema.sql`

**Что сделать:** вместо полного доступа выдать минимально необходимые права, например только `SELECT` на нужные таблицы для роли `app_user`, без `DELETE`/`UPDATE` на чувствительные объекты.

Это не заменяет параметризацию, но ограничивает ущерб при компрометации приложения.

---

## Проверка после исправления

Повторите шаги 2–4 из раздела «Проверка». Ожидаемое поведение:

| Тест | До исправления | После исправления |
|------|----------------|-------------------|
| Поиск `ivan.petrov@...` | 1 запись | 1 запись |
| Payload `%` | 4 записи | Только клиенты alice (или все строки, где email содержит `%` — среди **своих**) |
| Payload `' OR '1'='1` | 4 записи | 0 записей или только совпадения по буквальной строке |
| UNION с `app_users` | Пароли в таблице | Ошибка SQL или пустой результат; пароли не утекают |

Дополнительно: в ответе API/страницы **не должно** быть поля `sql` с текстом запроса.

---

## Чеклист для отчёта по практике

- [ ] Описана уязвимая функция и файл (`unsafeSearchCustomers` в `db.ts`)
- [ ] Приведён уязвимый фрагмент SQL с конкатенацией
- [ ] Выполнен контрольный поиск (1 запись)
- [ ] Подтверждён обход фильтра (`%` или `' OR '1'='1`)
- [ ] Продемонстрирован UNION и утечка паролей
- [ ] Скриншот или фрагмент ответа с полем `sql` (до исправления)
- [ ] Описано исправление: параметризация + фильтр по `owner_user_id`
- [ ] Описана роль RLS и отключение `BYPASSRLS`

---

## Связанные уязвимости на стенде

На том же проекте есть другие задания:

- **SQL Reports** (`/reports`) — инъекция в `WHERE` через `SECURITY DEFINER`-функцию
- **Invoice demo** — IDOR по UUID счёта
- **Профиль** — повышение привилегий через скрытое поле `roleName`

Данный документ относится только к инъекции №1 на странице `/catalog`.
