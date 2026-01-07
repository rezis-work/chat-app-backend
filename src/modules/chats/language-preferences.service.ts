import { prisma } from '../../db/prisma';
import { verifyChatMembership } from './chats.service';
import { ValidationError } from '../../utils/errors';
import type { ChatLanguagePreference } from '@prisma/client';

/**
 * Set language preference for a user in a chat
 */
export async function setLanguagePreference(
  userId: string,
  chatId: string,
  myLanguage: string,
  viewLanguage: string
): Promise<ChatLanguagePreference> {
  // Validate language codes (basic validation - non-empty string)
  if (!myLanguage || myLanguage.trim().length === 0) {
    throw new ValidationError('myLanguage is required');
  }

  if (!viewLanguage || viewLanguage.trim().length === 0) {
    throw new ValidationError('viewLanguage is required');
  }

  // Verify membership
  await verifyChatMembership(userId, chatId);

  // Upsert preference (create or update)
  const preference = await prisma.chatLanguagePreference.upsert({
    where: {
      chatId_userId: {
        chatId,
        userId,
      },
    },
    create: {
      chatId,
      userId,
      myLanguage: myLanguage.trim(),
      viewLanguage: viewLanguage.trim(),
    },
    update: {
      myLanguage: myLanguage.trim(),
      viewLanguage: viewLanguage.trim(),
    },
  });

  return preference;
}

/**
 * Get language preference for a user in a chat
 * Returns null if not set
 */
export async function getLanguagePreference(
  userId: string,
  chatId: string
): Promise<ChatLanguagePreference | null> {
  return await prisma.chatLanguagePreference.findUnique({
    where: {
      chatId_userId: {
        chatId,
        userId,
      },
    },
  });
}

/**
 * Get default language preference for a user in a chat
 * Returns preference if exists, else defaults to { myLanguage: "en", viewLanguage: "en" }
 */
export async function getDefaultLanguagePreference(
  userId: string,
  chatId: string
): Promise<{ myLanguage: string; viewLanguage: string }> {
  const preference = await getLanguagePreference(userId, chatId);

  if (preference) {
    return {
      myLanguage: preference.myLanguage,
      viewLanguage: preference.viewLanguage,
    };
  }

  return {
    myLanguage: 'en',
    viewLanguage: 'en',
  };
}

/**
 * Get all unique viewLanguages from all members in a chat
 * Returns array of unique language codes (default "en" if not set)
 */
export async function getAllMembersViewLanguages(
  chatId: string
): Promise<string[]> {
  // Get all members
  const members = await prisma.chatMember.findMany({
    where: {
      chatId,
    },
    include: {
      user: {
        select: {
          id: true,
        },
      },
    },
  });

  // Get preferences for all members
  const preferences = await prisma.chatLanguagePreference.findMany({
    where: {
      chatId,
      userId: {
        in: members.map(m => m.userId),
      },
    },
  });

  // Create a map of userId -> viewLanguage
  const preferenceMap = new Map<string, string>();
  preferences.forEach(p => {
    preferenceMap.set(p.userId, p.viewLanguage);
  });

  // Get unique viewLanguages (default "en" if not set)
  const viewLanguages = new Set<string>();
  members.forEach(member => {
    const viewLang = preferenceMap.get(member.userId) || 'en';
    viewLanguages.add(viewLang);
  });

  return Array.from(viewLanguages);
}

