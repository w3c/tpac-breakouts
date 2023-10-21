import path from 'path';

let config = null;

/**
 * Retrieve the requested variable from the environment or from the
 * `config.json` file in the current working directory if it exists.
 * 
 * Function throws if the environment key is missing, unless a default
 * value was provided.
 */
export async function getEnvKey(key, defaultValue, json) {
  if (Object.hasOwn(process.env, key)) {
    return json ? JSON.parse(process.env[key]) : process.env[key];
  }
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
  finally {
    if (config && Object.hasOwn(config, key)) {
      return config[key];
    }
    else if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`No ${key} found in environment of config file.`);
  }
}