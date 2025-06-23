import { sendGraphQLRequest } from './graphql.mjs';
import { getEnvKey } from './envkeys.mjs';
import { base64Encode } from './base64.mjs';
import { sleep } from './sleep.mjs';
import bundleFiles from '../../files/bundle.mjs';

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
  console.log(`Retrieve the ID of GitHub owner ${repo.owner}`);
  repo.ownerId = await getRepositoryOwnerId(repo);
  if (!repo.ownerId) {
    return repo;
  }

  // Create the repository
  console.log(`Create new ${repo.type} repository ${repo.owner}/${repo.name}`);
  repo.repoId = await cloneTemplateRepository(repo);

  // Create "session" label
  console.log(`Create "session" label`);
  await createSessionLabel(repo.repoId);

  // Copy files to the repository
  console.log(`Copy files to the newly created repository`);
  await copyFiles(project);

  return repo;
}


/**
 * Get the GitHub ID of the repository owner
 */
async function getRepositoryOwnerId(repo) {
  const query = `query {
    ${repo.type}(login: "${repo.owner}") {
      id
      repository(name: "${repo.name}") {
        id
      }
    }
  }`;
  const res = await sendGraphQLRequest(query);
  if (!res?.data?.[repo.type]?.id) {
    console.log(query);
    console.log(JSON.stringify(res, null, 2));
    throw new Error(`GraphQL error, could not retrieve the GitHub repository owner ID`);
  }
  if (res.data[repo.type].repository) {
    // Repository already exists!
    return null;
  }
  return res.data[repo.type].id;
}


/**
 * Clone the template repository into a new one.
 *
 * Note: The clone query returns before Git operations take place and there's
 * no easy way to tell when the operation is going to be over. The function
 * sleeps 30s after the clone query to give GitHub some time to perform them.
 * The `getGitObjectId` function will also retry the query a few times if
 * needed.
 */
async function cloneTemplateRepository(repo) {
  const REPO_TEMPLATE = await getEnvKey('REPO_TEMPLATE');
  const templateRepo = parseRepositoryName(REPO_TEMPLATE);
  const templateId = await getRepositoryId(templateRepo);
  const query = `mutation {
    cloneTemplateRepository(input: {
      clientMutationId: "mutatis mutandis"
      name: "${repo.name}"
      ownerId: "${repo.ownerId}"
      visibility: PUBLIC
      repositoryId: "${templateId}"
    }) {
      repository {
        id
      }
    }
  }`;

  const res = await sendGraphQLRequest(query);
  if (!res?.data?.cloneTemplateRepository?.repository?.id) {
    console.log(query);
    console.log(JSON.stringify(res, null, 2));
    throw new Error(`GraphQL error, could not clone template repository`);
  }
  await sleep(30000);
  return res.data.cloneTemplateRepository.repository.id;
}


/**
 * Create the "session" label needed by the issue template
 */
async function createSessionLabel(repoId) {
  const query = `mutation {
    createLabel(input: {
      repositoryId: "${repoId}"
      name: "session"
      color: "C2E0C6"
      description: "Breakout session proposal"
      clientMutationId: "mutatis mutandis"
    }) {
      label {
        id
      }
    }
  }`;
  const res = await sendGraphQLRequest(query);
  if (!res?.data?.createLabel?.label?.id) {
    console.log(query);
    console.log(JSON.stringify(res, null, 2));
    throw new Error(`GraphQL error, could not create "session" label`);
  }
}


/**
 * Copy workflows and issue template files to the cloned repository
 *
 * Note: the GRAPHQL_TOKEN token must have GitHub actions workflows update
 * permissions otherwise function will fail!
 */
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

  bundleFiles['README.md'] = `# ${project.title}`;

  const fileChanges = Object.entries(bundleFiles)
    .map(([file, contents]) => {
      file = file
        .replace(/^workflows\//, '.github/workflows/');
      if (file.startsWith('issue-created')) {
        // Depends on event type!
        if (!file.endsWith(project.metadata.fullType + '.md')) {
          return null;
        }
        file = '.github/session-created.md';
      }
      if (file.startsWith('issue-template')) {
        // Depends on event type!
        if (!file.endsWith(project.metadata.fullType + '.yml')) {
          if (file.endsWith('.yml') &&
              file.indexOf(project.metadata.fullType + '-') !== -1) {
            // Additional issue template specific to the event type
            file = '.github/ISSUE_TEMPLATE/' +
              file.substring(
                `issue-template/${project.metadata.fullType}-`.length);
          }
          return null;
        }
        file = '.github/ISSUE_TEMPLATE/session.yml';
      }
      return {
        path: file,
        contents: base64Encode(contents)
      };
    })
    .filter(change => change)
    .map(change => `{
      path: "${change.path}",
      contents: "${change.contents}"
    }`)
    .join(',\n');

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
        additions: [${fileChanges}]
      }
    }) {
      commit {
        id
        commitUrl
      }
    }
  }`;
  const res = await sendGraphQLRequest(query);
  if (!res?.data?.createCommitOnBranch?.commit?.id) {
    console.log(query);
    console.log(JSON.stringify(res, null, 2));
    throw new Error(`GraphQL error, could not add files to the repository`);
  }
}


/**
 * Retrieve the GitHub ID of a repository
 */
async function getRepositoryId(repo) {
  const query = `query {
    ${repo.type}(login: "${repo.owner}") {
      repository(name: "${repo.name}") {
        id
      }
    }
  }`;
  const res = await sendGraphQLRequest(query);
  if (!res?.data?.[repo.type]?.repository?.id) {
    console.log(query);
    console.log(JSON.stringify(res, null, 2));
    throw new Error(`GraphQL error, could not retrieve the repository ID`);
  }
  return res.data[repo.type].repository.id;
}


/**
 * Retrieve the HEAD's Git commit ID
 *
 * Note: The function retries a few times before it surrenders to give the
 * clone operation more time to finish if needed.
 */
async function getGitObjectId(repo, counter) {
  const query = `query {
    ${repo.type}(login: "${repo.owner}") {
      repository(name: "${repo.name}") {
        object(expression: "HEAD") {
          oid
        }
      }
    }
  }`;
  const res = await sendGraphQLRequest(query);
  if (!res?.data?.[repo.type]?.repository) {
    console.log(query);
    console.log(JSON.stringify(res, null, 2));
    throw new Error(`GraphQL error, could not retrieve last commit ID`);
  }
  if (!res.data[repo.type].repository.object) {
    // Not yet available, we should wait a bit before we try again, as cloning
    // takes some time. We'll just surrender after a while.
    if (counter) {
      counter += 1;
    }
    else {
      counter = 1;
    }
    if (counter > 10) {
      throw new Error(`Still no content in repository after a while!`);
    }
    await sleep(5000);
    return getGitObjectId(repo, counter);
  }
  return res.data[repo.type].repository.object.oid;
}
