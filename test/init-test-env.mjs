import { getEnvKey, setEnvKey, resetEnvKeys } from '../tools/lib/envkeys.mjs';
import { resetGraphQLCache } from '../tools/lib/graphql.mjs';
import { resetSectionHandlers } from '../tools/lib/session.mjs';

export function initTestEnv() {
  resetEnvKeys();
  resetGraphQLCache();
  resetSectionHandlers();
  setEnvKey('STUB_REQUESTS', true);
  setEnvKey('PROJECT_OWNER', 'test');
}