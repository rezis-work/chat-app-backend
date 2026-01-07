import request from 'supertest';
import { createApp } from '../src/server';
import { prisma } from '../src/db/prisma';
import { __getSentEmails } from '../src/modules/email/email.service';
import { hashToken } from '../src/utils/crypto';

const app = createApp();

describe('Email Service', () => {
  describe('Fake Email Provider (Test Mode)', () => {
    it('should store emails in memory in test mode', async () => {
      const { sendVerificationEmail } = await import('../src/modules/email/email.service');
      
      await sendVerificationEmail('test@example.com', 'test-token-123');
      
      const sentEmails = __getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe('test@example.com');
      expect(sentEmails[0].subject).toBe('Verify your email address');
      expect(sentEmails[0].html).toContain('test-token-123');
      expect(sentEmails[0].text).toContain('test-token-123');
    });

    it('should clear sent emails', async () => {
      const { sendVerificationEmail, __clearSentEmails } = await import('../src/modules/email/email.service');
      
      await sendVerificationEmail('test@example.com', 'test-token');
      expect(__getSentEmails()).toHaveLength(1);
      
      __clearSentEmails();
      expect(__getSentEmails()).toHaveLength(0);
    });
  });
});

describe('Email Verification Flow', () => {
  const testUser = {
    email: 'verify@example.com',
    password: 'TestPassword123!',
    displayName: 'Test User',
  };

  beforeEach(async () => {
    // Clear emails first
    const emailService = await import('../src/modules/email/email.service');
    emailService.__clearSentEmails();
    
    // Clear database (order matters - delete children first)
    await prisma.session.deleteMany();
    await prisma.emailVerificationToken.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.userSettings.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('POST /auth/register', () => {
    it('should send verification email on registration', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.emailVerifiedAt).toBeNull();

      // Check email was sent
      const sentEmails = __getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe(testUser.email);
      expect(sentEmails[0].subject).toBe('Verify your email address');
      expect(sentEmails[0].html).toContain('verify-email');
      expect(sentEmails[0].html).toContain('token=');
    });
  });

  describe('POST /auth/verify-email', () => {
    let verificationToken: string;
    let userId: string;

    beforeEach(async () => {
      // Clear emails first
      const { __clearSentEmails } = await import('../src/modules/email/email.service');
      __clearSentEmails();
      
      // Register user
      const registerResponse = await request(app)
        .post('/auth/register')
        .send(testUser);
      
      userId = registerResponse.body.user.id;
      
      // Get token from test response (available in test mode)
      if (registerResponse.body.verificationToken) {
        verificationToken = registerResponse.body.verificationToken;
      } else {
        // Fallback: get token from sent email HTML
        const sentEmails = __getSentEmails();
        if (sentEmails.length > 0) {
          const emailContent = sentEmails[0].html;
          const tokenMatch = emailContent.match(/token=([a-f0-9]{64})/);
          verificationToken = tokenMatch ? tokenMatch[1] : '';
        } else {
          throw new Error('Could not extract verification token');
        }
      }
    });

    it('should verify email and set emailVerifiedAt', async () => {
      // Ensure token is valid
      if (!verificationToken) {
        throw new Error('Verification token is missing');
      }
      
      // Ensure user exists before verification
      const userBeforeVerify = await prisma.user.findUnique({
        where: { id: userId },
      });
      if (!userBeforeVerify) {
        throw new Error('User does not exist before verification');
      }
      
      const response = await request(app)
        .post('/auth/verify-email')
        .send({ token: verificationToken })
        .expect(200);

      expect(response.body).toEqual({ ok: true });

      // Verify user emailVerifiedAt is set
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      expect(user).not.toBeNull();
      expect(user?.emailVerifiedAt).not.toBeNull();
      expect(user?.emailVerifiedAt).toBeInstanceOf(Date);

      // Verify token is deleted
      const tokenRecord = await prisma.emailVerificationToken.findFirst({
        where: { userId },
      });
      expect(tokenRecord).toBeNull();
    });

    it('should return 401 for invalid token', async () => {
      await request(app)
        .post('/auth/verify-email')
        .send({ token: 'invalid-token' })
        .expect(401);
    });

    it('should return 401 for expired token', async () => {
      // Create expired token
      const expiredToken = 'expired-token-123';
      const expiredTokenHash = hashToken(expiredToken);
      const expiredDate = new Date();
      expiredDate.setHours(expiredDate.getHours() - 25); // 25 hours ago

      await prisma.emailVerificationToken.create({
        data: {
          userId,
          tokenHash: expiredTokenHash,
          expiresAt: expiredDate,
        },
      });

      await request(app)
        .post('/auth/verify-email')
        .send({ token: expiredToken })
        .expect(401);
    });
  });

  describe('POST /auth/resend-verification', () => {
    beforeEach(async () => {
      // Register user
      await request(app).post('/auth/register').send(testUser);
    });

    it('should resend verification email', async () => {
      const { __clearSentEmails } = await import('../src/modules/email/email.service');
      __clearSentEmails();

      const response = await request(app)
        .post('/auth/resend-verification')
        .send({ email: testUser.email })
        .expect(200);

      expect(response.body).toEqual({ ok: true });

      // Check email was sent
      const sentEmails = __getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe(testUser.email);
      expect(sentEmails[0].subject).toBe('Verify your email address');
    });

    it('should return OK for unknown email (no enumeration)', async () => {
      const { __clearSentEmails } = await import('../src/modules/email/email.service');
      __clearSentEmails(); // Clear emails from beforeEach registration

      const response = await request(app)
        .post('/auth/resend-verification')
        .send({ email: 'unknown@example.com' })
        .expect(200);

      expect(response.body).toEqual({ ok: true });

      // No email should be sent
      const sentEmails = __getSentEmails();
      expect(sentEmails).toHaveLength(0);
    });

    it('should delete old tokens when resending', async () => {
      // Get initial token count
      const initialTokens = await prisma.emailVerificationToken.count({
        where: { userId: (await prisma.user.findUnique({ where: { email: testUser.email } }))?.id },
      });
      expect(initialTokens).toBe(1);

      // Resend verification
      await request(app)
        .post('/auth/resend-verification')
        .send({ email: testUser.email })
        .expect(200);

      // Should still have only 1 token (old deleted, new created)
      const user = await prisma.user.findUnique({ where: { email: testUser.email } });
      const tokenCount = await prisma.emailVerificationToken.count({
        where: { userId: user?.id },
      });
      expect(tokenCount).toBe(1);
    });

    it('should not resend if email already verified', async () => {
      // Verify email first
      const user = await prisma.user.findUnique({ where: { email: testUser.email } });
      await prisma.user.update({
        where: { id: user!.id },
        data: { emailVerifiedAt: new Date() },
      });

      const { __clearSentEmails } = await import('../src/modules/email/email.service');
      __clearSentEmails();

      const response = await request(app)
        .post('/auth/resend-verification')
        .send({ email: testUser.email })
        .expect(200);

      expect(response.body).toEqual({ ok: true });

      // No email should be sent
      const sentEmails = __getSentEmails();
      expect(sentEmails).toHaveLength(0);
    });
  });
});

describe('Password Reset Flow', () => {
  const testUser = {
    email: 'reset@example.com',
    password: 'OldPassword123!',
    displayName: 'Test User',
  };

  beforeEach(async () => {
    // Register and verify user
    await request(app).post('/auth/register').send(testUser);
    const user = await prisma.user.findUnique({ where: { email: testUser.email } });
    await prisma.user.update({
      where: { id: user!.id },
      data: { emailVerifiedAt: new Date() },
    });

    // Clear emails
    const { __clearSentEmails } = await import('../src/modules/email/email.service');
    __clearSentEmails();
  });

  describe('POST /auth/forgot-password', () => {
    it('should send password reset email', async () => {
      const { __clearSentEmails } = await import('../src/modules/email/email.service');
      __clearSentEmails(); // Clear emails from beforeEach
      
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(200);

      expect(response.body).toEqual({ ok: true });

      // Check email was sent
      const sentEmails = __getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe(testUser.email);
      expect(sentEmails[0].subject).toBe('Reset your password');
      expect(sentEmails[0].html).toContain('reset-password');
      expect(sentEmails[0].html).toContain('token=');
    });

    it('should return OK for unknown email (no enumeration)', async () => {
      const { __clearSentEmails } = await import('../src/modules/email/email.service');
      __clearSentEmails(); // Clear emails from beforeEach
      
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'unknown@example.com' })
        .expect(200);

      expect(response.body).toEqual({ ok: true });

      // No email should be sent
      const sentEmails = __getSentEmails();
      expect(sentEmails).toHaveLength(0);
    });

    it('should delete old reset tokens when requesting new one', async () => {
      // Create initial reset token
      const user = await prisma.user.findUnique({ where: { email: testUser.email } });
      const oldToken = 'old-token-123';
      const oldTokenHash = hashToken(oldToken);
      await prisma.passwordResetToken.create({
        data: {
          userId: user!.id,
          tokenHash: oldTokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      // Request password reset
      await request(app)
        .post('/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(200);

      // Old token should be deleted
      const oldTokenRecord = await prisma.passwordResetToken.findFirst({
        where: { tokenHash: oldTokenHash },
      });
      expect(oldTokenRecord).toBeNull();

      // New token should exist
      const tokenCount = await prisma.passwordResetToken.count({
        where: { userId: user!.id },
      });
      expect(tokenCount).toBe(1);
    });
  });

  describe('POST /auth/reset-password', () => {
    let resetToken: string;
    let userId: string;

    beforeEach(async () => {
      // User should exist from parent beforeEach
      const user = await prisma.user.findUnique({ where: { email: testUser.email } });
      if (!user) {
        throw new Error('User should exist from parent beforeEach');
      }
      userId = user.id;

      // Create reset token
      resetToken = 'reset-token-123';
      const resetTokenHash = hashToken(resetToken);
      await prisma.passwordResetToken.create({
        data: {
          userId,
          tokenHash: resetTokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });

      // Create active session
      await prisma.session.create({
        data: {
          userId,
          refreshTokenHash: hashToken('session-token'),
          status: 'ACTIVE',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    });

    it('should reset password and revoke all sessions', async () => {
      const newPassword = 'NewPassword123!';

      const response = await request(app)
        .post('/auth/reset-password')
        .send({ token: resetToken, newPassword })
        .expect(200);

      expect(response.body).toEqual({ ok: true });

      // Verify password changed
      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.passwordHash).not.toBe(testUser.password);

      // Verify all sessions revoked (session might be deleted, so check if exists)
      const sessions = await prisma.session.findMany({
        where: { userId },
      });
      // Session might be deleted or revoked - either is acceptable
      if (sessions.length > 0) {
        expect(sessions[0].status).toBe('REVOKED');
      } else {
        // Session was deleted, which is also acceptable
        expect(sessions).toHaveLength(0);
      }

      // Verify reset token deleted
      const tokenRecord = await prisma.passwordResetToken.findFirst({
        where: { userId },
      });
      expect(tokenRecord).toBeNull();

      // Verify new password works
      // Ensure user still exists
      const userAfterReset = await prisma.user.findUnique({
        where: { id: userId },
      });
      if (!userAfterReset) {
        throw new Error('User was deleted after password reset');
      }
      
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({ email: testUser.email, password: newPassword })
        .expect(200);
      expect(loginResponse.body.accessToken).toBeDefined();
    });

    it('should return 401 for invalid token', async () => {
      await request(app)
        .post('/auth/reset-password')
        .send({ token: 'invalid-token', newPassword: 'NewPassword123!' })
        .expect(401);
    });

    it('should return 401 for expired token', async () => {
      // Create expired token
      const expiredToken = 'expired-reset-token';
      const expiredTokenHash = hashToken(expiredToken);
      await prisma.passwordResetToken.create({
        data: {
          userId,
          tokenHash: expiredTokenHash,
          expiresAt: new Date(Date.now() - 1000), // Expired
        },
      });

      await request(app)
        .post('/auth/reset-password')
        .send({ token: expiredToken, newPassword: 'NewPassword123!' })
        .expect(401);
    });

    it('should validate password strength', async () => {
      await request(app)
        .post('/auth/reset-password')
        .send({ token: resetToken, newPassword: 'weak' })
        .expect(400);
    });
  });
});

