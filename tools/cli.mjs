#!/usr/bin/env node
/**
 * This module defines a command-line interface to help run the different tools
 * contained in the package.
 * 
 * The command-line interface (CLI) gets exposed as the `tpac-breakouts`
 * command tool in `package.json`. It comes with built-in usage help. To get
 * started, run:
 *
 * npx tpac-breakouts --help
 */
import packageConfig from '../package.json' with { type: 'json' };
import { Command, InvalidArgumentError } from 'commander';
import { getEnvKey } from './common/envkeys.mjs';
import { loadProject } from './node/lib/project.mjs';
import schedule from './node/schedule.mjs';
import synchronizeCalendar from './node/sync-calendar.mjs';
import validate from './node/validate.mjs';
import viewEvent from './node/view-event.mjs';
import viewRegisrants from './node/view-registrants.mjs';

function myParseInt(value) {
  // parseInt takes a string and a radix
  const parsedValue = parseInt(value, 10);
  if (isNaN(parsedValue)) {
    throw new InvalidArgumentError(`Expected a number as parameter, got "${value}"`);
  }
  return parsedValue;
}


/**
 * Individual commands expect to receive the project as first parameter.
 */
function getProjectCommandRunner(command) {
  return async function () {
    const project = await loadProject();
    return command(project, ...arguments);
  };
}


/******************************************************************************
 * Main program
 *****************************************************************************/
const program = new Command();
program
  .name('tpac-breakouts')
  .version(packageConfig.version)
  .description('Manage scheduling of TPAC group meetings and breakouts events.')
  .addHelpText('after', `
Pre-requisites:
  - Except for the "create" command, this command line interface (CLI) must be run from the root folder of a clone of a TPAC group meetings or breakouts event repository.
  - The \`gh\` CLI must be available and directly usable. Run \`gh auth login\` if you are not logged in yet.
  - Local environment must define a \`GRAPHQL_TOKEN\` variable set to a valid GitHub Personal Access Token (classic version) with \`repo\` and \`project\` scopes. Alternatively, that variable can be defined in a \`config.json\` file.
  - Calendar synchronization also requires local environment to define \`W3C_LOGIN\` and \`W3C_PASSWORD\` variables. These variables are also needed to validate chairs of breakout sessions.
`);


/******************************************************************************
 * The "validate" command
 *****************************************************************************/
program
  .command('validate')
  .summary('Validate sessions.')
  .description('Validate sessions (description, conflicts, things to check) and save the result on GitHub.')
  .argument('<number>', 'session to validate. Either a session number or "all" to validate all sessions.')
  .option('-c, --changes <changes>', 'JSON file that describes changes made to an issue description, as generated by GitHub in a change event (`github.event.changes`). Used to manage "check: instructions" flag. Only used if session number is an actual number.')
  .option('-w, --what <what>', 'whether to validate "scheduling" or "everything". Only used if session number is "all". Default value is "everything"', 'everything')
  .action(getProjectCommandRunner(validate))
  .addHelpText('after', `
Examples:
  $ npx tpac-breakouts validate 42
  $ npx tpac-breakouts validate all
`);


/******************************************************************************
 * The "view" command
 *****************************************************************************/
program
  .command('view')
  .summary('Vizualize the event\'s schedule as HTML.')
  .description('Create an HTML page that contains the event\'s current schedule and additional validation information.')
  .option('-f, --format <format>', 'output format. One of "json" or "html". Default is "html"', 'html')
  .action(getProjectCommandRunner(viewEvent))
  .addHelpText('after', `
Output:
  The command returns HTML content. You may want to redirect the output to a file. For example:
    $ npx tpac-breakouts view > grid.html

Notes:
  - The HTML page starts with a summary of validation issues. Use the \`validate\` command to get details.
  - The HTML page ends with a dump of the schedule as YAML. This YAML can be provided as input to the \`schedule\` command.  
`);


/******************************************************************************
 * The "schedule" command
 *****************************************************************************/
program
  .command('schedule')
  .summary('Create a schedule grid.')
  .description('Create or adjust a schedule grid and optionally apply it.')
  .option('-a, --apply', 'apply the created schedule, updating events information on GitHub')
  .option('-c, --changes <file>', 'YAML file with a list of changes to apply to the generated schedule')
  .option('-e, --except <numbers...>', 'numbers of sessions for which scheduling information should be discarded')
  .option('-p, --preserve <numbers...>', 'numbers of sessions for which scheduling information should be preserved', ['all'])
  .option('-s, --seed <number>', 'seed string to use to shuffle sessions', myParseInt)
  .option('-r, --reduce', 'reduce output: schedule only, without github links or room info')
  .action(getProjectCommandRunner(schedule))
  .addHelpText('after', `
Output:
  The command returns the generated schedule grid as HTML content (same structure as the one returned by the \`view\` command). You may want to redirect the output to a file. For example:
    $ npx tpac-breakouts schedule > grid.html

  The command also emits warnings to the console to report on progress and scheduling decisions.

Usage notes for the options:
-a, --apply
  When the option is not set, the command merely suggests a schedule grid.

  When the option is set, the command applies the generated schedule, meaning it updates the scheduling information in the GitHub project associated with the event repository.

  Checking a schedule thoroughly before it is applied is strongly recommended. See the \`seed\` and \`changes\` options for mechanisms to re-generate a previously generated schedule.

-c, --changes <file>
  The option allows to pass the name of a local file that contains a series of updates to make to the generated schedule. This is particularly useful in combination with the \`seed\` option to adjust and test a previously generated schedule (the \`seed\` option is not needed if the changes affect all sessions). For example:
    $ npx tpac-breakouts --changes changes.yml

  The file must be a YAML file that contains the list of sessions to change. Each entry must have a \`number\` property with the session number, and a set of field names (\`room\`, \`day\`, \`slot\`, \`meeting\`) followed by their new value. To reset all fields before applying the changes, add \`reset: all\`.

  For example, to change the room of session #18, and set a couple of meetings for session #42 after resetting all fields:

    - number: 18
      room: Bambu
    - number: 42
      reset: all
      meeting:
        - Tuesday, 09:30, Ficus
        - Tuesday, 11:00, Salon Ecija

  Note: The HTML page generated by the \`view\` and \`schedule\` commands ends with a YAML serialization of the schedule grid that can be saved to a YAML file and used as a changes file.

-e, --except <numbers...>
  Set this option to list sessions for which scheduling information must be discarded.

  This option only makes sense when the \`preserve\` option is not set, meaning when the command actually preserves the scheduling information.

  Multiple session numbers can be specified, repeating the option name or not:
    $ npx tpac-breakouts --except 18 --except 42
    $ npx tpac-breakouts -e 18 -e 42
    $ npx tpac-breakouts -e 18 42

-p, --preserve <numbers...>
  By default, the command preserves any scheduling information it finds attached to sessions on GitHub. Set this option to make the list of sessions for which scheduling information must be preserved explicit.

  Multiple session numbers can be specified, repeating the option name or not:
    $ npx tpac-breakouts --preserve 18 --preserve 42
    $ npx tpac-breakouts -p 18 -p 42
    $ npx tpac-breakouts -p 18 42

  To tell the command to discard any scheduling information, set the option to "none":
    $ npx tpac-breakouts --preserve none

-s, --seed <number>
  The command shuffles the list of sessions before it tries to schedule anything and reports an identifier of the shuffled list as a seed number in the generated HTML. This seed number can be provided to make the command re-generate the same shuffling order and thus the same schedule (unless data changed in the meantime).

  This mechanism is useful to review a generated schedule before applying it with the \`apply\` option. It also allows to adjust and test a previously generated schedule.

  For example:
    $ npx tpac-breakouts --seed 12345 --changes changes.yml
    $ npx tpac-breakouts --seed 54321 --apply
`);


/******************************************************************************
 * The "sync-calendar" command
 *****************************************************************************/
program
  .command('sync-calendar')
  .summary('Synchronize the schedule with the W3C calendar.')
  .description('Synchronize the event\'s schedule grid with the W3C calendar.')
  .argument('<number>', 'session to synchronize. Either a session number or "all" to synchronize all sessions.')
  .option('-s, --status <status>', 'status of the calendar entries: "draft", "tentative" or "confirmed".')
  .option('-q, --quiet', 'make the command fail silently without error when the session is invalid. Useful for jobs.')
  .action(getProjectCommandRunner(synchronizeCalendar))
  .addHelpText('after', `
Notes:
  - The command follows the project's "calendar" setting by default. If that setting is absent or set to "no" and the \`status\` option is not set either, the command will not do anything.
  - Local environment must define \`W3C_LOGIN\` and \`W3C_PASSWORD\` variables, used to impersonate a W3C account when updating the W3C calendar.

Examples:
  $ npx tpac-breakouts sync-calendar all --status tentative
  $ npx tpac-breakouts sync-calendar 42 --status confirmed
`);


/******************************************************************************
 * The "view-registrants" command
 *****************************************************************************/
program
  .command('view-registrants')
  .summary('View the number of participants and observers for each session.')
  .description('View the number of participants and observers for each session, possibly fetching the information from a registrants page (for TPAC events).')
  .argument('<number>', 'session to view. Either a session number or "all" to view information for all sessions.')
  .option('-f, --fetch', 'fetch the registrants information from the registrants page.')
  .option('-s, --save', 'save registrants information to the project. The --fetch option must be set.')
  .option('-u, --url <url>', 'URL of the page that lists the registrants per session. The code uses `https://www.w3.org/register/[meeting name]/registrants` when not given. The --fetch option must be set.')
  .option('-w, --warnings-only', 'Only return information about sessions that meet in rooms that are too small.')
  .action(getProjectCommandRunner(viewRegisrants))
  .addHelpText('after', `
Examples:
  $ npx tpac-breakouts view-registrants all
  $ npx tpac-breakouts view-registrants all -w
  $ npx tpac-breakouts view-registrants all --fetch --save
  $ npx tpac-breakouts view-registrants all --fetch --url https://example.org/registrants
`);

program.parseAsync(process.argv);
