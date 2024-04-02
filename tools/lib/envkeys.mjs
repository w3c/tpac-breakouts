import path from 'path';
import { execSync } from 'child_process';

let config = null;
let repoConfig = null;

/**
 * Retrieve the requested variable from the environment or from the
 * `config.json` file in the current working directory if it exists.
 * 
 * Function throws if the environment key is missing, unless a default
 * value was provided.
 */
export async function getEnvKey(key, defaultValue, json) {
  // If the environment explicitly defines the key, that's good, let's use it!
  if (Object.hasOwn(process.env, key)) {
    return json ? JSON.parse(process.env[key]) : process.env[key];
  }

  // Initialize the local configuration from the config.json file, if defined
  // (note that is done only once)
  try {
    if (!config) {
      const configFileUrl = 'file:///' +
        path.join(process.cwd(), 'config.json').replace(/\\/g, '/');
      const { default: env } = await import(
        configFileUrl,
        { assert: { type: 'json' } }
      );
      config = env;
    }
  }
  catch {
  }

  // Retrieve variables from the GitHub repo directly through the "gh" CLI.
  try {
    const repoVariablesStr = execSync(`gh variable list --json name,value`);
    const repoVariables = JSON.parse(repoVariablesStr);
    repoConfig = {};
    for (const variable of repoVariables) {
      repoConfig[variable.name] = variable.value;
    }
  }
  catch {
  }

  if (config && Object.hasOwn(config, key)) {
    return config[key];
  }
  else if (repoConfig && Object.hasOwn(repoConfig, key)) {
    return repoConfig[key];
  }
  else if (defaultValue !== undefined) {
    return defaultValue;
  }
  throw new Error(`No ${key} found in environment of config file.`);
}