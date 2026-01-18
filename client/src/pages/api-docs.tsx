import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronRight, Send, Copy, Check, Key, Server, Shield, Users, Package, MapPin, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EndpointDef {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  summary: string;
  description: string;
  auth: boolean;
  permissions?: string[];
  requestBody?: Record<string, unknown>;
  responseExample?: Record<string, unknown>;
}

interface ApiSection {
  name: string;
  icon: typeof Server;
  description: string;
  endpoints: EndpointDef[];
}

const apiSections: ApiSection[] = [
  {
    name: "Аутентификация",
    icon: Key,
    description: "JWT access/refresh токены, регистрация и авторизация",
    endpoints: [
      {
        method: "POST",
        path: "/api/auth/register",
        summary: "Регистрация нового пользователя",
        description: "Создает нового пользователя (client, courier или staff)",
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
          data: {
            accessToken: "eyJhbGciOiJIUzI1NiIs...",
            refreshToken: "eyJhbGciOiJIUzI1NiIs..."
          }
        }
      },
      {
        method: "POST",
        path: "/api/auth/login",
        summary: "Авторизация пользователя",
        description: "Возвращает JWT токены при успешной авторизации",
        auth: false,
        requestBody: {
          phone: "+79991234567",
          password: "securePassword123"
        },
        responseExample: {
          status: "success",
          message: { key: "auth.login_success", params: { userId: "uuid" } },
          data: {
            accessToken: "eyJhbGciOiJIUzI1NiIs...",
            refreshToken: "eyJhbGciOiJIUzI1NiIs..."
          }
        }
      },
      {
        method: "POST",
        path: "/api/auth/refresh",
        summary: "Обновление токена",
        description: "Обновляет access token используя refresh token",
        auth: false,
        requestBody: {
          refreshToken: "eyJhbGciOiJIUzI1NiIs..."
        },
        responseExample: {
          accessToken: "eyJhbGciOiJIUzI1NiIs...",
          refreshToken: "eyJhbGciOiJIUzI1NiIs..."
        }
      },
      {
        method: "GET",
        path: "/api/auth/me",
        summary: "Текущий пользователь",
        description: "Возвращает информацию о текущем авторизованном пользователе",
        auth: true,
        responseExample: {
          id: "uuid",
          type: "client",
          phone: "+79991234567",
          email: "user@example.com",
          status: "active",
          createdAt: "2024-01-15T10:30:00Z"
        }
      }
    ]
  },
  {
    name: "Пользователи",
    icon: Users,
    description: "Управление пользователями и ролями (ERP)",
    endpoints: [
      {
        method: "GET",
        path: "/api/users",
        summary: "Список пользователей",
        description: "Получение списка всех пользователей с фильтрацией",
        auth: true,
        permissions: ["users.read"],
        responseExample: {
          users: [
            { id: "uuid", type: "client", phone: "+79991234567", status: "active" }
          ],
          total: 100,
          page: 1,
          limit: 20
        }
      },
      {
        method: "GET",
        path: "/api/users/:id",
        summary: "Информация о пользователе",
        description: "Получение детальной информации о пользователе",
        auth: true,
        permissions: ["users.read"],
        responseExample: {
          id: "uuid",
          type: "client",
          phone: "+79991234567",
          email: "user@example.com",
          status: "active",
          roles: ["admin", "manager"],
          createdAt: "2024-01-15T10:30:00Z"
        }
      },
      {
        method: "PATCH",
        path: "/api/users/:id",
        summary: "Обновление пользователя",
        description: "Обновление данных пользователя",
        auth: true,
        permissions: ["users.manage"],
        requestBody: {
          status: "blocked",
          email: "new@example.com"
        }
      },
      {
        method: "POST",
        path: "/api/users/:id/roles",
        summary: "Назначение ролей",
        description: "Назначение ролей пользователю",
        auth: true,
        permissions: ["users.manage"],
        requestBody: {
          roleIds: ["role-uuid-1", "role-uuid-2"]
        }
      }
    ]
  },
  {
    name: "Адреса",
    icon: MapPin,
    description: "Управление адресами клиентов",
    endpoints: [
      {
        method: "GET",
        path: "/api/addresses",
        summary: "Мои адреса",
        description: "Получение списка адресов текущего пользователя",
        auth: true,
        responseExample: [
          {
            id: "uuid",
            city: "Москва",
            street: "Тверская",
            house: "10",
            apartment: "5",
            floor: 3,
            hasElevator: true,
            comment: "Код домофона 123"
          }
        ]
      },
      {
        method: "POST",
        path: "/api/addresses",
        summary: "Добавление адреса",
        description: "Добавление нового адреса",
        auth: true,
        requestBody: {
          city: "Москва",
          street: "Тверская",
          house: "10",
          apartment: "5",
          floor: 3,
          hasElevator: true,
          comment: "Код домофона 123"
        }
      },
      {
        method: "PATCH",
        path: "/api/addresses/:id",
        summary: "Обновление адреса",
        description: "Обновление существующего адреса",
        auth: true,
        requestBody: {
          comment: "Новый комментарий"
        }
      },
      {
        method: "DELETE",
        path: "/api/addresses/:id",
        summary: "Удаление адреса",
        description: "Удаление адреса",
        auth: true
      }
    ]
  },
  {
    name: "Заказы",
    icon: Package,
    description: "Создание, управление и отслеживание заказов",
    endpoints: [
      {
        method: "POST",
        path: "/api/orders",
        summary: "Создание заказа",
        description: "Создание нового заказа клиентом",
        auth: true,
        requestBody: {
          addressId: "address-uuid",
          scheduledAt: "2024-01-20T10:00:00Z",
          timeWindow: "10:00-12:00"
        },
        responseExample: {
          id: "order-uuid",
          clientId: "client-uuid",
          addressId: "address-uuid",
          status: "created",
          scheduledAt: "2024-01-20T10:00:00Z",
          timeWindow: "10:00-12:00",
          price: 500,
          createdAt: "2024-01-15T10:30:00Z"
        }
      },
      {
        method: "GET",
        path: "/api/orders",
        summary: "Список заказов",
        description: "Получение списка заказов (для клиентов - свои, для ERP - все)",
        auth: true,
        permissions: ["orders.read"],
        responseExample: {
          orders: [
            {
              id: "order-uuid",
              status: "assigned",
              scheduledAt: "2024-01-20T10:00:00Z"
            }
          ],
          total: 50
        }
      },
      {
        method: "GET",
        path: "/api/orders/:id",
        summary: "Детали заказа",
        description: "Получение полной информации о заказе",
        auth: true,
        responseExample: {
          id: "order-uuid",
          clientId: "client-uuid",
          courierId: "courier-uuid",
          address: {
            city: "Москва",
            street: "Тверская",
            house: "10"
          },
          status: "in_progress",
          events: [
            { eventType: "created", createdAt: "2024-01-15T10:30:00Z" }
          ]
        }
      },
      {
        method: "PATCH",
        path: "/api/orders/:id",
        summary: "Обновление заказа",
        description: "Обновление статуса, курьера или данных заказа",
        auth: true,
        permissions: ["orders.update_status"],
        requestBody: {
          status: "in_progress"
        }
      },
      {
        method: "POST",
        path: "/api/orders/:id/assign",
        summary: "Назначение курьера",
        description: "Назначение курьера на заказ (ERP)",
        auth: true,
        permissions: ["orders.assign"],
        requestBody: {
          courierId: "courier-uuid"
        }
      },
      {
        method: "POST",
        path: "/api/orders/:id/cancel",
        summary: "Отмена заказа",
        description: "Отмена заказа клиентом или оператором",
        auth: true,
        requestBody: {
          reason: "Причина отмены"
        }
      }
    ]
  },
  {
    name: "Курьеры",
    icon: Truck,
    description: "Профиль курьера, статус и заказы",
    endpoints: [
      {
        method: "GET",
        path: "/api/courier/profile",
        summary: "Профиль курьера",
        description: "Получение профиля текущего курьера",
        auth: true,
        responseExample: {
          courierId: "courier-uuid",
          availabilityStatus: "available",
          rating: 4.8,
          completedOrdersCount: 150,
          verificationStatus: "verified"
        }
      },
      {
        method: "PATCH",
        path: "/api/courier/profile",
        summary: "Обновление статуса",
        description: "Изменение статуса доступности курьера",
        auth: true,
        requestBody: {
          availabilityStatus: "busy"
        }
      },
      {
        method: "GET",
        path: "/api/courier/orders",
        summary: "Заказы курьера",
        description: "Получение списка назначенных заказов",
        auth: true,
        responseExample: {
          orders: [
            {
              id: "order-uuid",
              status: "assigned",
              address: { city: "Москва", street: "Тверская" },
              scheduledAt: "2024-01-20T10:00:00Z"
            }
          ]
        }
      },
      {
        method: "POST",
        path: "/api/courier/orders/:id/accept",
        summary: "Принять заказ",
        description: "Принятие назначенного заказа курьером",
        auth: true
      },
      {
        method: "POST",
        path: "/api/courier/orders/:id/complete",
        summary: "Завершить заказ",
        description: "Отметка заказа как выполненного",
        auth: true
      }
    ]
  },
  {
    name: "Роли и права",
    icon: Shield,
    description: "Управление ролями и правами доступа (ERP)",
    endpoints: [
      {
        method: "GET",
        path: "/api/roles",
        summary: "Список ролей",
        description: "Получение списка всех ролей",
        auth: true,
        permissions: ["users.manage"],
        responseExample: [
          {
            id: "role-uuid",
            name: "admin",
            description: "Полный доступ",
            permissions: ["orders.read", "orders.create"]
          }
        ]
      },
      {
        method: "POST",
        path: "/api/roles",
        summary: "Создание роли",
        description: "Создание новой роли с набором прав",
        auth: true,
        permissions: ["users.manage"],
        requestBody: {
          name: "dispatcher",
          description: "Диспетчер заказов",
          permissionIds: ["perm-uuid-1", "perm-uuid-2"]
        }
      },
      {
        method: "GET",
        path: "/api/permissions",
        summary: "Список прав",
        description: "Получение списка всех доступных прав",
        auth: true,
        permissions: ["users.manage"],
        responseExample: [
          { id: "perm-uuid", name: "orders.read", description: "Просмотр заказов" }
        ]
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

function EndpointCard({ endpoint, baseUrl }: { endpoint: EndpointDef; baseUrl: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [requestBody, setRequestBody] = useState(
    endpoint.requestBody ? JSON.stringify(endpoint.requestBody, null, 2) : ""
  );
  const [response, setResponse] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [token, setToken] = useState("");
  const [pathParams, setPathParams] = useState<Record<string, string>>({});
  const { toast } = useToast();

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
    toast({ description: "Скопировано в буфер обмена" });
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
          <span className="text-sm text-muted-foreground hidden sm:block">{endpoint.summary}</span>
          {endpoint.auth && <Badge variant="secondary" className="text-xs">Auth</Badge>}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-7 mr-2 mb-4 mt-2 space-y-4">
          <p className="text-sm text-muted-foreground">{endpoint.description}</p>
          
          {endpoint.permissions && (
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Требуемые права:</span>
              {endpoint.permissions.map(p => (
                <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
              ))}
            </div>
          )}

          <Tabs defaultValue="try" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="try" data-testid="tab-try">Тестировать</TabsTrigger>
              <TabsTrigger value="request" data-testid="tab-request">Запрос</TabsTrigger>
              <TabsTrigger value="response" data-testid="tab-response">Ответ</TabsTrigger>
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
                {isLoading ? "Отправка..." : "Отправить"}
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
                <p className="text-sm text-muted-foreground p-3">Нет тела запроса</p>
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
                <p className="text-sm text-muted-foreground p-3">Пустой ответ или 204 No Content</p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function ApiDocs() {
  const [activeSection, setActiveSection] = useState(apiSections[0].name);
  const [copied, setCopied] = useState(false);
  const baseUrl = window.location.origin;

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
              <h1 className="text-lg font-semibold">Waste Collection API</h1>
              <p className="text-xs text-muted-foreground">v1.0 • OpenAPI 3.0</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
                  key={section.name}
                  onClick={() => setActiveSection(section.name)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-left ${
                    activeSection === section.name
                      ? "bg-primary text-primary-foreground"
                      : "hover-elevate text-foreground"
                  }`}
                  data-testid={`nav-${section.name}`}
                >
                  <Icon className="h-4 w-4" />
                  {section.name}
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
                    key={section.name}
                    variant={activeSection === section.name ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveSection(section.name)}
                    data-testid={`mobile-nav-${section.name}`}
                  >
                    {section.name}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {apiSections
            .filter((s) => s.name === activeSection)
            .map((section) => (
              <div key={section.name}>
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold flex items-center gap-2">
                    <section.icon className="h-6 w-6 text-primary" />
                    {section.name}
                  </h2>
                  <p className="text-muted-foreground mt-1">{section.description}</p>
                </div>

                <Card>
                  <CardContent className="p-0 divide-y">
                    {section.endpoints.map((endpoint) => (
                      <EndpointCard
                        key={`${endpoint.method}-${endpoint.path}`}
                        endpoint={endpoint}
                        baseUrl={baseUrl}
                      />
                    ))}
                  </CardContent>
                </Card>
              </div>
            ))}

          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-lg">Интернационализация (i18n)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Поддерживаемые языки</h4>
                <div className="flex gap-2">
                  <Badge>he</Badge>
                  <Badge>ru</Badge>
                  <Badge>ar</Badge>
                  <Badge variant="outline">en (fallback)</Badge>
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-2">Заголовок Accept-Language</h4>
                <pre className="bg-muted p-3 rounded-md text-xs">Accept-Language: he</pre>
                <p className="text-sm text-muted-foreground mt-2">API возвращает заголовок Content-Language с выбранным языком</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Формат успешного ответа</h4>
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
                <h4 className="font-medium mb-2">Формат ошибки</h4>
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
                <p><strong>Принципы:</strong></p>
                <ul className="list-disc list-inside ml-2">
                  <li>API возвращает только ключи локализации, не текст</li>
                  <li>Форматирование дат/валют/чисел — на клиенте</li>
                  <li>Даты в ISO 8601: <code className="bg-muted px-1">2026-01-15T10:30:00Z</code></li>
                  <li>Деньги: <code className="bg-muted px-1">{`{ "amount": 25, "currency": "ILS" }`}</code></li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg">HTTP коды ответов</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2"><Badge variant="outline">200</Badge> <span className="text-muted-foreground">Успешный запрос</span></div>
                <div className="flex items-center gap-2"><Badge variant="outline">201</Badge> <span className="text-muted-foreground">Ресурс создан</span></div>
                <div className="flex items-center gap-2"><Badge variant="outline">204</Badge> <span className="text-muted-foreground">Нет контента (удаление)</span></div>
                <div className="flex items-center gap-2"><Badge variant="outline">400</Badge> <span className="text-muted-foreground">Неверный формат запроса</span></div>
                <div className="flex items-center gap-2"><Badge variant="outline">401</Badge> <span className="text-muted-foreground">Требуется авторизация</span></div>
                <div className="flex items-center gap-2"><Badge variant="outline">403</Badge> <span className="text-muted-foreground">Недостаточно прав</span></div>
                <div className="flex items-center gap-2"><Badge variant="outline">404</Badge> <span className="text-muted-foreground">Ресурс не найден</span></div>
                <div className="flex items-center gap-2"><Badge variant="outline">409</Badge> <span className="text-muted-foreground">Конфликт состояния</span></div>
                <div className="flex items-center gap-2"><Badge variant="outline">429</Badge> <span className="text-muted-foreground">Превышен лимит запросов</span></div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg">Модульная архитектура</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>API спроектирован для расширения без изменения существующих контрактов:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Подписки</strong> — периодичность, автогенерация заказов</li>
                <li><strong>Отзывы и рейтинг</strong> — client → courier модерация</li>
                <li><strong>Чаевые</strong> — привязка к заказу, post-completion</li>
                <li><strong>Геолокация</strong> — last known location, proximity-based</li>
                <li><strong>Финансы</strong> — начисления, выплаты, отчёты</li>
                <li><strong>Верификация курьеров</strong> — документы, статусы</li>
              </ul>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
