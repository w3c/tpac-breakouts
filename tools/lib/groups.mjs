import { fetchW3CGroups } from './w3c.mjs';


/**
 * Retrieve information about issue groups in an array
 *
 * The issue groups are those that appear in the title. Most of the time, there
 * will be only one. In some cases, there may be more than one.
 *
 * Returned array contains, for each groups, an object with:
 * - the group's name
 * - the group's W3C ID
 *
 * The object may only contain the GitHub login or the W3C account name.
 */
export async function fetchSessionGroups(session, groups2W3CID) {
  const lcGroups2W3CID = {};
  for (const name of Object.keys(groups2W3CID ?? {})) {
    lcGroups2W3CID[name.toLowerCase()] = groups2W3CID[name];
  }

  const w3cGroups = await fetchW3CGroups();

  function title2Groups(title) {
    const jointMatch = title.match(/^(.*)\s+Joint Meeting$/i);
    if (jointMatch) {
      title = jointMatch[1];
    }
    const normalized = title
      .replace(/ (BG|Business Group)($|,| and| &)(?:(?:,| and| &)\s*(.*))?/gi, ' BG|')
      .replace(/ (CG|Community Group)($|,| and| &)/gi, ' CG|')
      .replace(/ (IG|Interest Group)($|,| and| &)/gi, ' IG|')
      .replace(/ (WG|Working Group)($|,| and| &)/gi, ' WG|')
      .replace(/ (TF|Task Force)($|,| and| &)/gi, ' TF|');
    return normalized.split('|')
      .map(name => name.trim())
      .filter(name => !!name)
      .map(name => {
        const match =
          name.match(/^(.*?)\s+(BG|CG|IG|WG|TF)$/i) ??
          [name, name, 'other', null];
        const type = match[2].toLowerCase();
        const lcAbbrName = match[1].toLowerCase();
        let group = w3cGroups.find(group =>
          group.type === type &&
          (group.abbrName === lcAbbrName || group.alias === lcAbbrName));
        if (!group) {
          group = {
            name, type,
            label: name,
            abbrName: lcAbbrName
          };
          if (lcGroups2W3CID[name.toLowerCase()]) {
            group.w3cId = lcGroups2W3CID[name.toLowerCase()];
          }
        }
        return group;
      });
  }

  // Gather group name(s) from title
  const groups = title2Groups(session.title);
  return groups;
}


/**
 * Validate the given list of session groups, where each group is represented
 * with an object that follows the same format as that returned by the
 * `fetchSessionGroups` function.
 * 
 * The function returns a list of errors (each error is a string), or an empty
 * array when the list looks fine. The function throws if the list is invalid,
 * in other words if it contains objects that don't have a `name` property.
 */
export function validateSessionGroups(groups) {
  if (groups.length === 0) {
    return ['No group associated with the issue'];
  }
  return groups
    .map(group => {
      if (!group.w3cId) {
        return `No W3C group found for "${group.name}"`;
      }
      return null;
    })
    .filter(error => !!error);
}