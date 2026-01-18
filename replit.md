# Waste Collection API

Backend API для сервиса выноса мусора / бытовых услуг.

## ВАЖНО: Синхронизация документации

**При любых изменениях или доработках API ОБЯЗАТЕЛЬНО сразу обновлять информацию в веб-документации API:**
- Файл: `client/src/pages/api-docs.tsx`
- Документация двуязычная (EN/RU) — обновлять оба языка
- Добавлять новые endpoints в соответствующие секции `apiSections`
- Обновлять примеры запросов/ответов
- Добавлять новые ключи локализации при необходимости

## Обзор

Централизованный REST API, обслуживающий:
- ERP / систему управления
- Клиентское мобильное приложение
- Курьерское мобильное приложение
- Будущие продукты и сервисы

## Архитектура

- **API-first** — единственный источник истины
- **Stateless REST API** — JSON
- **RBAC** — Role & Permission Based Access Control
- **Extension-ready** — модульное расширение без изменения контрактов
- **Event-based history** — аудит и аналитика
- **API Versioning** — `/api/v1/*` с обратной совместимостью `/api/*`
- **Soft Delete** — `deletedAt` поле для User, Order, CourierProfile
- **Audit Logging** — все staff-действия логируются с diff изменений

## Технологии

- Node.js + TypeScript
- Express + express-rate-limit
- JWT (access + refresh) с jsonwebtoken
- bcryptjs для хеширования паролей
- In-Memory Storage (для MVP)

## Интернационализация (i18n)

Поддерживаемые языки: `he`, `ru`, `ar`, `en` (fallback)

### Определение языка
```
Accept-Language: he | ru | ar | en
```

### Формат ответов

Ошибки:
```json
{
  "error": {
    "key": "order.not_found",
    "params": { "orderId": 123 }
  }
}
```

Успех:
```json
{
  "status": "success",
  "message": {
    "key": "order.created",
    "params": { "orderId": 456 }
  },
  "data": { ... }
}
```

### Принципы
- Нет захардкоженного текста в API
- API не формирует UI-тексты, только ключи локализации
- Форматирование дат/валют/чисел на клиенте
- Поддержка RTL (he, ar) без склеивания строк
- Даты только в ISO 8601: `"2026-01-12T10:30:00Z"`
- Деньги: `{ "price": 25, "currency": "ILS" }`

## Безопасность

- Rate limiting на auth endpoints (10 запросов / 15 мин)
- Revoke refresh tokens при блокировке пользователя
- Валидация переходов статусов (state machine)
- RBAC с гранулярными permissions
- Soft delete для User, Order, CourierProfile, Address (`deletedAt` + `?includeDeleted=true`)
- Audit log для staff-действий (кто, что, когда, diff)
- Device/session tracking (deviceId, platform, lastSeenAt, userAgent)
- **CORS** — настраиваемый через `ALLOWED_ORIGINS` env var

## OpenAPI спецификация

- `GET /api/v1/openapi.json` — JSON формат
- `GET /api/v1/openapi.yaml` — YAML формат
- Файл: `docs/openapi.yaml`
- Доступно для скачивания в веб-документации

## CORS настройка

Переменная окружения `ALLOWED_ORIGINS`:
```
ALLOWED_ORIGINS=https://your-frontend.replit.app,https://your-domain.com
```

Если не указана — разрешены все домены (`*`)

## API Versioning

Все endpoints доступны через:
- `/api/v1/*` — версионированный API (рекомендуется)
- `/api/*` — обратная совместимость (deprecated)

## Soft Delete

Сущности с поддержкой soft delete:
- `User` — `deletedAt` поле
- `Order` — `deletedAt` поле  
- `CourierProfile` — `deletedAt` поле
- `Address` — `deletedAt` поле (для истории заказов)

Фильтрация:
- По умолчанию удалённые сущности скрыты
- ERP может использовать `?includeDeleted=true` для просмотра

## Audit Logging

Логируемые действия (`AuditAction`):
- `CREATE_USER`, `UPDATE_USER`, `DELETE_USER`, `BLOCK_USER`
- `CREATE_ORDER`, `UPDATE_ORDER`, `DELETE_ORDER`, `CANCEL_ORDER`
- `ASSIGN_COURIER`, `VERIFY_COURIER`
- `CREATE_ROLE`, `UPDATE_ROLE`, `ASSIGN_ROLE`

Формат записи с i18n:
```json
{
  "userId": "who",
  "userRole": "admin",
  "action": "VERIFY_COURIER",
  "messageKey": "audit.courier.verified",
  "entity": "courier",
  "entityId": "courier-uuid",
  "changes": { "field": { "from": "old", "to": "new" } },
  "metadata": { "courierId": "courier-uuid" },
  "createdAt": "ISO8601"
}
```

### i18n ключи для аудита

```
audit.user.created, audit.user.updated, audit.user.deleted, audit.user.blocked
audit.user.roles_assigned
audit.order.created, audit.order.updated, audit.order.deleted, audit.order.cancelled
audit.order.assigned
audit.courier.verified
audit.role.created, audit.role.updated
```

## Device/Session Tracking

При логине создаётся сессия:
```json
{
  "deviceId": "device-123",
  "platform": "ios | android | web",
  "userAgent": "...",
  "lastSeenAt": "ISO8601"
}
```

Обновление `lastSeenAt` при refresh token.

### i18n ключи для сессий

```
session.created
session.deleted
session.device_not_found
session.all_sessions_deleted
```

## Структура проекта

```
├── client/                 # Web-интерфейс документации API
│   └── src/
│       └── pages/
│           └── api-docs.tsx  # Интерактивная документация
├── docs/
│   ├── openapi.yaml              # OpenAPI 3.0 спецификация
│   └── POSTGRESQL_MIGRATION.md  # Руководство по миграции на PostgreSQL
├── server/
│   ├── auth.ts            # JWT аутентификация
│   ├── i18n.ts            # i18n middleware (Accept-Language)
│   ├── localization-keys.ts # Каталог ключей локализации
│   ├── middleware.ts      # RBAC middleware
│   ├── repositories.ts    # Repository interfaces (для миграции на PostgreSQL)
│   ├── routes.ts          # API endpoints
│   └── storage.ts         # In-memory хранилище (implements IStorage)
└── shared/
    └── schema.ts          # Типы и схемы данных
```

## API Endpoints (v1)

### Аутентификация
- `POST /api/v1/auth/register` — Регистрация
- `POST /api/v1/auth/login` — Авторизация (создаёт сессию)
- `POST /api/v1/auth/refresh` — Обновление токена (обновляет lastSeenAt)
- `GET /api/v1/auth/me` — Текущий пользователь

### Пользователи (ERP)
- `GET /api/v1/users` — Список (?type, ?status, ?includeDeleted=true)
- `GET /api/v1/users/:id` — Информация о пользователе
- `PATCH /api/v1/users/:id` — Обновление (audit log)
- `DELETE /api/v1/users/:id` — Soft delete (audit log)
- `POST /api/v1/users/:id/roles` — Назначение ролей (audit log)

### Audit & Sessions
- `GET /api/v1/audit-logs` — Просмотр (?userId, ?entity, ?entityId, ?action)
- `GET /api/v1/auth/sessions` — Мои активные сессии
- `DELETE /api/v1/auth/sessions/:id` — Выход с устройства
- `POST /api/v1/auth/logout-all` — Выход со всех устройств

### Адреса
- `GET /api/v1/addresses` — Мои адреса
- `POST /api/v1/addresses` — Добавить адрес
- `PATCH /api/v1/addresses/:id` — Обновить адрес
- `DELETE /api/v1/addresses/:id` — Удалить адрес

### Заказы
- `POST /api/v1/orders` — Создать заказ (audit log)
- `GET /api/v1/orders` — Список (?status, ?includeDeleted=true)
- `GET /api/v1/orders/:id` — Детали (?includeDeleted=true)
- `PATCH /api/v1/orders/:id` — Обновить (audit log для staff)
- `DELETE /api/v1/orders/:id` — Soft delete (audit log)
- `POST /api/v1/orders/:id/assign` — Назначить курьера (audit log)
- `POST /api/v1/orders/:id/cancel` — Отменить заказ (audit log)

### Курьеры
- `GET /api/v1/courier/profile` — Профиль курьера
- `PATCH /api/v1/courier/profile` — Обновить статус
- `GET /api/v1/courier/orders` — Заказы курьера
- `POST /api/v1/courier/orders/:id/accept` — Принять заказ
- `POST /api/v1/courier/orders/:id/complete` — Завершить заказ

### Роли и права (ERP)
- `GET /api/v1/roles` — Список ролей
- `POST /api/v1/roles` — Создать роль (audit log)
- `GET /api/v1/permissions` — Список прав
- `GET /api/v1/couriers` — Список курьеров (?includeDeleted=true)
- `PATCH /api/v1/couriers/:id/verify` — Верификация курьера (audit log)

## Типы пользователей

- `client` — Клиент
- `courier` — Курьер
- `staff` — Персонал

## Статусы заказа (State Machine)

```
created → scheduled → assigned → in_progress → completed
    ↓          ↓          ↓            ↓
cancelled  cancelled  cancelled   cancelled
```

Разрешённые переходы:
- `created` → `scheduled`, `assigned`, `cancelled`
- `scheduled` → `assigned`, `cancelled`
- `assigned` → `in_progress`, `cancelled`
- `in_progress` → `completed`, `cancelled`
- `completed` → (терминальный статус)
- `cancelled` → (терминальный статус)

## Права доступа

- `orders.read`, `orders.create`, `orders.assign`, `orders.update_status`
- `users.read`, `users.manage`
- `couriers.verify`
- `payments.read`, `reports.read`
- `subscriptions.manage`
- `addresses.read`, `addresses.manage`

## Будущие модули (не MVP)

- Подписки — периодичность, автогенерация заказов
- Отзывы и рейтинг
- Чаевые
- Геолокация и трекинг
- Финансы и выплаты
- Верификация документов курьеров

## Запуск

```bash
npm run dev
```

Web-интерфейс документации: http://localhost:5000/docs
