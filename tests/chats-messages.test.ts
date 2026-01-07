import request from 'supertest';
import { createApp } from '../src/server';
import { prisma } from '../src/db/prisma';
import { normalizeUserPair } from '../src/utils/user-pairs';

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

describe('Chats and Messages API', () => {
  describe('DM Chat Creation', () => {
    let userA: { userId: string; accessToken: string };
    let userB: { userId: string; accessToken: string };

    beforeEach(async () => {
      userA = await createVerifiedUser(
        'chata@test.com',
        'Password123!',
        'Chat A'
      );
      userB = await createVerifiedUser(
        'chatb@test.com',
        'Password123!',
        'Chat B'
      );
    });

    it('should create DM chat (new) and return chat + members', async () => {
      const response = await request(app)
        .post('/chats/dm')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      expect(response.body.ok).toBe(true);
      expect(response.body.chat.type).toBe('DM');
      expect(response.body.chat.title).toBeNull();
      expect(response.body.members).toHaveLength(2);

      // Verify chat exists in DB
      const chat = await prisma.chat.findUnique({
        where: { id: response.body.chat.id },
        include: {
          dmChat: true,
          members: true,
        },
      });

      expect(chat).toBeDefined();
      expect(chat?.type).toBe('DM');
      expect(chat?.dmChat).toBeDefined();
      expect(chat?.members).toHaveLength(2);
    });

    it('should return same chat when creating DM again (no duplicates)', async () => {
      // Create first DM chat
      const firstResponse = await request(app)
        .post('/chats/dm')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      const firstChatId = firstResponse.body.chat.id;

      // Create again (should return same chat)
      const secondResponse = await request(app)
        .post('/chats/dm')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      expect(secondResponse.body.chat.id).toBe(firstChatId);

      // Verify only one DmChat exists
      const { userAId, userBId } = normalizeUserPair(
        userA.userId,
        userB.userId
      );
      const dmChats = await prisma.dmChat.findMany({
        where: {
          userAId,
          userBId,
        },
      });

      expect(dmChats).toHaveLength(1);
    });

    it('should return 403 when blocked user tries to create DM', async () => {
      // User B blocks User A
      await request(app)
        .post('/blocks')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ userId: userA.userId })
        .expect(201);

      // User A cannot create DM with User B
      await request(app)
        .post('/chats/dm')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(403);
    });

    it('should return 400 when creating DM with yourself', async () => {
      await request(app)
        .post('/chats/dm')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userA.userId })
        .expect(400);
    });
  });

  describe('Group Chat Creation', () => {
    let userA: { userId: string; accessToken: string };
    let userB: { userId: string; accessToken: string };
    let userC: { userId: string; accessToken: string };

    beforeEach(async () => {
      userA = await createVerifiedUser(
        'groupa@test.com',
        'Password123!',
        'Group A'
      );
      userB = await createVerifiedUser(
        'groupb@test.com',
        'Password123!',
        'Group B'
      );
      userC = await createVerifiedUser(
        'groupc@test.com',
        'Password123!',
        'Group C'
      );
    });

    it('should create group chat with creator as OWNER and members as MEMBER', async () => {
      const response = await request(app)
        .post('/chats/group')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({
          title: 'Test Group',
          memberIds: [userB.userId, userC.userId],
        })
        .expect(201);

      expect(response.body.ok).toBe(true);
      expect(response.body.chat.type).toBe('GROUP');
      expect(response.body.chat.title).toBe('Test Group');
      expect(response.body.members).toHaveLength(3);

      // Verify roles
      const creatorMember = response.body.members.find(
        (m: any) => m.userId === userA.userId
      );
      expect(creatorMember.role).toBe('OWNER');

      const memberB = response.body.members.find(
        (m: any) => m.userId === userB.userId
      );
      expect(memberB.role).toBe('MEMBER');

      const memberC = response.body.members.find(
        (m: any) => m.userId === userC.userId
      );
      expect(memberC.role).toBe('MEMBER');
    });

    it('should return 400 for empty title', async () => {
      await request(app)
        .post('/chats/group')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({
          title: '',
          memberIds: [userB.userId],
        })
        .expect(400);
    });

    it('should return 400 for empty memberIds', async () => {
      await request(app)
        .post('/chats/group')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({
          title: 'Test Group',
          memberIds: [],
        })
        .expect(400);
    });
  });

  describe('Message Sending', () => {
    let userA: { userId: string; accessToken: string };
    let userB: { userId: string; accessToken: string };
    let chatId: string;

    beforeEach(async () => {
      userA = await createVerifiedUser(
        'msga@test.com',
        'Password123!',
        'Msg A'
      );
      userB = await createVerifiedUser(
        'msgb@test.com',
        'Password123!',
        'Msg B'
      );

      // Create DM chat
      const chatResponse = await request(app)
        .post('/chats/dm')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      chatId = chatResponse.body.chat.id;
    });

    it('should send message in DM before friendship and create dmRequest pending', async () => {
      const response = await request(app)
        .post(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ content: 'Hello!' })
        .expect(201);

      expect(response.body.ok).toBe(true);
      expect(response.body.message.content).toBe('Hello!');
      expect(response.body.message.senderId).toBe(userA.userId);

      // Verify DM request was created/updated
      const { userAId, userBId } = normalizeUserPair(
        userA.userId,
        userB.userId
      );
      const dmRequest = await prisma.dmRequest.findUnique({
        where: {
          userAId_userBId: {
            userAId,
            userBId,
          },
        },
      });

      expect(dmRequest).toBeDefined();
      expect(dmRequest?.status).toBe('PENDING');
      expect(dmRequest?.initiatedById).toBe(userA.userId);
    });

    it('should allow message after accepting dmRequest', async () => {
      // Send first message (creates PENDING request)
      await request(app)
        .post(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ content: 'Hello!' })
        .expect(201);

      // Accept DM request
      await request(app)
        .post(`/dm/requests/${userA.userId}/accept`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .expect(200);

      // Send another message (should work now)
      const response = await request(app)
        .post(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ content: 'Hello again!' })
        .expect(201);

      expect(response.body.message.content).toBe('Hello again!');

      // Verify DM request status is ACCEPTED
      const { userAId, userBId } = normalizeUserPair(
        userA.userId,
        userB.userId
      );
      const dmRequest = await prisma.dmRequest.findUnique({
        where: {
          userAId_userBId: {
            userAId,
            userBId,
          },
        },
      });

      expect(dmRequest?.status).toBe('ACCEPTED');
    });

    it('should auto-accept DM request when receiver replies', async () => {
      // User A sends message (creates PENDING request)
      await request(app)
        .post(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ content: 'Hello!' })
        .expect(201);

      // User B replies (should auto-accept)
      await request(app)
        .post(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ content: 'Hi back!' })
        .expect(201);

      // Verify DM request is ACCEPTED
      const { userAId, userBId } = normalizeUserPair(
        userA.userId,
        userB.userId
      );
      const dmRequest = await prisma.dmRequest.findUnique({
        where: {
          userAId_userBId: {
            userAId,
            userBId,
          },
        },
      });

      expect(dmRequest?.status).toBe('ACCEPTED');
    });

    it('should return 403 when non-member tries to send message', async () => {
      const userC = await createVerifiedUser(
        'msgc@test.com',
        'Password123!',
        'Msg C'
      );

      await request(app)
        .post(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userC.accessToken}`)
        .send({ content: 'Hello!' })
        .expect(403);
    });

    it('should return 400 for empty message content', async () => {
      await request(app)
        .post(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ content: '' })
        .expect(400);
    });
  });

  describe('Message Retrieval', () => {
    let userA: { userId: string; accessToken: string };
    let userB: { userId: string; accessToken: string };
    let chatId: string;

    beforeEach(async () => {
      userA = await createVerifiedUser(
        'geta@test.com',
        'Password123!',
        'Get A'
      );
      userB = await createVerifiedUser(
        'getb@test.com',
        'Password123!',
        'Get B'
      );

      // Create DM chat
      const chatResponse = await request(app)
        .post('/chats/dm')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      chatId = chatResponse.body.chat.id;

      // Send some messages
      for (let i = 1; i <= 5; i++) {
        await request(app)
          .post(`/chats/${chatId}/messages`)
          .set('Authorization', `Bearer ${userA.accessToken}`)
          .send({ content: `Message ${i}` })
          .expect(201);
      }
    });

    it('should get messages with pagination (oldest-first)', async () => {
      const response = await request(app)
        .get(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .query({ limit: 3 })
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.messages).toHaveLength(3);
      expect(response.body.messages[0].content).toBe('Message 1');
      expect(response.body.messages[1].content).toBe('Message 2');
      expect(response.body.messages[2].content).toBe('Message 3');
      expect(response.body.nextCursor).toBeDefined();
    });

    it('should use cursor for pagination', async () => {
      // Get first page
      const firstPage = await request(app)
        .get(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .query({ limit: 2 })
        .expect(200);

      expect(firstPage.body.messages).toHaveLength(2);
      expect(firstPage.body.nextCursor).toBeDefined();

      // Get second page using cursor
      const secondPage = await request(app)
        .get(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .query({ cursor: firstPage.body.nextCursor, limit: 2 })
        .expect(200);

      expect(secondPage.body.messages).toHaveLength(2);
      expect(secondPage.body.messages[0].content).toBe('Message 3');
      expect(secondPage.body.messages[1].content).toBe('Message 4');
    });

    it('should return 403 when non-member tries to get messages', async () => {
      const userC = await createVerifiedUser(
        'getc@test.com',
        'Password123!',
        'Get C'
      );

      await request(app)
        .get(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userC.accessToken}`)
        .expect(403);
    });
  });

  describe('Inbox', () => {
    let userA: { userId: string; accessToken: string };
    let userB: { userId: string; accessToken: string };
    let userC: { userId: string; accessToken: string };
    let dmChatId: string;
    let groupChatId: string;

    beforeEach(async () => {
      userA = await createVerifiedUser(
        'inboxa@test.com',
        'Password123!',
        'Inbox A'
      );
      userB = await createVerifiedUser(
        'inboxb@test.com',
        'Password123!',
        'Inbox B'
      );
      userC = await createVerifiedUser(
        'inboxc@test.com',
        'Password123!',
        'Inbox C'
      );

      // Create DM chat
      const dmResponse = await request(app)
        .post('/chats/dm')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      dmChatId = dmResponse.body.chat.id;

      // Create group chat
      const groupResponse = await request(app)
        .post('/chats/group')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({
          title: 'Test Group',
          memberIds: [userB.userId, userC.userId],
        })
        .expect(201);

      groupChatId = groupResponse.body.chat.id;
    });

    it('should show inbox with lastMessage and unreadCount', async () => {
      // Send message in DM
      await request(app)
        .post(`/chats/${dmChatId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ content: 'DM message' })
        .expect(201);

      // Send message in group
      await request(app)
        .post(`/chats/${groupChatId}/messages`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ content: 'Group message' })
        .expect(201);

      const response = await request(app)
        .get('/chats')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.chats).toHaveLength(2);

      // Find DM chat
      const dmChat = response.body.chats.find(
        (c: any) => c.id === dmChatId
      );
      expect(dmChat).toBeDefined();
      expect(dmChat.lastMessage).toBeDefined();
      expect(dmChat.lastMessage.content).toBe('DM message');
      expect(dmChat.unreadCount).toBeGreaterThanOrEqual(0);

      // Find group chat
      const groupChat = response.body.chats.find(
        (c: any) => c.id === groupChatId
      );
      expect(groupChat).toBeDefined();
      expect(groupChat.title).toBe('Test Group');
      expect(groupChat.lastMessage).toBeDefined();
      expect(groupChat.lastMessage.content).toBe('Group message');
    });

    it('should calculate unreadCount correctly', async () => {
      // Send 3 messages in DM
      for (let i = 1; i <= 3; i++) {
        await request(app)
          .post(`/chats/${dmChatId}/messages`)
          .set('Authorization', `Bearer ${userA.accessToken}`)
          .send({ content: `Message ${i}` })
          .expect(201);
      }

      // Get inbox (should show 3 unread for userB)
      const response = await request(app)
        .get('/chats')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .expect(200);

      const dmChat = response.body.chats.find(
        (c: any) => c.id === dmChatId
      );
      expect(dmChat.unreadCount).toBe(3);

      // Mark as read
      const messagesResponse = await request(app)
        .get(`/chats/${dmChatId}/messages`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .query({ limit: 1 })
        .expect(200);

      const lastMessageId = messagesResponse.body.messages[0].id;

      await request(app)
        .post(`/chats/${dmChatId}/read`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ lastReadMessageId: lastMessageId })
        .expect(200);

      // Get inbox again (unreadCount should decrease)
      const updatedResponse = await request(app)
        .get('/chats')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .expect(200);

      const updatedDmChat = updatedResponse.body.chats.find(
        (c: any) => c.id === dmChatId
      );
      expect(updatedDmChat.unreadCount).toBeLessThan(3);
    });
  });

  describe('Read Receipts', () => {
    let userA: { userId: string; accessToken: string };
    let userB: { userId: string; accessToken: string };
    let chatId: string;
    let messageId: string;

    beforeEach(async () => {
      userA = await createVerifiedUser(
        'reada@test.com',
        'Password123!',
        'Read A'
      );
      userB = await createVerifiedUser(
        'readb@test.com',
        'Password123!',
        'Read B'
      );

      // Create DM chat
      const chatResponse = await request(app)
        .post('/chats/dm')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      chatId = chatResponse.body.chat.id;

      // Send message
      const messageResponse = await request(app)
        .post(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ content: 'Test message' })
        .expect(201);

      messageId = messageResponse.body.message.id;
    });

    it('should update lastReadMessageId when marking chat as read', async () => {
      await request(app)
        .post(`/chats/${chatId}/read`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ lastReadMessageId: messageId })
        .expect(200);

      // Verify ChatMember.lastReadMessageId is updated
      const member = await prisma.chatMember.findUnique({
        where: {
          chatId_userId: {
            chatId,
            userId: userB.userId,
          },
        },
      });

      expect(member?.lastReadMessageId).toBe(messageId);
    });

    it('should return 403 when non-member tries to mark as read', async () => {
      const userC = await createVerifiedUser(
        'readc@test.com',
        'Password123!',
        'Read C'
      );

      await request(app)
        .post(`/chats/${chatId}/read`)
        .set('Authorization', `Bearer ${userC.accessToken}`)
        .send({ lastReadMessageId: messageId })
        .expect(403);
    });
  });

  describe('Message Editing', () => {
    let userA: { userId: string; accessToken: string };
    let userB: { userId: string; accessToken: string };
    let chatId: string;
    let messageId: string;

    beforeEach(async () => {
      userA = await createVerifiedUser(
        'edita@test.com',
        'Password123!',
        'Edit A'
      );
      userB = await createVerifiedUser(
        'editb@test.com',
        'Password123!',
        'Edit B'
      );

      // Create DM chat
      const chatResponse = await request(app)
        .post('/chats/dm')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      chatId = chatResponse.body.chat.id;

      // Send message
      const messageResponse = await request(app)
        .post(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ content: 'Original message' })
        .expect(201);

      messageId = messageResponse.body.message.id;
    });

    it('should edit message (only sender)', async () => {
      const response = await request(app)
        .patch(`/messages/${messageId}`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ content: 'Edited message' })
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.message.content).toBe('Edited message');
      expect(response.body.message.editedAt).not.toBeNull();

      // Verify in DB
      const message = await prisma.message.findUnique({
        where: { id: messageId },
      });

      expect(message?.content).toBe('Edited message');
      expect(message?.editedAt).not.toBeNull();
    });

    it('should return 403 when non-sender tries to edit', async () => {
      await request(app)
        .patch(`/messages/${messageId}`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ content: 'Edited message' })
        .expect(403);
    });

    it('should return 403 when editing deleted message', async () => {
      // Delete message first
      await request(app)
        .delete(`/messages/${messageId}`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .expect(204);

      // Try to edit
      await request(app)
        .patch(`/messages/${messageId}`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ content: 'Edited message' })
        .expect(403);
    });
  });

  describe('Message Deletion', () => {
    let userA: { userId: string; accessToken: string };
    let userB: { userId: string; accessToken: string };
    let chatId: string;
    let messageId: string;

    beforeEach(async () => {
      userA = await createVerifiedUser(
        'dela@test.com',
        'Password123!',
        'Del A'
      );
      userB = await createVerifiedUser(
        'delb@test.com',
        'Password123!',
        'Del B'
      );

      // Create DM chat
      const chatResponse = await request(app)
        .post('/chats/dm')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      chatId = chatResponse.body.chat.id;

      // Send message
      const messageResponse = await request(app)
        .post(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ content: 'Message to delete' })
        .expect(201);

      messageId = messageResponse.body.message.id;
    });

    it('should soft delete message (only sender)', async () => {
      await request(app)
        .delete(`/messages/${messageId}`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .expect(204);

      // Verify message is soft deleted
      const message = await prisma.message.findUnique({
        where: { id: messageId },
      });

      expect(message?.deletedAt).not.toBeNull();
    });

    it('should return 403 when non-sender tries to delete', async () => {
      await request(app)
        .delete(`/messages/${messageId}`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .expect(403);
    });

    it('should not return deleted messages in getMessages', async () => {
      // Delete message
      await request(app)
        .delete(`/messages/${messageId}`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .expect(204);

      // Get messages (should not include deleted)
      const response = await request(app)
        .get(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .expect(200);

      const deletedMessage = response.body.messages.find(
        (m: any) => m.id === messageId
      );
      expect(deletedMessage).toBeUndefined();
    });
  });

  describe('Chat Details', () => {
    let userA: { userId: string; accessToken: string };
    let userB: { userId: string; accessToken: string };
    let chatId: string;

    beforeEach(async () => {
      userA = await createVerifiedUser(
        'detaila@test.com',
        'Password123!',
        'Detail A'
      );
      userB = await createVerifiedUser(
        'detailb@test.com',
        'Password123!',
        'Detail B'
      );

      // Create DM chat
      const chatResponse = await request(app)
        .post('/chats/dm')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      chatId = chatResponse.body.chat.id;
    });

    it('should get chat details with members', async () => {
      const response = await request(app)
        .get(`/chats/${chatId}`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.chat.id).toBe(chatId);
      expect(response.body.chat.type).toBe('DM');
      expect(response.body.chat.members).toHaveLength(2);
    });

    it('should return 403 when non-member tries to get chat details', async () => {
      const userC = await createVerifiedUser(
        'detailc@test.com',
        'Password123!',
        'Detail C'
      );

      await request(app)
        .get(`/chats/${chatId}`)
        .set('Authorization', `Bearer ${userC.accessToken}`)
        .expect(403);
    });
  });
});

