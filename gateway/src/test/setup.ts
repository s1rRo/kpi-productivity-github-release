import { beforeAll, afterAll } from 'vitest';
import { logger } from '../utils/logger';

// Suppress logs during testing
beforeAll(() => {
  logger.silent = true;
});

afterAll(() => {
  logger.silent = false;
});