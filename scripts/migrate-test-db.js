#!/usr/bin/env node
/**
 * Script to run migrations on test database
 * Works on Windows, Linux, and macOS
 */

const { execSync } = require('child_process');

const testDatabaseUrl =
  'postgresql://postgres:postgres@localhost:5433/chatapp_test?schema=public';

console.log('Running migrations on test database...');

try {
  // Set environment variables and run prisma migrate deploy
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = testDatabaseUrl;

  execSync('pnpm prisma migrate deploy', {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl,
    },
  });

  console.log('✅ Test database migrations completed');
} catch (error) {
  console.error('❌ Error running migrations:', error.message);
  console.error('\nMake sure:');
  console.error('1. Test database exists: pnpm test:db:setup');
  console.error('2. Docker containers are running: docker compose up -d');
  process.exit(1);
}

