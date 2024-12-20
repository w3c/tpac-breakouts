import path from 'node:path';
import fs from 'fs/promises';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import util from 'node:util';

/**
 * The template project on GitHub for group meetings and breakouts
 */
const templateProjects = {
  group: 81,      // TODO: create a real project template
  breakouts: 57   // TODO: create a real project template
}

const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function run(cmd, options) {
  try {
    const { stdout, stderr } = await util.promisify(exec)(cmd, options);
    if (stderr && !options?.ignoreErrors) {
      console.error(`Could not run command: ${cmd}`);
      console.error(stderr);
      process.exit(1);
    }
    return { stdout, stderr };
  }
  catch (err) {
    if (options.ignoreErrors) {
      return { stdout: '', stderr: err.toString() };
    }
    else {
      console.error(`Could not run command: ${cmd}`);
      console.error(stderr);
      process.exit(1);
    }
  }
}

export default async function (jsonfile, options) {
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
      path.join(templateSource,
        project.metadata.type === 'group' ? 'meeting.yml' : 'session.yml'),
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

    await run('git commit -m "Synchronize content with w3c/tpac-breakouts" || true', { cwd: repo.name });
  }

  // Step: Push git changes to GitHub
  {
    console.log(`- Push changes to "${repo.owner}/${repo.name}"`);
    {
      const { stdout, stderr } = await run('git push origin main', { cwd: repo.name, ignoreErrors: true });
      if (stderr &&
          !stderr.match(/Everything up-to-date/) &&
          !stderr.match(/To github.com:/)) {
        console.error(`Could not run "git push origin main" in folder "${repo.name}"`);
        console.error(stderr);
        process.exit(1);
      }
    }
  }

  // Step: Create session label on GitHub
  {
    console.log(`- Create session label in "${repo.owner}/${repo.name}"`);
    console.log('TODO');
  }

  // Step: Create GitHub project if needed
  {
    console.log(`- Retrieve/Create associated GitHub project`);
    const { stdout } = await run('gh repo view --json projectsV2', { cwd: repo.name });
    const projectsV2 = JSON.parse(stdout);
    const gProject = {};
    if (projectsV2?.Nodes?.length === 0) {
      const { stdout } = await run(`gh project copy ${templateProjects[project.metadata.type]} --source-owner w3c --target-owner ${repo.owner} --title "${project.title}"`);
      // stdout should contain a URL like:
      //  https://github.com/users/tidoust/projects/xx
      // or
      //  https://github.com/orgs/w3c/projects/xx
      gProject.url = stdout.trim();
      gProject.number = parseInt(gProject.match(/\/projects\/(\d+)$/)[1], 10);
      await run(`gh project link ${gProject.number} --owner w3c`)
    }
    else {
      gProject.number: projectsV2.Nodes[0].number,
      gProject.url = projectsV2.Nodes[0].url;
    }
  }

  // Step: Fill out project settings as needed
  {
    console.log(`- Refresh project settings as needed`);
    console.log('TODO!');
  }
}
