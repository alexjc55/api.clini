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
- Express
- JWT (access + refresh)
- In-Memory Storage (для MVP)

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
- `GET /api/users` — Список пользователей
- `GET /api/users/:id` — Информация о пользователе
- `PATCH /api/users/:id` — Обновление пользователя
- `POST /api/users/:id/roles` — Назначение ролей

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

## Статусы заказа

1. `created` — Создан
2. `scheduled` — Запланирован
3. `assigned` — Назначен курьер
4. `in_progress` — В процессе
5. `completed` — Завершён
6. `cancelled` — Отменён

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
