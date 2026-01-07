import request from 'supertest';
import { createApp } from '../src/server';
import { prisma } from '../src/db/prisma';
import { normalizeUserPair } from '../src/utils/user-pairs';
import {
  createOrUpdateDmRequest,
  autoAcceptDmRequestOnReply,
} from '../src/modules/dm/dm.service';
import { canSendMessage } from '../src/utils/message-permissions';

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

describe('Friends and DM Requests', () => {
  describe('Friend Request Flow', () => {
    let userA: { userId: string; accessToken: string };
    let userB: { userId: string; accessToken: string };

    beforeEach(async () => {
      userA = await createVerifiedUser(
        'usera@test.com',
        'Password123!',
        'User A'
      );
      userB = await createVerifiedUser(
        'userb@test.com',
        'Password123!',
        'User B'
      );
    });

    it('should request friend and create PENDING friendship', async () => {
      const response = await request(app)
        .post('/friends/request')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      expect(response.body.ok).toBe(true);
      expect(response.body.friendship.status).toBe('PENDING');

      // Verify friendship exists in DB
      const { userAId, userBId } = normalizeUserPair(
        userA.userId,
        userB.userId
      );
      const friendship = await prisma.friendship.findUnique({
        where: {
          userAId_userBId: {
            userAId,
            userBId,
          },
        },
      });

      expect(friendship).toBeDefined();
      expect(friendship?.status).toBe('PENDING');
      expect(friendship?.requestedById).toBe(userA.userId);
    });

    it('should show pending request to receiver', async () => {
      // User A requests friendship with User B
      await request(app)
        .post('/friends/request')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      // User B should see the request
      const response = await request(app)
        .get('/friends/requests')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.requests).toHaveLength(1);
      expect(response.body.requests[0].requesterId).toBe(userA.userId);
      expect(response.body.requests[0].status).toBe('PENDING');
    });

    it('should accept friend request and update status to ACCEPTED', async () => {
      // User A requests friendship
      await request(app)
        .post('/friends/request')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      // User B accepts
      const response = await request(app)
        .post('/friends/accept')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ userId: userA.userId })
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.friendship.status).toBe('ACCEPTED');

      // Both users should see each other in friends list
      const friendsA = await request(app)
        .get('/friends')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .expect(200);

      const friendsB = await request(app)
        .get('/friends')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .expect(200);

      expect(friendsA.body.friends).toHaveLength(1);
      expect(friendsB.body.friends).toHaveLength(1);
      expect(friendsA.body.friends[0].id).toBe(userB.userId);
      expect(friendsB.body.friends[0].id).toBe(userA.userId);
    });

    it('should decline friend request and update status to DECLINED', async () => {
      await request(app)
        .post('/friends/request')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      const response = await request(app)
        .post('/friends/decline')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ userId: userA.userId })
        .expect(200);

      expect(response.body.ok).toBe(true);

      // Verify status is DECLINED
      const { userAId, userBId } = normalizeUserPair(
        userA.userId,
        userB.userId
      );
      const friendship = await prisma.friendship.findUnique({
        where: {
          userAId_userBId: {
            userAId,
            userBId,
          },
        },
      });

      expect(friendship?.status).toBe('DECLINED');
    });

    it('should remove friendship and delete record', async () => {
      // Create accepted friendship
      await request(app)
        .post('/friends/request')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      await request(app)
        .post('/friends/accept')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ userId: userA.userId })
        .expect(200);

      // Remove friendship
      await request(app)
        .delete('/friends/remove')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(204);

      // Verify friendship is deleted
      const { userAId, userBId } = normalizeUserPair(
        userA.userId,
        userB.userId
      );
      const friendship = await prisma.friendship.findUnique({
        where: {
          userAId_userBId: {
            userAId,
            userBId,
          },
        },
      });

      expect(friendship).toBeNull();
    });

    it('should return 409 for duplicate friend request', async () => {
      await request(app)
        .post('/friends/request')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      // Try to request again
      await request(app)
        .post('/friends/request')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(409);
    });

    it('should return 400 for self friend request', async () => {
      await request(app)
        .post('/friends/request')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userA.userId })
        .expect(400);
    });
  });

  describe('Block System', () => {
    let userA: { userId: string; accessToken: string };
    let userB: { userId: string; accessToken: string };

    beforeEach(async () => {
      userA = await createVerifiedUser(
        'blocka@test.com',
        'Password123!',
        'Block A'
      );
      userB = await createVerifiedUser(
        'blockb@test.com',
        'Password123!',
        'Block B'
      );
    });

    it('should block user and prevent friend request', async () => {
      // User A blocks User B
      await request(app)
        .post('/blocks')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      // User B cannot send friend request to User A
      await request(app)
        .post('/friends/request')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ userId: userA.userId })
        .expect(403);

      // User A cannot send friend request to User B (blocked)
      await request(app)
        .post('/friends/request')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(403);
    });

    it('should block user and prevent DM request', async () => {
      await request(app)
        .post('/blocks')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      // User B cannot create DM request
      const permission = await canSendMessage(userB.userId, userA.userId);
      expect(permission.allowed).toBe(false);
      expect(permission.reason).toContain('blocked');
    });

    it('should unblock user and allow requests again', async () => {
      // Block first
      await request(app)
        .post('/blocks')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      // Unblock
      await request(app)
        .delete(`/blocks/${userB.userId}`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .expect(204);

      // Now friend request should work
      await request(app)
        .post('/friends/request')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ userId: userA.userId })
        .expect(201);
    });

    it('should get blocked users list', async () => {
      await request(app)
        .post('/blocks')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      const response = await request(app)
        .get('/blocks')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.blockedUsers).toHaveLength(1);
      expect(response.body.blockedUsers[0].id).toBe(userB.userId);
    });

    it('should return 400 for self block', async () => {
      await request(app)
        .post('/blocks')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userA.userId })
        .expect(400);
    });
  });

  describe('DM Request Flow', () => {
    let userA: { userId: string; accessToken: string };
    let userB: { userId: string; accessToken: string };

    beforeEach(async () => {
      userA = await createVerifiedUser(
        'dma@test.com',
        'Password123!',
        'DM A'
      );
      userB = await createVerifiedUser(
        'dmb@test.com',
        'Password123!',
        'DM B'
      );
    });

    it('should create DM request PENDING when sending message before friendship', async () => {
      // User A sends message to User B (not friends)
      await createOrUpdateDmRequest(userA.userId, userB.userId);

      // Verify DM request exists
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

    it('should show DM requests to receiver', async () => {
      await createOrUpdateDmRequest(userA.userId, userB.userId);

      const response = await request(app)
        .get('/dm/requests')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.requests).toHaveLength(1);
      expect(response.body.requests[0].senderId).toBe(userA.userId);
      expect(response.body.requests[0].status).toBe('PENDING');
    });

    it('should accept DM request and update status to ACCEPTED', async () => {
      await createOrUpdateDmRequest(userA.userId, userB.userId);

      const response = await request(app)
        .post(`/dm/requests/${userA.userId}/accept`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.dmRequest.status).toBe('ACCEPTED');

      // Verify in DB
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

    it('should decline DM request and update status to DECLINED', async () => {
      await createOrUpdateDmRequest(userA.userId, userB.userId);

      await request(app)
        .post(`/dm/requests/${userA.userId}/decline`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .expect(200);

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

      expect(dmRequest?.status).toBe('DECLINED');
    });

    it('should block via DM request and create UserBlock', async () => {
      await createOrUpdateDmRequest(userA.userId, userB.userId);

      await request(app)
        .post(`/dm/requests/${userA.userId}/block`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .expect(200);

      // Verify DM request is BLOCKED
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

      expect(dmRequest?.status).toBe('BLOCKED');

      // Verify UserBlock exists
      const userBlock = await prisma.userBlock.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: userB.userId,
            blockedId: userA.userId,
          },
        },
      });

      expect(userBlock).toBeDefined();
    });

    it('should auto-accept DM request when receiver replies', async () => {
      // User A sends message (creates PENDING request)
      await createOrUpdateDmRequest(userA.userId, userB.userId);

      // User B replies (auto-accepts)
      await autoAcceptDmRequestOnReply(userB.userId, userA.userId);

      // Verify status is ACCEPTED
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
  });

  describe('Rules Engine', () => {
    let userA: { userId: string; accessToken: string };
    let userB: { userId: string; accessToken: string };

    beforeEach(async () => {
      userA = await createVerifiedUser(
        'rulesa@test.com',
        'Password123!',
        'Rules A'
      );
      userB = await createVerifiedUser(
        'rulesb@test.com',
        'Password123!',
        'Rules B'
      );
    });

    it('should not allow message if receiver blocked sender', async () => {
      // User B blocks User A
      await request(app)
        .post('/blocks')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ userId: userA.userId })
        .expect(201);

      const permission = await canSendMessage(userA.userId, userB.userId);
      expect(permission.allowed).toBe(false);
      expect(permission.reason).toContain('blocked');
    });

    it('should not allow message if sender blocked receiver', async () => {
      // User A blocks User B
      await request(app)
        .post('/blocks')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      const permission = await canSendMessage(userA.userId, userB.userId);
      expect(permission.allowed).toBe(false);
      expect(permission.reason).toContain('blocked');
    });

    it('should allow direct message if friendship is ACCEPTED', async () => {
      // Create accepted friendship
      await request(app)
        .post('/friends/request')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      await request(app)
        .post('/friends/accept')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ userId: userA.userId })
        .expect(200);

      const permission = await canSendMessage(userA.userId, userB.userId);
      expect(permission.allowed).toBe(true);
      expect(permission.requiresDmRequest).toBe(false);
    });

    it('should require DM request if not friends', async () => {
      const permission = await canSendMessage(userA.userId, userB.userId);
      expect(permission.allowed).toBe(true);
      expect(permission.requiresDmRequest).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    let userA: { userId: string; accessToken: string };
    let userB: { userId: string; accessToken: string };

    beforeEach(async () => {
      userA = await createVerifiedUser(
        'edgea@test.com',
        'Password123!',
        'Edge A'
      );
      userB = await createVerifiedUser(
        'edgeb@test.com',
        'Password123!',
        'Edge B'
      );
    });

    it('should prevent duplicate friendships with normalized pairs', async () => {
      // User A requests User B
      await request(app)
        .post('/friends/request')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      // User B cannot request User A (duplicate)
      await request(app)
        .post('/friends/request')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ userId: userA.userId })
        .expect(409);

      // Verify only one friendship exists
      const { userAId, userBId } = normalizeUserPair(
        userA.userId,
        userB.userId
      );
      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [
            { userAId, userBId },
            { userAId: userBId, userBId: userAId },
          ],
        },
      });

      expect(friendships).toHaveLength(1);
    });

    it('should handle normalized user pairs correctly', async () => {
      // Create friendship
      await request(app)
        .post('/friends/request')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      // Verify normalized storage
      const { userAId, userBId } = normalizeUserPair(
        userA.userId,
        userB.userId
      );
      const friendship = await prisma.friendship.findUnique({
        where: {
          userAId_userBId: {
            userAId,
            userBId,
          },
        },
      });

      expect(friendship).toBeDefined();
      // Verify IDs are in correct order
      expect(friendship?.userAId).toBe(userAId);
      expect(friendship?.userBId).toBe(userBId);
    });
  });
});

