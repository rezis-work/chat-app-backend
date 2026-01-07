/**
 * Translation provider interface and implementations
 */

export interface TranslationProvider {
  translate(text: string, fromLang: string, toLang: string): Promise<string>;
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
 * - In dev: returns MockTranslationProvider (OpenAI integration in Task 8)
 */
export function getTranslationProvider(): TranslationProvider {
  if (process.env.NODE_ENV === 'test') {
    return new MockTranslationProvider();
  }
  // For dev, use mock for now. OpenAI integration in Task 8
  return new MockTranslationProvider();
}
