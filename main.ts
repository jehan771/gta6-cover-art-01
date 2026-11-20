// Neon Coast Cover Studio — submission entrypoint.
//
// What this file does, in order:
//   1. Works out where it lives and where the output folder is.
//   2. Copies the offline browser app (app/) into the output folder.
//   3. Copies the screenshots/ folder into the output folder, if present.
//   4. Asks the vendor helper to build the submission dossier and writes
//      it out as dossier.json.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The folder holding this very file — the repo root for our purposes.
const repoRoot = dirname(fileURLToPath(import.meta.url));

// The grader tells us where to put everything; fall back to /output.
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outputDir, { recursive: true });

// Ship the whole browser app, exactly as it stands in the repo.
cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });

// The screenshots folder always exists in the output, even if the repo
// happens to have no screenshots to put in it yet.
const shotsOut = join(outputDir, 'screenshots');
mkdirSync(shotsOut, { recursive: true });
const shotsIn = join(repoRoot, 'screenshots');
if (existsSync(shotsIn)) {
  cpSync(shotsIn, shotsOut, { recursive: true });
}

// Let the vendor helper assemble the dossier. It hands back the finished
// bytes, so persist them exactly as returned — no re-encoding.
const dossierBytes = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});

const dossierPath = join(outputDir, 'dossier.json');
writeFileSync(dossierPath, dossierBytes);

// Sanity-check what just landed on disk, and fail loudly instead of
// handing the grader a broken output folder: the dossier must be
// non-empty and parse as JSON, and the copied app entrypoint must exist.
const writtenBack = readFileSync(dossierPath, 'utf8');
if (writtenBack.trim().length === 0) {
  throw new Error('dossier.json is empty after write');
}
JSON.parse(writtenBack);
if (!existsSync(join(outputDir, 'app', 'index.html'))) {
  throw new Error('app/index.html missing from output after copy');
}
