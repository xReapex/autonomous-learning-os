import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { clearLocalSessionData } from './account-session-core';
import { legacyTechnicalSessionKey } from './secure-store-keys';

export function clearLocalSessionDataOnDevice(): Promise<void> {
  return clearLocalSessionData({
    clearSession: () => SecureStore.deleteItemAsync(legacyTechnicalSessionKey),
    removeStorage: async (keys) => {
      await AsyncStorage.multiRemove([...keys]);
    },
  });
}
