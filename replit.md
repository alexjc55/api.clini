# Waste Collection API

Backend API для сервиса выноса мусора / бытовых услуг.

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
- Soft delete пользователей (deletedAt + ?includeDeleted=true для админов)
- Audit log для staff-действий (кто, что, когда, diff)
- Device/session tracking (deviceId, platform, lastSeenAt)

## Структура проекта

```
├── client/                 # Web-интерфейс документации API
│   └── src/
│       └── pages/
│           └── api-docs.tsx  # Интерактивная документация
├── server/
│   ├── auth.ts            # JWT аутентификация
│   ├── middleware.ts      # RBAC middleware
│   ├── routes.ts          # API endpoints
│   └── storage.ts         # In-memory хранилище
└── shared/
    └── schema.ts          # Типы и схемы данных
```

## API Endpoints

### Аутентификация
- `POST /api/auth/register` — Регистрация
- `POST /api/auth/login` — Авторизация
- `POST /api/auth/refresh` — Обновление токена
- `GET /api/auth/me` — Текущий пользователь

### Пользователи (ERP)
- `GET /api/users` — Список пользователей (?includeDeleted=true для удалённых)
- `GET /api/users/:id` — Информация о пользователе
- `PATCH /api/users/:id` — Обновление пользователя
- `DELETE /api/users/:id` — Soft delete пользователя
- `POST /api/users/:id/roles` — Назначение ролей

### Audit & Sessions
- `GET /api/audit-logs` — Просмотр audit log (staff)
- `GET /api/auth/sessions` — Мои активные сессии
- `DELETE /api/auth/sessions/:id` — Выход с устройства
- `POST /api/auth/logout-all` — Выход со всех устройств

### Адреса
- `GET /api/addresses` — Мои адреса
- `POST /api/addresses` — Добавить адрес
- `PATCH /api/addresses/:id` — Обновить адрес
- `DELETE /api/addresses/:id` — Удалить адрес

### Заказы
- `POST /api/orders` — Создать заказ
- `GET /api/orders` — Список заказов
- `GET /api/orders/:id` — Детали заказа
- `PATCH /api/orders/:id` — Обновить заказ
- `POST /api/orders/:id/assign` — Назначить курьера
- `POST /api/orders/:id/cancel` — Отменить заказ

### Курьеры
- `GET /api/courier/profile` — Профиль курьера
- `PATCH /api/courier/profile` — Обновить статус
- `GET /api/courier/orders` — Заказы курьера
- `POST /api/courier/orders/:id/accept` — Принять заказ
- `POST /api/courier/orders/:id/complete` — Завершить заказ

### Роли и права (ERP)
- `GET /api/roles` — Список ролей
- `POST /api/roles` — Создать роль
- `GET /api/permissions` — Список прав

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
