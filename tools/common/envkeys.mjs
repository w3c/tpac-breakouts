let localConfig = {};
let fileConfig = null;
let repoName = null;
let repoConfig = null;

/**
 * Retrieve the requested variable from the environment or from the
 * `config.json` file in the current working directory if it exists.
 * 
 * Function throws if the environment key is missing, unless a default
 * value was provided.
 */
export async function getEnvKey(key, defaultValue, json) {
  // If the environment key was set through a call to setEnvKey, let's use it!
  // (typically used in tests)
  if (Object.hasOwn(localConfig, key)) {
    return json ? JSON.parse(localConfig[key]) : localConfig[key];
  }

  // If the environment explicitly defines the key, that's good, let's use it!
  if (typeof process !== 'undefined' && Object.hasOwn(process.env, key)) {
    return json ? JSON.parse(process.env[key]) : process.env[key];
  }

  // Initialize the local configuration from the config.json file, if defined
  // (note that is done only once)
  if (!fileConfig) {
    fileConfig = {};
    if (typeof process !== 'undefined') {
      const path = await import('node:path');
      try {
        const configFileUrl = 'file:///' +
          path.join(process.cwd(), 'config.json').replace(/\\/g, '/');
        const { default: env } = await import(
          configFileUrl,
          { with: { type: 'json' } }
        );
        fileConfig = env;
      }
      catch {
      }
    }
  }
  if (Object.hasOwn(fileConfig, key)) {
    return fileConfig[key];
  }

  // Retrieve the variable from sheet environment properties if the code
  // runs within the context of an AppScript.
  if (typeof PropertiesService !== 'undefined') {
    const scriptProperties = PropertiesService.getScriptProperties();
    const value = scriptProperties.getProperty(key);
    if (value) {
      return value;
    }
  }

  // If we're running in a node.js process, leverage the `gh` CLI command to
  // get the variable, either from the local context for the repository name
  // or from the GitHub repository itself.
  if (typeof process !== 'undefined') {
    if (key === 'REPOSITORY' || !repoConfig) {
      const childProcess = await import('node:child_process');
      const execSync = childProcess.execSync;

      try {
        if (key === 'REPOSITORY') {
          if (!repoName) {
            const repoStr = execSync(`gh repo view --json nameWithOwner`);
            repoName = JSON.parse(repoStr).nameWithOwner;
          }
          return repoName;
        }
        else {
          repoConfig = {};
          const repoVariablesStr = execSync(`gh variable list --json name,value`);
          const repoVariables = JSON.parse(repoVariablesStr);
          for (const variable of repoVariables) {
            repoConfig[variable.name] = variable.value;
          }
        }
      }
      catch {
      }
    }
  }
  if (repoConfig && Object.hasOwn(repoConfig, key)) {
    return json ? JSON.parse(repoConfig[key]) : repoConfig[key];
  }

  // Variable not found, return default value otherwise, or alert that
  // it's missing.
  if (defaultValue !== undefined) {
    return defaultValue;
  }
  throw new Error(`No ${key} found in environment of config file.`);
}


/**
 * Set the environment variable for next getEnvKey calls.
 * (useful in tests)
 */
export async function setEnvKey(key, value, json) {
  localConfig[key] = json ? JSON.stringify(value) : value;
}


/**
 * Reset the local runtime environment (useful in tests)
 */
export async function resetEnvKeys() {
  localConfig = {};
  fileConfig = {};
  repoConfig = {};
}