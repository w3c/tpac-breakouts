import { sendGraphQLRequest } from './graphql.mjs';
import todoStrings from './todostrings.mjs';

/**
 * Simple regular expression to match Markdown links
 */
const reLink = /^\[\s*(.+)\s*\]\((.*)\)$/;


/**
 * Returns true if the given URL is valid, false otherwise.
 *
 * Unfortunately, the Appscript runtime does not support the URL object,
 * so we'll fallback to a simple regular expression in that case. It is
 * possible that the validation on GitHub rejects a URL that validation in the
 * spreadsheet accepts, but so be it.
 */
function isUrlValid(url) {
  if (typeof URL === 'undefined') {
    return /^https?:\/\/[^ "]+$/.test(url);
  }
  else {
    try {
      new URL(url);
      return true;
    }
    catch (err) {
      return false;
    }
  }
}


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
 * The `linesOnly` option is only useful when `spaceSeparator` is not set. It
 * tells the function to only split tokens on newlines (and not on commas)
 */
function parseList(value, { spaceSeparator = false, prefix = null, linesOnly = false }) {
  const tokens = linesOnly ?
    (value || '').split(/\n/) :
    (value || '').split(/[\n,]/);
  return tokens
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
 * Reset the list of section handlers
 *
 * The function should be only useful to reset state between tests.
 */
export async function resetSectionHandlers() {
  sectionHandlers = null;
}


/**
 * Populate the list of section handlers from the info in `session.yml`.
 *
 * The function needs to be called once before `parseSessionBody` or
 * `validateSessionBody` may be called (function returns immediately on
 * further calls).
 */
export async function initSectionHandlers(project) {
  if (sectionHandlers) {
    return;
  }
  const sections = project.sessionSections;

  sectionHandlers = sections
    .map(section => {
      const handler = {
        id: section.id,
        title: section.attributes.label
          .replace(/ \(Optional\)$/i, '')
          .replace(/ \(For meeting planners only\)$/i, ''),
        autoHide: !!section.attributes.autoHide,
        adminOnly: !!section.attributes.adminOnly,
        required: !!section.validations?.required,
        includeOptional: !!section.attributes.label.endsWith('(Optional)'),
        validate: value => true,
        parse: value => value,
        serialize: value => value
      };
      if (section.type === 'dropdown') {
        // GitHub has this funky feature that "required" is not supported
        // when the repository is "private", making it add a "None" choice
        // to dropdowns. We'll add it to the list of options.
        handler.options = section.attributes.options.map(o => Object.assign({
          label: o,
          llabel: o.toLowerCase()
        }));
        handler.options.push({
          label: 'None',
          llabel: 'none'
        });
        handler.validate = value => !!handler.options.find(o => o.llabel === value.toLowerCase());
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
        const reNickname = /^@[A-Za-z0-9][A-Za-z0-9\-]+$/;
        const reName = /^[^@]+$/;
        const reNickUrl = /^https:\/\/github\.com\/([^\/]+)\/?$/;
        handler.parse = value => parseList(value, { spaceSeparator: true, prefix: '@' })
          .map(nick => {
            if (nick.match(reNickname)) {
              return { login: nick.substring(1) };
            }
            else if (nick.match(reLink)) {
              const name = nick.match(reLink)[2];
              if (name.match(reNickname)) {
                return { login: nick.substring(1) };
              }
              else {
                return { name };
              }
            }
            else if (nick.match(reNickUrl)) {
              return { login: nick.match(reNickUrl)[1] }
            }
            else {
              return { name: nick };
            }
          });
        handler.validate = value => {
          const chairs = parseList(value, { spaceSeparator: true, prefix: '@' });
          return chairs.every(nick =>
            nick.match(reNickname) ||
            (nick.match(reLink) && nick.match(reLink)[2].match(reNickname)) ||
            (nick.match(reLink) && nick.match(reLink)[2].match(reName)) ||
            nick.match(reNickUrl) ||
            nick.match(reName));
        }
        handler.serialize = value => value
          .map(nick => nick.login ? `@${nick.login}` : nick.name)
          .join(', ');
        break;

      case 'shortname':
        handler.parse = value => value
          .replace(reLink, '$1')
          .replace(/^\`(.*)\`$/, '$1');
        handler.validate = value =>
          value.match(/^(\`#?[A-Za-z0-9\-_]+\`|#?[A-Za-z0-9\-_]+)$/) ||
          value.match(/^\[(\`#?[A-Za-z0-9\-_]+\`|#?[A-Za-z0-9\-_]+)\]\((.*)\)$/i);
        handler.serialize = value =>
          `[\`#${value.replace(/#/, '')}\`](https://webirc.w3.org/?channels=${value.replace(/#/, '')})`;
        break;

      case 'discussion':
        handler.parse = value => {
          const match = value.match(reLink);
          let url = match ? match[2] : value;
          if (url.startsWith('#')) {
            url = `https://webirc.w3.org/?channels=${url.replace(/#/, '')}`;
          }
          return url;
        };
        handler.validate = value => {
          const match = value.match(reLink);
          let url = match ? match[2] : value;
          if (url.startsWith('#')) {
            url = `https://webirc.w3.org/?channels=${url.replace(/#/, '')}`;
          }
          return isUrlValid(url);
        };
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

      case 'type':
        handler.parse = value => value.toLowerCase() === 'plenary' ? 'plenary' : 'breakout';
        handler.serialize = value => value === 'plenary' ? 'Plenary' : 'Breakout (Default)';
        break;

      case 'conflicts':
        // List of GitHub issues
        const reIssueNumber = /^#\d+$/;
        const reEndsWithIssueNumber = /#\d+$/;
        handler.parse = value => parseList(value, { spaceSeparator: true, prefix: '#' })
          .map(issue => {
            let issueNb = '';
            if (issue.match(reIssueNumber)) {
              issueNb = issue;
            }
            else if (issue.match(reLink)) {
              issueNb = issue.match(reLink)[2];
            }
            else {
              issueNb = issue.match(reEndsWithIssueNumber)[0];
            }
            return parseInt(issueNb.substring(1), 10);
          });
        handler.validate = value => {
          const conflictingSessions = parseList(value, { spaceSeparator: true, prefix: '#' });
          return conflictingSessions.every(issue =>
            issue.match(reIssueNumber) ||
            (issue.match(reLink) && issue.match(reLink)[2].match(reIssueNumber)) ||
            (isUrlValid(issue) && issue.match(reEndsWithIssueNumber)));
        };
        handler.serialize = value => value.map(issue => `- #${issue}`).join('\n');
        break;

      case 'capacity':
        for (const option of handler.options) {
          option.value = (function (label) {
            switch (label) {
            case 'none': return 0;
            case 'don\'t know': return 0;
            case 'don\'t know (default)': return 0;

            // Labels used for TPAC 2023
            case 'less than 15': return 10;
            case '16-30': return 20;
            case '31-50': return 40;
            case 'more than 50': return 50;

            // Labels used for TPAC 2024
            case 'less than 20': return 15;
            case '20 to 29': return 25;
            case '30 to 39': return 35;
            case 'more than 40': return 40;

            // Labels used for breakouts day 2024
            case 'fewer than 20 people': return 15;
            case '20-45 people': return 30;
            case 'more than 45 people': return 50;
            }
          })(option.llabel);
        }
        handler.parse = value => {
          const option = handler.options.find(o => o.llabel === value.toLowerCase());
          if (!option) {
            throw new Error(`Unexpected capacity value "${value}"`);
          }
          return option.value;
        };
        handler.serialize = value => {
          const option =
            handler.options.find(o => o.value === value && o.label !== 'none') ??
            handler.options.find(o => o.value === value);
          if (!option) {
            throw new Error(`Unexpected capacity value "${value}"`);
          }
          return option.label;
        };
        break;

      case 'nbslots':
        handler.parse = value => {
          const option = handler.options.find(o => o.llabel === value.toLowerCase());
          if (!option) {
            throw new Error(`Unexpected value "${value}" for number of slots`);
          }
          if (option.label === 'none') {
            return 0;
          }
          const match = option.label.match(/^(\d+) slots?$/);
          return parseInt(match[1], 10);
        };
        handler.serialize = value => {
          let llabel = '';
          if (value === 0) {
            llabel = 'None';
          }
          else if (value === 1) {
            llabel = '1 slot';
          }
          else {
            llabel = `${value} slots`;
          }
          const option = handler.options.find(o => o.llabel === llabel);
          if (!option) {
            throw new Error(`Unexpected value "${value}" for number of slots`);
          }
          return option.label;
        };
        break;

      case 'slots':
        // Each entry looks like "[x] Monday, 09:30 - 11:00"
        const reSlot = /^\[( |x)\]\s*(monday|tuesday|thursday|friday),\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/i;
        handler.allowEmptyValue = true;
        handler.parse = value => parseList(value, { linesOnly: true })
            .map(slotDesc => {
              const match = slotDesc.match(reSlot);
              if (!match[1].trim()) {
                return null;
              }
              const slot = project.slots.find(slot =>
                slot.weekday.toLowerCase() === match[2].toLowerCase() &&
                (slot.start === match[3] || slot.start === `0${match[3]}`));
              return {
                day: slot.date,
                slot: slot.start
              };
            })
            .filter(slot => !!slot);
        handler.validate = value => parseList(value, { linesOnly: true })
          .every(slotDesc => {
            const match = slotDesc.match(reSlot);
            if (!match) {
              // Not the expected format
              return false;
            }
            if (!match[1].trim()) {
              // Day not selected, we don't really care whether the line
              // contains something valid, serialization will fix any possible
              // hiccup in any case
              return true;
            }
            const slot = project.slots.find(slot =>
              slot.weekday.toLowerCase() === match[2].toLowerCase() &&
              (slot.start === match[3] || slot.start === `0${match[3]}`));
            // TODO: consider more flexible mapping when times change slightly
            return !!slot;
          });
        handler.serialize = value => project.slots
          .map(slot => {
            const selected = value?.find(choice =>
              choice.day === slot.date &&
              choice.slot === slot.start);
            return `- [${selected ? 'X' : ' '}] ${slot.weekday}, ${slot.start} - ${slot.end}`;
          })
          .join('\n');
        break;

      case 'times':
        // Each entry looks like "[x] Monday, 09:30 - 11:00"
        const reTime = /^\[( |x)\]\s*(monday|tuesday|thursday|friday),\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/i;
        handler.allowEmptyValue = true;
        handler.parse = value => parseList(value, { linesOnly: true })
            .map(time => {
              const match = time.match(reTime);
              if (!match[1].trim()) {
                return null;
              }
              const slot = project.slots.find(slot =>
                slot.weekday.toLowerCase() === match[2].toLowerCase() &&
                (slot.start === match[3] || slot.start === `0${match[3]}`));
              return {
                day: slot.date,
                slot: slot.start
              };
            })
            .filter(time => !!time);
        handler.validate = value => parseList(value, { linesOnly: true })
          .every(time => {
            const match = time.match(reTime);
            if (!match) {
              // Not the expected format
              return false;
            }
            if (!match[1].trim()) {
              // Time not selected, we don't really care whether the line
              // contains something valid, serialization will fix any possible
              // hiccup in any case
              return true;
            }
            const slot = project.slots.find(slot =>
              slot.weekday.toLowerCase() === match[2].toLowerCase() &&
              (slot.start === match[3] || slot.start === `0${match[3]}`));
            return !!slot;
          });
        handler.serialize = value => project.slots
          .map(slot => {
            const selected = value?.find(choice =>
              choice.day === slot.date &&
              choice.slot === slot.start);
            return `- [${selected ? 'X' : ' '}] ${slot.weekday}, ${slot.start} - ${slot.end}`;
          })
          .join('\n');
        break;

      case 'calendar':
        // There can be one link... or multiple ones.
        // The label of each link should provide some useful info about the
        // calendar entry (day, start, end, and plenary flag)
        const reCalendarInfo = /^(.+),\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})(?:,\s*(plenary))?$/i;
        handler.parse = value => {
          const matches = parseList(value, { linesOnly: true })
            .map(line => line.match(reLink));
          return matches.map(match => {
            const infoMatch = match[1].match(reCalendarInfo);
            const entry = {
              day: infoMatch[1],
              start: infoMatch[2],
              end: infoMatch[3],
              url: match[2]
            };
            if (infoMatch[4]) {
              entry.type = 'plenary';
            }
            return entry;
          });
        };
        handler.validate = value => {
          const matches = parseList(value, { linesOnly: true })
            .map(line => line.match(reLink));
          return matches.every(match => {
            if (!match) {
              return false;
            }
            if (!isUrlValid(match[2])) {
              return false;
            }
            return !!match[1].match(reCalendarInfo);
          });
        };
        handler.serialize = value => value
          .map(e => `- [${e.day}, ${e.start} - ${e.end}${e.type === 'plenary' ? ', plenary' : ''}](${e.url})`)
          .join('\n');
        break;

      case 'materials':
        const capitalize = str => str.slice(0, 1).toUpperCase() + str.slice(1);
        const reLabelThenUrl = /^([^:]+):\s*(.*)$/;
        handler.parse = value => {
          const materials = {};
          parseList(value, { spaceSeparator: false })
            .map(line => line.match(reLink) ?? line.match(reLabelThenUrl))
            .forEach(match => materials[match[1].toLowerCase()] = match[2]);
          return materials;
        };
        handler.validate = value => {
          const matches = parseList(value, { spaceSeparator: false })
            .map(line => line.match(reLink) || line.match(reLabelThenUrl));
          return matches.every(match => {
            if (!match) {
              return false;
            }
            if (!todoStrings.includes(match[2].toUpperCase())) {
              return isUrlValid(match[2]);
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
  return body.trim().split(/^### /m)
    .filter(section => !!section)
    .map(section => section.split(/\r?\n/))
    .map(section => {
      let value = section.slice(1).join('\n').trim();
      if (value.replace(/^_(.*)_$/, '$1') === 'No response') {
        value = null;
      }
      return {
        title: section[0]
          .replace(/ \(Optional\)$/i, '')
          .replace(/ \(For meeting planners only\)$/i, ''),
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
        console.warn(`Invalid content in section "${section.title}":
          ${section.value}`);
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
        value: section.value || section.value === 0 || sectionHandler.allowEmptyValue ?
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
    .filter(handler =>
      !handler.autoHide ||
      description[handler.id] ||
      description[handler.id] === 0)
    .map(handler => {
      let suffix = '';
      if (handler.includeOptional) {
        suffix = ' (Optional)';
      }
      if (handler.adminOnly) {
        suffix = ' (For meeting planners only)';
      }
      return `### ${handler.title}${suffix}

${(description[handler.id] || description[handler.id] === 0 || handler.allowEmptyValue) ?
    handler.serialize(description[handler.id]) : '_No response_' }`;
    })
    .join('\n\n');
}


/**
 * Update session description if needed
 */
export async function updateSessionDescription(session) {
  const body = serializeSessionDescription(session.description);
  if (body === session.body) {
    return;
  }
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