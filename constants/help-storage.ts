import AsyncStorage from '@react-native-async-storage/async-storage';

const NEW_KEY = 'chefai_help_picker_value_v1';
const LEGACY_KEY = 'chefai_help_language_v1';

export async function getSavedHelpPickerValue(): Promise<string | null> {
  try {
    const v = (await AsyncStorage.getItem(NEW_KEY))?.trim();
    if (v) return v;
    const old = (await AsyncStorage.getItem(LEGACY_KEY))?.trim();
    if (!old) return null;
    const migrated =
      old === 'en'
        ? 'English'
        : old === 'bn'
          ? 'বাংলা'
          : old === 'hi'
            ? 'Hindi'
            : old === 'ur'
              ? 'Urdu'
              : null;
    if (migrated) {
      try {
        await AsyncStorage.setItem(NEW_KEY, migrated);
      } catch {
        /* ignore */
      }
    }
    return migrated;
  } catch {
    return null;
  }
}

export async function setSavedHelpPickerValue(value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(NEW_KEY, value.trim());
  } catch {
    /* ignore */
  }
}
