# Руководство по миграции на Zod валидацию

## 🎯 Цель

Добавить валидацию входных данных ко всем API endpoints для защиты от:
- SQL/NoSQL Injection
- Type Confusion
- Prototype Pollution
- Invalid Data

## ✅ Что уже сделано

### 1. Созданы схемы валидации
- ✅ `src/schemas/auth.schema.ts` - Аутентификация (8 схем)
- ✅ `src/schemas/habits.schema.ts` - Привычки (7 схем)
- ✅ `src/schemas/teams.schema.ts` - Команды (8 схем)
- ✅ `src/schemas/goals.schema.ts` - Цели (8 схем)
- ✅ `src/schemas/friends.schema.ts` - Друзья (4 схемы)

### 2. Создан validation middleware
- ✅ `src/middleware/validation.ts`
  - `validateBody()` - валидация body
  - `validateQuery()` - валидация query params
  - `validateParams()` - валидация route params
  - `validateBodyAndParams()` - комбинированная валидация

### 3. Создана документация
- ✅ `src/schemas/README.md` - Полное руководство
- ✅ `src/schemas/index.ts` - Централизованный экспорт

## 📝 План миграции по routes

### Route: auth.ts (Приоритет 1)

**Endpoints для валидации:**
```typescript
// ❌ НЕБЕЗОПАСНЫЕ ENDPOINTS
POST   /auth/register        - нет валидации req.body
POST   /auth/login           - нет валидации req.body
POST   /auth/forgot-password - нет валидации req.body
POST   /auth/reset-password  - нет валидации req.body
PUT    /auth/profile         - нет валидации req.body
POST   /auth/change-password - нет валидации req.body
```

**Применение валидации:**
```typescript
import {
  validateBody,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  changePasswordSchema
} from '../schemas';

// Было
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body; // Небезопасно!
});

// Стало
router.post('/register',
  validateBody(registerSchema),
  async (req, res) => {
    const { email, password, name } = req.body; // Валидировано!
  }
);
```

### Route: habits.ts (Приоритет 1)

**Endpoints для валидации:**
```typescript
POST   /habits              - createHabitSchema
GET    /habits              - getHabitsQuerySchema
GET    /habits/:id          - habitIdParamSchema
PUT    /habits/:id          - updateHabitSchema + habitIdParamSchema
DELETE /habits/:id          - habitIdParamSchema
POST   /habits/:id/records  - createHabitRecordSchema + habitIdParamSchema
POST   /habits/:id/test     - createSkillTestSchema + habitIdParamSchema
```

**Пример кода:**
```typescript
import {
  validateBody,
  validateQuery,
  validateParams,
  validateBodyAndParams,
  createHabitSchema,
  updateHabitSchema,
  getHabitsQuerySchema,
  habitIdParamSchema
} from '../schemas';

// POST /habits
router.post('/',
  authenticateToken,
  validateBody(createHabitSchema),
  async (req: AuthRequest, res) => {
    // req.body валидирован
  }
);

// GET /habits?category=...
router.get('/',
  authenticateToken,
  validateQuery(getHabitsQuerySchema),
  async (req: AuthRequest, res) => {
    // req.query валидирован
  }
);

// PUT /habits/:id
router.put('/:id',
  authenticateToken,
  ...validateBodyAndParams(updateHabitSchema, habitIdParamSchema),
  async (req: AuthRequest, res) => {
    // req.body и req.params валидированы
  }
);
```

### Route: teams.ts (Приоритет 1)

**Endpoints для валидации:**
```typescript
POST   /teams                      - createTeamSchema
GET    /teams                      - searchTeamsQuerySchema
GET    /teams/:id                  - teamIdParamSchema
PUT    /teams/:id                  - updateTeamSchema + teamIdParamSchema
DELETE /teams/:id                  - teamIdParamSchema
POST   /teams/:id/members          - addTeamMemberSchema + teamIdParamSchema
PUT    /teams/:id/members/:memberId - updateMemberRoleSchema + memberIdParamSchema
POST   /teams/:id/invitations      - createTeamInvitationSchema + teamIdParamSchema
```

### Route: goals.ts (Приоритет 1)

**Endpoints для валидации:**
```typescript
POST   /goals                       - createGoalSchema
GET    /goals                       - getGoalsQuerySchema
GET    /goals/:id                   - goalIdParamSchema
PUT    /goals/:id                   - updateGoalSchema + goalIdParamSchema
DELETE /goals/:id                   - goalIdParamSchema
PUT    /goals/:id/progress          - updateGoalProgressSchema + goalIdParamSchema
POST   /goals/:id/milestones        - createMilestoneSchema + goalIdParamSchema
PUT    /goals/:id/milestones/:milestoneId - updateMilestoneSchema + milestoneIdParamSchema
```

### Route: friends.ts (Приоритет 1)

**Endpoints для валидации:**
```typescript
POST   /friends/request     - sendFriendRequestSchema
PUT    /friends/:id/respond - respondToFriendRequestSchema + friendIdParamSchema
GET    /friends             - searchFriendsQuerySchema
DELETE /friends/:id         - friendIdParamSchema
```

## 🔄 Процесс миграции

### Шаг 1: Выберите route file
```bash
# Например, начните с auth.ts
vim src/routes/auth.ts
```

### Шаг 2: Добавьте импорты
```typescript
import { validateBody, registerSchema, loginSchema, ... } from '../schemas';
```

### Шаг 3: Добавьте validation middleware
```typescript
// Для каждого POST/PUT/PATCH endpoint
router.post('/endpoint',
  validateBody(schemaName),  // ← Добавить это
  async (req, res) => { ... }
);

// Для GET endpoints с query params
router.get('/endpoint',
  validateQuery(schemaName),  // ← Добавить это
  async (req, res) => { ... }
);

// Для endpoints с route params
router.get('/endpoint/:id',
  validateParams(schemaName),  // ← Добавить это
  async (req, res) => { ... }
);
```

### Шаг 4: Удалите manual validation
```typescript
// ❌ Удалить
if (!req.body.name) {
  return res.status(400).json({ error: 'Name is required' });
}

// ✅ Validation middleware делает это автоматически
```

### Шаг 5: Протестируйте
```bash
# Запустить тесты
npm test

# Или вручную с curl/Postman
curl -X POST http://localhost:3000/api/habits \
  -H "Content-Type: application/json" \
  -d '{"name":"","targetFrequency":-1}'

# Должен вернуть 400 с деталями ошибок
```

### Шаг 6: Commit
```bash
git add src/routes/auth.ts
git commit -m "security: add input validation to auth routes (5/93 CodeQL issues)"
```

## 📊 Прогресс трекинг

### Routes миграция
- [ ] auth.ts (6 endpoints)
- [ ] habits.ts (7+ endpoints)
- [ ] teams.ts (8+ endpoints)
- [ ] goals.ts (8+ endpoints)
- [ ] friends.ts (4+ endpoints)
- [ ] invitations.ts
- [ ] analytics.ts
- [ ] users.ts

### Estimated impact
После миграции всех routes:
- ✅ Исправлено: ~15 критических проблем CodeQL
- ✅ Защита от: SQL Injection, NoSQL Injection, Type Confusion
- ✅ Улучшенная безопасность API
- ✅ Лучшая документация API (через схемы)

## 🧪 Тестирование валидации

### Создать тест файл
```typescript
// src/__tests__/validation.test.ts
import { createHabitSchema } from '../schemas/habits.schema';

describe('Habit Validation', () => {
  it('should accept valid habit data', () => {
    const validData = {
      name: 'Test Habit',
      description: 'Test description',
      targetFrequency: 7
    };

    expect(() => createHabitSchema.parse(validData)).not.toThrow();
  });

  it('should reject empty name', () => {
    const invalidData = {
      name: '',
      targetFrequency: 7
    };

    expect(() => createHabitSchema.parse(invalidData)).toThrow();
  });

  it('should reject invalid targetFrequency', () => {
    const invalidData = {
      name: 'Test',
      targetFrequency: -1
    };

    expect(() => createHabitSchema.parse(invalidData)).toThrow();
  });
});
```

### Запустить тесты
```bash
npm test -- validation.test
```

## 📚 Полезные ресурсы

- Документация схем: `src/schemas/README.md`
- Примеры использования: См. примеры выше
- Zod документация: https://zod.dev/
- OWASP Input Validation: https://owasp.org/www-project-proactive-controls/v3/en/c5-validate-inputs

## 🚨 Важные замечания

1. **НЕ удаляйте** существующую бизнес-логику валидации
   - Zod проверяет формат и тип
   - Бизнес-правила (например, уникальность email) остаются в коде

2. **Порядок middleware имеет значение**
   ```typescript
   router.post('/',
     authenticateToken,      // 1. Сначала auth
     validateBody(schema),   // 2. Потом validation
     handler                 // 3. Затем handler
   );
   ```

3. **Validated данные заменяют оригинальные**
   - После validation middleware `req.body` содержит только валидированные поля
   - Это предотвращает использование невалидированных данных

4. **Partial schemas для PATCH/PUT**
   - Используйте `.partial()` для optional updates
   - Пример: `updateHabitSchema = createHabitSchema.partial()`

## ✅ Checklist завершения

После миграции всех routes проверьте:
- [ ] Все POST/PUT/PATCH endpoints имеют `validateBody()`
- [ ] Все GET endpoints с query params имеют `validateQuery()`
- [ ] Все routes с `:id` params имеют `validateParams()`
- [ ] Тесты обновлены и проходят
- [ ] CodeQL показывает меньше проблем
- [ ] API документация обновлена

## 🎉 Результат

После завершения миграции:
- **15/93 проблем CodeQL исправлено** (Missing Input Validation)
- **Улучшенная безопасность API**
- **Автоматическая валидация всех входных данных**
- **Лучшая документация через схемы**
- **TypeScript типы из схем**

---

**Автор:** Claude Code
**Дата:** 13.01.2026
**Статус:** 🟢 Ready to use
