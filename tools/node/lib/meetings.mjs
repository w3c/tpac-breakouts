import * as YAML from 'yaml';

/**
 * Parse a list of meetings changes defined in a YAML string.
 *
 * Meeting changes are used to apply local changes to a schedule.
 */
export function parseMeetingsChanges(yaml) {
  const resources = ['room', 'day', 'slot', 'meeting'];
  const yamlChanges = YAML.parse(yaml);
  return yamlChanges.map(yamlChange => {
    const change = {};
    for (const [key, value] of Object.entries(yamlChange)) {
      if (!['number', 'reset', 'room', 'day', 'slot', 'meeting'].includes(key)) {
        throw new Error(`Invalid meetings changes for #${yamlChange.number}: "${key}" is an unexpected key`);
      }
      switch (key) {
      case 'number':
        if (!Number.isInteger(value)) {
          throw new Error(`Invalid meetings changes: #${value} is not a session number`);
        }
        change[key] = value;
        break;
      case 'reset':
        if (value === 'all') {
          change[key] = resources.slice();
        }
        else if (Array.isArray(value)) {
          if (value.find(val => !resources.includes(val))) {
            throw new Error(`Invalid meetings changes for #${yamlChange.number}: "${key}" values "${value.join(', ')}" contains an unexpected field`);
          }
          change[key] = value;
        }
        else if (!resources.includes(value)) {
          throw new Error(`Invalid meetings changes for #${yamlChange.number}: "${key}" value "${value}" is unexpected`);
        }
        else {
          change[key] = [value];
        }
        break;

      case 'room':
      case 'day':
      case 'slot':
        if (typeof value !== 'string') {
          throw new Error(`Invalid meetings changes for #${yamlChange.number}: "${key}" value is not a string`);
        }
        change[key] = value;
        break;

      case 'meeting':
        if (Array.isArray(value)) {
          if (value.find(val => typeof val !== 'string' ||
                                val.includes(';') ||
                                val.includes('|'))) {
            throw new Error(`Invalid meetings changes for #${yamlChange.number}: "${key}" value is not an array of individual meeting strings`);
          }
          change[key] = value.join('; ');
        }
        else if (typeof value !== 'string') {
          throw new Error(`Invalid meetings changes for #${yamlChange.number}: "${key}" value is not a string`);
        }
        else {
          change[key] = value;
        }
      }
      if (!change.number) {
        throw new Error(`Invalid meetings changes: all changes must reference a session number`);
      }
    }
    return change;
  });
}


/**
 * Apply the list of meetings changes to the given list of sessions.
 *
 * Sessions are updated in place. The sessions that are effectively updated
 * also get an `updated` flag.
 *
 * The list of meetings changes must follow the structure returned by the
 * previous parseMeetingsChanges function.
 */
export function applyMeetingsChanges(sessions, changes) {
  for (const change of changes) {
    const session = sessions.find(s => s.number === change.number);
    if (!session) {
      throw new Error(`Invalid change requested: #${change.number} does not exist`);
    }
    if (change.reset) {
      for (const field of change.reset) {
        if (session[field]) {
          delete session[field];
          session.updated = true;
        }
      }
    }
    for (const field of ['room', 'day', 'slot', 'meeting']) {
      if (change[field] && change[field] !== session[field]) {
        session[field] = change[field];
        session.updated = true;
      }
    }
  }
}