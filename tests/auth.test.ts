import request from 'supertest';
import { createApp } from '../src/server';
import { prisma } from '../src/db/prisma';

const app = createApp();

describe('Auth API', () => {
  const testUser = {
    email: 'test@example.com',
    password: 'TestPassword123',
    displayName: 'Test User',
  };

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user).not.toHaveProperty('passwordHash');
      expect(response.body.user.settings).toBeDefined();
      expect(response.body.user.settings.displayName).toBe(
        testUser.displayName
      );

      // Verify user was created in database
      const user = await prisma.user.findUnique({
        where: { email: testUser.email },
      });
      expect(user).toBeDefined();
      expect(user?.email).toBe(testUser.email);
    });

    it('should return 409 for duplicate email', async () => {
      // Create first user
      await request(app).post('/auth/register').send(testUser).expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/auth/register')
        .send(testUser)
        .expect(409);

      expect(response.body.error).toBeDefined();
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'TestPassword123',
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return 400 for short password', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test2@example.com',
          password: 'short',
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // Register a user before each login test
      await request(app).post('/auth/register').send(testUser);
    });

    it('should login successfully and set cookie + return access token', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user.email).toBe(testUser.email);

      // Check cookie is set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieArray = Array.isArray(cookies)
        ? cookies
        : cookies
          ? [cookies]
          : [];
      const refreshCookie = cookieArray.find((cookie: string) =>
        cookie.startsWith('refreshToken=')
      );
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
    });

    it('should return 401 for wrong password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword',
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should return 401 for wrong email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUser.password,
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshToken: string;
    let accessToken: string;

    beforeEach(async () => {
      // Register and login to get tokens
      await request(app).post('/auth/register').send(testUser);
      const loginResponse = await request(app).post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      // Extract refresh token from cookie
      const cookies = loginResponse.headers['set-cookie'];
      const cookieArray = Array.isArray(cookies)
        ? cookies
        : cookies
          ? [cookies]
          : [];
      const refreshCookie = cookieArray.find((cookie: string) =>
        cookie.startsWith('refreshToken=')
      );
      refreshToken = refreshCookie?.split(';')[0].split('=')[1] || '';
      accessToken = loginResponse.body.accessToken;
    });

    it('should refresh access token successfully', async () => {
      // Add small delay to ensure different token timestamps
      await new Promise(resolve => setTimeout(resolve, 1000));

      const response = await request(app)
        .post('/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.accessToken).toBeDefined();
      // Token should be different due to different iat timestamp
      expect(response.body.accessToken).not.toBe(accessToken);

      // Check new cookie is set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
    });

    it('should rotate refresh token (old token no longer works)', async () => {
      // First refresh
      const firstResponse = await request(app)
        .post('/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .expect(200);

      const cookies = firstResponse.headers['set-cookie'];
      const cookieArray = Array.isArray(cookies)
        ? cookies
        : cookies
          ? [cookies]
          : [];
      const newRefreshCookie = cookieArray.find((cookie: string) =>
        cookie.startsWith('refreshToken=')
      );
      const newRefreshToken =
        newRefreshCookie?.split(';')[0].split('=')[1] || '';

      // Old refresh token should no longer work
      await request(app)
        .post('/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .expect(401);

      // New refresh token should work
      await request(app)
        .post('/auth/refresh')
        .set('Cookie', `refreshToken=${newRefreshToken}`)
        .expect(200);
    });

    it('should return 401 for invalid cookie', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .set('Cookie', 'refreshToken=invalid-token')
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should return 401 for missing cookie', async () => {
      const response = await request(app).post('/auth/refresh').expect(401);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /auth/logout', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Register and login
      await request(app).post('/auth/register').send(testUser);
      const loginResponse = await request(app).post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      const cookies = loginResponse.headers['set-cookie'];
      const cookieArray = Array.isArray(cookies)
        ? cookies
        : cookies
          ? [cookies]
          : [];
      const refreshCookie = cookieArray.find((cookie: string) =>
        cookie.startsWith('refreshToken=')
      );
      refreshToken = refreshCookie?.split(';')[0].split('=')[1] || '';
    });

    it('should logout successfully and clear cookie', async () => {
      // Verify session exists (we need to hash the token to find it)
      const { hashToken } = await import('../src/utils/crypto');
      const refreshTokenHash = hashToken(refreshToken);
      const sessionBefore = await prisma.session.findFirst({
        where: {
          refreshTokenHash,
        },
      });
      expect(sessionBefore).toBeDefined();

      const response = await request(app)
        .post('/auth/logout')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .expect(204);

      // Check cookie is cleared
      const cookies = response.headers['set-cookie'];
      const cookieArray = Array.isArray(cookies)
        ? cookies
        : cookies
          ? [cookies]
          : [];
      const clearCookie = cookieArray.find((cookie: string) =>
        cookie.includes('refreshToken=')
      );
      expect(clearCookie).toBeDefined();
      expect(clearCookie).toContain('Max-Age=0');

      // Verify session is deleted
      const { hashToken: hashTokenAfter } = await import('../src/utils/crypto');
      const refreshTokenHashAfter = hashTokenAfter(refreshToken);
      const sessionAfter = await prisma.session.findFirst({
        where: {
          refreshTokenHash: refreshTokenHashAfter,
        },
      });
      expect(sessionAfter).toBeNull();
    });
  });

  describe('GET /me', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Register and login
      await request(app).post('/auth/register').send(testUser);
      const loginResponse = await request(app).post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });
      accessToken = loginResponse.body.accessToken;
    });

    it('should return user with valid access token', async () => {
      const response = await request(app)
        .get('/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.settings).toBeDefined();
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get('/me').expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });
});
