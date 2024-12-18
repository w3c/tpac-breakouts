import { getEnvKey, setEnvKey, resetEnvKeys } from '../tools/common/envkeys.mjs';
import { resetGraphQLCache } from '../tools/common/graphql.mjs';
import { resetSectionHandlers } from '../tools/common/session.mjs';
import { resetW3CCache } from '../tools/common/w3c.mjs';

export function initTestEnv() {
  resetEnvKeys();
  resetGraphQLCache();
  resetSectionHandlers();
  resetW3CCache();
  setEnvKey('STUB_REQUESTS', true);
  setEnvKey('PROJECT_OWNER', 'test');
}