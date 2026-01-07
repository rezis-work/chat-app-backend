import request from 'supertest';
import { createApp } from '../src/server';
import { prisma } from '../src/db/prisma';

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

describe('Translation Per-Chat API', () => {
  describe('Language Preferences', () => {
    let userA: { userId: string; accessToken: string };
    let userB: { userId: string; accessToken: string };
    let chatId: string;

    beforeEach(async () => {
      userA = await createVerifiedUser(
        'langa@test.com',
        'Password123!',
        'Lang A'
      );
      userB = await createVerifiedUser(
        'langb@test.com',
        'Password123!',
        'Lang B'
      );

      // Create DM chat
      const chatResponse = await request(app)
        .post('/chats/dm')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      chatId = chatResponse.body.chat.id;
    });

    it('should set language preferences for userA (ka/ka) and userB (es/es)', async () => {
      // Set preference for userA
      const responseA = await request(app)
        .put(`/chats/${chatId}/language`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ myLanguage: 'ka', viewLanguage: 'ka' })
        .expect(200);

      expect(responseA.body.ok).toBe(true);
      expect(responseA.body.preference.myLanguage).toBe('ka');
      expect(responseA.body.preference.viewLanguage).toBe('ka');

      // Set preference for userB
      const responseB = await request(app)
        .put(`/chats/${chatId}/language`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ myLanguage: 'es', viewLanguage: 'es' })
        .expect(200);

      expect(responseB.body.ok).toBe(true);
      expect(responseB.body.preference.myLanguage).toBe('es');
      expect(responseB.body.preference.viewLanguage).toBe('es');

      // Verify preferences are stored correctly
      const prefA = await prisma.chatLanguagePreference.findUnique({
        where: {
          chatId_userId: {
            chatId,
            userId: userA.userId,
          },
        },
      });

      expect(prefA).toBeDefined();
      expect(prefA?.myLanguage).toBe('ka');
      expect(prefA?.viewLanguage).toBe('ka');

      const prefB = await prisma.chatLanguagePreference.findUnique({
        where: {
          chatId_userId: {
            chatId,
            userId: userB.userId,
          },
        },
      });

      expect(prefB).toBeDefined();
      expect(prefB?.myLanguage).toBe('es');
      expect(prefB?.viewLanguage).toBe('es');
    });

    it('should return 403 when non-member tries to set preferences', async () => {
      const userC = await createVerifiedUser(
        'langc@test.com',
        'Password123!',
        'Lang C'
      );

      await request(app)
        .put(`/chats/${chatId}/language`)
        .set('Authorization', `Bearer ${userC.accessToken}`)
        .send({ myLanguage: 'en', viewLanguage: 'en' })
        .expect(403);
    });

    it('should return 400 for empty language codes', async () => {
      await request(app)
        .put(`/chats/${chatId}/language`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ myLanguage: '', viewLanguage: 'ka' })
        .expect(400);

      await request(app)
        .put(`/chats/${chatId}/language`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ myLanguage: 'ka', viewLanguage: '' })
        .expect(400);
    });

    it('should get language preference', async () => {
      // Set preference first
      await request(app)
        .put(`/chats/${chatId}/language`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ myLanguage: 'ka', viewLanguage: 'ka' })
        .expect(200);

      // Get preference
      const response = await request(app)
        .get(`/chats/${chatId}/language`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.preference).toBeDefined();
      expect(response.body.preference.myLanguage).toBe('ka');
      expect(response.body.preference.viewLanguage).toBe('ka');
    });

    it('should return null preference with defaults if not set', async () => {
      const response = await request(app)
        .get(`/chats/${chatId}/language`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.preference).toBeNull();
      expect(response.body.defaults.myLanguage).toBe('en');
      expect(response.body.defaults.viewLanguage).toBe('en');
    });
  });

  describe('Message Translation on Send', () => {
    let userA: { userId: string; accessToken: string };
    let userB: { userId: string; accessToken: string };
    let chatId: string;

    beforeEach(async () => {
      userA = await createVerifiedUser(
        'transa@test.com',
        'Password123!',
        'Trans A'
      );
      userB = await createVerifiedUser(
        'transb@test.com',
        'Password123!',
        'Trans B'
      );

      // Create DM chat
      const chatResponse = await request(app)
        .post('/chats/dm')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      chatId = chatResponse.body.chat.id;

      // Set preferences: userA ka/ka, userB es/es
      await request(app)
        .put(`/chats/${chatId}/language`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ myLanguage: 'ka', viewLanguage: 'ka' })
        .expect(200);

      await request(app)
        .put(`/chats/${chatId}/language`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ myLanguage: 'es', viewLanguage: 'es' })
        .expect(200);
    });

    it('should create translation when userA sends Georgian message', async () => {
      const georgianText = 'გამარჯობა';

      // Send message
      const response = await request(app)
        .post(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ content: georgianText })
        .expect(201);

      expect(response.body.ok).toBe(true);
      expect(response.body.message.content).toBe(georgianText);

      // Wait a bit for async translation creation
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify original message stored with Georgian content
      const message = await prisma.message.findUnique({
        where: { id: response.body.message.id },
      });

      expect(message?.content).toBe(georgianText);

      // Verify translation created for Spanish (userB's viewLanguage: es)
      const translation = await prisma.messageTranslation.findUnique({
        where: {
          messageId_lang: {
            messageId: message!.id,
            lang: 'es',
          },
        },
      });

      expect(translation).toBeDefined();
      expect(translation?.lang).toBe('es');
      expect(translation?.content).toBe(georgianText.split('').reverse().join('')); // Mock provider reverses text

      // Verify no translation created for Georgian (same as original)
      const georgianTranslation = await prisma.messageTranslation.findUnique({
        where: {
          messageId_lang: {
            messageId: message!.id,
            lang: 'ka',
          },
        },
      });

      expect(georgianTranslation).toBeNull();
    });
  });

  describe('Message Fetching with Translations', () => {
    let userA: { userId: string; accessToken: string };
    let userB: { userId: string; accessToken: string };
    let chatId: string;
    let messageId: string;

    beforeEach(async () => {
      userA = await createVerifiedUser(
        'fetcha@test.com',
        'Password123!',
        'Fetch A'
      );
      userB = await createVerifiedUser(
        'fetchb@test.com',
        'Password123!',
        'Fetch B'
      );

      // Create DM chat
      const chatResponse = await request(app)
        .post('/chats/dm')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      chatId = chatResponse.body.chat.id;

      // Set preferences: userA ka/ka, userB es/es
      await request(app)
        .put(`/chats/${chatId}/language`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ myLanguage: 'ka', viewLanguage: 'ka' })
        .expect(200);

      await request(app)
        .put(`/chats/${chatId}/language`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ myLanguage: 'es', viewLanguage: 'es' })
        .expect(200);

      // Send message from userA
      const georgianText = 'გამარჯობა';
      const messageResponse = await request(app)
        .post(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ content: georgianText })
        .expect(201);

      messageId = messageResponse.body.message.id;

      // Wait for translation to be created
      await new Promise(resolve => setTimeout(resolve, 500));
    });

    it('should return Spanish translation for userB', async () => {
      const response = await request(app)
        .get(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.messages).toHaveLength(1);

      const message = response.body.messages[0];
      expect(message.id).toBe(messageId);
      expect(message.langOriginal).toBe('ka');
      expect(message.langShown).toBe('es');
      expect(message.contentOriginal).toBe('გამარჯობა'); // Original Georgian
      expect(message.content).toBe('აბოჯრამაგ'); // Reversed (mock translation)
    });

    it('should return Georgian original for userA', async () => {
      const response = await request(app)
        .get(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.messages).toHaveLength(1);

      const message = response.body.messages[0];
      expect(message.id).toBe(messageId);
      expect(message.langOriginal).toBe('ka');
      expect(message.langShown).toBe('ka');
      expect(message.content).toBe('გამარჯობა'); // Original Georgian
      expect(message.contentOriginal).toBeUndefined(); // Not included when same as content
    });
  });

  describe('Group Chat Multiple Languages', () => {
    let userA: { userId: string; accessToken: string };
    let userB: { userId: string; accessToken: string };
    let userC: { userId: string; accessToken: string };
    let chatId: string;

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

      // Create group chat
      const chatResponse = await request(app)
        .post('/chats/group')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({
          title: 'Multi-Lang Group',
          memberIds: [userB.userId, userC.userId],
        })
        .expect(201);

      chatId = chatResponse.body.chat.id;

      // Set preferences: userA ka/ka, userB es/es, userC en/en
      await request(app)
        .put(`/chats/${chatId}/language`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ myLanguage: 'ka', viewLanguage: 'ka' })
        .expect(200);

      await request(app)
        .put(`/chats/${chatId}/language`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ myLanguage: 'es', viewLanguage: 'es' })
        .expect(200);

      await request(app)
        .put(`/chats/${chatId}/language`)
        .set('Authorization', `Bearer ${userC.accessToken}`)
        .send({ myLanguage: 'en', viewLanguage: 'en' })
        .expect(200);
    });

    it('should create only one translation per language when userA sends message', async () => {
      const georgianText = 'გამარჯობა';

      // Send message from userA
      const messageResponse = await request(app)
        .post(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ content: georgianText })
        .expect(201);

      const messageId = messageResponse.body.message.id;

      // Wait for translations to be created
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify translations created: one for es, one for en (not for ka)
      const translations = await prisma.messageTranslation.findMany({
        where: { messageId },
      });

      expect(translations).toHaveLength(2); // Only es and en, not ka

      const langs = translations.map(t => t.lang).sort();
      expect(langs).toEqual(['en', 'es']);

      // Verify unique constraint prevents duplicates
      // Try to create duplicate translation (should fail)
      await expect(
        prisma.messageTranslation.create({
          data: {
            messageId,
            lang: 'es',
            content: 'duplicate',
            provider: 'mock',
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Translation Caching', () => {
    let userA: { userId: string; accessToken: string };
    let userB: { userId: string; accessToken: string };
    let chatId: string;

    beforeEach(async () => {
      userA = await createVerifiedUser(
        'cachea@test.com',
        'Password123!',
        'Cache A'
      );
      userB = await createVerifiedUser(
        'cacheb@test.com',
        'Password123!',
        'Cache B'
      );

      // Create DM chat
      const chatResponse = await request(app)
        .post('/chats/dm')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      chatId = chatResponse.body.chat.id;

      // Set preferences
      await request(app)
        .put(`/chats/${chatId}/language`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ myLanguage: 'ka', viewLanguage: 'ka' })
        .expect(200);

      await request(app)
        .put(`/chats/${chatId}/language`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ myLanguage: 'es', viewLanguage: 'es' })
        .expect(200);
    });

    it('should cache translations and not create duplicates', async () => {
      const georgianText = 'გამარჯობა';

      // Send first message
      const message1Response = await request(app)
        .post(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ content: georgianText })
        .expect(201);

      const message1Id = message1Response.body.message.id;

      // Wait for translation
      await new Promise(resolve => setTimeout(resolve, 500));

      // Count translations before second message
      const translationsBefore = await prisma.messageTranslation.count({
        where: { lang: 'es' },
      });

      // Send second message with same content
      const message2Response = await request(app)
        .post(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ content: georgianText })
        .expect(201);

      const message2Id = message2Response.body.message.id;

      // Wait for translation
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify two separate translations created (one per message)
      const translationsAfter = await prisma.messageTranslation.count({
        where: { lang: 'es' },
      });

      expect(translationsAfter).toBe(translationsBefore + 1);

      // Verify each message has its own translation
      const translation1 = await prisma.messageTranslation.findUnique({
        where: {
          messageId_lang: {
            messageId: message1Id,
            lang: 'es',
          },
        },
      });

      const translation2 = await prisma.messageTranslation.findUnique({
        where: {
          messageId_lang: {
            messageId: message2Id,
            lang: 'es',
          },
        },
      });

      expect(translation1).toBeDefined();
      expect(translation2).toBeDefined();
      expect(translation1?.id).not.toBe(translation2?.id);
    });
  });

  describe('Fallback Behavior', () => {
    let userA: { userId: string; accessToken: string };
    let userB: { userId: string; accessToken: string };
    let chatId: string;

    beforeEach(async () => {
      userA = await createVerifiedUser(
        'falla@test.com',
        'Password123!',
        'Fall A'
      );
      userB = await createVerifiedUser(
        'fallb@test.com',
        'Password123!',
        'Fall B'
      );

      // Create DM chat
      const chatResponse = await request(app)
        .post('/chats/dm')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ userId: userB.userId })
        .expect(201);

      chatId = chatResponse.body.chat.id;

      // Set preference only for userA
      await request(app)
        .put(`/chats/${chatId}/language`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ myLanguage: 'ka', viewLanguage: 'ka' })
        .expect(200);

      // userB has no preference (defaults to en/en)
    });

    it('should default to "en" when user has no preference', async () => {
      const georgianText = 'გამარჯობა';

      // Send message from userA
      await request(app)
        .post(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ content: georgianText })
        .expect(201);

      // Wait for translation
      await new Promise(resolve => setTimeout(resolve, 500));

      // userB fetches messages (no preference, defaults to en)
      const response = await request(app)
        .get(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .expect(200);

      expect(response.body.messages).toHaveLength(1);
      const message = response.body.messages[0];

      // Should have translation for en (userB's default viewLanguage)
      expect(message.langOriginal).toBe('ka');
      expect(message.langShown).toBe('en');
      expect(message.contentOriginal).toBe(georgianText);
    });

    it('should fallback to original content if translation does not exist', async () => {
      const englishText = 'Hello';

      // Send message from userA (myLanguage: ka, but sending English)
      const messageResponse = await request(app)
        .post(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ content: englishText })
        .expect(201);

      // Manually delete translation to simulate missing translation
      await prisma.messageTranslation.deleteMany({
        where: { messageId: messageResponse.body.message.id },
      });

      // userB fetches messages
      const response = await request(app)
        .get(`/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .expect(200);

      expect(response.body.messages).toHaveLength(1);
      const message = response.body.messages[0];

      // Should fallback to original
      expect(message.content).toBe(englishText);
      expect(message.langShown).toBe('ka'); // Falls back to original lang
      expect(message.contentOriginal).toBeUndefined();
    });
  });
});

