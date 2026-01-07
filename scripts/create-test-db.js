#!/usr/bin/env node
/**
 * Script to create test database
 * Works on Windows, Linux, and macOS
 */

const { execSync } = require('child_process');
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:postgres@localhost:5433/postgres';
const testDbName = 'chatapp_test';

async function createTestDatabase() {
  console.log('Creating test database...');

  try {
    const client = new Client({
      connectionString,
    });

    await client.connect();

    // Check if database exists
    const result = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [testDbName]
    );

    if (result.rows.length > 0) {
      console.log(`✅ Database "${testDbName}" already exists`);
      await client.end();
      return;
    }

    // Create database
    await client.query(`CREATE DATABASE ${testDbName}`);
    console.log(`✅ Database "${testDbName}" created successfully`);
    await client.end();
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log(`✅ Database "${testDbName}" already exists`);
    } else {
      console.error('❌ Error creating database:', error.message);
      console.error('\nMake sure:');
      console.error('1. Docker containers are running: docker compose up -d');
      console.error('2. PostgreSQL is accessible at localhost:5433');
      process.exit(1);
    }
  }
}

createTestDatabase();

