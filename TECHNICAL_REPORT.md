# Технический отчёт: Waste Collection API v1.0

---

## 1. Общие сведения

| Параметр | Значение |
|----------|----------|
| **Название** | Waste Collection API |
| **Версия** | 1.0 (MVP) |
| **Тип** | REST API (Stateless, JSON) |
| **Архитектура** | API-first, модульная, v2-ready |
| **Хранилище** | In-Memory (MVP), готово к PostgreSQL |
| **Документация** | Web-интерфейс `/docs` (EN/RU) |

---

## 2. Технологический стек

| Компонент | Технология |
|-----------|------------|
| Runtime | Node.js + TypeScript |
| Web Framework | Express.js |
| Аутентификация | JWT (access + refresh tokens) |
| Хеширование паролей | bcryptjs |
| Rate Limiting | express-rate-limit |
| Валидация | Zod |
| Frontend (docs) | React + Vite + TailwindCSS + shadcn/ui |

---

## 3. Целевые потребители API

```
┌─────────────────────────────────────────────────────────────┐
│                    Waste Collection API                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  ERP System  │  │ Client App   │  │  Courier App     │   │
│  │  (Web)       │  │ (iOS/Android)│  │  (iOS/Android)   │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Архитектурные принципы

### 4.1 API Versioning
```
/api/v1/*  — рекомендуемый (версионированный)
/api/*     — обратная совместимость (deprecated)
```

### 4.2 Интернационализация (i18n)

**Поддерживаемые языки:** `he`, `ru`, `ar`, `en` (fallback)

**Определение языка:**
```http
Accept-Language: he | ru | ar | en
```

**Формат ответов с i18n:**

Ошибки:
```json
{
  "error": {
    "key": "order.not_found",
    "params": { "orderId": "uuid-123" }
  }
}
```

Успех:
```json
{
  "status": "success",
  "message": {
    "key": "order.created",
    "params": { "orderId": "uuid-456" }
  },
  "data": { ... }
}
```

**Принципы i18n:**
- Нет захардкоженного текста в API
- API возвращает только ключи локализации + параметры
- Форматирование дат/валют/чисел — на клиенте
- Поддержка RTL (Hebrew, Arabic)
- Даты: ISO 8601 (`2026-01-18T10:30:00Z`)
- Деньги: `{ "price": 25, "currency": "ILS" }`

---

## 5. Модель данных

### 5.1 Основные сущности

| Сущность | Поля | Soft Delete |
|----------|------|-------------|
| **User** | id, type, phone, email, passwordHash, status, createdAt, `deletedAt` | ✅ |
| **Order** | id, clientId, courierId, addressId, scheduledAt, timeWindow, status, price, createdAt, completedAt, `deletedAt` | ✅ |
| **CourierProfile** | courierId, availabilityStatus, rating, completedOrdersCount, verificationStatus, `deletedAt` | ✅ |
| **Address** | id, userId, city, street, house, apartment, floor, hasElevator, comment | ❌ |
| **Role** | id, name, description | ❌ |
| **Permission** | id, name, description | ❌ |
| **Session** | id, userId, refreshToken, deviceId, platform, userAgent, lastSeenAt, createdAt | ❌ |
| **AuditLog** | id, userId, userRole, action, `messageKey`, entity, entityId, changes, metadata, createdAt | ❌ |

### 5.2 Типы пользователей

| Тип | Описание |
|-----|----------|
| `client` | Клиент (заказчик услуг) |
| `courier` | Курьер (исполнитель) |
| `staff` | Персонал (ERP, менеджеры) |

### 5.3 Статусы пользователя

| Статус | Описание |
|--------|----------|
| `active` | Активный |
| `blocked` | Заблокирован |
| `pending` | Ожидает подтверждения |

### 5.4 State Machine заказов

```
created → scheduled → assigned → in_progress → completed
    ↓          ↓          ↓            ↓
cancelled  cancelled  cancelled   cancelled
```

**Разрешённые переходы:**
- `created` → `scheduled`, `assigned`, `cancelled`
- `scheduled` → `assigned`, `cancelled`
- `assigned` → `in_progress`, `cancelled`
- `in_progress` → `completed`, `cancelled`
- `completed` → (терминальный)
- `cancelled` → (терминальный)

---

## 6. Безопасность

### 6.1 Аутентификация

| Механизм | Реализация |
|----------|------------|
| **JWT Access Token** | Короткоживущий (15 мин) |
| **JWT Refresh Token** | Долгоживущий (7 дней) |
| **Rate Limiting** | 10 запросов / 15 мин на auth endpoints |
| **Password Hashing** | bcryptjs (salt rounds: 10) |

### 6.2 RBAC (Role-Based Access Control)

**Предустановленные роли:**

| Роль | Права |
|------|-------|
| `admin` | Все права |
| `manager` | orders.read, orders.assign, orders.update_status, users.read, couriers.verify |
| `accountant` | orders.read, payments.read, reports.read |
| `support` | orders.read, users.read, addresses.read |
| `dispatcher` | orders.read, orders.assign, orders.update_status |

**Полный список permissions:**
```
orders.read, orders.create, orders.assign, orders.update_status
users.read, users.manage
couriers.verify
payments.read, reports.read
subscriptions.manage
addresses.read, addresses.manage
```

### 6.3 Soft Delete

**Сущности с soft delete:**
- `User` — поле `deletedAt`
- `Order` — поле `deletedAt`
- `CourierProfile` — поле `deletedAt`

**Фильтрация:**
- По умолчанию удалённые сущности **скрыты**
- ERP может использовать `?includeDeleted=true` для просмотра

**i18n при soft delete:**
```json
{
  "error": {
    "key": "user.deleted",
    "params": { "userId": "uuid-123" }
  }
}
```

---

## 7. Audit Logging

### 7.1 Логируемые действия

| Action | Описание | messageKey |
|--------|----------|------------|
| `CREATE_USER` | Создание пользователя | `audit.user.created` |
| `UPDATE_USER` | Обновление пользователя | `audit.user.updated` |
| `DELETE_USER` | Soft delete пользователя | `audit.user.deleted` |
| `BLOCK_USER` | Блокировка пользователя | `audit.user.blocked` |
| `ASSIGN_ROLE` | Назначение ролей | `audit.user.roles_assigned` |
| `CREATE_ORDER` | Создание заказа | `audit.order.created` |
| `UPDATE_ORDER` | Обновление заказа | `audit.order.updated` |
| `DELETE_ORDER` | Soft delete заказа | `audit.order.deleted` |
| `CANCEL_ORDER` | Отмена заказа | `audit.order.cancelled` |
| `ASSIGN_COURIER` | Назначение курьера | `audit.order.assigned` |
| `VERIFY_COURIER` | Верификация курьера | `audit.courier.verified` |
| `CREATE_ROLE` | Создание роли | `audit.role.created` |
| `UPDATE_ROLE` | Обновление роли | `audit.role.updated` |

### 7.2 Формат записи

```json
{
  "id": "log-uuid",
  "userId": "staff-uuid",
  "userRole": "admin",
  "action": "VERIFY_COURIER",
  "messageKey": "audit.courier.verified",
  "entity": "courier",
  "entityId": "courier-uuid",
  "changes": {
    "verificationStatus": { "from": "pending", "to": "verified" }
  },
  "metadata": { "courierId": "courier-uuid" },
  "createdAt": "2026-01-18T10:30:00Z"
}
```

### 7.3 Фильтрация audit logs

```
GET /api/v1/audit-logs?userId=...&entity=...&entityId=...&action=...
```

---

## 8. Device/Session Tracking

### 8.1 Создание сессии (при login)

```json
{
  "id": "session-uuid",
  "deviceId": "device-123",
  "platform": "ios | android | web",
  "userAgent": "Mozilla/5.0...",
  "lastSeenAt": "2026-01-18T10:30:00Z",
  "createdAt": "2026-01-18T08:00:00Z"
}
```

### 8.2 Обновление сессии

- `lastSeenAt` обновляется при каждом refresh token

### 8.3 i18n ключи для сессий

| Ключ | Описание |
|------|----------|
| `session.created` | Сессия создана |
| `session.deleted` | Сессия удалена |
| `session.device_not_found` | Устройство не найдено |
| `session.all_sessions_deleted` | Все сессии удалены |

---

## 9. API Endpoints

### 9.1 Аутентификация

| Метод | Путь | Описание | Auth |
|-------|------|----------|------|
| POST | `/api/v1/auth/register` | Регистрация | ❌ |
| POST | `/api/v1/auth/login` | Авторизация (создаёт сессию) | ❌ |
| POST | `/api/v1/auth/refresh` | Обновление токена | ❌ |
| GET | `/api/v1/auth/me` | Текущий пользователь | ✅ |
| GET | `/api/v1/auth/sessions` | Мои активные сессии | ✅ |
| DELETE | `/api/v1/auth/sessions/:id` | Выход с устройства | ✅ |
| POST | `/api/v1/auth/logout-all` | Выход со всех устройств | ✅ |

### 9.2 Пользователи (ERP)

| Метод | Путь | Описание | Permissions |
|-------|------|----------|-------------|
| GET | `/api/v1/users` | Список (?type, ?status, ?includeDeleted) | users.read |
| GET | `/api/v1/users/:id` | Информация о пользователе | users.read |
| PATCH | `/api/v1/users/:id` | Обновление (audit log) | users.manage |
| DELETE | `/api/v1/users/:id` | Soft delete (audit log) | users.manage |
| POST | `/api/v1/users/:id/roles` | Назначение ролей (audit log) | users.manage |

### 9.3 Адреса

| Метод | Путь | Описание | Auth |
|-------|------|----------|------|
| GET | `/api/v1/addresses` | Мои адреса | ✅ |
| POST | `/api/v1/addresses` | Добавить адрес | ✅ |
| PATCH | `/api/v1/addresses/:id` | Обновить адрес | ✅ |
| DELETE | `/api/v1/addresses/:id` | Удалить адрес | ✅ |

### 9.4 Заказы

| Метод | Путь | Описание | Permissions |
|-------|------|----------|-------------|
| POST | `/api/v1/orders` | Создать заказ (audit log) | — |
| GET | `/api/v1/orders` | Список (?status, ?includeDeleted) | orders.read |
| GET | `/api/v1/orders/:id` | Детали (?includeDeleted) | orders.read |
| PATCH | `/api/v1/orders/:id` | Обновить (audit log) | orders.update_status |
| DELETE | `/api/v1/orders/:id` | Soft delete (audit log) | orders.update_status |
| POST | `/api/v1/orders/:id/assign` | Назначить курьера (audit log) | orders.assign |
| POST | `/api/v1/orders/:id/cancel` | Отменить заказ (audit log) | — |

### 9.5 Курьеры

| Метод | Путь | Описание | Auth |
|-------|------|----------|------|
| GET | `/api/v1/courier/profile` | Профиль курьера | ✅ (courier) |
| PATCH | `/api/v1/courier/profile` | Обновить статус | ✅ (courier) |
| GET | `/api/v1/courier/orders` | Заказы курьера | ✅ (courier) |
| POST | `/api/v1/courier/orders/:id/accept` | Принять заказ | ✅ (courier) |
| POST | `/api/v1/courier/orders/:id/complete` | Завершить заказ | ✅ (courier) |

### 9.6 Роли и права (ERP)

| Метод | Путь | Описание | Permissions |
|-------|------|----------|-------------|
| GET | `/api/v1/roles` | Список ролей | users.manage |
| POST | `/api/v1/roles` | Создать роль (audit log) | users.manage |
| GET | `/api/v1/permissions` | Список прав | users.manage |
| GET | `/api/v1/couriers` | Список курьеров (?includeDeleted) | couriers.verify |
| PATCH | `/api/v1/couriers/:id/verify` | Верификация курьера (audit log) | couriers.verify |

### 9.7 Audit

| Метод | Путь | Описание | Permissions |
|-------|------|----------|-------------|
| GET | `/api/v1/audit-logs` | Просмотр (?userId, ?entity, ?entityId, ?action) | users.manage |

---

## 10. Каталог i18n ключей

### 10.1 Аутентификация (`auth.*`)

```
auth.register_success, auth.login_success, auth.refresh_success
auth.logout_success, auth.logout_all_success
auth.invalid_credentials, auth.invalid_token, auth.token_expired
auth.token_revoked, auth.user_blocked, auth.user_deleted
auth.missing_token, auth.session_not_found
```

### 10.2 Сессии (`session.*`)

```
session.created, session.deleted
session.device_not_found, session.all_sessions_deleted
```

### 10.3 Аудит (`audit.*`)

```
audit.user.created, audit.user.updated, audit.user.deleted, audit.user.blocked
audit.user.roles_assigned
audit.order.created, audit.order.updated, audit.order.deleted, audit.order.cancelled
audit.order.assigned
audit.courier.verified
audit.role.created, audit.role.updated
```

### 10.4 Пользователи (`user.*`)

```
user.not_found, user.already_deleted
user.created, user.updated, user.deleted, user.roles_assigned
```

### 10.5 Заказы (`order.*`)

```
order.not_found, order.created, order.updated, order.deleted
order.cancelled, order.assigned, order.started, order.completed
order.invalid_status_transition, order.already_assigned, order.already_deleted
order.not_assigned_to_you, order.not_in_assigned_status, order.not_in_progress
order.cannot_cancel
```

### 10.6 Адреса (`address.*`)

```
address.not_found, address.created, address.updated, address.deleted
address.forbidden
```

### 10.7 Курьеры (`courier.*`)

```
courier.not_found, courier.profile_not_found
courier.profile_updated, courier.verified
courier.invalid_verification_status
```

### 10.8 Роли (`role.*`)

```
role.created, role.not_found, role.invalid_role_ids
```

### 10.9 Общие (`common.*`)

```
common.bad_request, common.forbidden, common.not_found
common.conflict, common.internal_error, common.validation_error
common.rate_limit_exceeded, common.missing_permission, common.invalid_user_type
```

---

## 11. Структура проекта

```
├── client/                     # Web-интерфейс документации
│   └── src/
│       └── pages/
│           └── api-docs.tsx    # Интерактивная документация (EN/RU)
├── server/
│   ├── auth.ts                 # JWT аутентификация
│   ├── i18n.ts                 # i18n middleware
│   ├── localization-keys.ts    # Каталог i18n ключей
│   ├── middleware.ts           # RBAC middleware
│   ├── routes.ts               # API endpoints (~780 строк)
│   └── storage.ts              # In-memory хранилище
├── shared/
│   └── schema.ts               # Типы, схемы Zod, константы
└── replit.md                   # Документация проекта
```

---

## 12. Будущие модули (v2+)

| Модуль | Описание |
|--------|----------|
| **Подписки** | Периодические заказы, автогенерация |
| **Отзывы и рейтинг** | Оценка курьеров клиентами |
| **Чаевые** | Система чаевых для курьеров |
| **Геолокация** | Трекинг курьеров в реальном времени |
| **Финансы** | Выплаты курьерам, финансовая отчётность |
| **Верификация документов** | Проверка документов курьеров |

---

## 13. Запуск и документация

```bash
npm run dev
```

**Web-интерфейс документации:** `http://localhost:5000/docs`

---

## 14. Статус реализации

| Функциональность | Статус |
|-----------------|--------|
| API Versioning (`/api/v1/*`) | ✅ Реализовано |
| JWT аутентификация (access + refresh) | ✅ Реализовано |
| RBAC (роли + права) | ✅ Реализовано |
| Soft Delete (User, Order, CourierProfile) | ✅ Реализовано |
| Audit Logging с i18n messageKey | ✅ Реализовано |
| Device/Session Tracking | ✅ Реализовано |
| Rate Limiting | ✅ Реализовано |
| State Machine заказов | ✅ Реализовано |
| i18n (ключи + params) | ✅ Реализовано |
| Веб-документация (EN/RU) | ✅ Реализовано |
| PostgreSQL интеграция | ⏳ Готово к миграции |

---

**Дата отчёта:** 18 января 2026  
**Версия API:** 1.0 MVP
