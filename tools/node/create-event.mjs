import path from 'node:path';
import fs from 'fs/promises';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { exportProjectToGitHub } from '../common/project.mjs';
import util from 'node:util';

const __dirname = fileURLToPath(new URL('.', import.meta.url));


export default async function (jsonfile, options) {
  console.log(`----- MAGIC BEGINS -----`);
  console.log(`- Read event data from JSON file`);
  const data = await fs.readFile(jsonfile, 'utf8');
  const project = JSON.parse(data);
  
  // Make sure that we have what we need
  if (!project.title) {
    console.warn('No "title" property found in the provided JSON file.');
    process.exit(1);
  }
  if (!project.metadata) {
    console.warn('No "metadata" property found in the provided JSON file.');
    process.exit(1);
  }
  if (!project.metadata.type in ['group', 'breakouts']) {
    console.warn('The "metadata.type" property must be one of "group" or "breakouts".');
    process.exit(1);
  }
  if (!project.metadata.reponame) {
    console.warn('The "metadata.reponame" property must be set to the name of the repository to create.');
    process.exit(1);
  }
  if (project.rooms.length === 0) {
    console.warn('At least one room must be defined. Room name may remain a placeholder (like "Room 1")');
    process.exit(1);
  }
  if (project.days.length === 0) {
    console.warn('At least one day must be defined.');
    process.exit(1);
  }
  if (project.slots.length === 0) {
    console.warn('At least one slot must be defined.');
    process.exit(1);
  }

  const repoparts = project.metadata.reponame.split('/');
  const repo = {
    owner: repoparts.length > 1 ? repoparts[0] : 'w3c',
    name: repoparts.length > 1 ? repoparts[1] : repoparts[0]
  };

  // Make sure the command is not running from within another Git repository
  // (this would confuse the "npm install" command)
  {
    const { stdout, stderr } = await run(`git status`, { ignoreErrors: true });
    if (stderr && stderr.match(/not a git repository/)) {
      // Great if that fails!
    }
    else {
      console.error('Command cannot run from within a Git repository!');
      process.exit(1);
    }
  }


  // Step: Create the repository on GitHub if not already done
  {
    console.log(`- Create "${repo.owner}/${repo.name}" repository on GitHub if needed`);
    const { stdout, stderr } = await run(`gh repo create ${repo.owner}/${repo.name} --private --clone`, { ignoreErrors: true });
    if (stderr) {
      if (stderr.match(/Name already exists/)) {
        // Repository already exists, no need to worry about that!
        // Note: we'll assume that, if the local folder exists, it is setup to
        // be a clone of the GitHub repo already.
      }
      else {
        console.error(`Could not create GitHub repository "${repo.owner}/${repo.name}"`);
        console.error(stderr);
        process.exit(1);
      }
    }
  }

  // Step: Create local folder if it does not exist already
  // (setting "recursive" to true makes function fail silently if folder
  // already exists)
  {
    console.log(`- Clone GitHub repository to "${repo.name}" folder`);
    try {
      await fs.stat(repo.name);
    }
    catch (err) {
      if (err.code === 'ENOENT') {
        await run(`gh repo clone ${repo.owner}/${repo.name} -- --quiet`);
      }
      else {
        throw err;
      }
    }
    
  }
  
  // Step: Make local folder a git repository if not already done
  {
    console.log(`- Run git init in "${repo.name}" folder`);
    await run('git init', { cwd: repo.name });
  }

  // Step: Copy files to local folder, but don't override README.md
  // if it already exists.
  {
    console.log(`- Copy content to "${repo.name}" folder`);
    const filesSource = path.join(__dirname, '..', '..', 'files');
    const templateSource = path.join(filesSource, 'issue-template');
    const templateDest = path.join(repo.name, '.github', 'ISSUE_TEMPLATE');
    await fs.mkdir(templateDest, { recursive: true });
    await fs.copyFile(
      path.join(templateSource, project.metadata.fullType + '.yml'),
      path.join(templateDest, 'session.yml')
    );

    const workflowsSource = path.join(filesSource, 'workflows');
    const workflowsDest = path.join(repo.name, '.github', 'workflows');
    await fs.mkdir(workflowsDest, { recursive: true });
    const folderContent = await fs.readdir(workflowsSource);
    await Promise.all(folderContent.map(async name => {
      const file = path.join(workflowsSource, name);
      return fs.copyFile(file, path.join(workflowsDest, name));
    }));

    if (project.metadata.type === 'groups') {
      // TODO: the validate-session job needs to be adjusted not to use
      // session-created.md!
    }
    else {
      await fs.copyFile(
        path.join(filesSource, 'session-created.md'),
        path.join(repo.name, '.github', 'session-created.md')
      );
    }

    // This repo's "w3c.json" should be good enough for the new repo
    await fs.copyFile(
      path.join(__dirname, '..', '..', 'w3c.json'),
      path.join(repo.name, 'w3c.json')
    );

    // This repo's ".gitignore" should also be good enough for the new repo.
    // It contains a couple of entries that are not needed, but so be it!
    await fs.copyFile(
      path.join(__dirname, '..', '..', '.gitignore'),
      path.join(repo.name, '.gitignore')
    );

    const readmeFile = path.join(repo.name, 'README.md');
    try {
      await fs.stat(readmeFile);
    }
    catch (err) {
      if (err.code === 'ENOENT') {
        await fs.writeFile(readmeFile, `# ${project.title}`, 'utf8');
      }
      else {
        throw err;
      }
    }
  }

  // Step: Add w3c/tpac-breakouts dependency
  {
    console.log(`- Install w3c/tpac-breakouts in "${repo.name}" folder`);
    await run('npm install w3c/tpac-breakouts', { cwd: repo.name });
  }

  // Step: Commit git changes in local folder
  {
    console.log(`- Commit changes in "${repo.name}" folder`);
    {
      const { stdout, stderr } = await run('git add -A', { cwd: repo.name, ignoreErrors: true });
      if (stderr && !stderr.split('\n').every(line =>
            line.startsWith('warning:') || !line.trim())) {
        console.error(`Could not run "git add -A" in folder "${repo.name}"`);
        console.error(stderr);
        process.exit(1);
      }
    }

    {
      const { stdout } = await run('git status', { cwd: repo.name });
      if (!stdout.match(/nothing to commit/)) {
        await run('git commit -m "Synchronize content with w3c/tpac-breakouts" --quiet', { cwd: repo.name });
      }
    }
  }

  // Step: Push git changes to GitHub
  {
    console.log(`- Push changes to "${repo.owner}/${repo.name}"`);
    {
      const { stdout, stderr } = await run('git push origin main', { cwd: repo.name, ignoreErrors: true });
      if (stderr &&
          !stderr.match(/Everything up-to-date/) &&
          !stderr.match(/To (.*)github\.com/)) {
        console.error(`Could not run "git push origin main" in folder "${repo.name}"`);
        console.error(stderr);
        process.exit(1);
      }
    }
  }

  // Step: Create session label on GitHub
  {
    console.log(`- Create session label in "${repo.owner}/${repo.name}"`);
    const desc = (project.metadata.type === 'groups') ?
      'Group meeting' : 'Breakout session proposal'
    const { stdout } = await run(`gh label create session --color C2E0C6 --description "${desc}" --force`, { cwd: repo.name });
  }

  // Step: Setup repository variables
  {
    console.log(`- Setup repository variables`);
    await exportProjectToGitHub(project, { what: 'all'});

    // TODO: export W3CID_MAP variable when this runs in the spreadsheet
    const { stdout } = await run(`gh variable list --json name`, { cwd: repo.name });
    const variables = JSON.parse(stdout);
    if (!variables.find(v => v.name === 'W3CID_MAP')) {
      await run(`gh variable set W3CID_MAP --body "{}"`, { cwd: repo.name });
    }
    if (!variables.find(v => v.name === 'W3C_LOGIN')) {
      await run(`gh variable set W3C_LOGIN --body "fd"`, { cwd: repo.name });
    }
  }

  console.log(
`----- MAGIC ENDS -----

----- MANUAL STEPS -----
The following should now exist:
- Repository: https://github.com/${repo.owner}/${repo.name}
- Repository clone: in "${repo.name}" subfolder

But you still have work to do!

Run the following actions (in any order):
- Give @tpac-breakout-bot write access to the repository at:
   https://github.com/${repo.owner}/${repo.name}/settings/access
- Set "watch" to "All Activity" for the repository to receive comments left on issues:
   https://github.com/${repo.owner}/${repo.name}
   (look for the dropdown menu named "Watch" or "Unwatch")
- Ask François (fd@w3.org) to set the "GRAPHQL_TOKEN" and "W3C_PASSWORD" repository secret. Sorry, not something you can do on your own for now!`);

  if (project.metadata.type !== 'groups') {
    console.log(`
Consider adding documentation to the repository:
- Add Wiki pages to the repository:
   https://github.com/${repo.owner}/${repo.name}/wiki
   see https://github.com/w3c/tpac2024-breakouts/wiki for inspiration
- Adjust the README as needed:
   https://github.com/${repo.owner}/${repo.name}/blob/main/README.md
   see https://github.com/w3c/tpac2024-breakouts/blob/main/README.md for inspiration`);
  }
}


/**
 * Helper function to run a bash command within the script and report result
 */
async function run(cmd, options) {
  try {
    const { stdout, stderr } = await util.promisify(exec)(cmd, options);
    if (stderr && !options?.ignoreErrors) {
      console.error(`Could not run command: ${cmd}`);
      console.error(stderr);
      process.exit(1);
    }
    return { stdout: stdout.trim(), stderr: stderr.trim() };
  }
  catch (err) {
    if (options?.ignoreErrors) {
      return { stdout: '', stderr: err.toString().trim() };
    }
    else {
      console.error(`Could not run command: ${cmd}`);
      console.error(err.toString());
      process.exit(1);
    }
  }
}