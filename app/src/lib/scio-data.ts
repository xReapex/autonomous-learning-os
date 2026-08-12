import { join } from 'node:path';

import { createMobileDataHandlers } from './mobile-data-handlers';
import { loadMobileDefaultData } from './mobile-default-data';
import { scioAuthStoreFromEnvironment } from './scio-auth';
import { createScioUserDataStore } from './scio-user-data-store';

export function scioUserDataStoreFromEnvironment() {
  const configuredDirectory = process.env.SCIO_USER_DATA_DIR?.trim();
  const baseDirectory = process.env.LEARNING_DATA_DIR?.trim() || join(process.cwd(), '.data');
  return createScioUserDataStore({
    dataDirectory: configuredDirectory || join(baseDirectory, 'scio-user-data'),
  });
}

export function mobileDataHandlersFromEnvironment() {
  return createMobileDataHandlers({
    auth: scioAuthStoreFromEnvironment(),
    users: scioUserDataStoreFromEnvironment(),
    loadDefaultData: loadMobileDefaultData,
  });
}
