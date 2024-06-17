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
  function normalizeTitle(title) {
    return title
      .replace(/ (BG|Business Group)($|,| and| &)/gi, ' BG$2')
      .replace(/ (CG|Community Group)($|,| and| &)/gi, ' CG$2')
      .replace(/ (IG|Interest Group)($|,| and| &)/gi, ' IG$2')
      .replace(/ (WG|Working Group)($|,| and| &)/gi, ' WG$2')
      .replace(/ (TF|Task Force)($|,| and| &)/gi, ' TF$2')
      .trim();
  }

  const w3cGroups = await fetchW3CGroups();
  const additionalGroups = Object.entries(groups2W3CID ?? {})
    .map(([name, w3cId]) => {
      return {
        name: normalizeTitle(name),
        label: name,
        abbrName: normalizeTitle(name).toLowerCase(),
        w3cId
      };
    });
  const allGroups = additionalGroups.concat(w3cGroups);

  // Issue title may be for a joint meeting, in which case it contains a list
  // of groups separated by "&", "," or " and ". As individual group names may
  // also contain these tokens, we cannot just split the title on them to get
  // to the list of groups. Instead, the function consumes the title in chunks.
  function title2Groups(title) {
    const groups = [];
    let highlight = null;
    const jointMatch = title.trim().match(/^(.*)\s+Joint Meeting(?=$|\s*([:>].*))/i);
    if (jointMatch) {
      title = jointMatch[1] + (jointMatch[2] ?? '');
    }
    let remaining = normalizeTitle(title);
    while (remaining) {
      const lcRemaining = remaining.toLowerCase();
      let matchLength = 0;
      let group = allGroups.reduce((candidate, group) => {
        let candidateName = null;
        if (lcRemaining.startsWith(group.name.toLowerCase())) {
          candidateName = group.name;
        }
        else {
          candidateName = group.alias?.find(alias =>
            lcRemaining.startsWith(alias.toLowerCase()));
        }
        if (!candidateName) {
          // Current group is not a better match than the candidate group that
          // we may have found already.
          return candidate;
        }

        if (candidate && candidateName.length < matchLength) {
          // Previously found candidate group was better, stick with it.
          return candidate;
        }

        // Make sure that the name is followed by a separating token
        const match = remaining.substring(candidateName.length)
          .match(/^($|,| and| &|\s*(?=[:>]))/i);
        if (!match) {
          return candidate;
        }

        // Still there? That means we found a (better) group candidate!
        matchLength = candidateName.length + match[1].length;
        return group;
      }, null);

      if (group) {
        // We managed to map the beginning of the title to a group,
        // let's proceed with the rest of the title.
        remaining = remaining.substring(matchLength).trim();
      }
      else {
        // String does not match any known group. This can be an highlight
        // (something like ": Foo" or "> Foo"). Otherwise, we'll consider
        // that the whole string is the name of a group. Validation will
        // report an error afterwards.
        if (remaining.match(/^[:>]/)) {
          highlight = remaining.substring(1).trim();
        }
        else {
          const match =
            remaining.match(/^(.*?)\s+(BG|CG|IG|WG|TF)$/i) ??
            [remaining, remaining, 'other', null];
          group = {
            name: remaining,
            type: match[2].toLowerCase(),
            label: remaining,
            abbrName: match[1].toLowerCase()
          };
        }
        remaining = '';
      }
      if (group) {
        groups.push(Object.assign({}, group));
      }
    }

    return { groups, highlight };
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