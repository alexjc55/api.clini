# Руководство по миграции базы данных

## Обзор

Этот документ описывает процесс безопасного переноса и обновления базы данных на сторонних серверах без потери существующих данных.

## ВАЖНО: Источник схемы

**Единственный источник истины для схемы БД:** `server/database/schema.ts`

При генерации миграций **ВСЕГДА** указывайте путь к схеме явно:

```bash
npx drizzle-kit generate --dialect=postgresql --schema=./server/database/schema.ts --out=./migrations
```

> **Внимание:** Файл `drizzle.config.ts` может указывать на другой путь. Всегда используйте параметр `--schema=./server/database/schema.ts` в командной строке для гарантии корректной генерации миграций.

## Предупреждение о `drizzle-kit push`

> **НИКОГДА не используйте `drizzle-kit push` на production базе с существующими данными!**
> 
> Команда `push` может удалить колонки или таблицы для синхронизации схемы. Используйте только инкрементальные миграции через `scripts/migrate.ts`.

## Переход с `drizzle-kit push` на миграции

Если база данных была создана через `drizzle-kit push` (как в среде разработки), необходимо зарегистрировать начальную миграцию как уже применённую:

```bash
# 1. Создайте таблицу отслеживания миграций
psql $DATABASE_URL -c "CREATE TABLE IF NOT EXISTS __drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash TEXT NOT NULL,
  created_at BIGINT
);"

# 2. Найдите имя начальной миграции
ls migrations/

# 3. Зарегистрируйте её как применённую (замените имя файла)
psql $DATABASE_URL -c "INSERT INTO __drizzle_migrations (hash, created_at) 
VALUES ('0000_thick_redwing', $(date +%s000));"

# Теперь последующие миграции будут применяться корректно
```

## Структура файлов

```
├── docs/
│   └── database-schema.sql    # Полный дамп схемы БД (только структура)
├── migrations/
│   └── *.sql                  # Инкрементальные миграции Drizzle
├── scripts/
│   └── migrate.ts             # Скрипт безопасного применения миграций
└── server/database/
    └── schema.ts              # Drizzle ORM схема (источник истины)
```

## Способы развёртывания

### Способ 1: Чистая установка (новый сервер)

Для нового сервера без существующих данных:

```bash
# 1. Установите зависимости
npm install

# 2. Установите DATABASE_URL
export DATABASE_URL="postgresql://user:password@host:5432/dbname"

# 3. Примените полную схему напрямую
psql $DATABASE_URL < docs/database-schema.sql

# Или используйте Drizzle push (создаёт схему без миграций)
npx drizzle-kit push --dialect=postgresql --schema=./server/database/schema.ts --url=$DATABASE_URL
```

### Способ 2: Инкрементальные миграции (production сервер с данными)

Для обновления существующей БД без потери данных:

```bash
# 1. ОБЯЗАТЕЛЬНО: Создайте резервную копию
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Установите DATABASE_URL
export DATABASE_URL="postgresql://user:password@host:5432/dbname"

# 3. Проверьте какие миграции ещё не применены
npx drizzle-kit status --dialect=postgresql --schema=./server/database/schema.ts --url=$DATABASE_URL

# 4. Примените миграции
npx tsx scripts/migrate.ts
```

## Как работают миграции Drizzle

### Таблица отслеживания
Drizzle создаёт таблицу `__drizzle_migrations` для отслеживания применённых миграций:

```sql
SELECT * FROM __drizzle_migrations;
```

### Генерация новых миграций

При изменении схемы в `server/database/schema.ts`:

```bash
# Сгенерировать SQL миграцию
npx drizzle-kit generate --dialect=postgresql --schema=./server/database/schema.ts --out=./migrations

# Проверить сгенерированный SQL перед применением
cat migrations/XXXX_*.sql
```

### Применение миграций

```bash
# Через скрипт (рекомендуется)
npx tsx scripts/migrate.ts

# Или через drizzle-kit
npx drizzle-kit migrate --dialect=postgresql --schema=./server/database/schema.ts --url=$DATABASE_URL
```

## Безопасность данных

### Перед любыми миграциями

1. **Создайте полный бэкап:**
   ```bash
   pg_dump $DATABASE_URL > backup_full.sql
   ```

2. **Создайте бэкап только данных:**
   ```bash
   pg_dump --data-only $DATABASE_URL > backup_data.sql
   ```

3. **Проверьте миграцию на тестовой БД:**
   ```bash
   # Создайте копию production БД
   createdb test_migration
   pg_dump $PRODUCTION_URL | psql postgresql://localhost/test_migration
   
   # Примените миграции на копии
   DATABASE_URL=postgresql://localhost/test_migration npx tsx scripts/migrate.ts
   ```

### Откат миграций

Drizzle не поддерживает автоматический откат. При необходимости:

1. Восстановите из бэкапа:
   ```bash
   psql $DATABASE_URL < backup_full.sql
   ```

2. Или напишите ручной откат:
   ```sql
   -- Пример отката добавления колонки
   ALTER TABLE users DROP COLUMN new_column;
   DELETE FROM __drizzle_migrations WHERE hash = 'migration_hash';
   ```

## Типичные сценарии

### Добавление новой колонки

```typescript
// schema.ts - добавляем поле
export const users = pgTable("users", {
  // ... существующие поля
  newField: varchar("new_field", { length: 100 }),  // nullable по умолчанию
});
```

```bash
npx drizzle-kit generate --dialect=postgresql --schema=./server/database/schema.ts --out=./migrations
# Проверьте сгенерированный SQL
# Примените миграцию
```

### Добавление обязательной колонки

```typescript
// 1. Сначала добавьте как nullable
newField: varchar("new_field", { length: 100 }),

// 2. После миграции заполните данные
// UPDATE users SET new_field = 'default_value' WHERE new_field IS NULL;

// 3. Затем сделайте NOT NULL
newField: varchar("new_field", { length: 100 }).notNull(),
```

### Переименование таблицы/колонки

⚠️ Drizzle интерпретирует это как DROP + CREATE. Вместо этого:

```sql
-- Создайте ручную миграцию
ALTER TABLE old_name RENAME TO new_name;
ALTER TABLE table_name RENAME COLUMN old_column TO new_column;
```

## Обновление дампа схемы

После применения миграций обновите дамп:

```bash
pg_dump --schema-only $DATABASE_URL > docs/database-schema.sql
```

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NODE_ENV` | `production` для SSL соединения |

## Контрольный список перед миграцией

- [ ] Создан полный бэкап БД
- [ ] Миграция протестирована на копии БД
- [ ] Проверен сгенерированный SQL
- [ ] Подготовлен план отката
- [ ] Уведомлены пользователи о возможном простое
- [ ] Доступ к production серверу подтверждён
