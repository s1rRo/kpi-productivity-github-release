import crypto from 'crypto';
import path from 'path';

/**
 * Генерирует криптографически безопасный ID
 * @param length Длина в байтах (результат будет length * 2 символов в hex)
 * @returns Hex-строка криптографически безопасного ID
 */
export function generateSecureId(length: number = 16): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Генерирует криптографически безопасный числовой код
 * @param min Минимальное значение (включительно)
 * @param max Максимальное значение (включительно)
 * @returns Строковое представление случайного числа
 */
export function generateSecureCode(min: number = 100000, max: number = 999999): string {
  return crypto.randomInt(min, max + 1).toString();
}

/**
 * Валидирует и санитизирует путь файла для предотвращения path traversal атак
 * @param userInput Путь от пользователя
 * @param baseDir Базовая директория (все пути должны быть внутри неё)
 * @param allowedExtensions Массив разрешенных расширений (например, ['.jpg', '.png'])
 * @returns Объект с результатом валидации
 */
export function sanitizeFilePath(
  userInput: string,
  baseDir: string,
  allowedExtensions: string[] = []
): { safe: boolean; path?: string; error?: string } {
  try {
    // Нормализовать путь и удалить ../ в начале
    const normalized = path.normalize(userInput).replace(/^(\.\.(\/|\\|$))+/, '');

    // Resolve к абсолютным путям
    const base = path.resolve(baseDir);
    const full = path.resolve(base, normalized);

    // Проверить, что путь начинается с baseDir + separator
    // Это предотвращает /base vs /base_malicious
    if (!full.startsWith(base + path.sep) && full !== base) {
      return { safe: false, error: 'Path traversal detected' };
    }

    // Проверить расширение если задано
    if (allowedExtensions.length > 0) {
      const ext = path.extname(full).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        return { safe: false, error: `Invalid file extension. Allowed: ${allowedExtensions.join(', ')}` };
      }
    }

    return { safe: true, path: full };
  } catch (error) {
    return { safe: false, error: 'Invalid path' };
  }
}

/**
 * Проверяет, что команда входит в whitelist разрешенных команд
 * @param command Команда для проверки
 * @param allowedCommands Массив разрешенных команд
 * @returns true если команда разрешена
 */
export function validateCommand(command: string, allowedCommands: string[]): boolean {
  return allowedCommands.includes(command);
}

/**
 * Санитизирует строку для безопасного использования в shell командах
 * ВНИМАНИЕ: Лучше использовать execFile вместо exec!
 * @param input Входная строка
 * @returns Экранированная строка
 */
export function sanitizeShellInput(input: string): string {
  // Удалить все опасные символы
  return input.replace(/[^a-zA-Z0-9_\-\.]/g, '');
}

/**
 * Хеширует пароль с использованием bcrypt
 * Примечание: bcrypt уже используется в проекте
 */
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Проверяет пароль против хеша
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(password, hash);
}
