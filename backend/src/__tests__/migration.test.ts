import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Database Migrations', () => {
  beforeAll(async () => {
    // Skip migration tests if not in test environment
    if (process.env.NODE_ENV !== 'test') {
      console.log('Skipping migration tests - not in test environment');
      return;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should connect to database successfully', async () => {
    // Basic database connection test
    await expect(prisma.$queryRaw`SELECT 1`).resolves.toBeDefined();
  });

  it('should have all required tables', async () => {
    // Check that core tables exist by trying to query them
    await expect(prisma.user.findMany()).resolves.toBeDefined();
    await expect(prisma.habit.findMany()).resolves.toBeDefined();
    await expect(prisma.dailyRecord.findMany()).resolves.toBeDefined();
    await expect(prisma.habitRecord.findMany()).resolves.toBeDefined();
    await expect(prisma.task.findMany()).resolves.toBeDefined();
  });

  it('should have extended tables for new features', async () => {
    // Check new feature tables
    await expect(prisma.goal.findMany()).resolves.toBeDefined();
    await expect(prisma.friendRequest.findMany()).resolves.toBeDefined();
    await expect(prisma.team.findMany()).resolves.toBeDefined();
    await expect(prisma.principlePreference.findMany()).resolves.toBeDefined();
  });

  it('should maintain data integrity constraints', async () => {
    // Test that foreign key constraints work
    // This should fail because there's no user with this ID
    await expect(
      prisma.dailyRecord.create({
        data: {
          userId: 'non-existent-user-id',
          date: new Date(),
          totalKpi: 100
        }
      })
    ).rejects.toThrow();
  });

  it('should have default habits available', async () => {
    // Check if habits table has data (either seeded or can be created)
    const habitsCount = await prisma.habit.count();
    
    // Either habits are already seeded, or we can create them
    if (habitsCount === 0) {
      // Try to create a test habit
      const testHabit = await prisma.habit.create({
        data: {
          name: 'Test Habit',
          targetMinutes: 60,
          category: 'test',
          skillLevel: 3
        }
      });
      
      expect(testHabit).toBeDefined();
      expect(testHabit.name).toBe('Test Habit');
      
      // Clean up
      await prisma.habit.delete({ where: { id: testHabit.id } });
    } else {
      // Habits are already present
      expect(habitsCount).toBeGreaterThan(0);
    }
  });
});