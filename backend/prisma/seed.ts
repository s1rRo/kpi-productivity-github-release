import { PrismaClient } from '@prisma/client';
import { DEFAULT_HABITS } from '../src/types';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create test user
  await createTestUser();

  // Check if habits already exist
  const existingHabitsCount = await prisma.habit.count();
  
  if (existingHabitsCount > 0) {
    console.log(`ℹ️  Database already has ${existingHabitsCount} habits. Skipping habits seed.`);
  } else {
    // Create default habits
    console.log('📝 Creating default habits...');
    
    const createdHabits = await prisma.habit.createMany({
      data: DEFAULT_HABITS
    });

    console.log(`✅ Successfully created ${createdHabits.count} default habits:`);
    DEFAULT_HABITS.forEach((habit, index) => {
      console.log(`   ${index + 1}. ${habit.name} (${habit.targetMinutes} min, ${habit.category}, Q${habit.eisenhowerQuadrant || 'N/A'})`);
    });
  }

  console.log('🎉 Database seeding completed!');
}

async function createTestUser() {
  console.log('👤 Creating test user...');
  
  const testEmail = 'test@example.com';
  
  // Check if test user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: testEmail }
  });

  if (existingUser) {
    console.log(`ℹ️  Test user already exists: ${testEmail}`);
    return;
  }

  // Hash password
  const hashedPassword = await bcrypt.hash('password123', 12);

  // Create test user
  const testUser = await prisma.user.create({
    data: {
      email: testEmail,
      password: hashedPassword,
      name: 'Тестовый Пользователь'
    }
  });

  console.log(`✅ Test user created successfully:`);
  console.log(`   📧 Email: ${testUser.email}`);
  console.log(`   🔑 Password: password123`);
  console.log(`   👤 Name: ${testUser.name}`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });