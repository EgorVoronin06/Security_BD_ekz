# Security BD — учебный стенд по безопасности БД

<p align="center">
  <img src="https://img.shields.io/badge/курс-Безопасность%20БД-blue?style=for-the-badge" alt="Курс" />
  <img src="https://img.shields.io/badge/СурГУ-лаборатория-orange?style=for-the-badge" alt="СурГУ" />
  <img src="https://img.shields.io/badge/SvelteKit-фронтенд-ff3e00?style=for-the-badge&logo=svelte&logoColor=white" alt="SvelteKit" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
</p>

<p align="center">
  <strong>Учебный портал с намеренными уязвимостями</strong><br/>
  для практики по SQL-инъекциям, контролю доступа и защите PostgreSQL
</p>

<p align="center">
  <a href="#-быстрый-старт">Быстрый старт</a> •
  <a href="#-алгоритм-практики">Алгоритм</a> •
  <a href="#-документация-по-уязвимостям">Документация</a> •
  <a href="#-карта-стенда">Карта стенда</a> •
  <a href="#-учётные-записи">Учётные записи</a>
</p>

---

## О проекте

Сайт с уязвимостями для курса **«Безопасность БД»** СурГУ.  
Основан на стенде [DB_SEC_SITE](https://github.com/Wheatgrh/DB_SEC_SITE).

В репозитории — исходный код приложения и **подробные отчёты** по четырём практическим заданиям: как найти уязвимость, как проверить и как исправить.

---

## Быстрый старт

**Требования:** [Docker](https://www.docker.com/) и Docker Compose.

```bash
# Сборка и запуск
docker compose up --build

# Остановка и удаление всех данных БД
docker compose down -v
```

| Сервис | URL |
|--------|-----|
| Веб-приложение | http://localhost:3000 |
| PostgreSQL | `localhost:5432` |

---

## Алгоритм практики

<p align="center">
  <a href="./algoritme.md">
    <img src="https://img.shields.io/badge/📋_Полная_цепочка_атак-algoritme.md-1d4ed8?style=for-the-badge" alt="algoritme.md" />
  </a>
</p>

Пошаговый сценарий от `alice (student)` до полного компромисса: **8 этапов**, все payload'ы, ожидаемые результаты, чеклист и mermaid-схема.

```
Этап 0: docker up → Этап 1: /audit → Этап 2: /catalog UNION ★
→ Этап 3: /reports → Этап 4: /invoices IDOR → Этап 5: /profile admin
```

---

## Документация по уязвимостям

<p align="center">
  <img src="https://img.shields.io/badge/заданий-5-critical?style=flat-square" alt="5 заданий" />
  <img src="https://img.shields.io/badge/SQL_Injection-2-red?style=flat-square" alt="2 SQLi" />
  <img src="https://img.shields.io/badge/Access_Control-3-orange?style=flat-square" alt="3 BAC" />
</p>

### Обзор заданий

| № | Документ | Страница | Тип | Сложность |
|:-:|----------|----------|-----|:---------:|
| 1 | [**sql_injection_1.md**](./sql_injection_1.md) | [`/catalog`](http://localhost:3000/catalog) | SQL Injection | ⭐⭐ |
| 2 | [**sql_injection_2.md**](./sql_injection_2.md) | [`/reports`](http://localhost:3000/reports) | SQL Injection (SECURITY DEFINER) | ⭐⭐⭐ |
| 3 | [**sql_injection_3.md**](./sql_injection_3.md) | [`/profile`](http://localhost:3000/profile) | Privilege Escalation + IDOR | ⭐⭐ |
| 4 | [**sql_injection_4.md**](./sql_injection_4.md) | [`/audit`](http://localhost:3000/audit) | Broken Access Control | ⭐ |
| 6 | [**sql_injection_6.md**](./sql_injection_6.md) | [`/invoices/{id}`](http://localhost:3000/invoices/f11d0794-51d4-4824-8c4e-7d79c42f1275) | IDOR (чужие счета) | ⭐⭐ |

---

### Задание 1 — SQL-инъекция в каталоге клиентов

<p>
  <a href="./sql_injection_1.md">
    <img src="https://img.shields.io/badge/📄_Открыть_отчёт-sql__injection__1.md-2ea44f?style=for-the-badge" alt="sql_injection_1.md" />
  </a>
</p>

| | |
|---|---|
| **Страница** | Клиенты → `/catalog` |
| **Вектор** | GET-параметр `q` в поиске по email |
| **Суть** | Конкатенация ввода в `ILIKE '%...%'` |
| **Payload** | `%` · `' OR '1'='1` · `UNION SELECT ... FROM app_users` |
| **В отчёте** | Проверка · Impact · Исправление в `db.ts` и `01-schema.sql` |

---

### Задание 2 — SQL-инъекция в пользовательских отчётах

<p>
  <a href="./sql_injection_2.md">
    <img src="https://img.shields.io/badge/📄_Открыть_отчёт-sql__injection__2.md-dc2626?style=for-the-badge" alt="sql_injection_2.md" />
  </a>
</p>

| | |
|---|---|
| **Страница** | SQL Reports → `/reports` |
| **Вектор** | POST-поле `whereClause` (фрагмент WHERE) |
| **Суть** | `EXECUTE format(...)` в функции `training.run_custom_report` |
| **Payload** | `1=1` · `1=0 UNION SELECT username, password ...` |
| **В отчёте** | Почему `$1` в Node.js не спасает · `SECURITY DEFINER` · исправление в БД |

---

### Задание 3 — повышение привилегий в профиле

<p>
  <a href="./sql_injection_3.md">
    <img src="https://img.shields.io/badge/📄_Открыть_отчёт-sql__injection__3.md-ca8a04?style=for-the-badge" alt="sql_injection_3.md" />
  </a>
</p>

| | |
|---|---|
| **Страница** | Профиль → `/profile` |
| **Вектор** | `POST /api/users/{id}/profile` + скрытое поле `roleName` |
| **Суть** | SQL-инъекции нет; API доверяет `id` и роли из запроса |
| **Эксплуатация** | `roleName=admin` в DevTools Console |
| **В отчёте** | IDOR на bob · исправление API и разделение смены роли |

---

### Задание 4 — несанкционированный доступ к аудиту

<p>
  <a href="./sql_injection_4.md">
    <img src="https://img.shields.io/badge/📄_Открыть_отчёт-sql__injection__4.md-7c3aed?style=for-the-badge" alt="sql_injection_4.md" />
  </a>
</p>

| | |
|---|---|
| **Страница** | Аудит → `/audit` |
| **Вектор** | Прямой URL без проверки роли |
| **Суть** | Студент видит служебный журнал (BYPASSRLS, role_change, DDL) |
| **Эксплуатация** | Войти как `alice` → открыть `/audit` |
| **В отчёте** | Проверка роли `admin` · скрытие ссылки · RLS на `audit_events` |

---

### Задание 6 — IDOR чужих счетов

<p>
  <a href="./sql_injection_6.md">
    <img src="https://img.shields.io/badge/📄_Открыть_отчёт-sql__injection__6.md-0d9488?style=for-the-badge" alt="sql_injection_6.md" />
  </a>
</p>

| | |
|---|---|
| **Страница** | Invoice demo → `/invoices/{uuid}` |
| **Вектор** | Подмена UUID в URL |
| **Суть** | Проверяется только вход, не владелец счёта |
| **Эксплуатация** | alice открывает UUID счёта carol (`004f7c74-...`) |
| **В отчёте** | Таблица UUID · проверка owner · RLS на `invoices` |

---

## Карта стенда

```mermaid
flowchart TB
    subgraph auth["🔐 Вход"]
        LOGIN["/login<br/>alice / alice123"]
    end

    subgraph sqli["🔴 SQL Injection"]
        C1["/catalog<br/>📄 sql_injection_1.md"]
        C2["/reports<br/>📄 sql_injection_2.md"]
    end

    subgraph bac["🟠 Broken Access Control"]
        C3["/profile<br/>📄 sql_injection_3.md"]
        C4["/audit<br/>📄 sql_injection_4.md"]
    end

    subgraph extra["🟡 IDOR"]
        C6["/invoices/id<br/>📄 sql_injection_6.md"]
    end

    LOGIN --> C1 & C2 & C3 & C4
    C4 -.->|подсказки| C1 & C2 & C3
    C1 -.->|UUID, пароли| C3
    C2 -.->|UUID счетов| C6
```

---

## Учётные записи

| Пользователь | Пароль | Роль | Назначение |
|:------------:|:------:|:----:|------------|
| `alice` | `alice123` | `student` | Основная учётка для атак |
| `bob` | `bob123` | `manager` | Жертва IDOR (задание 3) |
| `carol` | `carol123` | `admin` | Эталон полного доступа |

---

## Структура отчётов

Каждый файл `sql_injection_*.md` содержит единый шаблон:

```
📋 Краткое описание
📁 Затронутые файлы
🔍 Как устроена уязвимость
✅ Пошаговая проверка (payload'ы)
📊 Таблица сценариев / Impact
🛠️ Как исправить (по файлам с примерами кода)
🔄 Проверка после исправления
☑️ Чеклист для отчёта
```

---

## Стек технологий

| Слой | Технология |
|------|------------|
| Frontend | SvelteKit, TypeScript, Vite |
| Backend | SvelteKit Server Routes, Node.js |
| База данных | PostgreSQL 16 |
| Инфраструктура | Docker, Docker Compose |

---

## Структура репозитория

```
.
├── db/init/                  # Схема и seed-данные PostgreSQL
├── src/
│   ├── lib/server/db.ts      # Запросы к БД
│   └── routes/               # Страницы стенда
├── sql_injection_1.md        # Задание 1: /catalog
├── sql_injection_2.md        # Задание 2: /reports
├── sql_injection_3.md        # Задание 3: /profile
├── sql_injection_4.md        # Задание 4: /audit
├── sql_injection_6.md        # Задание 6: /invoices/{id}
├── algoritme.md              # Полная цепочка практики (все этапы)
├── docker-compose.yml
└── README.md
```

---

## Рекомендуемый порядок прохождения

```
1️⃣  sql_injection_1.md  →  SQL-инъекция в поиске (проще всего)
2️⃣  sql_injection_4.md  →  Аудит даёт подсказки к остальным
3️⃣  sql_injection_2.md  →  Инъекция в хранимой функции
4️⃣  sql_injection_3.md  →  Повышение привилегий через API
5️⃣  sql_injection_6.md  →  IDOR чужих счетов по UUID
```

---

<p align="center">
  <sub>Учебный проект · СурГУ · Безопасность БД · 2026</sub>
</p>
