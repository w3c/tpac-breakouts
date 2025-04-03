import { sendGraphQLRequest } from './graphql.mjs';
import { base64Encode } from './base64.mjs';
import bundleFiles from '../../files/bundle.mjs';

const REPO_TEMPLATE = 'tidoust/tpac-breakouts-template';

/**
 * Parse a reponame string to get the type (user or organization), owner and
 * actual repository name
 */
export function parseRepositoryName(reponame) {
  const repoparts = reponame.split('/');
  return {
    type: repoparts.length > 1 && repoparts[0].startsWith('user:') ? 'user': 'organization',
    owner: repoparts.length > 1 ? repoparts[0].replace(/^user:/, '') : 'w3c',
    name: repoparts.length > 1 ? repoparts[1] : repoparts[0]
  };
}

/**
 * Create and initialize the GitHub repository for the event
 */
export async function createRepository(project) {
  // Gather the repository owner ID and make sure the repository does not
  // exist yet
  const repo = parseRepositoryName(project.metadata.reponame);
  repo.ownerId = await getRepositoryOwnerId(repo);
  if (!repo.ownerId) {
    return repo;
  }

  // Create the repository
  const repoId = await cloneTemplateRepository(repo);

  // Copy files to the repository
  await copyFiles(project);

  // Create "session" label
  await createSessionLabel(repo);

  return repo;
}


async function getRepositoryOwnerId(repo) {
  const query = `query {
    ${repo.type} (login: "${repo.owner}") {
      id
      repository(name: "${repo.name}") {
        id
      }
    }`;
  const res = await sendGraphQLRequest(query);
  if (!res?.data?.[repo.type]?.id) {
    console.log(JSON.stringify(res, null, 2));
    throw new Error(`GraphQL error, could not retrieve the GitHub repository owner ID`);
  }
  if (res.data[repo.type].repository) {
    // Repository already exists!
    return null;
  }
  return res.data[repo.type].id;
}

async function cloneTemplateRepository(repo) {
  const templateRepo = {
    type: 'user',
    owner: 'tidoust',
    name: 'tpac-breakouts-template'
  };
  const templateId = await getRepository(templateRepo);
  const query = `mutation {
    cloneTemplateRepository(input: {
      clientMutationId: "mutatis mutandis"
      name: "${repo.name}"
      ownerId: "${repo.ownerId}"
      visibility: PRIVATE
      repositoryId: "${templateId}"
    }) {
      repository {
        id
      }
    }
  }`;

  const res = await sendGraphQLRequest(createQuery);
  if (!res?.data?.repository?.id) {
    console.log(JSON.stringify(res, null, 2));
    throw new Error(`GraphQL error, could not clone template repository`);
  }
  return res.data.repository.id;
}

async function copyFiles(project) {
  const repo = parseRepositoryName(project.metadata.reponame);

  bundleFiles['package.json'] = JSON.stringify({
    dependencies: {
      'tpac-breakouts': 'github:w3c/tpac-breakouts'
    }
  }, null, 2);

  bundleFiles['w3c.json'] = JSON.stringify({
    groups: [106],
    contacts: ['tidoust', 'ianbjacobs'],
    'repo-type': 'project'
  });

  bundleFiles['README.md'] = `# ${project.metadata.title}`;

  const fileChanges = Object.entries(bundleFiles)
    .map(([file, contents]) => {
      file = file
        .replace(/^workflows\//, '.github/workflows/')
        .replace(/^session-created/, '.github/session-created');
      if (file.startsWith('issue-template')) {
        // Depends on event type!
        if (!file.endsWith(project.metadata.fullType + '.yml')) {
          return null;
        }
        file = '.github/ISSUE_TEMPLATE/session.yml';
      }
      return {
        path: file,
        contents: base64Encode(contents)
      };
    })
    .filter(change => change);

  // Retrieve the last commit
  const headOid = await getGitObjectId(repo);

  const query = `mutation {
    createCommitOnBranch(input: {
      clientMutationId: "mutatis mutandis"
      branch: {
        repositoryNameWithOwner: "${repo.owner}/${repo.name}"
        branchName: "main"
      }
      message: {
        headline: "Setup repository"
      }
      expectedHeadOid: "${headOid}"
      fileChanges: {
        additions: ${JSON.stringify(fileChanges, null, 2)}
      }
    }) {
      commit {
        id
        commitUrl
      }
    }
  }`;
  const res = await sendGraphQLRequest(query);
  if (!res?.data?.commit?.id) {
    console.log(JSON.stringify(res, null, 2));
    throw new Error(`GraphQL error, could not add files to the repository`);
  }
}

async function createSessionLabel(repoId) {
  const query = `mutation {
    createLabel(input: {
      repositoryId: "${repoId}",
      name: "session",
      color: "C2E0C6",
      description: "Breakout session proposal",
      clientMutationId: "mutatis mutandis"
    }) {
      label {
        id
      }
    }
  }`
  const res = await sendGraphQLRequest(query);
  if (!res?.data?.label?.id) {
    console.log(JSON.stringify(res, null, 2));
    throw new Error(`GraphQL error, could not create "session" label`);
  }
}

async function getRepositoryId(repo) {
  const query = `query {
    ${repo.type} (login: "${repo.owner}") {
      repository(name: "${repo.name}") {
        id
      }
    }`;
  const res = await sendGraphQLRequest(query);
  if (!res?.data?.repository?.id) {
    console.log(JSON.stringify(res, null, 2));
    throw new Error(`GraphQL error, could not retrieve last commit ID`);
  }
  return res.data.repository.id;
}

async function getGitObjectId(repo) {
  const query = `query {
    ${repo.type} (login: "${repo.owner}") {
      repository(name: "${repo.name}") {
        object(expression: "HEAD") {
          oid
        }
      }
    }`;
  const res = await sendGraphQLRequest(query);
  if (!res?.data?.repository?.object?.oid) {
    console.log(JSON.stringify(res, null, 2));
    throw new Error(`GraphQL error, could not retrieve last commit ID`);
  }
  return res.data.repository.object.oid;
}