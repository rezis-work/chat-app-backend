import { Response, NextFunction } from 'express';
import {
  setLanguagePreference,
  getLanguagePreference,
} from './language-preferences.service';
import type { SetLanguagePreferenceInput } from './language-preferences.validation';
import type { AuthRequest } from '../../middleware/auth';

/**
 * Set language preference endpoint handler
 * PUT /chats/:chatId/language
 */
export async function setLanguagePreferenceHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { chatId } = req.params;
    const { myLanguage, viewLanguage } = req.body as SetLanguagePreferenceInput;
    const userId = req.user!.userId;

    const preference = await setLanguagePreference(
      userId,
      chatId,
      myLanguage,
      viewLanguage
    );

    res.json({
      ok: true,
      preference: {
        id: preference.id,
        chatId: preference.chatId,
        userId: preference.userId,
        myLanguage: preference.myLanguage,
        viewLanguage: preference.viewLanguage,
        createdAt: preference.createdAt,
        updatedAt: preference.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get language preference endpoint handler
 * GET /chats/:chatId/language
 */
export async function getLanguagePreferenceHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { chatId } = req.params;
    const userId = req.user!.userId;

    const preference = await getLanguagePreference(userId, chatId);

    if (!preference) {
      res.json({
        ok: true,
        preference: null,
        defaults: {
          myLanguage: 'en',
          viewLanguage: 'en',
        },
      });
      return;
    }

    res.json({
      ok: true,
      preference: {
        id: preference.id,
        chatId: preference.chatId,
        userId: preference.userId,
        myLanguage: preference.myLanguage,
        viewLanguage: preference.viewLanguage,
        createdAt: preference.createdAt,
        updatedAt: preference.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}
