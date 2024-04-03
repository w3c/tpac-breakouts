#!/usr/bin/env node
/**
 * This tool is only useful once recordings of breakout sessions have been
 * uploaded to Cloudflare. It create HTML recording pages for each of these
 * recordings that contain the video and an HTML rendition of the captions as
 * a transcript.
 * 
 * To run the tool:
 *
 *  node tools/create-recording-pages.mjs
 *
 * Pre-requisites:
 * 1. Recordings must have been uploaded to Cloudflare with a name that starts
 * with a well-known prefix.
 * 2. The well-known prefix must appear in a RECORDING_PREFIX env variable.
 * 3. Cloudflare account info must appear in CLOUDFLARE_ACCOUNT and
 * CLOUDFLARE_TOKEN env variables.
 * 4. The RECORDING_FOLDER env variable must target the local folder to use to
 * save recordings pages
 * 5. The RECORDING_FOLDER folder must contain a "recording-template.html" page
 * that contains the template to use for each recording page, see for example:
 * https://www.w3.org/2023/09/breakouts/recording-template.html
 *
 * The tool assumes that the recordings are named prefix-xx.mp4, where xx is
 * the breakout session number. It creates "recording-xx.html" pages in the
 * recording folder.
 */

import path from 'path';
import fs from 'fs/promises';
import { convert } from './lib/webvtt2html.mjs';
import { getEnvKey } from './lib/envkeys.mjs';
import { fetchProject } from './lib/project.mjs';
import { validateSession } from './lib/validate.mjs';
import { todoStrings } from './lib/todostrings.mjs';

async function listRecordings(accountId, authToken, recordingPrefix) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?search=${recordingPrefix}`,
    {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    }
  );
  const json = await response.json();
  const recordings = json.result
    .filter(v => v.meta.name.startsWith(recordingPrefix))
    .map(v => Object.assign({
      sessionId: v.meta.name.match(/-(\d+)\.mp4$/)[1],
      name: v.meta.name,
      title: v.meta.name,
      videoId: v.uid,
      preview: v.preview,
      embedUrl: v.preview.replace(/watch$/, 'iframe'),
      captions: v.preview.replace(/watch$/, 'captions/en')
    }))
    .sort((v1, v2) => v1.name.localeCompare(v2.name));
  return recordings;
}

async function createRecordingPage(recording, recordingFolder) {
  let template = await fs.readFile(path.join(recordingFolder, 'recording-template.html'), 'utf8');

  recording.transcript = await convert(recording.captions, { clean: true });

  // Replace content that needs to be serialized as JSON
  for (const property of Object.keys(recording)) {
    const regexp = new RegExp(`\{\{\{\{${property}\}\}\}\}`, 'g');
    template = template.replace(regexp, JSON.stringify(recording[property], null, 2));
  }

  // Replace content that needs to be escaped for use in HTML attributes
  for (const property of Object.keys(recording)) {
    const regexp = new RegExp(`\{\{\{${property}\}\}\}`, 'g');
    template = template.replace(regexp,
      ('' + recording[property] || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;'));
  }

  // Replace raw text content
  for (const property of Object.keys(recording)) {
    const regexp = new RegExp(`\{\{${property}\}\}`, 'g');
    template = template.replace(regexp, recording[property]);
  }

  // Write resulting recording page
  await fs.writeFile(path.join(recordingFolder, `recording-${recording.sessionId}.html`), template, 'utf8');
}

async function main() {
  // First, retrieve known information about the project
  const PROJECT_OWNER = await getEnvKey('PROJECT_OWNER');
  const PROJECT_NUMBER = await getEnvKey('PROJECT_NUMBER');
  const CHAIR_W3CID = await getEnvKey('CHAIR_W3CID', {}, true);
  console.log();
  console.log(`Retrieve project ${PROJECT_OWNER}/${PROJECT_NUMBER}...`);
  const project = await fetchProject(PROJECT_OWNER, PROJECT_NUMBER);
  if (!project) {
    throw new Error(`Project ${PROJECT_OWNER}/${PROJECT_NUMBER} could not be retrieved`);
  }
  project.chairsToW3CID = CHAIR_W3CID;
  console.log(`- ${project.sessions.length} sessions`);
  console.log(`Retrieve project ${PROJECT_OWNER}/${PROJECT_NUMBER}... done`);

  console.log();
  console.log('List recordings...');
  const CLOUDFLARE_ACCOUNT = await getEnvKey('CLOUDFLARE_ACCOUNT');
  const CLOUDFLARE_TOKEN = await getEnvKey('CLOUDFLARE_TOKEN');
  const RECORDING_PREFIX = await getEnvKey('RECORDING_PREFIX');
  const RECORDING_FOLDER = await getEnvKey('RECORDING_FOLDER');;
  const recordings = await listRecordings(CLOUDFLARE_ACCOUNT, CLOUDFLARE_TOKEN, RECORDING_PREFIX);
  console.log(`- found ${recordings.length} recordings`);
  console.log('List recordings... done');

  console.log();
  console.log('Create recording pages...');
  for (const recording of recordings) {
    const session = project.sessions.find(s => s.number === parseInt(recording.sessionId, 10));
    console.log(`- create page for ${recording.sessionId} - ${session.title}`);
    await validateSession(session.number, project);
    const desc = session.description;
    recording.title = session.title;
    recording.githubIssue = `https://github.com/${session.repository}/issues/${session.number}`;
    const links = [
      {
        title: 'Session proposal on GitHub',
        url: recording.githubIssue
      }
    ];
    if (desc.materials?.slides && !todoStrings.includes(desc.materials.slides.toUpperCase())) {
      links.push({
        title: 'Slides',
        url: desc.materials.slides
      });
    }
    if (desc.materials?.minutes && !todoStrings.includes(desc.materials.minutes.toUpperCase())) {
      links.push({
        title: 'Session minutes',
        url: desc.materials.minutes
      });
    }
    recording.links = links
      .map(l => `<li><a href="${l.url}">${l.title}</a></li>`)
      .join('\n');
    await createRecordingPage(recording, RECORDING_FOLDER);
  }
  console.log('Create recording pages... done');
}

main().then(_ => process.exit(0));