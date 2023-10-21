import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as YAML from 'yaml';
import { fileURLToPath } from 'url';
import { sendGraphQLRequest } from './graphql.mjs';
import { todoStrings } from './todostrings.mjs';
const __dirname = fileURLToPath(new URL('.', import.meta.url));


/**
 * The list of sections that may be found in a session body and, for each of
 * them, a `validate` function to validate the format of the section and a
 * `parse` function to return interpreted values.
 *
 * The list needs to be populated once and for all through a call to the async
 * `initSectionHandlers` function, which reads section info from the
 * `session.yml` file.
 */
let sectionHandlers = null;


/**
 * The issue template asks proposers to use comma- or space-separated lists, or
 * impose the list format. In practice, regardless of what we ask for or try to
 * impose, proposers often mix that with other markdown constructs for lists.
 * This function tries to handle all possibilities.
 *
 * The `spaceSeparator` option tells the function to split tokens on spaces.
 * The `prefix` option is only useful when `spaceSeparator` is set. It tells
 * the function to only split tokens on spaces provided that the value starts
 * with the provided prefix. This is useful to parse a list that, e.g., mixes
 * GitHub identities and actual names:
 *   - @tidoust @ianbjacobs
 *   - John Doe
 */
function parseList(value, { spaceSeparator = false, prefix = null }) {
  return (value || '')
    .split(/[\n,]/)
    .map(token => token.trim())
    .map(token => token.replace(/^(?:[-\+\*]|\d+[\.\)])\s*(.*)$/, '$1'))
    .map(token => token.trim())
    .filter(token => !!token)
    .map(token => {
      if (spaceSeparator) {
        if (!prefix || token.startsWith(prefix)) {
          return token.split(/\s+/);
        }
      }
      return token;
    })
    .flat();
}


/**
 * Populate the list of section handlers from the info in `session.yml`.
 *
 * The function needs to be called once before `parseSessionBody` or
 * `validateSessionBody` may be called (function returns immediately on
 * further calls).
 */
export async function initSectionHandlers() {
  if (sectionHandlers) {
    return;
  }
  const yamlTemplate = await readFile(
    path.join(__dirname, '..', '..', '.github', 'ISSUE_TEMPLATE', 'session.yml'),
    'utf8');
  const template = YAML.parse(yamlTemplate);
  sectionHandlers = template.body
    .filter(section => !!section.id)
    .map(section => {
      const handler = {
        id: section.id,
        title: section.attributes.label.replace(/ \(Optional\)$/, ''),
        required: !!section.validations?.required,
        validate: value => true,
        parse: value => value,
        serialize: value => value
      };
      if (section.type === 'dropdown') {
        handler.options = section.attributes.options.map(o => o.toLowerCase());
        handler.validate = value => handler.options.includes(value.toLowerCase());
      }
      else if (section.type === 'input') {
        handler.validate = value => !value.match(/\n/)
      }
      return handler;
    })
    .map(handler => {
      // Add custom validation constraints and parse/serialize logic
      // Ideally, this logic would be encoded in session.yml but GitHub rejects
      // additional properties in issue template files.
      switch (handler.id) {

      case 'description':
        // TODO: validate that markdown remains simple enough
        break;

      case 'goal':
        // Relax, people may use markdown after all
        // TODO: validate that markdown remains simple enough
        handler.validate = value => true;
        break;

      case 'chairs':
        // List of GitHub identities... or of actual names
        // Space-separated values are possible when there are only GitHub
        // identities. Otherwise, CSV, line-separated or markdown lists.
        handler.parse = value => parseList(value, { spaceSeparator: true, prefix: '@' })
          .map(nick => {
            if (nick.startsWith('@')) {
              return { login: nick.substring(1) };
            }
            else {
              return { name: nick };
            }
          });
        handler.validate = value => {
          const chairs = parseList(value, { spaceSeparator: true, prefix: '@' });
          return chairs.every(nick => nick.match(/^(@[A-Za-z0-9][A-Za-z0-9\-]+|[^@]+)$/));
        }
        handler.serialize = value => value
          .map(nick => nick.login ? `@${nick.login}` : nick.name)
          .join(', ');
        break;

      case 'shortname':
        handler.validate = value => value.match(/^#?[A-Za-z0-9\-_]+$/);
        break;

      case 'attendance':
        handler.parse = value => value.toLowerCase() === 'restricted to tpac registrants' ?
          'restricted' : 'public';
        handler.serialize = value => value === 'restricted' ?
          'Restricted to TPAC registrants' : 'Anyone may attend (Default)';
        break;

      case 'duration':
        handler.parse = value => value.toLowerCase() === '30 minutes' ? 30 : 60;
        handler.serialize = value => value === 30 ? '30 minutes' : '60 minutes (Default)';
        break;

      case 'conflicts':
        // List of GitHub issues
        handler.parse = value => parseList(value, { spaceSeparator: true, prefix: '#' })
          .map(issue => parseInt(issue.substring(1), 10));
        handler.validate = value => {
          const conflictingSessions = parseList(value, { spaceSeparator: true, prefix: '#' });
          return conflictingSessions.every(issue => issue.match(/^#\d+$/));
        };
        handler.serialize = value => value.map(issue => `#${issue}`).join(', ');
        break;

      case 'capacity':
        handler.parse = value => {
          switch (value.toLowerCase()) {
          case 'don\'t know': return 0;
          case 'don\'t know (default)': return 0;
          case 'fewer than 20 people': return 15;
          case '20-45 people': return 30;
          case 'more than 45 people': return 50;
          };
        };
        handler.serialize = value => {
          switch (value) {
          case 0: return 'Don\'t know (Default)';
          case 15: return 'Fewer than 20 people';
          case 30: return '20-45 people';
          case 50: return 'More than 45 people';
          }
        }
        break;

      case 'materials':
        const capitalize = str => str.slice(0, 1).toUpperCase() + str.slice(1);
        handler.parse = value => {
          const materials = {};
          parseList(value, { spaceSeparator: false })
            .map(line =>
              line.match(/^\[(.+)\]\((.*)\)$/i) ??
              line.match(/^([^:]+):\s*(.*)$/i))
            .forEach(match => materials[match[1].toLowerCase()] = match[2]);
          return materials;
        };
        handler.validate = value => {
          const matches = parseList(value, { spaceSeparator: false })
            .map(line =>
              line.match(/^\[(.+)\]\((.*)\)$/i) ||
              line.match(/^([^:]+):\s*(.*)$/i));
          return matches.every(match => {
            if (!match) {
              return false;
            }
            if (!todoStrings.includes(match[2].toUpperCase())) {
              try {
                new URL(match[2]);
                return true;
              }
              catch (err) {
                return false;
              }
            }
            return true;
          });
        }
        handler.serialize = value => Object.entries(value)
          .map(([key, url]) => todoStrings.includes(url) ?
            `- ${capitalize(key)}: ${url}` :
            `- [${capitalize(key)}](${url})`)
          .join('\n');
        break;
      }

      return handler;
    });
}


/**
 * Helper function to split a session issue body (in markdown) into sections
 */
function splitIntoSections(body) {
  return body.split(/^### /m)
    .filter(section => !!section)
    .map(section => section.split(/\r?\n/))
    .map(section => {
      let value = section.slice(1).join('\n\n').trim();
      if (value.replace(/^_(.*)_$/, '$1') === 'No response') {
        value = null;
      }
      return {
        title: section[0].replace(/ \(Optional\)$/, ''),
        value
      };
    });
}


/**
 * Validate the session issue body and return a list of errors (or an empty
 * array if all is fine)
 */
export function validateSessionBody(body) {
  if (!sectionHandlers) {
    throw new Error('Need to call `initSectionHandlers` first!');
  }
  const sections = splitIntoSections(body);
  const errors = sections
    .map(section => {
      const sectionHandler = sectionHandlers.find(handler =>
        handler.title === section.title);
      if (!sectionHandler) {
        return `Unexpected section "${section.title}"`;
      }
      if (!section.value && sectionHandler.required) {
        return `Unexpected empty section "${section.title}"`;
      }
      if (section.value && !sectionHandler.validate(section.value)) {
        return `Invalid content in section "${section.title}"`;
      }
      return null;
    })
    .filter(error => !!error);

  // Also report required sections that are missing
  for (const handler of sectionHandlers) {
    if (handler.required && !sections.find(s => s.title === handler.title)) {
      errors.push(`Missing required section "${handler.title}"`);
    }
  }

  return errors;
}


/**
 * Parse the session issue body and return a structured object with values that
 * describes the session.
 */
export function parseSessionBody(body) {
  if (!sectionHandlers) {
    throw new Error('Need to call `initSectionHandlers` first!');
  }
  const session = {};
  splitIntoSections(body)
    .map(section => {
      const sectionHandler = sectionHandlers.find(handler =>
        handler.title === section.title);
      return {
        id: sectionHandler.id,
        value: section.value || section.value === 0 ?
          sectionHandler.parse(section.value) :
          null
      };
    })
    .forEach(input => session[input.id] = input.value);
  return session;
}


/**
 * Serialize a session description into an issue body
 */
export function serializeSessionDescription(description) {
  if (!sectionHandlers) {
    throw new Error('Need to call `initSectionHandlers` first!');
  }
  return sectionHandlers
    .map(handler => `### ${handler.title}${handler.required ? '' : ' (Optional)'}

${(description[handler.id] || description[handler.id] === 0) ?
    handler.serialize(description[handler.id]) : '_No response_' }`)
    .join('\n\n');
}


/**
 * Update session description
 */
export async function updateSessionDescription(session) {
  const body = serializeSessionDescription(session.description);
  const res = await sendGraphQLRequest(`mutation {
    updateIssue(input: {
      id: "${session.id}",
      body: "${body.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"
    }) {
      issue {
        id
      }
    }
  }`);
  if (!res?.data?.updateIssue?.issue?.id) {
    console.log(JSON.stringify(res, null, 2));
    throw new Error(`GraphQL error, could not update issue body`);
  }
}