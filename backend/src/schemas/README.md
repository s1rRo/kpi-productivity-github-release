# Input Validation Schemas

Эта директория содержит Zod схемы для валидации всех входящих данных API.

## 🎯 Цель

Защитить приложение от:
- SQL/NoSQL Injection
- Type Confusion
- Prototype Pollution
- XSS атак
- Invalid Data

## 📁 Структура

```
schemas/
├── index.ts              # Централизованный экспорт
├── auth.schema.ts        # Схемы для аутентификации
├── habits.schema.ts      # Схемы для привычек
├── teams.schema.ts       # Схемы для команд
├── goals.schema.ts       # Схемы для целей
├── friends.schema.ts     # Схемы для друзей
└── README.md            # Эта документация
```

## 🚀 Использование

### Базовый пример

```typescript
import { Router } from 'express';
import { validateBody, createHabitSchema } from '../schemas';

const router = Router();

// Валидация body
router.post('/habits',
  validateBody(createHabitSchema),
  async (req, res) => {
    // req.body уже валидирован и типизирован!
    const habit = req.body; // TypeScript знает тип
    // ... создание привычки
  }
);
```

### Валидация query parameters

```typescript
import { validateQuery, getHabitsQuerySchema } from '../schemas';

router.get('/habits',
  validateQuery(getHabitsQuerySchema),
  async (req, res) => {
    // req.query валидирован
    const { category, limit, offset } = req.query;
    // ... получение привычек
  }
);
```

### Валидация route params

```typescript
import { validateParams, habitIdParamSchema } from '../schemas';

router.get('/habits/:id',
  validateParams(habitIdParamSchema),
  async (req, res) => {
    // req.params.id валидирован
    const { id } = req.params;
    // ... получение привычки
  }
);
```

### Комбинированная валидация (params + body)

```typescript
import { validateBodyAndParams, updateHabitSchema, habitIdParamSchema } from '../schemas';

router.put('/habits/:id',
  ...validateBodyAndParams(updateHabitSchema, habitIdParamSchema),
  async (req, res) => {
    // И params, и body валидированы
    const { id } = req.params;
    const updates = req.body;
    // ... обновление привычки
  }
);
```

## 📝 Примеры применения к существующим routes

### habits.ts - ДО

```typescript
// ❌ НЕБЕЗОПАСНО - нет валидации
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  const { name, description, targetFrequency } = req.body;
  // Любые данные могут прийти!
});
```

### habits.ts - ПОСЛЕ

```typescript
// ✅ БЕЗОПАСНО - с валидацией
import { validateBody, createHabitSchema } from '../schemas';

router.post('/',
  authenticateToken,
  validateBody(createHabitSchema),
  async (req: AuthRequest, res) => {
    const { name, description, targetFrequency } = req.body;
    // Гарантированно валидные данные!
  }
);
```

## 🛡️ Обработка ошибок

Middleware автоматически возвращает 400 Bad Request при ошибке валидации:

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "name",
      "message": "Name is required",
      "code": "too_small"
    },
    {
      "field": "email",
      "message": "Invalid email address",
      "code": "invalid_string"
    }
  ]
}
```

## 📚 Доступные схемы

### Auth
- `registerSchema` - регистрация
- `loginSchema` - вход
- `updateProfileSchema` - обновление профиля
- `changePasswordSchema` - смена пароля
- `forgotPasswordSchema` - восстановление пароля
- `resetPasswordSchema` - сброс пароля
- `verifyEmailSchema` - верификация email

### Habits
- `createHabitSchema` - создание привычки
- `updateHabitSchema` - обновление привычки
- `createHabitRecordSchema` - запись выполнения
- `createSkillTestSchema` - тест навыков
- `getHabitsQuerySchema` - параметры запроса списка

### Teams
- `createTeamSchema` - создание команды
- `updateTeamSchema` - обновление команды
- `addTeamMemberSchema` - добавление участника
- `updateMemberRoleSchema` - обновление роли
- `createTeamInvitationSchema` - создание приглашения
- `searchTeamsQuerySchema` - поиск команд

### Goals
- `createGoalSchema` - создание цели
- `updateGoalSchema` - обновление цели
- `updateGoalProgressSchema` - обновление прогресса
- `createMilestoneSchema` - создание milestone
- `getGoalsQuerySchema` - параметры запроса

### Friends
- `sendFriendRequestSchema` - отправка заявки
- `respondToFriendRequestSchema` - ответ на заявку
- `searchFriendsQuerySchema` - поиск друзей

## 🔨 Создание новых схем

### Шаблон

```typescript
import { z } from 'zod';

// 1. Создать схему
export const mySchema = z.object({
  field1: z.string().min(1).max(100),
  field2: z.number().int().positive(),
  field3: z.boolean().optional()
});

// 2. Экспортировать TypeScript тип
export type MyInput = z.infer<typeof mySchema>;
```

### Best Practices

1. **Всегда добавляйте сообщения об ошибках**
   ```typescript
   z.string().min(1, 'Name is required')
   ```

2. **Используйте строгие ограничения**
   ```typescript
   z.string().max(100)  // Предотвращает DoS атаки
   z.array(...).max(10) // Ограничивает размер массива
   ```

3. **Валидируйте форматы**
   ```typescript
   z.string().email()
   z.string().url()
   z.string().regex(/^#[0-9A-Fa-f]{6}$/)
   ```

4. **Используйте enums для ограниченных значений**
   ```typescript
   z.enum(['low', 'medium', 'high'])
   ```

5. **Добавляйте custom validation**
   ```typescript
   schema.refine(data => data.startDate < data.endDate, {
     message: 'End date must be after start date'
   })
   ```

## ✅ Checklist применения к routes

- [ ] Найти все POST/PUT/PATCH endpoints
- [ ] Создать схемы для каждого endpoint
- [ ] Добавить `validateBody()` middleware
- [ ] Добавить `validateQuery()` для GET endpoints с параметрами
- [ ] Добавить `validateParams()` для routes с динамическими параметрами
- [ ] Протестировать с невалидными данными
- [ ] Обновить типы TypeScript

## 🧪 Тестирование

```typescript
import { createHabitSchema } from './habits.schema';

describe('Habit Validation', () => {
  it('should accept valid habit', () => {
    const valid = { name: 'Test', targetFrequency: 7 };
    expect(() => createHabitSchema.parse(valid)).not.toThrow();
  });

  it('should reject invalid habit', () => {
    const invalid = { name: '', targetFrequency: -1 };
    expect(() => createHabitSchema.parse(invalid)).toThrow();
  });
});
```

## 📖 Дополнительная информация

- [Zod Documentation](https://zod.dev/)
- [OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [Express Validation Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
