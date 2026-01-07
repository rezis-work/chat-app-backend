import { prisma } from '../../db/prisma';
import { getTranslationProvider } from './translation.provider';
import type { MessageTranslation } from '@prisma/client';

/**
 * Get or create a translation for a message
 * Checks cache first, then creates if needed
 */
export async function getOrCreateTranslation(
  messageId: string,
  fromLang: string,
  toLang: string,
  originalContent: string
): Promise<MessageTranslation> {
  // Check if translation already exists
  const existing = await prisma.messageTranslation.findUnique({
    where: {
      messageId_lang: {
        messageId,
        lang: toLang,
      },
    },
  });

  if (existing) {
    return existing;
  }

  // Get translation provider
  const provider = getTranslationProvider();

  // Translate content
  const translatedContent = await provider.translate(
    originalContent,
    fromLang,
    toLang
  );

  // Determine provider name
  const providerName = process.env.NODE_ENV === 'test' ? 'mock' : 'mock'; // Will be 'openai' in Task 8

  // Create and return translation
  const translation = await prisma.messageTranslation.create({
    data: {
      messageId,
      lang: toLang,
      content: translatedContent,
      provider: providerName,
    },
  });

  return translation;
}

/**
 * Get translation for a message in a specific language
 * Returns null if translation doesn't exist
 */
export async function getTranslationForMessage(
  messageId: string,
  targetLang: string
): Promise<MessageTranslation | null> {
  return await prisma.messageTranslation.findUnique({
    where: {
      messageId_lang: {
        messageId,
        lang: targetLang,
      },
    },
  });
}
