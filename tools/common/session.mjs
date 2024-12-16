import { todoStrings } from './todostrings.mjs';


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
        title: section.attributes.label.replace(/ \(Optional\)$/, ''),
        autoHide: !!section.attributes.autoHide,
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
        handler.parse = value => value.replace(/^\`(.*)\`$/, '$1');
        handler.validate = value => value.match(/^(\`#?[A-Za-z0-9\-_]+\`|#?[A-Za-z0-9\-_]+)$/);
        break;

      case 'discussion':
        handler.parse = value => {
          const match = value.match(/^\[(.+)\]\((.*)\)$/i);
          if (match) {
            return match[2];
          }
          else {
            return value;
          }
        };
        handler.validate = value => {
          const match = value.match(/^\[(.+)\]\((.*)\)$/i);
          try {
            if (match) {
              new URL(match[2]);
            }
            else {
              new URL(value);
            }
            return true;
          }
          catch (err) {
            return false;
          }
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
        handler.parse = value => parseList(value, { spaceSeparator: true, prefix: '#' })
          .map(issue => parseInt(issue.substring(1), 10));
        handler.validate = value => {
          const conflictingSessions = parseList(value, { spaceSeparator: true, prefix: '#' });
          return conflictingSessions.every(issue => issue.match(/^#\d+$/));
        };
        handler.serialize = value => value.map(issue => `#${issue}`).join(', ');
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

      case 'times':
        // Each entry looks like "[x] Monday, 09:30 - 11:00"
        const reTime = /^\[( |x)\]\s*(?:(monday|tuesday|thursday|friday),\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2}))$/i;
        handler.allowEmptyValue = true;
        handler.parse = value => parseList(value, { linesOnly: true })
            .map(time => {
              const match = time.match(reTime);
              if (!match[1].trim()) {
                return null;
              }
              const day = project.days.find(day => day.label.toLowerCase() === match[2].toLowerCase());
              const slot = project.slots.find(slot => slot.start === match[3] && slot.end === match[4]);
              return { day: day.name, slot: slot.name };
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
            const day = project.days.find(day => day.label.toLowerCase() === match[2].toLowerCase());
            const slot = project.slots.find(slot => slot.start === match[3] && slot.end === match[4]);
            return day && slot;
          });
        // Serialization lists all possible times in order, selecting those
        // that are in the current times value.
        const daysAndSlots = project.days
          .map(day => project.slots.map(slot => Object.assign({ day, slot })))
          .flat();
        handler.serialize = value => daysAndSlots
          .map(ds => {
            const time = value?.find(time =>
              time.day === ds.day.name &&
              time.slot === ds.slot.name);
            return `- [${time ? 'X' : ' '}] ${ds.day.label}, ${ds.slot.name}`;
          })
          .join('\n');
        break;

      case 'calendar':
        // There can be one link... or multiple ones.
        // The label of each link should provide some useful info about the
        // calendar entry (day, start, end, and plenary flag)
        const reLink = /^\[\s*(.+)\s*\]\((.*)\)$/i;
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
            try {
              new URL(match[2]);
              return !!match[1].match(reCalendarInfo);
            }
            catch {
              return false;
            }

          });
        };
        handler.serialize = value => value
          .map(e => `- [${e.day}, ${e.start} - ${e.end}${e.type === 'plenary' ? ', plenary' : ''}](${e.url})`)
          .join('\n');
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
  return body.trim().split(/^### /m)
    .filter(section => !!section)
    .map(section => section.split(/\r?\n/))
    .map(section => {
      let value = section.slice(1).join('\n').trim();
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
    .map(handler => `### ${handler.title}${handler.includeOptional ? ' (Optional)' : ''}

${(description[handler.id] || description[handler.id] === 0 || handler.allowEmptyValue) ?
    handler.serialize(description[handler.id]) : '_No response_' }`)
    .join('\n\n');
}
