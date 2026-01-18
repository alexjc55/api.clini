import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronRight, Send, Copy, Check, Key, Server, Shield, Users, Package, MapPin, Truck, Globe } from "lucide-react";
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
  responseExample?: Record<string, unknown>;
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
    ]
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
    ]
  }
};

const apiSections: ApiSection[] = [
  {
    name: { en: "Authentication", ru: "Аутентификация" },
    icon: Key,
    description: { en: "JWT access/refresh tokens, registration and login", ru: "JWT access/refresh токены, регистрация и авторизация" },
    endpoints: [
      {
        method: "POST",
        path: "/api/auth/register",
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
        path: "/api/auth/login",
        summary: { en: "User login", ru: "Авторизация пользователя" },
        description: { en: "Returns JWT tokens on successful login", ru: "Возвращает JWT токены при успешной авторизации" },
        auth: false,
        requestBody: { phone: "+79991234567", password: "securePassword123" },
        responseExample: {
          status: "success",
          message: { key: "auth.login_success", params: { userId: "uuid" } },
          data: { accessToken: "eyJhbGciOiJIUzI1NiIs...", refreshToken: "eyJhbGciOiJIUzI1NiIs..." }
        }
      },
      {
        method: "POST",
        path: "/api/auth/refresh",
        summary: { en: "Refresh token", ru: "Обновление токена" },
        description: { en: "Refreshes access token using refresh token", ru: "Обновляет access token используя refresh token" },
        auth: false,
        requestBody: { refreshToken: "eyJhbGciOiJIUzI1NiIs..." },
        responseExample: { accessToken: "eyJhbGciOiJIUzI1NiIs...", refreshToken: "eyJhbGciOiJIUzI1NiIs..." }
      },
      {
        method: "GET",
        path: "/api/auth/me",
        summary: { en: "Current user", ru: "Текущий пользователь" },
        description: { en: "Returns info about current authenticated user", ru: "Возвращает информацию о текущем авторизованном пользователе" },
        auth: true,
        responseExample: { id: "uuid", type: "client", phone: "+79991234567", email: "user@example.com", status: "active", createdAt: "2024-01-15T10:30:00Z" }
      },
      {
        method: "GET",
        path: "/api/auth/sessions",
        summary: { en: "My active sessions", ru: "Мои активные сессии" },
        description: { en: "List of all active sessions with device info", ru: "Список всех активных сессий пользователя с информацией об устройствах" },
        auth: true,
        responseExample: [{ id: "session-uuid", deviceId: "device-123", platform: "ios", lastSeenAt: "2026-01-15T10:30:00Z", createdAt: "2026-01-10T08:00:00Z" }]
      },
      {
        method: "DELETE",
        path: "/api/auth/sessions/:id",
        summary: { en: "Logout from device", ru: "Выход с устройства" },
        description: { en: "Deletes session (logout from specific device)", ru: "Удаляет сессию (выход с конкретного устройства)" },
        auth: true
      },
      {
        method: "POST",
        path: "/api/auth/logout-all",
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
        path: "/api/users",
        summary: { en: "List users", ru: "Список пользователей" },
        description: { en: "Get list of all users with filtering", ru: "Получение списка всех пользователей с фильтрацией" },
        auth: true,
        permissions: ["users.read"],
        responseExample: { users: [{ id: "uuid", type: "client", phone: "+79991234567", status: "active" }], total: 100, page: 1, limit: 20 }
      },
      {
        method: "GET",
        path: "/api/users/:id",
        summary: { en: "User details", ru: "Информация о пользователе" },
        description: { en: "Get detailed user information", ru: "Получение детальной информации о пользователе" },
        auth: true,
        permissions: ["users.read"],
        responseExample: { id: "uuid", type: "client", phone: "+79991234567", email: "user@example.com", status: "active", roles: ["admin", "manager"], createdAt: "2024-01-15T10:30:00Z" }
      },
      {
        method: "PATCH",
        path: "/api/users/:id",
        summary: { en: "Update user", ru: "Обновление пользователя" },
        description: { en: "Update user data", ru: "Обновление данных пользователя" },
        auth: true,
        permissions: ["users.manage"],
        requestBody: { status: "blocked", email: "new@example.com" }
      },
      {
        method: "POST",
        path: "/api/users/:id/roles",
        summary: { en: "Assign roles", ru: "Назначение ролей" },
        description: { en: "Assign roles to user", ru: "Назначение ролей пользователю" },
        auth: true,
        permissions: ["users.manage"],
        requestBody: { roleIds: ["role-uuid-1", "role-uuid-2"] }
      },
      {
        method: "DELETE",
        path: "/api/users/:id",
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
        path: "/api/addresses",
        summary: { en: "My addresses", ru: "Мои адреса" },
        description: { en: "Get list of current user addresses", ru: "Получение списка адресов текущего пользователя" },
        auth: true,
        responseExample: [{ id: "uuid", city: "Tel Aviv", street: "Rothschild", house: "10", apartment: "5", floor: 3, hasElevator: true, comment: "Code 123" }]
      },
      {
        method: "POST",
        path: "/api/addresses",
        summary: { en: "Add address", ru: "Добавление адреса" },
        description: { en: "Add new address", ru: "Добавление нового адреса" },
        auth: true,
        requestBody: { city: "Tel Aviv", street: "Rothschild", house: "10", apartment: "5", floor: 3, hasElevator: true, comment: "Code 123" }
      },
      {
        method: "PATCH",
        path: "/api/addresses/:id",
        summary: { en: "Update address", ru: "Обновление адреса" },
        description: { en: "Update existing address", ru: "Обновление существующего адреса" },
        auth: true,
        requestBody: { comment: "New comment" }
      },
      {
        method: "DELETE",
        path: "/api/addresses/:id",
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
        path: "/api/orders",
        summary: { en: "Create order", ru: "Создание заказа" },
        description: { en: "Create new order by client", ru: "Создание нового заказа клиентом" },
        auth: true,
        requestBody: { addressId: "address-uuid", scheduledAt: "2024-01-20T10:00:00Z", timeWindow: "10:00-12:00" },
        responseExample: { id: "order-uuid", clientId: "client-uuid", addressId: "address-uuid", status: "created", scheduledAt: "2024-01-20T10:00:00Z", timeWindow: "10:00-12:00", price: 500, createdAt: "2024-01-15T10:30:00Z" }
      },
      {
        method: "GET",
        path: "/api/orders",
        summary: { en: "List orders", ru: "Список заказов" },
        description: { en: "Get orders list (clients - own, ERP - all)", ru: "Получение списка заказов (для клиентов - свои, для ERP - все)" },
        auth: true,
        permissions: ["orders.read"],
        responseExample: { orders: [{ id: "order-uuid", status: "assigned", scheduledAt: "2024-01-20T10:00:00Z" }], total: 50 }
      },
      {
        method: "GET",
        path: "/api/orders/:id",
        summary: { en: "Order details", ru: "Детали заказа" },
        description: { en: "Get full order information", ru: "Получение полной информации о заказе" },
        auth: true,
        responseExample: { id: "order-uuid", clientId: "client-uuid", courierId: "courier-uuid", address: { city: "Tel Aviv", street: "Rothschild", house: "10" }, status: "in_progress", events: [{ eventType: "created", createdAt: "2024-01-15T10:30:00Z" }] }
      },
      {
        method: "PATCH",
        path: "/api/orders/:id",
        summary: { en: "Update order", ru: "Обновление заказа" },
        description: { en: "Update status, courier or order data", ru: "Обновление статуса, курьера или данных заказа" },
        auth: true,
        permissions: ["orders.update_status"],
        requestBody: { status: "in_progress" }
      },
      {
        method: "POST",
        path: "/api/orders/:id/assign",
        summary: { en: "Assign courier", ru: "Назначение курьера" },
        description: { en: "Assign courier to order (ERP)", ru: "Назначение курьера на заказ (ERP)" },
        auth: true,
        permissions: ["orders.assign"],
        requestBody: { courierId: "courier-uuid" }
      },
      {
        method: "POST",
        path: "/api/orders/:id/cancel",
        summary: { en: "Cancel order", ru: "Отмена заказа" },
        description: { en: "Cancel order by client or operator", ru: "Отмена заказа клиентом или оператором" },
        auth: true,
        requestBody: { reason: "Cancellation reason" }
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
        path: "/api/courier/profile",
        summary: { en: "Courier profile", ru: "Профиль курьера" },
        description: { en: "Get current courier profile", ru: "Получение профиля текущего курьера" },
        auth: true,
        responseExample: { courierId: "courier-uuid", availabilityStatus: "available", rating: 4.8, completedOrdersCount: 150, verificationStatus: "verified" }
      },
      {
        method: "PATCH",
        path: "/api/courier/profile",
        summary: { en: "Update status", ru: "Обновление статуса" },
        description: { en: "Change courier availability status", ru: "Изменение статуса доступности курьера" },
        auth: true,
        requestBody: { availabilityStatus: "busy" }
      },
      {
        method: "GET",
        path: "/api/courier/orders",
        summary: { en: "Courier orders", ru: "Заказы курьера" },
        description: { en: "Get list of assigned orders", ru: "Получение списка назначенных заказов" },
        auth: true,
        responseExample: { orders: [{ id: "order-uuid", status: "assigned", address: { city: "Tel Aviv", street: "Rothschild" }, scheduledAt: "2024-01-20T10:00:00Z" }] }
      },
      {
        method: "POST",
        path: "/api/courier/orders/:id/accept",
        summary: { en: "Accept order", ru: "Принять заказ" },
        description: { en: "Accept assigned order by courier", ru: "Принятие назначенного заказа курьером" },
        auth: true
      },
      {
        method: "POST",
        path: "/api/courier/orders/:id/complete",
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
        path: "/api/roles",
        summary: { en: "List roles", ru: "Список ролей" },
        description: { en: "Get list of all roles", ru: "Получение списка всех ролей" },
        auth: true,
        permissions: ["users.manage"],
        responseExample: [{ id: "role-uuid", name: "admin", description: "Full access", permissions: ["orders.read", "orders.create"] }]
      },
      {
        method: "POST",
        path: "/api/roles",
        summary: { en: "Create role", ru: "Создание роли" },
        description: { en: "Create new role with permissions", ru: "Создание новой роли с набором прав" },
        auth: true,
        permissions: ["users.manage"],
        requestBody: { name: "dispatcher", description: "Order dispatcher", permissionIds: ["perm-uuid-1", "perm-uuid-2"] }
      },
      {
        method: "GET",
        path: "/api/permissions",
        summary: { en: "List permissions", ru: "Список прав" },
        description: { en: "Get list of all available permissions", ru: "Получение списка всех доступных прав" },
        auth: true,
        permissions: ["users.manage"],
        responseExample: [{ id: "perm-uuid", name: "orders.read", description: "View orders" }]
      },
      {
        method: "GET",
        path: "/api/couriers",
        summary: { en: "List couriers", ru: "Список курьеров" },
        description: { en: "Get list of all couriers with profiles (ERP)", ru: "Получение списка всех курьеров с профилями (ERP)" },
        auth: true,
        permissions: ["users.read"],
        responseExample: [{ id: "courier-uuid", phone: "+79991234567", profile: { availabilityStatus: "available", verificationStatus: "verified", rating: 4.8 } }]
      },
      {
        method: "PATCH",
        path: "/api/couriers/:id/verify",
        summary: { en: "Verify courier", ru: "Верификация курьера" },
        description: { en: "Change courier verification status (verified/rejected)", ru: "Изменение статуса верификации курьера (verified/rejected)" },
        auth: true,
        permissions: ["couriers.verify"],
        requestBody: { status: "verified" },
        responseExample: { status: "success", message: { key: "courier.verified", params: { courierId: "uuid", status: "verified" } } }
      },
      {
        method: "GET",
        path: "/api/audit-logs",
        summary: { en: "Audit log", ru: "Audit log" },
        description: { en: "View staff action history. Filters: ?userId, ?entity, ?entityId", ru: "Просмотр истории действий персонала. Фильтры: ?userId, ?entity, ?entityId" },
        auth: true,
        permissions: ["users.manage"],
        responseExample: { logs: [{ id: "log-uuid", userId: "staff-uuid", userRole: "admin", action: "VERIFY_COURIER", entity: "courier", entityId: "courier-uuid", changes: { verificationStatus: { from: "pending", to: "verified" } }, createdAt: "2026-01-15T10:30:00Z" }], total: 100, page: 1, limit: 50 }
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
