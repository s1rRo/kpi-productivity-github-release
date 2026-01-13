# План исправления 93 проблем безопасности CodeQL
**Дата:** 13.01.2026
**Проект:** KPI Productivity System
**CodeQL Alerts:** 93 проблемы

---

## 📊 Обзор найденных проблем

| Категория | Количество | Приоритет | Статус |
|-----------|------------|-----------|--------|
| **Insecure Randomness** | 13 | 🔴 Критический | Требует немедленного исправления |
| **Missing Input Validation** | ~15 | 🔴 Критический | Требует немедленного исправления |
| **Command Injection Risk** | 18 | 🟠 Высокий | Требует проверки |
| **Path Traversal Risk** | 34 | 🟠 Высокий | Требует валидации |
| **Missing Error Handling** | 3 | 🟡 Средний | Желательно исправить |
| **Other Issues** | ~10 | 🟡 Средний | Проверить детали |
| **ИТОГО** | ~93 | - | - |

---

## 🔴 КРИТИЧЕСКИЕ ПРОБЛЕМЫ (Приоритет 1)

### 1. Insecure Randomness (13 проблем)

**Проблема:** Использование `Math.random()` для генерации ID, токенов и кодов верификации.

**Риск:**
- Предсказуемая генерация ID → collision атаки
- Предсказуемые коды верификации → брутфорс
- Потенциальная возможность угадать токены

**Найденные файлы:**

#### 🔥 КРИТИЧНО: backend/src/routes/habits.ts:30
```typescript
// ❌ ПРОБЛЕМА
function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// ✅ ИСПРАВЛЕНИЕ
import crypto from 'crypto';

function generateId(): string {
  return crypto.randomBytes(16).toString('hex');
  // или использовать cuid/uuid/nanoid
}
```

#### 🔥 КРИТИЧНО: backend/src/services/inviteCodeGenerator.ts:134
```typescript
// ❌ ПРОБЛЕМА
static generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ✅ ИСПРАВЛЕНИЕ
import crypto from 'crypto';

static generateVerificationCode(): string {
  // Генерируем криптографически безопасный 6-значный код
  const num = crypto.randomInt(100000, 1000000);
  return num.toString();
}
```

#### 🟡 НИЗКИЙ ПРИОРИТЕТ: Симуляция данных (11 мест)
Файлы:
- `backend/src/services/goalInsightsService.ts:315, 329, 330`
- `backend/src/services/principlesAnalyticsService.ts:460, 548, 590`

```typescript
// Для симуляции данных можно оставить Math.random(),
// но добавить комментарий:
// SIMULATED DATA - NOT FOR SECURITY
const value = Math.random() * 100;
```

**План действий:**
1. ✅ Создать utility функцию для безопасной генерации случайных чисел
2. ✅ Заменить все критические использования Math.random()
3. ⚠️ Добавить комментарии к некритическим использованиям

---

### 2. Missing Input Validation (~15 критических мест)

**Проблема:** Прямое использование `req.body`, `req.query`, `req.params` без валидации.

**Риск:**
- SQL Injection (если есть raw SQL)
- NoSQL Injection
- Type confusion
- Prototype pollution

**Типичные паттерны:**

```typescript
// ❌ ПРОБЛЕМА
app.post('/api/habits', (req, res) => {
  const { name, description } = req.body; // Нет валидации!
  // ... использование без проверки
});

// ✅ ИСПРАВЛЕНИЕ (вариант 1: Zod)
import { z } from 'zod';

const habitSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  targetFrequency: z.number().int().min(1).max(31)
});

app.post('/api/habits', (req, res) => {
  try {
    const validated = habitSchema.parse(req.body);
    // ... использовать validated
  } catch (error) {
    return res.status(400).json({ error: 'Invalid input' });
  }
});

// ✅ ИСПРАВЛЕНИЕ (вариант 2: express-validator)
import { body, validationResult } from 'express-validator';

app.post('/api/habits',
  body('name').isString().trim().isLength({ min: 1, max: 100 }),
  body('description').optional().isString().isLength({ max: 500 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // ... безопасно использовать req.body
  }
);
```

**Файлы, требующие валидации (примеры):**
- `backend/src/routes/habits.ts` - все POST/PUT/PATCH методы
- `backend/src/routes/teams.ts` - все POST/PUT/PATCH методы
- `backend/src/routes/goals.ts` - все POST/PUT/PATCH методы
- `backend/src/routes/friends.ts` - все POST/PUT/PATCH методы
- `gateway/src/routes/*.ts` - все routes

**План действий:**
1. ✅ Установить Zod (уже установлен в frontend)
2. ✅ Создать схемы валидации для всех endpoints
3. ✅ Добавить middleware для валидации
4. ✅ Добавить централизованную обработку ошибок валидации

---

## 🟠 ВЫСОКИЙ ПРИОРИТЕТ (Приоритет 2)

### 3. Command Injection Risk (18 мест)

**Проблема:** Импорт `child_process.exec` без использования или с потенциально небезопасным использованием.

**Найденные файлы:**
- `backend/src/scripts/validateDocumentation.ts`
- `gateway/src/scripts/securityService.ts`
- `gateway/src/scripts/securityTester.ts`
- `gateway/src/scripts/securityMonitor.ts`
- `gateway/src/scripts/securityValidator.ts`
- `gateway/src/services/firewallManager.ts`
- `gateway/src/services/portManager.ts`
- И другие...

**Проверка:**
```bash
# Найти все использования exec с пользовательским вводом
grep -A 5 "exec(" backend/src gateway/src | grep -E "req\.|params|query|body"
```

**Исправление (если exec используется):**

```typescript
// ❌ ОПАСНО
import { exec } from 'child_process';

function runCommand(userInput: string) {
  exec(`ls ${userInput}`, (error, stdout) => {
    // Command injection!
  });
}

// ✅ БЕЗОПАСНО (вариант 1: execFile)
import { execFile } from 'child_process';

function runCommand(userInput: string) {
  // execFile не выполняет shell, передает аргументы напрямую
  execFile('ls', [userInput], (error, stdout) => {
    // Безопасно
  });
}

// ✅ БЕЗОПАСНО (вариант 2: whitelist + валидация)
import { exec } from 'child_process';

const ALLOWED_COMMANDS = ['status', 'info', 'help'];

function runCommand(cmd: string) {
  if (!ALLOWED_COMMANDS.includes(cmd)) {
    throw new Error('Invalid command');
  }
  exec(`myapp ${cmd}`, (error, stdout) => {
    // Безопасно, т.к. cmd из whitelist
  });
}

// ✅ ЛУЧШЕ ВСЕГО: не использовать exec вообще
// Использовать native Node.js API или библиотеки
```

**План действий:**
1. ✅ Проверить, где реально используется exec
2. ✅ Заменить exec на execFile где возможно
3. ✅ Добавить строгую валидацию/whitelist
4. ✅ Удалить неиспользуемые импорты exec

---

### 4. Path Traversal Risk (34 места)

**Проблема:** Операции с файловой системой без валидации путей.

**Найденные операции:**
- `fs.readFile()`
- `fs.writeFile()`
- `fs.appendFile()`
- `fs.readdir()`

**Риск:**
```typescript
// ❌ ОПАСНО
app.get('/file', (req, res) => {
  const filename = req.query.name; // ../../etc/passwd
  fs.readFile(`./uploads/${filename}`, (err, data) => {
    res.send(data); // Path traversal!
  });
});
```

**Исправление:**

```typescript
import path from 'path';
import fs from 'fs';

// ✅ БЕЗОПАСНО
app.get('/file', (req, res) => {
  const filename = req.query.name as string;

  // Валидация 1: Нормализовать путь
  const safePath = path.normalize(filename).replace(/^(\.\.(\/|\\|$))+/, '');

  // Валидация 2: Проверить, что путь внутри базовой директории
  const baseDir = path.resolve('./uploads');
  const fullPath = path.resolve(baseDir, safePath);

  if (!fullPath.startsWith(baseDir)) {
    return res.status(403).json({ error: 'Invalid file path' });
  }

  // Валидация 3: Whitelist расширений
  const allowedExtensions = ['.jpg', '.png', '.pdf'];
  const ext = path.extname(fullPath).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    return res.status(403).json({ error: 'Invalid file type' });
  }

  // Теперь безопасно читать
  fs.readFile(fullPath, (err, data) => {
    if (err) return res.status(404).json({ error: 'File not found' });
    res.send(data);
  });
});
```

**Utility функция:**

```typescript
// utils/pathSecurity.ts
import path from 'path';

export function sanitizeFilePath(
  userInput: string,
  baseDir: string,
  allowedExtensions: string[] = []
): { safe: boolean; path?: string; error?: string } {
  try {
    // Нормализовать путь и удалить ..
    const normalized = path.normalize(userInput).replace(/^(\.\.(\/|\\|$))+/, '');

    // Resolve к базовой директории
    const base = path.resolve(baseDir);
    const full = path.resolve(base, normalized);

    // Проверить, что внутри baseDir
    if (!full.startsWith(base)) {
      return { safe: false, error: 'Path traversal detected' };
    }

    // Проверить расширение если задано
    if (allowedExtensions.length > 0) {
      const ext = path.extname(full).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        return { safe: false, error: 'Invalid file extension' };
      }
    }

    return { safe: true, path: full };
  } catch (error) {
    return { safe: false, error: 'Invalid path' };
  }
}
```

**План действий:**
1. ✅ Создать utility функцию `sanitizeFilePath`
2. ✅ Найти все fs операции с пользовательским вводом
3. ✅ Добавить валидацию путей везде
4. ✅ Добавить тесты для path traversal

---

## 🟡 СРЕДНИЙ ПРИОРИТЕТ (Приоритет 3)

### 5. Missing Error Handling (3 места)

**Проблема:** Промисы без `.catch()` или `try/catch`.

```typescript
// ❌ ПРОБЛЕМА
someAsyncFunction()
  .then(result => {
    // обработка
  });
// Если ошибка - unhandled rejection!

// ✅ ИСПРАВЛЕНИЕ
someAsyncFunction()
  .then(result => {
    // обработка
  })
  .catch(error => {
    console.error('Error:', error);
    // обработка ошибки
  });

// ✅ ЕЩЕ ЛУЧШЕ: async/await
try {
  const result = await someAsyncFunction();
  // обработка
} catch (error) {
  console.error('Error:', error);
  // обработка ошибки
}
```

---

## 🛠️ ПЛАН РЕАЛИЗАЦИИ

### Этап 1: Подготовка (1 день)

**Задачи:**
- [ ] Создать utility модуль `backend/src/utils/security.ts`
- [ ] Добавить функции:
  - `generateSecureId()` - безопасная генерация ID
  - `generateSecureCode()` - безопасная генерация кодов
  - `sanitizeFilePath()` - валидация путей файлов
- [ ] Установить необходимые пакеты:
```bash
cd backend
npm install zod  # если еще не установлен
```

**Файл: backend/src/utils/security.ts**
```typescript
import crypto from 'crypto';
import path from 'path';

/**
 * Генерирует криптографически безопасный ID
 */
export function generateSecureId(length: number = 16): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Генерирует криптографически безопасный числовой код
 */
export function generateSecureCode(min: number = 100000, max: number = 999999): string {
  return crypto.randomInt(min, max + 1).toString();
}

/**
 * Валидирует и санитизирует путь файла
 */
export function sanitizeFilePath(
  userInput: string,
  baseDir: string,
  allowedExtensions: string[] = []
): { safe: boolean; path?: string; error?: string } {
  try {
    const normalized = path.normalize(userInput).replace(/^(\.\.(\/|\\|$))+/, '');
    const base = path.resolve(baseDir);
    const full = path.resolve(base, normalized);

    if (!full.startsWith(base)) {
      return { safe: false, error: 'Path traversal detected' };
    }

    if (allowedExtensions.length > 0) {
      const ext = path.extname(full).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        return { safe: false, error: 'Invalid file extension' };
      }
    }

    return { safe: true, path: full };
  } catch (error) {
    return { safe: false, error: 'Invalid path' };
  }
}

/**
 * Безопасное выполнение команды с whitelist
 */
export function validateCommand(command: string, allowedCommands: string[]): boolean {
  return allowedCommands.includes(command);
}
```

### Этап 2: Исправление критических проблем (2-3 дня)

**2.1. Заменить Math.random() (2 часа)**

Файлы для изменения:
- [ ] `backend/src/routes/habits.ts:30` - заменить generateId()
- [ ] `backend/src/services/inviteCodeGenerator.ts:134` - заменить generateVerificationCode()
- [ ] Добавить комментарии к некритическим использованиям

**2.2. Добавить валидацию входных данных (1-2 дня)**

Создать схемы Zod для каждого route:
- [ ] `backend/src/schemas/habits.schema.ts`
- [ ] `backend/src/schemas/teams.schema.ts`
- [ ] `backend/src/schemas/goals.schema.ts`
- [ ] `backend/src/schemas/friends.schema.ts`

Пример схемы:
```typescript
// backend/src/schemas/habits.schema.ts
import { z } from 'zod';

export const createHabitSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  targetFrequency: z.number().int().min(1).max(31),
  targetType: z.enum(['daily', 'weekly', 'monthly']),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional()
});

export const updateHabitSchema = createHabitSchema.partial();

export type CreateHabitInput = z.infer<typeof createHabitSchema>;
export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;
```

Middleware для валидации:
```typescript
// backend/src/middleware/validate.ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }
  };
};
```

Применение:
```typescript
// backend/src/routes/habits.ts
import { validate } from '../middleware/validate';
import { createHabitSchema, updateHabitSchema } from '../schemas/habits.schema';

router.post('/', validate(createHabitSchema), async (req, res) => {
  // req.body теперь валидирован!
});

router.put('/:id', validate(updateHabitSchema), async (req, res) => {
  // req.body теперь валидирован!
});
```

### Этап 3: Исправление проблем высокого приоритета (1-2 дня)

**3.1. Проверить и исправить использование exec (4 часа)**
- [ ] Найти реальные использования exec
- [ ] Заменить на execFile или добавить whitelist
- [ ] Удалить неиспользуемые импорты

**3.2. Добавить валидацию путей файлов (4 часа)**
- [ ] Найти все fs операции
- [ ] Применить sanitizeFilePath()
- [ ] Добавить тесты

### Этап 4: Тестирование (1 день)

- [ ] Запустить все тесты
- [ ] Запустить CodeQL локально (если возможно)
- [ ] Проверить работу всех endpoints
- [ ] Проверить что ничего не сломалось

### Этап 5: Документация и deploy (0.5 дня)

- [ ] Обновить документацию по безопасности
- [ ] Создать CHANGELOG
- [ ] Закоммитить изменения
- [ ] Создать PR
- [ ] Дождаться прохождения CodeQL на GitHub

---

## 📋 QUICK START - Начните отсюда!

### Шаг 1: Создайте utility модуль (5 минут)

```bash
# Создать файл
cat > backend/src/utils/security.ts << 'EOF'
import crypto from 'crypto';
import path from 'path';

export function generateSecureId(length: number = 16): string {
  return crypto.randomBytes(length).toString('hex');
}

export function generateSecureCode(min: number = 100000, max: number = 999999): string {
  return crypto.randomInt(min, max + 1).toString();
}

export function sanitizeFilePath(
  userInput: string,
  baseDir: string,
  allowedExtensions: string[] = []
): { safe: boolean; path?: string; error?: string } {
  try {
    const normalized = path.normalize(userInput).replace(/^(\.\.(\/|\\|$))+/, '');
    const base = path.resolve(baseDir);
    const full = path.resolve(base, normalized);

    if (!full.startsWith(base + path.sep)) {
      return { safe: false, error: 'Path traversal detected' };
    }

    if (allowedExtensions.length > 0) {
      const ext = path.extname(full).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        return { safe: false, error: 'Invalid file extension' };
      }
    }

    return { safe: true, path: full };
  } catch (error) {
    return { safe: false, error: 'Invalid path' };
  }
}
EOF
```

### Шаг 2: Исправьте 2 критические проблемы (10 минут)

```bash
# 1. Исправить habits.ts
sed -i 's/Math.random().toString(36).substring(2) + Date.now().toString(36)/generateSecureId()/g' backend/src/routes/habits.ts

# Добавить импорт
sed -i '1i import { generateSecureId } from '"'"'../utils/security'"'"';' backend/src/routes/habits.ts

# 2. Исправить inviteCodeGenerator.ts
# (требует ручного редактирования)
```

### Шаг 3: Запустите тесты

```bash
npm test
```

### Шаг 4: Закоммитьте изменения

```bash
git add .
git commit -m "security: fix critical security issues (Math.random, input validation)"
git push
```

---

## 📊 ПРОГРЕСС ТРЕКИНГ

### Критические (13 + 15 = 28)
- [ ] 0/13 Insecure Randomness исправлено
- [ ] 0/15 Missing Input Validation исправлено

### Высокий приоритет (18 + 34 = 52)
- [ ] 0/18 Command Injection проверено
- [ ] 0/34 Path Traversal исправлено

### Средний приоритет (3)
- [ ] 0/3 Missing Error Handling исправлено

### Остальные (~10)
- [ ] 0/10 Прочие проблемы проверены

**ИТОГО: 0/93 исправлено**

---

## 🔗 Полезные ссурсы

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [CodeQL JavaScript Queries](https://codeql.github.com/codeql-query-help/javascript/)
- [Zod Documentation](https://zod.dev/)
- [crypto.randomInt()](https://nodejs.org/api/crypto.html#cryptorandomintmin-max-callback)

---

**Автор:** Claude Code
**Дата:** 13.01.2026
**Статус:** 🔴 Требует немедленного действия
