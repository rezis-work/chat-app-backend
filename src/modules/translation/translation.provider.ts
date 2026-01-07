/**
 * Translation provider interface and implementations
 */

import OpenAI from 'openai';
import { env } from '../../config/env';

export interface TranslationProvider {
  translate(text: string, fromLang: string, toLang: string): Promise<string>;
}

export class OpenAITranslationProvider implements TranslationProvider {
  private client: OpenAI;

  constructor() {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for OpenAI provider');
    }
    this.client = new OpenAI({
      apiKey,
    });
  }

  async translate(
    text: string,
    fromLang: string,
    toLang: string
  ): Promise<string> {
    const prompt = `Translate the following text from ${fromLang} to ${toLang}. Return only the translation. Preserve names, numbers, and punctuation marks exactly as they appear.

Text to translate:
${text}`;

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini', // Cost-effective model
      messages: [
        {
          role: 'system',
          content:
            'You are a professional translator. Return only the translated text, nothing else.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent translations
      max_tokens: 2000, // Reasonable limit
    });

    const translatedText = response.choices[0]?.message?.content?.trim();
    if (!translatedText) {
      throw new Error('OpenAI returned empty translation');
    }

    return translatedText;
  }
}

export class MockTranslationProvider implements TranslationProvider {
  async translate(
    text: string,
    _fromLang: string,
    _toLang: string
  ): Promise<string> {
    // Return reversed text as mock translation
    return text.split('').reverse().join('');
  }
}

/**
 * Factory function to get the appropriate translation provider
 * - In test: returns MockTranslationProvider
 * - In dev/prod: returns OpenAITranslationProvider if API key is set, otherwise MockTranslationProvider
 */
export function getTranslationProvider(): TranslationProvider {
  if (process.env.NODE_ENV === 'test') {
    return new MockTranslationProvider();
  }

  // In dev/prod, use OpenAI if API key is set
  if (env.OPENAI_API_KEY) {
    return new OpenAITranslationProvider();
  }

  // Fallback to mock if no API key (for local dev without OpenAI)
  return new MockTranslationProvider();
}
