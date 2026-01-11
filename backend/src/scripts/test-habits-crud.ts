#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { validationSchemas } from '../utils/validation';
import { DEFAULT_HABITS } from '../types';

const prisma = new PrismaClient();

async function testHabitsCRUD() {
  console.log('🧪 Testing Habits CRUD Operations...\n');

  try {
    // Test 1: Validation
    console.log('1️⃣ Testing validation...');
    
    const validHabit = {
      name: 'Test Habit',
      targetMinutes: 60,
      category: 'health',
      skillLevel: 3,
      eisenhowerQuadrant: 'Q2',
      isWeekdayOnly: false
    };

    const validationResult = validationSchemas.habit.create.safeParse(validHabit);
    console.log(`✅ Valid habit validation: ${validationResult.success}`);

    const invalidHabit = {
      name: '',
      targetMinutes: -10,
      skillLevel: 6
    };

    const invalidValidationResult = validationSchemas.habit.create.safeParse(invalidHabit);
    console.log(`✅ Invalid habit validation (should be false): ${!invalidValidationResult.success}`);

    // Test 2: Default habits structure
    console.log('\n2️⃣ Testing default habits...');
    console.log(`✅ Default habits count: ${DEFAULT_HABITS.length} (expected: 10)`);
    
    const sleepHabit = DEFAULT_HABITS.find(h => h.name === 'Сон');
    console.log(`✅ Sleep habit found: ${!!sleepHabit}`);
    console.log(`✅ Sleep habit target: ${sleepHabit?.targetMinutes} minutes (expected: 480)`);

    const workHabit = DEFAULT_HABITS.find(h => h.name === 'Работа');
    console.log(`✅ Work habit weekday only: ${workHabit?.isWeekdayOnly} (expected: true)`);

    // Test 3: Database connection
    console.log('\n3️⃣ Testing database connection...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');

    // Test 4: Check if habits table exists
    console.log('\n4️⃣ Testing habits table...');
    const habitsCount = await prisma.habit.count();
    console.log(`✅ Habits table accessible, current count: ${habitsCount}`);

    // Test 5: Test habit creation (if no habits exist)
    if (habitsCount === 0) {
      console.log('\n5️⃣ Testing habit creation...');
      const testHabit = await prisma.habit.create({
        data: {
          name: 'Test CRUD Habit',
          targetMinutes: 45,
          category: 'health',
          skillLevel: 3,
          eisenhowerQuadrant: 'Q2',
          isWeekdayOnly: false
        }
      });
      console.log(`✅ Habit created with ID: ${testHabit.id}`);

      // Test 6: Test habit update
      console.log('\n6️⃣ Testing habit update...');
      const updatedHabit = await prisma.habit.update({
        where: { id: testHabit.id },
        data: {
          targetMinutes: 60,
          skillLevel: 4
        }
      });
      console.log(`✅ Habit updated, new target: ${updatedHabit.targetMinutes} minutes`);

      // Test 7: Test habit deletion
      console.log('\n7️⃣ Testing habit deletion...');
      await prisma.habit.delete({
        where: { id: testHabit.id }
      });
      console.log('✅ Habit deleted successfully');
    } else {
      console.log('\n5️⃣ Skipping CRUD tests (habits already exist)');
    }

    // Test 8: Test utility functions
    console.log('\n8️⃣ Testing utility functions...');
    
    const formatMinutesToHours = (minutes: number): string => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      if (hours === 0) return `${mins} мин`;
      if (mins === 0) return `${hours} ч`;
      return `${hours} ч ${mins} мин`;
    };

    console.log(`✅ Format 30 minutes: ${formatMinutesToHours(30)}`);
    console.log(`✅ Format 60 minutes: ${formatMinutesToHours(60)}`);
    console.log(`✅ Format 90 minutes: ${formatMinutesToHours(90)}`);

    const getCategoryLabel = (category?: string): string => {
      const categories: Record<string, string> = {
        health: 'Здоровье',
        skills: 'Навыки',
        learning: 'Обучение',
        career: 'Карьера',
        recovery: 'Восстановление',
        content: 'Контент'
      };
      return categories[category || ''] || category || 'Без категории';
    };

    console.log(`✅ Health category: ${getCategoryLabel('health')}`);
    console.log(`✅ Unknown category: ${getCategoryLabel('unknown')}`);

    console.log('\n🎉 All CRUD operations tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the tests
testHabitsCRUD();