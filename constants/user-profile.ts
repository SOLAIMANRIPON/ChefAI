import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_PROFILE_KEY = 'chefai_user_profile_v1';

export type UserProfile = {
  name: string;
  dietPreference: 'None' | 'Vegetarian' | 'Vegan' | 'Halal';
  cookingLevel: 'Beginner' | 'Intermediate' | 'Advanced';
  allergies: string;
};

export const DEFAULT_USER_PROFILE: UserProfile = {
  name: '',
  dietPreference: 'None',
  cookingLevel: 'Beginner',
  allergies: '',
};

export async function loadUserProfile(): Promise<UserProfile> {
  try {
    const raw = await AsyncStorage.getItem(USER_PROFILE_KEY);
    if (!raw) return DEFAULT_USER_PROFILE;
    const parsed = JSON.parse(raw) as Partial<UserProfile> | null;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_USER_PROFILE;
    return {
      name: typeof parsed.name === 'string' ? parsed.name : DEFAULT_USER_PROFILE.name,
      dietPreference:
        parsed.dietPreference === 'Vegetarian' ||
        parsed.dietPreference === 'Vegan' ||
        parsed.dietPreference === 'Halal' ||
        parsed.dietPreference === 'None'
          ? parsed.dietPreference
          : DEFAULT_USER_PROFILE.dietPreference,
      cookingLevel:
        parsed.cookingLevel === 'Intermediate' ||
        parsed.cookingLevel === 'Advanced' ||
        parsed.cookingLevel === 'Beginner'
          ? parsed.cookingLevel
          : DEFAULT_USER_PROFILE.cookingLevel,
      allergies:
        typeof parsed.allergies === 'string' ? parsed.allergies : DEFAULT_USER_PROFILE.allergies,
    };
  } catch {
    return DEFAULT_USER_PROFILE;
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const safe: UserProfile = {
    name: profile.name.trim().slice(0, 60),
    dietPreference: profile.dietPreference,
    cookingLevel: profile.cookingLevel,
    allergies: profile.allergies.trim().slice(0, 140),
  };
  await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(safe));
}
