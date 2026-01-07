import request from 'supertest';
import { createApp } from '../src/server';
import { prisma } from '../src/db/prisma';
import { io as Client } from 'socket.io-client';
import { createServer } from 'http';
import { setupSocketIO } from '../src/realtime/socket';
import { setSocketIOInstance } from '../src/realtime/notification-events';
import { createOrGetDmChat } from '../src/modules/chats/chats.service';
import { sendMessage } from '../src/modules/messages/messages.service';
import { redis } from '../src/db/redis';

const app = createApp();

// Helper function to register and verify a user
async function createVerifiedUser(
  email: string,
  password: string,
  displayName?: string
) {
  const registerResponse = await request(app)
    .post('/auth/register')
    .send({
      email,
      password,
      displayName: displayName || email.split('@')[0],
    })
    .expect(201);

  const userId = registerResponse.body.user.id;

  // Verify email if token is available
  if (registerResponse.body.verificationToken) {
    await request(app)
      .post('/auth/verify-email')
      .send({ token: registerResponse.body.verificationToken })
      .expect(200);
  }

  // Login to get access token
  const loginResponse = await request(app)
    .post('/auth/login')
    .send({ email, password })
    .expect(200);

  return {
    userId,
    accessToken: loginResponse.body.accessToken,
    email,
    password,
  };
}

describe('Notifications', () => {
  describe('Message Notifications', () => {
    let userA: { userId: string; accessToken: string };
    let userB: { userId: string; accessToken: string };
    let chatId: string;

    beforeEach(async () => {
      userA = await createVerifiedUser(
        'notifa@test.com',
        'Password123!',
        'Notif A'
      );
      userB = await createVerifiedUser(
        'notifb@test.com',
        'Password123!',
        'Notif B'
      );

      // Create DM chat
      const chatResponse = await request(app)
        .post('/chats/dm')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      chatId = chatResponse.body.chat.id;
    });

    it('should create notification for other member when message is sent', async () => {
      // Send message from userA
      const messageResponse = await request(app)
        .post(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ content: 'Hello world' })
        .expect(201);

      // Wait a bit for notification to be created
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check notification was created for userB
      const notifications = await prisma.notification.findMany({
        where: {
          userId: userB.userId,
          messageId: messageResponse.body.message.id,
        },
      });

      expect(notifications).toHaveLength(1);
      // Type could be MESSAGE or DM_REQUEST depending on DM request status
      expect(['MESSAGE', 'DM_REQUEST']).toContain(notifications[0].type);
      expect(notifications[0].chatId).toBe(chatId);
      expect(notifications[0].fromUserId).toBe(userA.userId);
      expect(notifications[0].readAt).toBeNull();
    });

    it('should not create notification for sender', async () => {
      // Send message from userA
      const messageResponse = await request(app)
        .post(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ content: 'Hello world' })
        .expect(201);

      // Wait a bit for notification to be created
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check no notification was created for userA (sender)
      const notifications = await prisma.notification.findMany({
        where: {
          userId: userA.userId,
          messageId: messageResponse.body.message.id,
        },
      });

      expect(notifications).toHaveLength(0);
    });

    it('should not create notification when chat is muted', async () => {
      // Mute chat for userB
      await prisma.chatMember.update({
        where: {
          chatId_userId: {
            chatId,
            userId: userB.userId,
          },
        },
        data: {
          mutedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        },
      });

      // Send message from userA
      const messageResponse = await request(app)
        .post(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ content: 'Hello world' })
        .expect(201);

      // Wait a bit for notification to be created (async notification creation)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check no notification was created (muted)
      // Note: DM_REQUEST notifications might still be created from dm.service.ts
      // but MESSAGE notifications should be blocked
      const messageNotifications = await prisma.notification.findMany({
        where: {
          userId: userB.userId,
          messageId: messageResponse.body.message.id,
          type: 'MESSAGE',
        },
      });

      expect(messageNotifications).toHaveLength(0);
    });
  });

  describe('DM Request Notifications', () => {
    let userA: { userId: string; accessToken: string };
    let userB: { userId: string; accessToken: string };
    let chatId: string;

    beforeEach(async () => {
      userA = await createVerifiedUser(
        'dmnotifa@test.com',
        'Password123!',
        'DM Notif A'
      );
      userB = await createVerifiedUser(
        'dmnotifb@test.com',
        'Password123!',
        'DM Notif B'
      );

      // Create DM chat (but don't make them friends)
      const chatResponse = await request(app)
        .post('/chats/dm')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      chatId = chatResponse.body.chat.id;
    });

    it('should create DM_REQUEST notification when message is sent in pending DM request', async () => {
      // Send message from userA (creates PENDING DM request)
      const messageResponse = await request(app)
        .post(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ content: 'Hello, can we chat?' })
        .expect(201);

      // Wait a bit for notification to be created
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check DM_REQUEST notification was created
      const notifications = await prisma.notification.findMany({
        where: {
          userId: userB.userId,
          type: 'DM_REQUEST',
        },
      });

      expect(notifications.length).toBeGreaterThan(0);
      const dmRequestNotification = notifications.find(
        n => n.messageId === messageResponse.body.message.id
      );
      expect(dmRequestNotification).toBeDefined();
      expect(dmRequestNotification?.type).toBe('DM_REQUEST');
      expect(dmRequestNotification?.chatId).toBe(chatId);
    });
  });

  describe('Friend Request Notifications', () => {
    let userA: { userId: string; accessToken: string };
    let userB: { userId: string; accessToken: string };

    beforeEach(async () => {
      userA = await createVerifiedUser(
        'friendnotifa@test.com',
        'Password123!',
        'Friend Notif A'
      );
      userB = await createVerifiedUser(
        'friendnotifb@test.com',
        'Password123!',
        'Friend Notif B'
      );
    });

    it('should create FRIEND_REQUEST notification when friend request is sent', async () => {
      // Send friend request from userA to userB
      await request(app)
        .post('/friends/request')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      // Wait a bit for notification to be created
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check FRIEND_REQUEST notification was created
      const notifications = await prisma.notification.findMany({
        where: {
          userId: userB.userId,
          type: 'FRIEND_REQUEST',
        },
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('FRIEND_REQUEST');
      expect(notifications[0].fromUserId).toBe(userA.userId);
      expect(notifications[0].readAt).toBeNull();
    });
  });

  describe('Notification API', () => {
    let userA: { userId: string; accessToken: string };
    let userB: { userId: string; accessToken: string };
    let chatId: string;

    beforeEach(async () => {
      userA = await createVerifiedUser(
        'apinotifa@test.com',
        'Password123!',
        'API Notif A'
      );
      userB = await createVerifiedUser(
        'apinotifb@test.com',
        'Password123!',
        'API Notif B'
      );

      // Create DM chat
      const chatResponse = await request(app)
        .post('/chats/dm')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      chatId = chatResponse.body.chat.id;
    });

    it('should get notifications with cursor pagination', async () => {
      // Send multiple messages to create multiple notifications
      for (let i = 0; i < 5; i++) {
        await sendMessage(userA.userId, chatId, `Message ${i}`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Wait for all notifications to be created
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get notifications
      const response = await request(app)
        .get('/notifications')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .query({ limit: '3' })
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.notifications).toHaveLength(3);
      expect(response.body.nextCursor).toBeDefined();

      // Get next page
      const nextResponse = await request(app)
        .get('/notifications')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .query({ cursor: response.body.nextCursor, limit: '3' })
        .expect(200);

      expect(nextResponse.body.notifications.length).toBeGreaterThan(0);
    });

    it('should mark notification as read', async () => {
      // Send message to create notification
      const messageResponse = await request(app)
        .post(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ content: 'Hello' })
        .expect(201);

      // Wait for notification
      await new Promise(resolve => setTimeout(resolve, 500));

      // Find notification
      const notification = await prisma.notification.findFirst({
        where: {
          userId: userB.userId,
          messageId: messageResponse.body.message.id,
        },
      });

      expect(notification).toBeDefined();
      expect(notification?.readAt).toBeNull();

      // Mark as read
      await request(app)
        .post(`/notifications/${notification!.id}/read`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .expect(200);

      // Verify notification is marked as read
      const updatedNotification = await prisma.notification.findUnique({
        where: { id: notification!.id },
      });

      expect(updatedNotification?.readAt).not.toBeNull();
    });

    it('should mark all notifications as read', async () => {
      // Send multiple messages
      for (let i = 0; i < 3; i++) {
        await sendMessage(userA.userId, chatId, `Message ${i}`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Wait for notifications
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mark all as read
      await request(app)
        .post('/notifications/read-all')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .expect(200);

      // Verify all notifications are read
      const unreadCount = await prisma.notification.count({
        where: {
          userId: userB.userId,
          readAt: null,
        },
      });

      expect(unreadCount).toBe(0);
    });

    it('should get unread notification count', async () => {
      // Send messages
      for (let i = 0; i < 3; i++) {
        await sendMessage(userA.userId, chatId, `Message ${i}`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Wait for notifications
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get unread count
      const response = await request(app)
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.count).toBeGreaterThanOrEqual(3);
    });

    it('should return 403 when trying to mark another user notification as read', async () => {
      // Send message from userA
      const messageResponse = await request(app)
        .post(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ content: 'Hello' })
        .expect(201);

      // Wait for notification
      await new Promise(resolve => setTimeout(resolve, 500));

      // Find notification (belongs to userB)
      const notification = await prisma.notification.findFirst({
        where: {
          userId: userB.userId,
          messageId: messageResponse.body.message.id,
        },
      });

      expect(notification).toBeDefined();

      // Try to mark as read as userA (should fail)
      await request(app)
        .post(`/notifications/${notification!.id}/read`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .expect(403);
    });
  });

  describe('Socket.IO Notification Events', () => {
    let httpServer: ReturnType<typeof createServer>;
    let io: ReturnType<typeof setupSocketIO>;
    let userA: { userId: string; accessToken: string };
    let userB: { userId: string; accessToken: string };
    let chatId: string;

    beforeAll(async () => {
      // Create HTTP server and Socket.IO
      const app = createApp();
      httpServer = createServer(app);
      io = setupSocketIO(httpServer);

      // Set the Socket.IO instance for notification events
      setSocketIOInstance(io);

      // Start server on random port
      await new Promise<void>(resolve => {
        httpServer.listen(0, () => {
          resolve();
        });
      });
    });

    afterAll(async () => {
      await new Promise<void>(resolve => {
        io.close(() => {
          httpServer.close(() => {
            resolve();
          });
        });
      });
    });

    beforeEach(async () => {
      userA = await createVerifiedUser(
        'socketnotifa@test.com',
        'Password123!',
        'Socket Notif A'
      );
      userB = await createVerifiedUser(
        'socketnotifb@test.com',
        'Password123!',
        'Socket Notif B'
      );

      // Create DM chat
      const chat = await createOrGetDmChat(userA.userId, userB.userId);
      chatId = chat.chat.id;
    });

    afterEach(async () => {
      // Clean up Redis keys
      await redis.del(`presence:user:${userA.userId}`);
      await redis.del(`presence:user:${userB.userId}`);
      await redis.del(`socket:user:${userA.userId}`);
      await redis.del(`socket:user:${userB.userId}`);
      await redis.del(`chat:room:user:${userA.userId}`);
      await redis.del(`chat:room:user:${userB.userId}`);
    });

    it('should emit notification:new event when notification is created', done => {
      const port = (httpServer.address() as { port: number }).port;
      const client = Client(`http://localhost:${port}`, {
        auth: {
          token: userB.accessToken,
        },
      });

      let notificationReceived = false;
      const timeout = setTimeout(() => {
        if (!notificationReceived) {
          client.disconnect();
          done(new Error('Notification event not received within timeout'));
        }
      }, 10000);

      client.on('connect', async () => {
        // Set up listener before sending message
        client.on('notification:new', data => {
          if (notificationReceived) return; // Prevent multiple calls
          notificationReceived = true;
          clearTimeout(timeout);

          expect(data.notification).toBeDefined();
          expect(data.notification.userId).toBe(userB.userId);
          // Type could be MESSAGE or DM_REQUEST depending on DM request status
          expect(['MESSAGE', 'DM_REQUEST']).toContain(data.notification.type);
          // chatId might be null for DM_REQUEST notifications created from dm.service
          if (data.notification.chatId) {
            expect(data.notification.chatId).toBe(chatId);
          }
          client.disconnect();
          done();
        });

        // Wait a bit for listener to be set up and user to join personal room
        await new Promise(resolve => setTimeout(resolve, 200));

        // Send message from userA (creates notification for userB)
        await sendMessage(userA.userId, chatId, 'Hello from socket');

        // Wait a bit for notification to be created and emitted
        await new Promise(resolve => setTimeout(resolve, 500));
      });

      client.on('connect_error', error => {
        clearTimeout(timeout);
        done(error);
      });
    });
  });
});
