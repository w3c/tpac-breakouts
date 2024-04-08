import { getEnvKey, setEnvKey, resetEnvKeys } from '../tools/lib/envkeys.mjs';
import { resetGraphQLCache } from '../tools/lib/graphql.mjs';
import { resetSectionHandlers } from '../tools/lib/session.mjs';
import { resetW3CCache } from '../tools/lib/w3c.mjs';

export function initTestEnv() {
  resetEnvKeys();
  resetGraphQLCache();
  resetSectionHandlers();
  resetW3CCache();
  setEnvKey('STUB_REQUESTS', true);
  setEnvKey('PROJECT_OWNER', 'test');
}