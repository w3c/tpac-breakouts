#!/usr/bin/env node
/**
 * This tool lets you truncate a local recording of a breakout session before
 * it gets uploaded to Cloudflare.
 * 
 * To run the tool:
 *
 *  npx truncate-recording [session number] [start] [end] [prefix]
 *
 * Pre-requisites:
 * 1. The RECORDING_FOLDER env variable must target the local folder to use to
 * read/write recordings.
 * 2. The well-known prefix must appear in a RECORDING_PREFIX env variable.
 *
 * Command may take a while.
 */

import path from 'path';
import fs from 'fs/promises';
import util from 'node:util';
import webvtt from 'webvtt-parser';
import { getEnvKey } from './node/lib/envkeys.mjs';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));

const run = util.promisify(execFile);

async function ffmpeg(params) {
  const quietParams = ['-y', '-loglevel', 'error'];
  console.log('ffmpeg', params.join(' '));
  const { stdout, stderr } = await run('ffmpeg', quietParams.concat(params), {
    windowsVerbatimArguments: true
  });
  if (stderr) {
    console.error(stderr);
    throw new Error('ffmpeg command failed');
  }
}

async function main(sessionNumber, trimStart, trimEnd, prefix) {
  trimStart = trimStart ?? 0;

  const RECORDING_FOLDER = await getEnvKey('RECORDING_FOLDER', __dirname);
  const RECORDING_PREFIX = await getEnvKey('RECORDING_PREFIX', 'breakout');

  prefix = prefix ?? RECORDING_PREFIX;

  // Find the raw video and captions files
  const folders = await fs.readdir(RECORDING_FOLDER);
  const folder = folders.find(f => f.startsWith('' + sessionNumber));
  if (!folder) {
    throw new Error(`No recording found in folder ${RECORDING_FOLDER} for session ${sessionNumber}`);
  }
  const files = await fs.readdir(path.join(RECORDING_FOLDER, folder));
  const videoFile = files.find(f => f.match(/^GMT\d{8}-\d{6}_Recording_\d{2,4}x\d{2,4}\.mp4$/));
  const captionsFile = files.find(f => f.match(/^GMT\d{8}-\d{6}_Recording.transcript.vtt$/));
  if (!videoFile || !captionsFile) {
    throw new Error(`No video or captions found in folder ${RECORDING_FOLDER} for session ${sessionNumber}`);
  }

  console.log('Truncate captions...');
  const parser = new webvtt.WebVTTParser();
  const serializer = new webvtt.WebVTTSerializer();
  const vtt = await fs.readFile(path.join(RECORDING_FOLDER, folder, captionsFile), 'utf8');
  let cues;
  try {
    ({cues} = parser.parse(vtt));
  }
  catch (e) {
    throw new Error('Could not parse WebVTT file', e);
  }
  const updatedCues = cues
    .filter(cue => cue.tree.children.length)
    .filter(cue => cue.startTime >= trimStart)
    .filter(cue => !trimEnd || cue.startTime <= trimEnd)
    .map(cue => {
      cue.startTime -= trimStart;
      if (trimEnd && cue.endTime > trimEnd) {
        cue.endTime = trimEnd;
      }
      cue.endTime -= trimStart;
      return cue;
    });
  const captions = serializer.serialize(updatedCues);
  const newCaptionsFile = path.join(RECORDING_FOLDER, prefix + '-' + sessionNumber + '.vtt');
  await fs.writeFile(newCaptionsFile, captions, 'utf8');
  console.log(`- wrote ${newCaptionsFile}`);
  console.log('Truncate captions... done');

  console.log('Truncate the video file...');
  const trimParams = ['start=' + trimStart];
  if (trimEnd) {
    trimParams.push('end=' + trimEnd);
  }
  const trimFilter = 'trim=' + trimParams.join(':') + ',';
  const atrimFilter = 'atrim=' + trimParams.join(':') + ',';
  const newVideoFile = path.join(RECORDING_FOLDER, prefix + '-' + sessionNumber + '.mp4');
  await ffmpeg([
    '-i', path.join(RECORDING_FOLDER, folder, videoFile),
    '-filter_complex', '"' + [
      `[0:v] fps=25, scale=width=1920:height=1080:force_original_aspect_ratio=decrease, pad=width=1920:height=1080:x=(ow-iw)/2:y=(oh-ih)/2, format=yuv420p, ${trimFilter} setsar=1, setpts=PTS-STARTPTS [v]`,
      `[0:a] aformat=channel_layouts=stereo:sample_rates=44100, ${atrimFilter} asetpts=PTS-STARTPTS [a]`
    ].join(';') + '"',
    '-map "[v]" -map "[a]"',
    '-c:v libx264 -c:a aac',
    newVideoFile
  ]);
  console.log(`- wrote ${newVideoFile}`);
  console.log('Truncate the video file... done');
}

const sessionNumber = process.argv[2];
let start = process.argv[3] ?? '00:00';
let end = process.argv[4] ?? null;
if (end === '0' || end === '-1' || end === '-') {
  end = null;
}

const startMatch = start.match(/^(\d+)$|^(\d{1,3}):(\d{2})$/);
if (!startMatch) {
  throw new Error('Invalid start parameter, should be something like `00:03`');
}
if (startMatch[1]) {
  start = parseInt(startMatch[1], 10);
}
else {
  start = parseInt(startMatch[2], 10) * 60 + parseInt(startMatch[3], 10);
}

if (end) {
  const endMatch = end.match(/^(\d+)$|^(\d{1,3}):(\d{2})$/);
  if (!endMatch) {
    throw new Error('Invalid end parameter, should be something like `00:03`, or `-` not to truncate the end of the video');
  }
  if (endMatch[1]) {
    end = parseInt(endMatch[1], 10);
  }
  else {
    end = parseInt(endMatch[2], 10) * 60 + parseInt(endMatch[3], 10);
  }
}
const prefix = process.argv[5];

main(sessionNumber, start, end, prefix).then(_ => process.exit(0));