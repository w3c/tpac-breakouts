import { sendGraphQLRequest } from './graphql.mjs';
import { serializeSessionDescription } from '../../common/session.mjs';

/**
 * Update session description
 */
export async function updateSessionDescription(session) {
  const body = serializeSessionDescription(session.description);
  const query = `mutation {
    updateIssue(input: {
      id: "${session.id}",
      body: "${body.replaceAll('\\', '\\\\').replaceAll(/\r?\n/g, '\\n').replaceAll('"', '\\"')}"
    }) {
      issue {
        id
      }
    }
  }`;
  const res = await sendGraphQLRequest(query);
  if (!res?.data?.updateIssue?.issue?.id) {
    console.log(JSON.stringify(res, null, 2));
    throw new Error(`GraphQL error, could not update issue body`);
  }
}