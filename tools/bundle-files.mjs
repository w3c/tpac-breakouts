#!/usr/bin/env node
/**
 * This tool bundles static files in the "files" folder into a JS module for
 * inclusion within the AppScript bundle.
 *
 * To run the tool:
 *
 *  node tools/bundle-files.mjs
 *
 * The tools creates (or overwrites) tools/appscript/bundle-static.js which is
 * referenced by other scripts.
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function bundleStaticFiles() {
  const fileFolder = path.join(__dirname, '..', 'files');
  const children = await fs.readdir(fileFolder, { recursive: true });
  const files = children.filter(f => f.match(/\./) && !f.endsWith('bundle.mjs'));
  const res = {};
  for (const file of files) {
    const contents = await fs.readFile(path.join(fileFolder, file), 'utf8');
    res[file.replace(/\\/g, '/')] = contents;
  }

  const bundle = 'export default ' + JSON.stringify(res, null, 2) + ';';
  await fs.writeFile(path.join(fileFolder, 'bundle.mjs'), bundle, 'utf8');
}

bundleStaticFiles().then(_ => {});
