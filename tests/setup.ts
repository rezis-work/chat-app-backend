import { config } from 'dotenv';
import { resolve } from 'path';
import { prisma } from '../src/db/prisma';

// Set NODE_ENV to test if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// Load test-specific environment variables from .env.test
// Falls back to .env if .env.test doesn't exist
config({ path: resolve(__dirname, '../.env.test') });
config({ path: resolve(__dirname, '../.env') }); // Fallback to .env

// Clean up database before all tests
beforeAll(async () => {
  // Verify we're using test database (safety check)
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl.includes('test') && process.env.NODE_ENV === 'test') {
    console.warn(
      '⚠️  WARNING: Tests are not using a test database! Current DATABASE_URL does not contain "test".'
    );
    console.warn(
      '   Consider creating .env.test with DATABASE_URL pointing to chatapp_test'
    );
  }

  // Clean up test data
  await prisma.message.deleteMany();
  await prisma.chatMember.deleteMany();
  await prisma.dmChat.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.session.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.dmRequest.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.userBlock.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.user.deleteMany();
});

// Clean up after each test
afterEach(async () => {
  await prisma.message.deleteMany();
  await prisma.chatMember.deleteMany();
  await prisma.dmChat.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.session.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.dmRequest.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.userBlock.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.user.deleteMany();

  // Clear sent emails in test mode
  if (process.env.NODE_ENV === 'test') {
    const { __clearSentEmails } = await import('../src/modules/email/email.service');
    __clearSentEmails();
  }
});

// Close Prisma connection after all tests
afterAll(async () => {
  await prisma.$disconnect();
  // Give time for connections to close
  await new Promise(resolve => setTimeout(resolve, 1000));
});
