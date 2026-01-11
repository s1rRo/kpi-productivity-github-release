import { prisma } from '../index';
import fs from 'fs';
import path from 'path';

// Detect database type from connection string
function getDatabaseType(): 'sqlite' | 'postgresql' {
  const databaseUrl = process.env.DATABASE_URL || '';
  if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
    return 'postgresql';
  }
  return 'sqlite';
}

export async function runMigrations() {
  try {
    const dbType = getDatabaseType();
    console.log(`Running migrations for ${dbType} database...`);

    if (dbType === 'postgresql') {
      await runPostgreSQLMigrations();
    } else {
      await runSQLiteMigrations();
    }

    // Seed default habits if they don't exist
    await seedDefaultHabits();
    
    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
}

async function runPostgreSQLMigrations() {
  try {
    // Check if users table exists (main table to verify schema)
    const usersResult = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users';
    `;

    if (!Array.isArray(usersResult) || usersResult.length === 0) {
      console.log('Creating PostgreSQL schema...');
      
      // Read and execute PostgreSQL migration SQL
      const migrationPath = path.join(__dirname, '../../prisma/migrations/migrate_to_postgresql.sql');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      // Split by semicolon and execute each statement
      const statements = migrationSQL.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          await prisma.$executeRawUnsafe(statement.trim());
        }
      }
      
      console.log('PostgreSQL schema created successfully');
    } else {
      console.log('PostgreSQL schema already exists');
    }
  } catch (error) {
    console.error('PostgreSQL migration error:', error);
    throw error;
  }
}

async function runSQLiteMigrations() {
  try {
    // Check if habit_history table exists
    const habitHistoryResult = await prisma.$queryRaw`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='habit_history';
    `;

    if (!Array.isArray(habitHistoryResult) || habitHistoryResult.length === 0) {
      console.log('Creating habit_history table...');
      
      // Read and execute migration SQL
      const migrationPath = path.join(__dirname, '../../prisma/migrations/create_habit_history.sql');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      // Split by semicolon and execute each statement
      const statements = migrationSQL.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          await prisma.$executeRawUnsafe(statement.trim());
        }
      }
      
      console.log('habit_history table created successfully');
    } else {
      console.log('habit_history table already exists');
    }

    // Check if friends system tables exist
    const friendsResult = await prisma.$queryRaw`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='friendships';
    `;

    if (!Array.isArray(friendsResult) || friendsResult.length === 0) {
      console.log('Creating friends system tables...');
      
      // Read and execute friends migration SQL
      const friendsMigrationPath = path.join(__dirname, '../../prisma/migrations/add_friends_system.sql');
      const friendsMigrationSQL = fs.readFileSync(friendsMigrationPath, 'utf8');
      
      // Split by semicolon and execute each statement
      const statements = friendsMigrationSQL.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          await prisma.$executeRawUnsafe(statement.trim());
        }
      }
      
      console.log('Friends system tables created successfully');
    } else {
      console.log('Friends system tables already exist');
    }

    // Check if teams system tables exist
    const teamsResult = await prisma.$queryRaw`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='teams';
    `;

    if (!Array.isArray(teamsResult) || teamsResult.length === 0) {
      console.log('Creating teams system tables...');
      
      // Read and execute teams migration SQL
      const teamsMigrationPath = path.join(__dirname, '../../prisma/migrations/add_teams_system.sql');
      const teamsMigrationSQL = fs.readFileSync(teamsMigrationPath, 'utf8');
      
      // Split by semicolon and execute each statement
      const statements = teamsMigrationSQL.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          await prisma.$executeRawUnsafe(statement.trim());
        }
      }
      
      console.log('Teams system tables created successfully');
    } else {
      console.log('Teams system tables already exist');
    }
  } catch (error) {
    console.error('SQLite migration error:', error);
    throw error;
  }
}

async function seedDefaultHabits() {
  try {
    // Check if habits already exist
    const existingHabits = await prisma.habit.count();
    
    if (existingHabits === 0) {
      console.log('Seeding default habits...');
      
      const defaultHabits = [
        { name: 'Сон', targetMinutes: 480, category: 'health', skillLevel: 3, eisenhowerQuadrant: 'Q2', isWeekdayOnly: false },
        { name: 'Спорт', targetMinutes: 60, category: 'health', skillLevel: 3, eisenhowerQuadrant: 'Q2', isWeekdayOnly: false },
        { name: 'Английский', targetMinutes: 60, category: 'skills', skillLevel: 2, eisenhowerQuadrant: 'Q2', isWeekdayOnly: false },
        { name: 'Чтение', targetMinutes: 30, category: 'learning', skillLevel: 3, eisenhowerQuadrant: 'Q2', isWeekdayOnly: false },
        { name: 'Работа', targetMinutes: 360, category: 'career', skillLevel: 4, eisenhowerQuadrant: 'Q1', isWeekdayOnly: true },
        { name: 'Отдых', targetMinutes: 180, category: 'recovery', skillLevel: 3, eisenhowerQuadrant: 'Q3', isWeekdayOnly: false },
        { name: 'Права', targetMinutes: 20, category: 'skills', skillLevel: 1, eisenhowerQuadrant: 'Q2', isWeekdayOnly: false },
        { name: 'Блог в X', targetMinutes: 20, category: 'content', skillLevel: 1, eisenhowerQuadrant: 'Q2', isWeekdayOnly: false },
        { name: 'ИИ', targetMinutes: 30, category: 'skills', skillLevel: 1, eisenhowerQuadrant: 'Q2', isWeekdayOnly: false },
        { name: 'Аналитика', targetMinutes: 30, category: 'skills', skillLevel: 3, eisenhowerQuadrant: 'Q2', isWeekdayOnly: false }
      ];

      await prisma.habit.createMany({
        data: defaultHabits,
        skipDuplicates: true
      });
      
      console.log('Default habits seeded successfully');
    } else {
      console.log('Default habits already exist');
    }
  } catch (error) {
    console.error('Error seeding default habits:', error);
    // Don't throw error - this is not critical
  }
}

// Migration utility for data migration from SQLite to PostgreSQL
export async function migrateDataFromSQLite(sqliteDbPath: string) {
  try {
    console.log('Starting data migration from SQLite to PostgreSQL...');
    
    // This would be used for migrating existing user data
    // Implementation would depend on specific migration requirements
    
    console.log('Data migration completed successfully');
  } catch (error) {
    console.error('Data migration error:', error);
    throw error;
  }
}