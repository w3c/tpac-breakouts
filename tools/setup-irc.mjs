#!/usr/bin/env node
/**
 * This tool initializes IRC channels that will be used for breakout sessions.
 *
 * To run the tool:
 *
 *  node tools/setup-irc.mjs [sessionNumber or "all"] [commands] [dismiss]
 *
 * where [sessionNumber or "all"] is the session issue number or "all" to
 * initialize IRC channels for all valid sessions.
 * 
 * Set [commands] to "commands" to only output the IRC commands to run without
 * actually running them.
 * 
 * Set [dismiss] to "dismiss" to make bots draft minutes and leave the channel.
 *
 * The tool runs IRC commands one after the other to avoid getting kicked out
 * of the IRC server. It allows checks that IRC bots return the appropriate
 * responses.
 */

import { getEnvKey } from './common/envkeys.mjs';
import { loadProject } from './node/lib/project.mjs'
import { validateSession } from './common/validate.mjs';
import todoStrings from './common/todostrings.mjs';
import irc from 'irc';

const botName = 'breakout-bot';
const timeout = 60 * 1000;

/**
 * Helper function to generate a shortname from the session's title
 */
function getChannel(session) {
  return session.description.shortname;
}


/**
 * Helper function to make the code wait for a specific IRC command from the
 * IRC server, typically to check that a command we sent was properly executed.
 *
 * Note the function will timeout after some time. The timeout is meant to
 * avoid getting stuck in an infinite loop when a bot becomes unresponsive.
 */
const pendingIRCMessage = {
  what: {},
  promise: null,
  resolve: null
};
async function waitForIRCMessage(what) {
  pendingIRCMessage.what = what;
  pendingIRCMessage.promise = new Promise((resolve, reject) => {
    pendingIRCMessage.resolve = resolve;
  });
  const timeoutPromise = new Promise((resolve, reject) => {
    setTimeout(reject, timeout, 'timeout');
  });
  return Promise.race([pendingIRCMessage.promise, timeoutPromise]);
}

/**
 * Main function
 */
async function main({ sessionFilter, onlyCommands, dismissBots } = {}) {
  const project = await loadProject();
  let number = null;;
  if (sessionFilter?.match(/^\d+$/)) {
    number = parseInt(sessionFilter, 10);
    sessionFilter = null;
  }
  let sessions = project.sessions
    .filter(s => s.slot && (!number || s.number === number))
    .filter(s => !sessionFilter || s.slot.startsWith(sessionFilter));
  sessions.sort((s1, s2) => s1.number - s2.number);
  if (number) {
    if (sessions.length === 0) {
      throw new Error(`Session ${number} not found`);
    }
    else if (!sessions[0].day || !sessions[0].slot) {
      throw new Error(`Session ${number} not assigned to a slot`);
    }
  }
  else {
    console.log(`- found ${sessions.length} sessions assigned to slots: ${sessions.map(s => s.number).join(', ')}`);
  }
  sessions = await Promise.all(sessions.map(async session => {
    const sessionErrors = (await validateSession(session.number, project))
      .filter(error => error.severity === 'error');
    if (sessionErrors.length > 0) {
      return null;
    }
    if (session.description.type === 'plenary') {
      return null;
    }
    return session;
  }));
  sessions = sessions.filter(s => !!s);
  if (number) {
    if (sessions.length === 0) {
      throw new Error(`Session ${number} contains errors that need fixing`);
    }
  }
  else {
    console.log(`- found ${sessions.length} valid sessions among them: ${sessions.map(s => s.number).join(', ')}`);
  }

  console.log('Compute IRC channels...');
  const channels = {};
  for (const session of sessions) {
    const channel = getChannel(session);
    if (!channels[channel]) {
      channels[channel] = [];
    }
    channels[channel].push(session);
    channels[channel].sort((s1, s2) => {
      const slot1 = project.slots.findIndex(slot => slot.name === s1.slot);
      const slot2 = project.slots.findIndex(slot => slot.name === s2.slot);
      if (slot1 !== slot2) {
        return slot1 - slot2;
      }
    });
  }
  sessions = Object.values(channels).map(sessions => sessions[0]);
  console.log(`- found ${Object.keys(channels).length} different IRC channels`);
  console.log('Compute IRC channels... done');

  console.log();
  console.log('Connect to W3C IRC server...');
  const bot = onlyCommands ?
    undefined :
    new irc.Client('irc.w3.org', botName, {
      channels: []
    });

  const connection = {
    established: null,
    resolve: null,
    reject: null
  };
  connection.established = new Promise((resolve, reject) => {
    connection.resolve = resolve;
    connection.reject = reject;
  });
  if (bot) {
    bot.addListener('registered', msg => {
      console.log(`- registered message: ${msg.command}`);
      connection.resolve();
    });
  }
  else {
    console.log(`- commands only, no connection needed`);
    connection.resolve();
  }
  await connection.established;
  console.log('Connect to W3C IRC server... done');

  if (bot) {
    // Only useful when debugging the code
    /*bot.addListener('raw', msg => {
      console.log(JSON.stringify({
        nick: msg.nick,
        command: msg.command,
        commandType: msg.commandType,
        raw: msg.rawCommand,
        args: msg.args
      }, null, 2));
    });*/

    // Listen to the JOIN messages that tell us when our bot or the bots we've
    // invited have joined the IRC channel.
    bot.addListener('join', (channel, nick, message) => {
      if (pendingIRCMessage.what.command === 'join' &&
          pendingIRCMessage.what.channel === channel &&
          pendingIRCMessage.what.nick === nick) {
        pendingIRCMessage.resolve();
      }
    });

    // Listen to the list of users in the channels we joined
    bot.addListener('names', (channel, nicks) => {
      if (pendingIRCMessage.what.command === 'names' &&
          pendingIRCMessage.what.channel === channel) {
        pendingIRCMessage.resolve(Object.keys(nicks));
      }
    });

    // Listen to the MESSAGE messages that contain bot replies to our commands.
    bot.addListener('message', (nick, channel, text, message) => {
      if (pendingIRCMessage.what.command === 'message' &&
          (pendingIRCMessage.what.channel === channel || channel === botName) &&
          pendingIRCMessage.what.nick === nick &&
          text.startsWith(pendingIRCMessage.what.message)) {
        pendingIRCMessage.resolve();
      }
    });

    // Listen to the TOPIC message that should tell us that we managed to set
    // the topic as planned.
    bot.addListener('topic', (channel, topic, nick, message) => {
      if (pendingIRCMessage.what.command === 'topic' &&
          pendingIRCMessage.what.channel === channel &&
          pendingIRCMessage.what.nick === nick) {
        pendingIRCMessage.resolve();
      }
    });

    // Listen to PART messages to tell when our bot or other bots leave the
    // channel.
    bot.addListener('part', (channel, nick) => {
      if (pendingIRCMessage.what.command === 'part' &&
          pendingIRCMessage.what.channel === channel &&
          pendingIRCMessage.what.nick === nick) {
        pendingIRCMessage.resolve();
      }
    });

    // Errors are returned when a bot gets invited to a channel where it
    // already is, and when disconnecting from the server. Both cases are fine,
    // let's trap them.
    bot.addListener('error', err => {
      if (err.command === 'err_useronchannel' &&
          pendingIRCMessage.what.command === 'join' &&
          pendingIRCMessage.what.channel === err.args[2] &&
          pendingIRCMessage.what.nick === err.args[1]) {
        pendingIRCMessage.resolve();
      }
      else if (err.command === 'ERROR' &&
          err.args[0] === '"node-irc says goodbye"') {
        console.log('- disconnected from IRC server');
      }
      else {
        throw err;
      }
    });
  }

  function joinChannel(session) {
    const channel = getChannel(session);
    console.log(`/join ${channel}`);
    if (!onlyCommands) {
      bot.join(channel);
      return waitForIRCMessage({ command: 'names', channel, nick: botName });
    }
  }

  function inviteBot(session, name) {
    const channel = getChannel(session);
    console.log(`/invite ${name} ${channel}`);
    if (!onlyCommands) {
      bot.send('INVITE', name, channel);
      return waitForIRCMessage({ command: 'join', channel, nick: name });
    }
  }

  function leaveChannel(session) {
    const channel = getChannel(session);
    if (!onlyCommands) {
      bot.part(channel);
      return waitForIRCMessage({ command: 'part', channel, nick: botName });
    }
  }

  function setTopic(session) {
    const channel = getChannel(session);
    const room = project.rooms.find(r => r.name === session.room);
    const roomLabel = room ? `- ${room.name} ` : '';
    const topic = `Breakout: ${session.title} ${roomLabel}- ${session.slot}`;
    console.log(`/topic ${channel} ${topic}`);
    if (!onlyCommands) {
      bot.send('TOPIC', channel, topic);
      return waitForIRCMessage({ command: 'topic', channel, nick: botName });
    }
  }

  async function setupRRSAgent(session) {
    const channel = getChannel(session);
    await say(channel, {
      to: 'RRSAgent',
      message: `do not leave`,
      reply: `ok, ${botName}; I will stay here even if the channel goes idle`
    });

    await say(channel, {
      to: 'RRSAgent',
      message: `this meeting spans midnight`,
      reply: `ok, ${botName}; I will not start a new log at midnight`
    });

    await say(channel, {
      to: 'RRSAgent',
      message: `make logs ${session.description.attendance === 'restricted' ? 'member' : 'public'}`,
      reply: `I have made the request, ${botName}`
    });

    await say(channel, `Meeting: ${session.title}`);
    await say(channel, `Chair: ${session.chairs.map(c => c.name).join(', ')}`);
    if (session.description.materials?.agenda &&
        !todoStrings.includes(session.description.materials.agenda)) {
      await say(channel, `Agenda: ${session.description.materials.agenda}`);
    }
    else {
      await say(channel, `Agenda: https://github.com/${session.repository}/issues/${session.number}`);
    }
    if (session.description.materials?.slides &&
        !todoStrings.includes(session.description.materials.slides)) {
      await say(channel, `Slideset: ${session.description.materials.slides}`);
    }
  }

  async function setupZakim(session) {
    const channel = getChannel(session);
    await say(channel, {
      to: 'Zakim',
      message: 'clear agenda',
      reply: 'agenda cleared'
    });
    await say(channel, {
      to: 'Zakim',
      message: 'agenda+ Pick a scribe',
      reply: 'agendum 1 added'
    });
    await say(channel, {
      to: 'Zakim',
      message: 'agenda+ Reminders: code of conduct, health policies, recorded session policy',
      reply: 'agendum 2 added'
    });
    await say(channel, {
      to: 'Zakim',
      message: 'agenda+ Goal of this session',
      reply: 'agendum 3 added'
    });
    await say(channel, {
      to: 'Zakim',
      message: 'agenda+ Discussion',
      reply: 'agendum 4 added'
    });
    await say(channel, {
      to: 'Zakim',
      message: 'agenda+ Next steps / where discussion continues',
      reply: 'agendum 5 added'
    });
    await say(channel, {
      to: 'Zakim',
      message: 'agenda+ Adjourn / Use IRC command: Zakim, end meeting',
      reply: 'agendum 6 added'
    });
  }

  async function draftMinutes(session, channelUsers) {
    const channel = getChannel(session);
    if (channelUsers.includes('RRSAgent')) {
      // Should have been already done in theory, but worth re-doing just in
      // case, especially since RRSAgent won't leave a channel until some
      // access level has been specified.
      await say(channel, {
        to: 'RRSAgent',
        message: `make logs ${session.description.attendance === 'restricted' ? 'member' : 'public'}`,
        reply: `I have made the request, ${botName}`
      });
    }
    if (channelUsers.includes('Zakim')) {
      await say(channel, {
        to: 'Zakim',
        message: `end meeting`,
        reply: `I am happy to have been of service, ${botName}; please remember to excuse RRSAgent.  Goodbye`
      });
    }
    if (channelUsers.includes('RRSAgent')) {
      await say(channel, `RRSAgent, bye`);
    }
  }

  // Helper function to send a message to a channel. The function waits for a
  // reply if one is expected.
  function say(channel, msg) {
    const message = msg?.to ?
      `${msg.to}, ${msg.message}` :
      (msg?.message ? msg.message : msg);
    console.log(`/msg ${channel} ${message}`);
    if (!onlyCommands) {
      bot.say(channel, message);
      if (msg?.reply) {
        return waitForIRCMessage({
          command: 'message', channel,
          nick: msg.to, message: msg.reply
        });
      }
    }
  }

  const errors = [];
  for (const session of sessions) {
    console.log();
    console.log(`session ${session.number}`);
    console.log('-----');
    try {
      const channelUsers = await joinChannel(session);
      if (dismissBots) {
        await draftMinutes(session, channelUsers);
      }
      else {
        await setTopic(session);
        if (onlyCommands || !channelUsers.includes('RRSAgent')) {
          await inviteBot(session, 'RRSAgent');
        }
        await setupRRSAgent(session);
        if (onlyCommands || !channelUsers.includes('Zakim')) {
          await inviteBot(session, 'Zakim');
        }
        await setupZakim(session);
        await leaveChannel(session);
      }
    }
    catch (err) {
      errors.push(`- ${session.number}: ${err.message}`);
      console.log(`- An error occurred: ${err.message}`);
    }
    console.log('-----');
  }

  if (!onlyCommands) {
    return new Promise((resolve, reject) => {
      console.log('Disconnect from IRC server...');
      bot.disconnect(_ => {
        console.log('Disconnect from IRC server... done');
        if (errors.length > 0) {
          reject(new Error(errors.join('\n')));
        }
        else {
          resolve();
        }
      });
    });
  }
}

const sessionFilter = process.argv[2] === 'all' ? undefined : process.argv[2];
const onlyCommands = process.argv[3] === 'commands';
const dismissBots = process.argv[4] === 'dismiss';

main({ sessionFilter, onlyCommands, dismissBots })
  .then(_ => process.exit(0))
  .catch(err => {
    console.error(`Something went wrong:\n${err.message}`);
    process.exit(1);
  });