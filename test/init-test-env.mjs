import { getEnvKey, setEnvKey, resetEnvKeys } from '../tools/node/lib/envkeys.mjs';
import { resetGraphQLCache } from '../tools/node/lib/graphql.mjs';
import { resetSectionHandlers } from '../tools/common/session.mjs';
import { resetW3CCache } from '../tools/node/lib/w3c.mjs';

export function initTestEnv() {
  resetEnvKeys();
  resetGraphQLCache();
  resetSectionHandlers();
  resetW3CCache();
  setEnvKey('STUB_REQUESTS', true);
  setEnvKey('PROJECT_OWNER', 'test');
}