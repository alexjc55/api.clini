import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronRight, Send, Copy, Check, Key, Server, Shield, Users, Package, MapPin, Truck, Globe, Download, Activity, Flag, Gift, CalendarClock, Store, DollarSign, Trophy, Flame, Target, Unlock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Lang = "en" | "ru";

interface EndpointDef {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  summary: { en: string; ru: string };
  description: { en: string; ru: string };
  auth: boolean;
  permissions?: string[];
  requestBody?: Record<string, unknown>;
  responseExample?: Record<string, unknown> | unknown[];
}

interface ApiSection {
  name: { en: string; ru: string };
  icon: typeof Server;
  description: { en: string; ru: string };
  endpoints: EndpointDef[];
}

const t = {
  en: {
    title: "Waste Collection API",
    version: "v1.0 • OpenAPI 3.0",
    tryIt: "Try it",
    request: "Request",
    response: "Response",
    sending: "Sending...",
    send: "Send",
    noRequestBody: "No request body",
    emptyResponse: "Empty response or 204 No Content",
    authRequired: "Auth",
    i18nTitle: "Internationalization (i18n)",
    supportedLangs: "Supported Languages",
    acceptLangHeader: "Accept-Language Header",
    acceptLangDesc: "API returns Content-Language header with selected language",
    successFormat: "Success Response Format",
    errorFormat: "Error Response Format",
    principles: "Principles",
    principlesList: [
      "API returns only localization keys, not text",
      "Date/currency/number formatting on client",
      "Dates in ISO 8601",
      "Money format"
    ],
    httpCodes: "HTTP Response Codes",
    httpCodesList: {
      200: "Successful request",
      201: "Resource created",
      204: "No content (deletion)",
      400: "Invalid request format",
      401: "Authorization required",
      403: "Insufficient permissions",
      404: "Resource not found",
      409: "State conflict",
      429: "Rate limit exceeded"
    },
    modularArch: "Modular Architecture",
    modularDesc: "API designed for extension without changing existing contracts:",
    modules: [
      "Subscriptions — periodicity, auto-generation of orders",
      "Reviews and ratings — client → courier moderation",
      "Tips — order binding, post-completion",
      "Geolocation — last known location, proximity-based",
      "Finances — accruals, payouts, reports",
      "Courier verification — documents, statuses"
    ],
    versioningTitle: "API Versioning",
    versioningDesc: "All endpoints available via /api/v1/* with backward compatibility via /api/*",
    softDeleteTitle: "Soft Delete",
    softDeleteDesc: "Deleted entities have deletedAt field. Use ?includeDeleted=true to view deleted (ERP only)",
    auditLogTitle: "Audit Logging",
    auditLogDesc: "Staff actions are logged with: who, what, when, and changes diff",
    openApiSpec: "OpenAPI Spec",
    downloadJson: "JSON",
    downloadYaml: "YAML",
    corsTitle: "CORS Configuration",
    corsDesc: "Set ALLOWED_ORIGINS environment variable for cross-origin requests"
  },
  ru: {
    title: "Waste Collection API",
    version: "v1.0 • OpenAPI 3.0",
    tryIt: "Попробовать",
    request: "Запрос",
    response: "Ответ",
    sending: "Отправка...",
    send: "Отправить",
    noRequestBody: "Нет тела запроса",
    emptyResponse: "Пустой ответ или 204 No Content",
    authRequired: "Auth",
    i18nTitle: "Интернационализация (i18n)",
    supportedLangs: "Поддерживаемые языки",
    acceptLangHeader: "Заголовок Accept-Language",
    acceptLangDesc: "API возвращает заголовок Content-Language с выбранным языком",
    successFormat: "Формат успешного ответа",
    errorFormat: "Формат ошибки",
    principles: "Принципы",
    principlesList: [
      "API возвращает только ключи локализации, не текст",
      "Форматирование дат/валют/чисел — на клиенте",
      "Даты в ISO 8601",
      "Формат денег"
    ],
    httpCodes: "HTTP коды ответов",
    httpCodesList: {
      200: "Успешный запрос",
      201: "Ресурс создан",
      204: "Нет контента (удаление)",
      400: "Неверный формат запроса",
      401: "Требуется авторизация",
      403: "Недостаточно прав",
      404: "Ресурс не найден",
      409: "Конфликт состояния",
      429: "Превышен лимит запросов"
    },
    modularArch: "Модульная архитектура",
    modularDesc: "API спроектирован для расширения без изменения существующих контрактов:",
    modules: [
      "Подписки — периодичность, автогенерация заказов",
      "Отзывы и рейтинг — client → courier модерация",
      "Чаевые — привязка к заказу, post-completion",
      "Геолокация — last known location, proximity-based",
      "Финансы — начисления, выплаты, отчёты",
      "Верификация курьеров — документы, статусы"
    ],
    versioningTitle: "Версионирование API",
    versioningDesc: "Все endpoints доступны через /api/v1/* с обратной совместимостью через /api/*",
    softDeleteTitle: "Мягкое удаление",
    softDeleteDesc: "Удалённые сущности имеют поле deletedAt. Используйте ?includeDeleted=true для просмотра (только ERP)",
    auditLogTitle: "Аудит логирование",
    auditLogDesc: "Действия персонала логируются: кто, что, когда, и diff изменений",
    openApiSpec: "OpenAPI спецификация",
    downloadJson: "JSON",
    downloadYaml: "YAML",
    corsTitle: "Настройка CORS",
    corsDesc: "Установите переменную окружения ALLOWED_ORIGINS для кросс-доменных запросов"
  }
};

const apiSections: ApiSection[] = [
  {
    name: { en: "System", ru: "Системные" },
    icon: Server,
    description: { en: "Health check and metadata endpoints", ru: "Проверка состояния и метаданные" },
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/health",
        summary: { en: "Health check", ru: "Проверка работоспособности" },
        description: { en: "Returns API health status and current timestamp", ru: "Возвращает статус API и текущее время" },
        auth: false,
        responseExample: {
          status: "ok",
          timestamp: "2026-01-18T10:30:00.000Z"
        }
      },
      {
        method: "GET",
        path: "/api/v1/meta/order-statuses",
        summary: { en: "Order statuses list", ru: "Список статусов заказа" },
        description: { en: "Returns all possible order statuses for UI rendering", ru: "Возвращает все возможные статусы заказа для отображения в UI" },
        auth: false,
        responseExample: [
          { code: "created" },
          { code: "scheduled" },
          { code: "assigned" },
          { code: "in_progress" },
          { code: "completed" },
          { code: "cancelled" }
        ]
      },
      {
        method: "GET",
        path: "/api/v1/meta/user-types",
        summary: { en: "User types list", ru: "Список типов пользователей" },
        description: { en: "Returns all possible user types", ru: "Возвращает все возможные типы пользователей" },
        auth: false,
        responseExample: [
          { code: "client" },
          { code: "courier" },
          { code: "staff" }
        ]
      },
      {
        method: "GET",
        path: "/api/v1/meta/user-statuses",
        summary: { en: "User statuses list", ru: "Список статусов пользователей" },
        description: { en: "Returns all possible user statuses", ru: "Возвращает все возможные статусы пользователей" },
        auth: false,
        responseExample: [
          { code: "active" },
          { code: "blocked" },
          { code: "pending" }
        ]
      },
      {
        method: "GET",
        path: "/api/v1/meta/availability-statuses",
        summary: { en: "Courier availability statuses", ru: "Статусы доступности курьера" },
        description: { en: "Returns courier availability status options", ru: "Возвращает варианты статуса доступности курьера" },
        auth: false,
        responseExample: [
          { code: "available" },
          { code: "busy" },
          { code: "offline" }
        ]
      },
      {
        method: "GET",
        path: "/api/v1/meta/verification-statuses",
        summary: { en: "Verification statuses list", ru: "Список статусов верификации" },
        description: { en: "Returns courier verification status options", ru: "Возвращает варианты статуса верификации курьера" },
        auth: false,
        responseExample: [
          { code: "pending" },
          { code: "verified" },
          { code: "rejected" }
        ]
      },
      {
        method: "GET",
        path: "/api/v1/meta/order-event-types",
        summary: { en: "Order event types", ru: "Типы событий заказа" },
        description: { en: "Returns all order event types for history tracking", ru: "Возвращает все типы событий заказа для истории" },
        auth: false,
        responseExample: [
          { code: "created" },
          { code: "scheduled" },
          { code: "assigned" },
          { code: "started" },
          { code: "completed" },
          { code: "cancelled" },
          { code: "status_changed" },
          { code: "courier_changed" },
          { code: "price_changed" },
          { code: "note_added" }
        ]
      },
      {
        method: "GET",
        path: "/api/v1/meta/event-types",
        summary: { en: "Product event types (v2)", ru: "Типы продуктовых событий (v2)" },
        description: { en: "Returns all product analytics event types", ru: "Возвращает все типы продуктовых событий для аналитики" },
        auth: false,
        responseExample: [
          { code: "order.created" },
          { code: "order.completed" },
          { code: "subscription.started" },
          { code: "bonus.earned" },
          { code: "bonus.redeemed" }
        ]
      },
      {
        method: "GET",
        path: "/api/v1/meta/activity-types",
        summary: { en: "User activity types (v2)", ru: "Типы активности пользователей (v2)" },
        description: { en: "Returns user activity event types", ru: "Возвращает типы событий активности пользователей" },
        auth: false,
        responseExample: [
          { code: "session_start" },
          { code: "order_placed" },
          { code: "app_opened" }
        ]
      },
      {
        method: "GET",
        path: "/api/v1/meta/user-flag-keys",
        summary: { en: "User flag keys (v2)", ru: "Ключи флагов пользователей (v2)" },
        description: { en: "Returns available user segmentation flag keys", ru: "Возвращает доступные ключи флагов для сегментации" },
        auth: false,
        responseExample: [
          { code: "vip" },
          { code: "churn_risk" },
          { code: "high_ltv" }
        ]
      },
      {
        method: "GET",
        path: "/api/v1/meta/bonus-transaction-types",
        summary: { en: "Bonus transaction types (v2)", ru: "Типы бонусных транзакций (v2)" },
        description: { en: "Returns bonus transaction types", ru: "Возвращает типы бонусных транзакций" },
        auth: false,
        responseExample: [
          { code: "earn" },
          { code: "spend" },
          { code: "expire" },
          { code: "adjust" }
        ]
      },
      {
        method: "GET",
        path: "/api/v1/meta/subscription-statuses",
        summary: { en: "Subscription statuses (v2)", ru: "Статусы подписок (v2)" },
        description: { en: "Returns subscription status options", ru: "Возвращает варианты статусов подписок" },
        auth: false,
        responseExample: [
          { code: "active" },
          { code: "paused" },
          { code: "cancelled" }
        ]
      },
      {
        method: "GET",
        path: "/api/v1/meta/partner-categories",
        summary: { en: "Partner categories (v2)", ru: "Категории партнёров (v2)" },
        description: { en: "Returns partner category options", ru: "Возвращает варианты категорий партнёров" },
        auth: false,
        responseExample: [
          { code: "cleaning" },
          { code: "laundry" },
          { code: "repair" }
        ]
      }
    ]
  },
  {
    name: { en: "Authentication", ru: "Аутентификация" },
    icon: Key,
    description: { en: "JWT access/refresh tokens, registration and login", ru: "JWT access/refresh токены, регистрация и авторизация" },
    endpoints: [
      {
        method: "POST",
        path: "/api/v1/auth/register",
        summary: { en: "Register new user", ru: "Регистрация нового пользователя" },
        description: { en: "Creates a new user (client, courier or staff)", ru: "Создает нового пользователя (client, courier или staff)" },
        auth: false,
        requestBody: {
          type: "client | courier | staff",
          phone: "+79991234567",
          email: "user@example.com",
          password: "securePassword123"
        },
        responseExample: {
          status: "success",
          message: { key: "auth.register_success", params: { userId: "uuid" } },
          data: { accessToken: "eyJhbGciOiJIUzI1NiIs...", refreshToken: "eyJhbGciOiJIUzI1NiIs..." }
        }
      },
      {
        method: "POST",
        path: "/api/v1/auth/login",
        summary: { en: "User login", ru: "Авторизация пользователя" },
        description: { en: "Returns JWT tokens on successful login. Creates device session.", ru: "Возвращает JWT токены при успешной авторизации. Создаёт сессию устройства." },
        auth: false,
        requestBody: { phone: "+79991234567", password: "securePassword123", deviceId: "device-123", platform: "ios | android | web" },
        responseExample: {
          status: "success",
          message: { key: "auth.login_success", params: { userId: "uuid" } },
          data: { accessToken: "eyJhbGciOiJIUzI1NiIs...", refreshToken: "eyJhbGciOiJIUzI1NiIs..." }
        }
      },
      {
        method: "POST",
        path: "/api/v1/auth/refresh",
        summary: { en: "Refresh token", ru: "Обновление токена" },
        description: { en: "Refreshes access token using refresh token. Updates lastSeenAt.", ru: "Обновляет access token используя refresh token. Обновляет lastSeenAt." },
        auth: false,
        requestBody: { refreshToken: "eyJhbGciOiJIUzI1NiIs..." },
        responseExample: { accessToken: "eyJhbGciOiJIUzI1NiIs...", refreshToken: "eyJhbGciOiJIUzI1NiIs..." }
      },
      {
        method: "GET",
        path: "/api/v1/auth/me",
        summary: { en: "Current user", ru: "Текущий пользователь" },
        description: { en: "Returns info about current authenticated user", ru: "Возвращает информацию о текущем авторизованном пользователе" },
        auth: true,
        responseExample: { id: "uuid", type: "client", phone: "+79991234567", email: "user@example.com", status: "active", createdAt: "2024-01-15T10:30:00Z" }
      },
      {
        method: "GET",
        path: "/api/v1/auth/sessions",
        summary: { en: "My active sessions", ru: "Мои активные сессии" },
        description: { en: "List of all active sessions with device info", ru: "Список всех активных сессий пользователя с информацией об устройствах" },
        auth: true,
        responseExample: [{ id: "session-uuid", deviceId: "device-123", platform: "ios", lastSeenAt: "2026-01-15T10:30:00Z", createdAt: "2026-01-10T08:00:00Z" }]
      },
      {
        method: "DELETE",
        path: "/api/v1/auth/sessions/:id",
        summary: { en: "Logout from device", ru: "Выход с устройства" },
        description: { en: "Deletes session (logout from specific device)", ru: "Удаляет сессию (выход с конкретного устройства)" },
        auth: true
      },
      {
        method: "POST",
        path: "/api/v1/auth/logout-all",
        summary: { en: "Logout from all devices", ru: "Выход со всех устройств" },
        description: { en: "Deletes all sessions and revokes all tokens", ru: "Удаляет все сессии и отзывает все токены пользователя" },
        auth: true,
        responseExample: { status: "success", message: { key: "auth.logout_all_success" } }
      }
    ]
  },
  {
    name: { en: "Users", ru: "Пользователи" },
    icon: Users,
    description: { en: "User and role management (ERP)", ru: "Управление пользователями и ролями (ERP)" },
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/users",
        summary: { en: "List users", ru: "Список пользователей" },
        description: { en: "Get list of all users. Filters: ?type, ?status, ?includeDeleted=true", ru: "Получение списка всех пользователей. Фильтры: ?type, ?status, ?includeDeleted=true" },
        auth: true,
        permissions: ["users.read"],
        responseExample: { users: [{ id: "uuid", type: "client", phone: "+79991234567", status: "active", deletedAt: null }], total: 100, page: 1, limit: 20 }
      },
      {
        method: "GET",
        path: "/api/v1/users/:id",
        summary: { en: "User details", ru: "Информация о пользователе" },
        description: { en: "Get detailed user information", ru: "Получение детальной информации о пользователе" },
        auth: true,
        permissions: ["users.read"],
        responseExample: { id: "uuid", type: "client", phone: "+79991234567", email: "user@example.com", status: "active", roles: ["admin", "manager"], createdAt: "2024-01-15T10:30:00Z" }
      },
      {
        method: "PATCH",
        path: "/api/v1/users/:id",
        summary: { en: "Update user", ru: "Обновление пользователя" },
        description: { en: "Update user data", ru: "Обновление данных пользователя" },
        auth: true,
        permissions: ["users.manage"],
        requestBody: { status: "blocked", email: "new@example.com" }
      },
      {
        method: "POST",
        path: "/api/v1/users/:id/roles",
        summary: { en: "Assign roles", ru: "Назначение ролей" },
        description: { en: "Assign roles to user", ru: "Назначение ролей пользователю" },
        auth: true,
        permissions: ["users.manage"],
        requestBody: { roleIds: ["role-uuid-1", "role-uuid-2"] }
      },
      {
        method: "DELETE",
        path: "/api/v1/users/:id",
        summary: { en: "Soft delete user", ru: "Soft delete пользователя" },
        description: { en: "Soft delete user (sets deletedAt). Use ?includeDeleted=true to view deleted", ru: "Мягкое удаление пользователя (устанавливает deletedAt). Используйте ?includeDeleted=true для просмотра удалённых" },
        auth: true,
        permissions: ["users.manage"],
        responseExample: { status: "success", message: { key: "user.deleted", params: { userId: "uuid" } } }
      }
    ]
  },
  {
    name: { en: "Addresses", ru: "Адреса" },
    icon: MapPin,
    description: { en: "Client address management", ru: "Управление адресами клиентов" },
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/addresses",
        summary: { en: "My addresses", ru: "Мои адреса" },
        description: { en: "Get list of current user addresses", ru: "Получение списка адресов текущего пользователя" },
        auth: true,
        responseExample: [{ id: "uuid", city: "Tel Aviv", street: "Rothschild", house: "10", apartment: "5", floor: 3, hasElevator: true, comment: "Code 123" }]
      },
      {
        method: "POST",
        path: "/api/v1/addresses",
        summary: { en: "Add address", ru: "Добавление адреса" },
        description: { en: "Add new address", ru: "Добавление нового адреса" },
        auth: true,
        requestBody: { city: "Tel Aviv", street: "Rothschild", house: "10", apartment: "5", floor: 3, hasElevator: true, comment: "Code 123" }
      },
      {
        method: "PATCH",
        path: "/api/v1/addresses/:id",
        summary: { en: "Update address", ru: "Обновление адреса" },
        description: { en: "Update existing address", ru: "Обновление существующего адреса" },
        auth: true,
        requestBody: { comment: "New comment" }
      },
      {
        method: "DELETE",
        path: "/api/v1/addresses/:id",
        summary: { en: "Delete address", ru: "Удаление адреса" },
        description: { en: "Delete address", ru: "Удаление адреса" },
        auth: true
      }
    ]
  },
  {
    name: { en: "Orders", ru: "Заказы" },
    icon: Package,
    description: { en: "Create, manage and track orders", ru: "Создание, управление и отслеживание заказов" },
    endpoints: [
      {
        method: "POST",
        path: "/api/v1/orders",
        summary: { en: "Create order", ru: "Создание заказа" },
        description: { en: "Create new order by client", ru: "Создание нового заказа клиентом" },
        auth: true,
        requestBody: { addressId: "address-uuid", scheduledAt: "2024-01-20T10:00:00Z", timeWindow: "10:00-12:00" },
        responseExample: { id: "order-uuid", clientId: "client-uuid", addressId: "address-uuid", status: "created", scheduledAt: "2024-01-20T10:00:00Z", timeWindow: "10:00-12:00", price: 500, createdAt: "2024-01-15T10:30:00Z" }
      },
      {
        method: "GET",
        path: "/api/v1/orders",
        summary: { en: "List orders", ru: "Список заказов" },
        description: { en: "Get orders list. Filters: ?status, ?includeDeleted=true (ERP only)", ru: "Получение списка заказов. Фильтры: ?status, ?includeDeleted=true (только ERP)" },
        auth: true,
        permissions: ["orders.read"],
        responseExample: { orders: [{ id: "order-uuid", status: "assigned", scheduledAt: "2024-01-20T10:00:00Z", deletedAt: null }], total: 50 }
      },
      {
        method: "GET",
        path: "/api/v1/orders/:id",
        summary: { en: "Order details", ru: "Детали заказа" },
        description: { en: "Get full order information", ru: "Получение полной информации о заказе" },
        auth: true,
        responseExample: { id: "order-uuid", clientId: "client-uuid", courierId: "courier-uuid", address: { city: "Tel Aviv", street: "Rothschild", house: "10" }, status: "in_progress", events: [{ eventType: "created", createdAt: "2024-01-15T10:30:00Z" }] }
      },
      {
        method: "PATCH",
        path: "/api/v1/orders/:id",
        summary: { en: "Update order", ru: "Обновление заказа" },
        description: { en: "Update status, courier or order data", ru: "Обновление статуса, курьера или данных заказа" },
        auth: true,
        permissions: ["orders.update_status"],
        requestBody: { status: "in_progress" }
      },
      {
        method: "POST",
        path: "/api/v1/orders/:id/assign",
        summary: { en: "Assign courier", ru: "Назначение курьера" },
        description: { en: "Assign courier to order (ERP)", ru: "Назначение курьера на заказ (ERP)" },
        auth: true,
        permissions: ["orders.assign"],
        requestBody: { courierId: "courier-uuid" }
      },
      {
        method: "POST",
        path: "/api/v1/orders/:id/cancel",
        summary: { en: "Cancel order", ru: "Отмена заказа" },
        description: { en: "Cancel order by client or operator", ru: "Отмена заказа клиентом или оператором" },
        auth: true,
        requestBody: { reason: "Cancellation reason" }
      },
      {
        method: "DELETE",
        path: "/api/v1/orders/:id",
        summary: { en: "Soft delete order", ru: "Soft delete заказа" },
        description: { en: "Soft delete order (sets deletedAt). Use ?includeDeleted=true to view", ru: "Мягкое удаление заказа (устанавливает deletedAt). Используйте ?includeDeleted=true для просмотра" },
        auth: true,
        permissions: ["orders.update_status"]
      }
    ]
  },
  {
    name: { en: "Couriers", ru: "Курьеры" },
    icon: Truck,
    description: { en: "Courier profile, status and orders", ru: "Профиль курьера, статус и заказы" },
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/courier/profile",
        summary: { en: "Courier profile", ru: "Профиль курьера" },
        description: { en: "Get current courier profile", ru: "Получение профиля текущего курьера" },
        auth: true,
        responseExample: { courierId: "courier-uuid", availabilityStatus: "available", rating: 4.8, completedOrdersCount: 150, verificationStatus: "verified" }
      },
      {
        method: "PATCH",
        path: "/api/v1/courier/profile",
        summary: { en: "Update status", ru: "Обновление статуса" },
        description: { en: "Change courier availability status", ru: "Изменение статуса доступности курьера" },
        auth: true,
        requestBody: { availabilityStatus: "busy" }
      },
      {
        method: "GET",
        path: "/api/v1/courier/orders",
        summary: { en: "Courier orders", ru: "Заказы курьера" },
        description: { en: "Get list of assigned orders", ru: "Получение списка назначенных заказов" },
        auth: true,
        responseExample: { orders: [{ id: "order-uuid", status: "assigned", address: { city: "Tel Aviv", street: "Rothschild" }, scheduledAt: "2024-01-20T10:00:00Z" }] }
      },
      {
        method: "POST",
        path: "/api/v1/courier/orders/:id/accept",
        summary: { en: "Accept order", ru: "Принять заказ" },
        description: { en: "Accept assigned order by courier", ru: "Принятие назначенного заказа курьером" },
        auth: true
      },
      {
        method: "POST",
        path: "/api/v1/courier/orders/:id/complete",
        summary: { en: "Complete order", ru: "Завершить заказ" },
        description: { en: "Mark order as completed", ru: "Отметка заказа как выполненного" },
        auth: true
      }
    ]
  },
  {
    name: { en: "Roles & Permissions", ru: "Роли и права" },
    icon: Shield,
    description: { en: "Role and permission management (ERP)", ru: "Управление ролями и правами доступа (ERP)" },
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/roles",
        summary: { en: "List roles", ru: "Список ролей" },
        description: { en: "Get list of all roles", ru: "Получение списка всех ролей" },
        auth: true,
        permissions: ["users.manage"],
        responseExample: [{ id: "role-uuid", name: "admin", description: "Full access", permissions: ["orders.read", "orders.create"] }]
      },
      {
        method: "POST",
        path: "/api/v1/roles",
        summary: { en: "Create role", ru: "Создание роли" },
        description: { en: "Create new role with permissions", ru: "Создание новой роли с набором прав" },
        auth: true,
        permissions: ["users.manage"],
        requestBody: { name: "dispatcher", description: "Order dispatcher", permissionIds: ["perm-uuid-1", "perm-uuid-2"] }
      },
      {
        method: "GET",
        path: "/api/v1/permissions",
        summary: { en: "List permissions", ru: "Список прав" },
        description: { en: "Get list of all available permissions", ru: "Получение списка всех доступных прав" },
        auth: true,
        permissions: ["users.manage"],
        responseExample: [{ id: "perm-uuid", name: "orders.read", description: "View orders" }]
      },
      {
        method: "GET",
        path: "/api/v1/couriers",
        summary: { en: "List couriers", ru: "Список курьеров" },
        description: { en: "Get list of all couriers with profiles. Filter: ?includeDeleted=true", ru: "Получение списка всех курьеров с профилями. Фильтр: ?includeDeleted=true" },
        auth: true,
        permissions: ["users.read"],
        responseExample: [{ id: "courier-uuid", phone: "+79991234567", profile: { availabilityStatus: "available", verificationStatus: "verified", rating: 4.8, deletedAt: null } }]
      },
      {
        method: "PATCH",
        path: "/api/v1/couriers/:id/verify",
        summary: { en: "Verify courier", ru: "Верификация курьера" },
        description: { en: "Change courier verification status (verified/rejected)", ru: "Изменение статуса верификации курьера (verified/rejected)" },
        auth: true,
        permissions: ["couriers.verify"],
        requestBody: { status: "verified" },
        responseExample: { status: "success", message: { key: "courier.verified", params: { courierId: "uuid", status: "verified" } } }
      },
      {
        method: "GET",
        path: "/api/v1/audit-logs",
        summary: { en: "Audit log", ru: "Audit log" },
        description: { en: "View staff action history. Filters: ?userId, ?entity, ?entityId, ?action", ru: "Просмотр истории действий персонала. Фильтры: ?userId, ?entity, ?entityId, ?action" },
        auth: true,
        permissions: ["users.manage"],
        responseExample: { logs: [{ id: "log-uuid", userId: "staff-uuid", userRole: "admin", action: "VERIFY_COURIER", messageKey: "audit.courier.verified", entity: "courier", entityId: "courier-uuid", changes: { verificationStatus: { from: "pending", to: "verified" } }, metadata: { courierId: "courier-uuid" }, createdAt: "2026-01-15T10:30:00Z" }], total: 100, page: 1, limit: 50 }
      }
    ]
  },
  {
    name: { en: "Events & Activity (v2)", ru: "События и активность (v2)" },
    icon: Activity,
    description: { en: "Product analytics events and user activity tracking", ru: "Продуктовые события и отслеживание активности пользователей" },
    endpoints: [
      {
        method: "POST",
        path: "/api/v1/events",
        summary: { en: "Create event", ru: "Создать событие" },
        description: { en: "Send product analytics event", ru: "Отправить продуктовое событие для аналитики" },
        auth: true,
        requestBody: { type: "order.created", actorType: "user", actorId: "user-uuid", entityType: "order", entityId: "order-uuid", metadata: { source: "mobile" } },
        responseExample: { status: "success", data: { id: "event-uuid", type: "order.created", actorType: "user", actorId: "user-uuid", createdAt: "2026-01-18T10:30:00Z" } }
      },
      {
        method: "GET",
        path: "/api/v1/events",
        summary: { en: "List events", ru: "Список событий" },
        description: { en: "Get events with filters: ?type, ?actorType, ?actorId, ?entityType, ?entityId, ?from, ?to", ru: "Получение событий с фильтрами: ?type, ?actorType, ?actorId, ?entityType, ?entityId, ?from, ?to" },
        auth: true,
        permissions: ["reports.read"],
        responseExample: [{ id: "event-uuid", type: "order.created", actorType: "user", actorId: "user-uuid", entityType: "order", entityId: "order-uuid", metadata: {}, createdAt: "2026-01-18T10:30:00Z" }]
      },
      {
        method: "POST",
        path: "/api/v1/users/:id/activity",
        summary: { en: "Record activity", ru: "Записать активность" },
        description: { en: "Record user activity event", ru: "Записать событие активности пользователя" },
        auth: true,
        requestBody: { eventType: "app_opened", metadata: { screen: "home" } },
        responseExample: { status: "success", data: { id: "activity-uuid", userId: "user-uuid", eventType: "app_opened", metadata: { screen: "home" }, createdAt: "2026-01-18T10:30:00Z" } }
      },
      {
        method: "GET",
        path: "/api/v1/users/:id/activity",
        summary: { en: "Get user activity", ru: "Получить активность" },
        description: { en: "Get user activity history with filters: ?eventType, ?from, ?to", ru: "Получение истории активности пользователя с фильтрами: ?eventType, ?from, ?to" },
        auth: true,
        responseExample: [{ id: "activity-uuid", userId: "user-uuid", eventType: "order_placed", metadata: { orderId: "order-uuid" }, createdAt: "2026-01-18T10:30:00Z" }]
      },
      {
        method: "GET",
        path: "/api/v1/users/:id/activity/summary",
        summary: { en: "Activity summary", ru: "Сводка активности" },
        description: { en: "Get user activity summary with aggregated stats", ru: "Получение сводки активности пользователя с агрегированной статистикой" },
        auth: true,
        responseExample: { userId: "user-uuid", lastOrderAt: "2026-01-18T10:30:00Z", totalOrders: 15, totalSpent: 1500 }
      }
    ]
  },
  {
    name: { en: "User Flags (v2)", ru: "Флаги пользователей (v2)" },
    icon: Flag,
    description: { en: "User segmentation and feature flags", ru: "Сегментация пользователей и флаги функций" },
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/users/:id/flags",
        summary: { en: "Get user flags", ru: "Получить флаги пользователя" },
        description: { en: "Get all flags for a user", ru: "Получение всех флагов пользователя" },
        auth: true,
        permissions: ["users.read"],
        responseExample: [{ id: "flag-uuid", userId: "user-uuid", key: "vip", value: true, source: "manual", createdAt: "2026-01-18T10:30:00Z" }]
      },
      {
        method: "POST",
        path: "/api/v1/users/:id/flags",
        summary: { en: "Set user flag", ru: "Установить флаг" },
        description: { en: "Set or update a user flag", ru: "Установить или обновить флаг пользователя" },
        auth: true,
        permissions: ["users.manage"],
        requestBody: { key: "vip", value: true, source: "manual" },
        responseExample: { status: "success", data: { id: "flag-uuid", userId: "user-uuid", key: "vip", value: true, source: "manual", createdAt: "2026-01-18T10:30:00Z" } }
      },
      {
        method: "DELETE",
        path: "/api/v1/users/:id/flags/:key",
        summary: { en: "Delete flag", ru: "Удалить флаг" },
        description: { en: "Delete a user flag by key", ru: "Удаление флага пользователя по ключу" },
        auth: true,
        permissions: ["users.manage"]
      },
      {
        method: "GET",
        path: "/api/v1/flags/:key/users",
        summary: { en: "Users by flag", ru: "Пользователи по флагу" },
        description: { en: "Get list of user IDs with specific flag. Filter: ?value", ru: "Получение списка ID пользователей с определённым флагом. Фильтр: ?value" },
        auth: true,
        permissions: ["users.read"],
        responseExample: ["user-uuid-1", "user-uuid-2", "user-uuid-3"]
      }
    ]
  },
  {
    name: { en: "Bonus System (v2)", ru: "Бонусная система (v2)" },
    icon: Gift,
    description: { en: "Bonus accounts and transactions", ru: "Бонусные счета и транзакции" },
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/bonus/accounts/:userId",
        summary: { en: "Get bonus account", ru: "Получить бонусный счёт" },
        description: { en: "Get user's bonus account balance", ru: "Получение баланса бонусного счёта пользователя" },
        auth: true,
        responseExample: { userId: "user-uuid", balance: 500, updatedAt: "2026-01-18T10:30:00Z" }
      },
      {
        method: "POST",
        path: "/api/v1/bonus/transactions",
        summary: { en: "Create transaction", ru: "Создать транзакцию" },
        description: { en: "Create bonus transaction (earn/spend/expire/adjust)", ru: "Создание бонусной транзакции (earn/spend/expire/adjust)" },
        auth: true,
        permissions: ["payments.read"],
        requestBody: { userId: "user-uuid", type: "earn", amount: 100, reason: "order_completion", referenceType: "order", referenceId: "order-uuid" },
        responseExample: { status: "success", data: { id: "tx-uuid", userId: "user-uuid", type: "earn", amount: 100, reason: "order_completion", referenceType: "order", referenceId: "order-uuid", createdAt: "2026-01-18T10:30:00Z" } }
      },
      {
        method: "GET",
        path: "/api/v1/bonus/transactions/:userId",
        summary: { en: "Get transactions", ru: "Получить транзакции" },
        description: { en: "Get user's bonus transaction history. Filters: ?type, ?from, ?to", ru: "Получение истории бонусных транзакций пользователя. Фильтры: ?type, ?from, ?to" },
        auth: true,
        responseExample: [{ id: "tx-uuid", userId: "user-uuid", type: "earn", amount: 100, reason: "order_completion", referenceType: "order", referenceId: "order-uuid", createdAt: "2026-01-18T10:30:00Z" }]
      }
    ]
  },
  {
    name: { en: "Subscriptions (v2)", ru: "Подписки (v2)" },
    icon: CalendarClock,
    description: { en: "Subscription plans and recurring services", ru: "Планы подписок и периодические услуги" },
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/subscriptions",
        summary: { en: "List subscriptions", ru: "Список подписок" },
        description: { en: "Get user's subscriptions", ru: "Получение подписок пользователя" },
        auth: true,
        responseExample: [{ id: "sub-uuid", userId: "user-uuid", planId: "plan-uuid", status: "active", startedAt: "2026-01-01T00:00:00Z", nextOrderAt: "2026-01-25T00:00:00Z" }]
      },
      {
        method: "POST",
        path: "/api/v1/subscriptions",
        summary: { en: "Create subscription", ru: "Создать подписку" },
        description: { en: "Create new subscription", ru: "Создание новой подписки" },
        auth: true,
        requestBody: { planId: "plan-uuid", addressId: "address-uuid", dayOfWeek: 1, timeSlot: "09:00-12:00" },
        responseExample: { status: "success", data: { id: "sub-uuid", userId: "user-uuid", planId: "plan-uuid", status: "active", startedAt: "2026-01-18T10:30:00Z" } }
      },
      {
        method: "PATCH",
        path: "/api/v1/subscriptions/:id",
        summary: { en: "Update subscription", ru: "Обновить подписку" },
        description: { en: "Update subscription (pause, cancel, change plan)", ru: "Обновление подписки (пауза, отмена, смена плана)" },
        auth: true,
        requestBody: { status: "paused" },
        responseExample: { status: "success", data: { id: "sub-uuid", status: "paused", pausedAt: "2026-01-18T10:30:00Z" } }
      },
      {
        method: "GET",
        path: "/api/v1/subscription-plans",
        summary: { en: "List plans", ru: "Список планов" },
        description: { en: "Get available subscription plans", ru: "Получение доступных планов подписок" },
        auth: false,
        responseExample: [{ id: "plan-uuid", name: "Weekly Pickup", descriptionKey: "plan.weekly.description", basePrice: 99, currency: "ILS", isActive: true }]
      },
      {
        method: "POST",
        path: "/api/v1/subscription-plans",
        summary: { en: "Create plan", ru: "Создать план" },
        description: { en: "Create new subscription plan (staff only)", ru: "Создание нового плана подписки (только персонал)" },
        auth: true,
        permissions: ["subscriptions.manage"],
        requestBody: { name: "Bi-weekly Pickup", descriptionKey: "plan.biweekly.description", basePrice: 149, currency: "ILS" },
        responseExample: { status: "success", data: { id: "plan-uuid", name: "Bi-weekly Pickup", descriptionKey: "plan.biweekly.description", basePrice: 149, currency: "ILS", isActive: true } }
      }
    ]
  },
  {
    name: { en: "Partners (v2)", ru: "Партнёры (v2)" },
    icon: Store,
    description: { en: "Partner marketplace and offers", ru: "Маркетплейс партнёров и предложения" },
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/partners",
        summary: { en: "List partners", ru: "Список партнёров" },
        description: { en: "Get all partners with filters: ?category, ?status", ru: "Получение всех партнёров с фильтрами: ?category, ?status" },
        auth: false,
        responseExample: [{ id: "partner-uuid", name: "CleanCo", category: "cleaning", status: "active", contactEmail: "info@cleanco.il" }]
      },
      {
        method: "POST",
        path: "/api/v1/partners",
        summary: { en: "Create partner", ru: "Создать партнёра" },
        description: { en: "Create new partner (staff only)", ru: "Создание нового партнёра (только персонал)" },
        auth: true,
        permissions: ["users.manage"],
        requestBody: { name: "CleanCo", category: "cleaning", contactEmail: "info@cleanco.il" },
        responseExample: { status: "success", data: { id: "partner-uuid", name: "CleanCo", category: "cleaning", status: "pending" } }
      },
      {
        method: "GET",
        path: "/api/v1/partners/:id/offers",
        summary: { en: "Partner offers", ru: "Офферы партнёра" },
        description: { en: "Get partner's offers with filter: ?activeOnly", ru: "Получение офферов партнёра с фильтром: ?activeOnly" },
        auth: false,
        responseExample: [{ id: "offer-uuid", partnerId: "partner-uuid", titleKey: "offer.cleaning.title", descriptionKey: "offer.cleaning.description", price: 150, currency: "ILS", isActive: true }]
      },
      {
        method: "POST",
        path: "/api/v1/partners/:id/offers",
        summary: { en: "Create offer", ru: "Создать оффер" },
        description: { en: "Create new partner offer (staff only)", ru: "Создание нового оффера партнёра (только персонал)" },
        auth: true,
        permissions: ["users.manage"],
        requestBody: { titleKey: "offer.cleaning.title", descriptionKey: "offer.cleaning.description", price: 150, bonusPrice: 50, availableForSegments: ["vip", "high_ltv"] },
        responseExample: { status: "success", data: { id: "offer-uuid", partnerId: "partner-uuid", titleKey: "offer.cleaning.title", price: 150, bonusPrice: 50, isActive: true } }
      },
      {
        method: "GET",
        path: "/api/v1/partner-offers",
        summary: { en: "Offers by segments", ru: "Офферы по сегментам" },
        description: { en: "Get offers available for user segments: ?segments=vip,high_ltv", ru: "Получение офферов, доступных для сегментов пользователя: ?segments=vip,high_ltv" },
        auth: false,
        responseExample: [{ id: "offer-uuid", partnerId: "partner-uuid", titleKey: "offer.cleaning.title", price: 150, bonusPrice: 50, availableForSegments: ["vip"], isActive: true }]
      }
    ]
  },
  {
    name: { en: "Order Finance (v2)", ru: "Финансы заказа (v2)" },
    icon: DollarSign,
    description: { en: "Order financial snapshots and margin tracking", ru: "Финансовые снимки заказов и отслеживание маржи" },
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/orders/:id/finance",
        summary: { en: "Get finance snapshot", ru: "Получить финансовый снимок" },
        description: { en: "Get order's financial snapshot", ru: "Получение финансового снимка заказа" },
        auth: true,
        permissions: ["payments.read"],
        responseExample: { id: "snapshot-uuid", orderId: "order-uuid", clientPrice: 100, courierPayout: 60, bonusSpent: 10, platformFee: 5, margin: 25, currency: "ILS", createdAt: "2026-01-18T10:30:00Z" }
      },
      {
        method: "POST",
        path: "/api/v1/orders/:id/finance",
        summary: { en: "Create finance snapshot", ru: "Создать финансовый снимок" },
        description: { en: "Create order's financial snapshot", ru: "Создание финансового снимка заказа" },
        auth: true,
        permissions: ["payments.read"],
        requestBody: { clientPrice: 100, courierPayout: 60, bonusSpent: 10, platformFee: 5 },
        responseExample: { status: "success", data: { id: "snapshot-uuid", orderId: "order-uuid", clientPrice: 100, courierPayout: 60, bonusSpent: 10, platformFee: 5, margin: 25, currency: "ILS" } }
      },
      {
        method: "PATCH",
        path: "/api/v1/orders/:id/finance",
        summary: { en: "Update finance snapshot", ru: "Обновить финансовый снимок" },
        description: { en: "Update order's financial snapshot", ru: "Обновление финансового снимка заказа" },
        auth: true,
        permissions: ["payments.read"],
        requestBody: { courierPayout: 65 },
        responseExample: { status: "success", data: { id: "snapshot-uuid", orderId: "order-uuid", clientPrice: 100, courierPayout: 65, bonusSpent: 10, platformFee: 5, margin: 20, currency: "ILS" } }
      }
    ]
  },
  {
    name: { en: "Levels & Progress", ru: "Уровни и прогресс" },
    icon: Trophy,
    description: { en: "User levels, points progression and level benefits", ru: "Уровни пользователей, прогресс очков и привилегии уровней" },
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/levels",
        summary: { en: "List levels", ru: "Список уровней" },
        description: { en: "Get all available levels with benefits", ru: "Получение всех доступных уровней с привилегиями" },
        auth: false,
        responseExample: [{ id: "level-uuid", code: "silver", nameKey: "level.silver.name", minPoints: 50, benefits: { discount_percent: 5, shabbat_access: true }, createdAt: "2026-01-18T10:30:00Z" }]
      },
      {
        method: "POST",
        path: "/api/v1/levels",
        summary: { en: "Create level", ru: "Создать уровень" },
        description: { en: "Create new level definition (staff only)", ru: "Создание нового уровня (только персонал)" },
        auth: true,
        permissions: ["users.manage"],
        requestBody: { code: "gold", nameKey: "level.gold.name", minPoints: 100, benefits: { discount_percent: 10, priority_courier: true } },
        responseExample: { status: "success", data: { id: "level-uuid", code: "gold", nameKey: "level.gold.name", minPoints: 100, benefits: { discount_percent: 10, priority_courier: true } } }
      },
      {
        method: "GET",
        path: "/api/v1/users/:id/progress",
        summary: { en: "Get user progress", ru: "Получить прогресс" },
        description: { en: "Get user's total points and current level", ru: "Получение общего количества очков и текущего уровня пользователя" },
        auth: true,
        responseExample: { userId: "user-uuid", totalPoints: 75, updatedAt: "2026-01-18T10:30:00Z", currentLevel: { id: "level-uuid", code: "silver", nameKey: "level.silver.name", minPoints: 50 } }
      },
      {
        method: "POST",
        path: "/api/v1/users/:id/progress",
        summary: { en: "Add points", ru: "Добавить очки" },
        description: { en: "Add progress points to user (staff only)", ru: "Добавление очков прогресса пользователю (только персонал)" },
        auth: true,
        permissions: ["users.manage"],
        requestBody: { points: 5, reason: "daily_order", referenceType: "order", referenceId: "order-uuid" },
        responseExample: { status: "success", data: { id: "tx-uuid", userId: "user-uuid", points: 5, reason: "daily_order", referenceType: "order", referenceId: "order-uuid", createdAt: "2026-01-18T10:30:00Z" } }
      },
      {
        method: "GET",
        path: "/api/v1/users/:id/progress/transactions",
        summary: { en: "Points history", ru: "История очков" },
        description: { en: "Get user's points transaction history. Filters: ?reason, ?from, ?to", ru: "Получение истории транзакций очков пользователя. Фильтры: ?reason, ?from, ?to" },
        auth: true,
        responseExample: [{ id: "tx-uuid", userId: "user-uuid", points: 5, reason: "daily_order", referenceType: "order", referenceId: "order-uuid", createdAt: "2026-01-18T10:30:00Z" }]
      },
      {
        method: "GET",
        path: "/api/v1/users/:id/level",
        summary: { en: "Get user level", ru: "Получить уровень" },
        description: { en: "Get user's current level and history", ru: "Получение текущего уровня пользователя и истории" },
        auth: true,
        responseExample: { currentLevel: { id: "level-uuid", code: "silver", nameKey: "level.silver.name", minPoints: 50, benefits: {} }, achievedAt: "2026-01-15T10:30:00Z", history: [] }
      },
      {
        method: "POST",
        path: "/api/v1/users/:id/level",
        summary: { en: "Set user level", ru: "Установить уровень" },
        description: { en: "Manually set user's level (staff only)", ru: "Ручная установка уровня пользователя (только персонал)" },
        auth: true,
        permissions: ["users.manage"],
        requestBody: { levelId: "level-uuid" },
        responseExample: { status: "success", data: { userLevel: { id: "ul-uuid", userId: "user-uuid", levelId: "level-uuid", achievedAt: "2026-01-18T10:30:00Z", current: true }, level: { id: "level-uuid", code: "gold" } } }
      }
    ]
  },
  {
    name: { en: "Streaks", ru: "Стрики" },
    icon: Flame,
    description: { en: "User streaks for retention and engagement", ru: "Стрики пользователей для удержания и вовлечения" },
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/users/:id/streaks",
        summary: { en: "Get all streaks", ru: "Получить все стрики" },
        description: { en: "Get all user's streaks", ru: "Получение всех стриков пользователя" },
        auth: true,
        responseExample: [{ userId: "user-uuid", type: "daily_cleanup", currentCount: 7, maxCount: 14, lastActionDate: "2026-01-18" }]
      },
      {
        method: "GET",
        path: "/api/v1/users/:id/streaks/:type",
        summary: { en: "Get streak", ru: "Получить стрик" },
        description: { en: "Get specific streak by type", ru: "Получение конкретного стрика по типу" },
        auth: true,
        responseExample: { userId: "user-uuid", type: "daily_cleanup", currentCount: 7, maxCount: 14, lastActionDate: "2026-01-18" }
      },
      {
        method: "POST",
        path: "/api/v1/users/:id/streaks/:type/increment",
        summary: { en: "Increment streak", ru: "Увеличить стрик" },
        description: { en: "Increment streak count (auto-resets if day skipped)", ru: "Увеличение счётчика стрика (автосброс при пропуске дня)" },
        auth: true,
        responseExample: { status: "success", data: { userId: "user-uuid", type: "daily_cleanup", currentCount: 8, maxCount: 14, lastActionDate: "2026-01-18" } }
      },
      {
        method: "POST",
        path: "/api/v1/users/:id/streaks/:type/reset",
        summary: { en: "Reset streak", ru: "Сбросить стрик" },
        description: { en: "Reset streak to zero (staff only)", ru: "Сброс стрика до нуля (только персонал)" },
        auth: true,
        permissions: ["users.manage"],
        responseExample: { status: "success", data: { userId: "user-uuid", type: "daily_cleanup", currentCount: 0, maxCount: 14, lastActionDate: "2026-01-18" } }
      }
    ]
  },
  {
    name: { en: "Feature Unlocks", ru: "Разблокировка функций" },
    icon: Unlock,
    description: { en: "Feature access control based on levels and promotions", ru: "Управление доступом к функциям на основе уровней и промо-акций" },
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/features",
        summary: { en: "List features", ru: "Список функций" },
        description: { en: "Get all available features", ru: "Получение всех доступных функций" },
        auth: false,
        responseExample: [{ id: "feature-uuid", code: "shabbat_orders", descriptionKey: "feature.shabbat.description", createdAt: "2026-01-18T10:30:00Z" }]
      },
      {
        method: "POST",
        path: "/api/v1/features",
        summary: { en: "Create feature", ru: "Создать функцию" },
        description: { en: "Create new feature definition (staff only)", ru: "Создание нового определения функции (только персонал)" },
        auth: true,
        permissions: ["users.manage"],
        requestBody: { code: "bonus_marketplace", descriptionKey: "feature.bonus_marketplace.description" },
        responseExample: { status: "success", data: { id: "feature-uuid", code: "bonus_marketplace", descriptionKey: "feature.bonus_marketplace.description" } }
      },
      {
        method: "GET",
        path: "/api/v1/users/:id/features",
        summary: { en: "User features", ru: "Функции пользователя" },
        description: { en: "Get user's unlocked features", ru: "Получение разблокированных функций пользователя" },
        auth: true,
        responseExample: [{ id: "access-uuid", userId: "user-uuid", featureId: "feature-uuid", grantedBy: "level", expiresAt: null, feature: { id: "feature-uuid", code: "shabbat_orders" } }]
      },
      {
        method: "GET",
        path: "/api/v1/users/:id/features/:code",
        summary: { en: "Check feature access", ru: "Проверить доступ" },
        description: { en: "Check if user has access to specific feature", ru: "Проверка доступа пользователя к конкретной функции" },
        auth: true,
        responseExample: { featureCode: "shabbat_orders", hasAccess: true }
      },
      {
        method: "POST",
        path: "/api/v1/users/:id/features",
        summary: { en: "Grant feature access", ru: "Выдать доступ" },
        description: { en: "Grant feature access to user (staff only)", ru: "Выдача доступа к функции пользователю (только персонал)" },
        auth: true,
        permissions: ["users.manage"],
        requestBody: { featureId: "feature-uuid", grantedBy: "promo", expiresAt: "2026-02-18T10:30:00Z" },
        responseExample: { status: "success", data: { id: "access-uuid", userId: "user-uuid", featureId: "feature-uuid", grantedBy: "promo", expiresAt: "2026-02-18T10:30:00Z" } }
      },
      {
        method: "DELETE",
        path: "/api/v1/users/:id/features/:featureId",
        summary: { en: "Revoke access", ru: "Отозвать доступ" },
        description: { en: "Revoke feature access from user (staff only)", ru: "Отзыв доступа к функции у пользователя (только персонал)" },
        auth: true,
        permissions: ["users.manage"]
      }
    ]
  }
];

const methodColors: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  POST: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  PATCH: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  DELETE: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
};

function EndpointCard({ endpoint, baseUrl, lang }: { endpoint: EndpointDef; baseUrl: string; lang: Lang }) {
  const [isOpen, setIsOpen] = useState(false);
  const [requestBody, setRequestBody] = useState(
    endpoint.requestBody ? JSON.stringify(endpoint.requestBody, null, 2) : ""
  );
  const [response, setResponse] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [token, setToken] = useState("");
  const [pathParams, setPathParams] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const tr = t[lang];

  const hasPathParams = endpoint.path.includes(":");
  const pathParamNames = endpoint.path.match(/:(\w+)/g)?.map(p => p.slice(1)) || [];

  const buildPath = () => {
    let path = endpoint.path;
    for (const param of pathParamNames) {
      path = path.replace(`:${param}`, pathParams[param] || `{${param}}`);
    }
    return path;
  };

  const handleSend = async () => {
    setIsLoading(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const options: RequestInit = {
        method: endpoint.method,
        headers
      };

      if (endpoint.method !== "GET" && requestBody) {
        options.body = requestBody;
      }

      const res = await fetch(`${baseUrl}${buildPath()}`, options);
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (err) {
      setResponse(JSON.stringify({ error: { code: "NETWORK_ERROR", message: String(err) } }, null, 2));
    }
    setIsLoading(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ description: lang === "en" ? "Copied to clipboard" : "Скопировано в буфер обмена" });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div 
          className="flex items-center gap-3 p-3 hover-elevate cursor-pointer rounded-md"
          data-testid={`endpoint-${endpoint.method}-${endpoint.path.replace(/[/:]/g, "-")}`}
        >
          {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <Badge variant="outline" className={`${methodColors[endpoint.method]} font-mono text-xs px-2`}>
            {endpoint.method}
          </Badge>
          <code className="text-sm font-mono flex-1">{endpoint.path}</code>
          <span className="text-sm text-muted-foreground hidden sm:block">{endpoint.summary[lang]}</span>
          {endpoint.auth && <Badge variant="secondary" className="text-xs">{tr.authRequired}</Badge>}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-7 mr-2 mb-4 mt-2 space-y-4">
          <p className="text-sm text-muted-foreground">{endpoint.description[lang]}</p>
          
          {endpoint.permissions && (
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">{lang === "en" ? "Required permissions:" : "Требуемые права:"}</span>
              {endpoint.permissions.map(p => (
                <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
              ))}
            </div>
          )}

          <Tabs defaultValue="try" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="try" data-testid="tab-try">{tr.tryIt}</TabsTrigger>
              <TabsTrigger value="request" data-testid="tab-request">{tr.request}</TabsTrigger>
              <TabsTrigger value="response" data-testid="tab-response">{tr.response}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="try" className="space-y-3">
              {endpoint.auth && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Bearer Token</label>
                  <Input
                    placeholder="eyJhbGciOiJIUzI1NiIs..."
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="font-mono text-xs"
                    data-testid="input-token"
                  />
                </div>
              )}
              
              {hasPathParams && (
                <div className="space-y-2">
                  {pathParamNames.map(param => (
                    <div key={param}>
                      <label className="text-xs text-muted-foreground mb-1 block">:{param}</label>
                      <Input
                        placeholder={param}
                        value={pathParams[param] || ""}
                        onChange={(e) => setPathParams({ ...pathParams, [param]: e.target.value })}
                        className="font-mono text-xs"
                        data-testid={`input-param-${param}`}
                      />
                    </div>
                  ))}
                </div>
              )}
              
              {endpoint.method !== "GET" && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Request Body</label>
                  <Textarea
                    value={requestBody}
                    onChange={(e) => setRequestBody(e.target.value)}
                    className="font-mono text-xs min-h-[100px]"
                    data-testid="input-body"
                  />
                </div>
              )}
              
              <Button onClick={handleSend} disabled={isLoading} data-testid="button-send">
                <Send className="h-4 w-4 mr-2" />
                {isLoading ? tr.sending : tr.send}
              </Button>
              
              {response && (
                <div className="relative">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-2 top-2"
                    onClick={() => copyToClipboard(response)}
                    data-testid="button-copy-response"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                    {response}
                  </pre>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="request">
              {endpoint.requestBody ? (
                <div className="relative">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-2 top-2"
                    onClick={() => copyToClipboard(JSON.stringify(endpoint.requestBody, null, 2))}
                    data-testid="button-copy-request"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                    {JSON.stringify(endpoint.requestBody, null, 2)}
                  </pre>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground p-3">{tr.noRequestBody}</p>
              )}
            </TabsContent>
            
            <TabsContent value="response">
              {endpoint.responseExample ? (
                <div className="relative">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-2 top-2"
                    onClick={() => copyToClipboard(JSON.stringify(endpoint.responseExample, null, 2))}
                    data-testid="button-copy-example"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                    {JSON.stringify(endpoint.responseExample, null, 2)}
                  </pre>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground p-3">{tr.emptyResponse}</p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function ApiDocs() {
  const [lang, setLang] = useState<Lang>("en");
  const [activeSection, setActiveSection] = useState(apiSections[0].name.en);
  const [copied, setCopied] = useState(false);
  const baseUrl = window.location.origin;
  const tr = t[lang];

  const copyBaseUrl = () => {
    navigator.clipboard.writeText(baseUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Server className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-lg font-semibold">{tr.title}</h1>
              <p className="text-xs text-muted-foreground">{tr.version}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/api/v1/openapi.json" download="openapi.json" className="inline-flex" data-testid="link-download-json">
              <Button size="sm" variant="outline" data-testid="button-download-json">
                <Download className="h-4 w-4 mr-1" />
                {tr.downloadJson}
              </Button>
            </a>
            <a href="/api/v1/openapi.yaml" download="openapi.yaml" className="inline-flex" data-testid="link-download-yaml">
              <Button size="sm" variant="outline" data-testid="button-download-yaml">
                <Download className="h-4 w-4 mr-1" />
                {tr.downloadYaml}
              </Button>
            </a>
            <div className="w-px h-6 bg-border" />
            <Button
              size="sm"
              variant={lang === "en" ? "default" : "outline"}
              onClick={() => setLang("en")}
              data-testid="button-lang-en"
            >
              EN
            </Button>
            <Button
              size="sm"
              variant={lang === "ru" ? "default" : "outline"}
              onClick={() => setLang("ru")}
              data-testid="button-lang-ru"
            >
              RU
            </Button>
            <code className="text-xs bg-muted px-2 py-1 rounded hidden sm:block">{baseUrl}</code>
            <Button size="icon" variant="ghost" onClick={copyBaseUrl} data-testid="button-copy-base-url">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 flex gap-6">
        <aside className="hidden md:block w-64 shrink-0">
          <nav className="sticky top-24 space-y-1">
            {apiSections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.name.en}
                  onClick={() => setActiveSection(section.name.en)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-left ${
                    activeSection === section.name.en
                      ? "bg-primary text-primary-foreground"
                      : "hover-elevate text-foreground"
                  }`}
                  data-testid={`nav-${section.name.en}`}
                >
                  <Icon className="h-4 w-4" />
                  {section.name[lang]}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 min-w-0">
          <div className="md:hidden mb-4">
            <ScrollArea className="w-full whitespace-nowrap pb-2">
              <div className="flex gap-2">
                {apiSections.map((section) => (
                  <Button
                    key={section.name.en}
                    variant={activeSection === section.name.en ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveSection(section.name.en)}
                    data-testid={`mobile-nav-${section.name.en}`}
                  >
                    {section.name[lang]}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {apiSections
            .filter((s) => s.name.en === activeSection)
            .map((section) => (
              <div key={section.name.en}>
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold flex items-center gap-2">
                    <section.icon className="h-6 w-6 text-primary" />
                    {section.name[lang]}
                  </h2>
                  <p className="text-muted-foreground mt-1">{section.description[lang]}</p>
                </div>

                <Card>
                  <CardContent className="p-0 divide-y">
                    {section.endpoints.map((endpoint) => (
                      <EndpointCard
                        key={`${endpoint.method}-${endpoint.path}`}
                        endpoint={endpoint}
                        baseUrl={baseUrl}
                        lang={lang}
                      />
                    ))}
                  </CardContent>
                </Card>
              </div>
            ))}

          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-lg">{tr.i18nTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">{tr.supportedLangs}</h4>
                <div className="flex gap-2">
                  <Badge>he</Badge>
                  <Badge>ru</Badge>
                  <Badge>ar</Badge>
                  <Badge variant="outline">en (fallback)</Badge>
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-2">{tr.acceptLangHeader}</h4>
                <pre className="bg-muted p-3 rounded-md text-xs">Accept-Language: he</pre>
                <p className="text-sm text-muted-foreground mt-2">{tr.acceptLangDesc}</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">{tr.successFormat}</h4>
                <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
{`{
  "status": "success",
  "message": {
    "key": "order.created",
    "params": { "orderId": "uuid" }
  },
  "data": { ... }
}`}
                </pre>
              </div>
              <div>
                <h4 className="font-medium mb-2">{tr.errorFormat}</h4>
                <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
{`{
  "error": {
    "key": "order.not_found",
    "params": { "orderId": "uuid" }
  }
}`}
                </pre>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>{tr.principles}:</strong></p>
                <ul className="list-disc list-inside ml-2">
                  {tr.principlesList.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg">{tr.httpCodes}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {Object.entries(tr.httpCodesList).map(([code, desc]) => (
                  <div key={code} className="flex items-center gap-2">
                    <Badge variant="outline">{code}</Badge>
                    <span className="text-muted-foreground">{desc}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg">{tr.modularArch}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>{tr.modularDesc}</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                {tr.modules.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
