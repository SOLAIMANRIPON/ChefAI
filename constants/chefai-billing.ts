import AsyncStorage from '@react-native-async-storage/async-storage';

export const CHEFAI_INSTALL_ID_STORAGE_KEY = 'chefai_install_id_v1';
/** Must match server expectation (32 lowercase hex chars). */
export const CHEFAI_INSTALL_HEADER = 'X-ChefAI-Install-Id';

function randomHex32(): string {
  let out = '';
  for (let i = 0; i < 32; i += 1) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

export async function getOrCreateChefAiInstallId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(CHEFAI_INSTALL_ID_STORAGE_KEY);
    if (existing && /^[\da-f]{32}$/i.test(existing.trim())) {
      return existing.trim().toLowerCase();
    }
  } catch {
    // fall through to mint a fresh id
  }
  const created = randomHex32();
  try {
    await AsyncStorage.setItem(CHEFAI_INSTALL_ID_STORAGE_KEY, created);
  } catch {
    // Still return an id for this session even if persistence fails.
  }
  return created;
}

export type RecipeBillingSnapshot = {
  credits: number;
  creditCostTextRecipe: number;
  creditCostPhotoRecipe: number;
  billingDisabled?: boolean;
};
