import * as SecureStore from 'expo-secure-store';

export type Language = 'ar' | 'en' | 'tr';
const LANGUAGE_KEY = 'star_ai_language';

export async function getLanguage(): Promise<Language> {
  const value = await SecureStore.getItemAsync(LANGUAGE_KEY);
  return value === 'en' || value === 'tr' ? value : 'ar';
}

export async function setLanguage(language: Language) {
  await SecureStore.setItemAsync(LANGUAGE_KEY, language);
}
