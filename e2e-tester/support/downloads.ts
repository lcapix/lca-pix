/**
 * Where a download landed. `browser.waitForDownload()` returns the file's path
 * relative to the attempt's artifact directory (`downloads/001-<name>`), which
 * sits under `.e2e/artifacts/<target>/<test>/<agent>/attempt-<n>/`. The newest
 * file with that relative path is this attempt's: every test downloads a
 * differently named file, and a later attempt writes a newer one.
 */
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ARTIFACTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.e2e', 'artifacts');

export function downloadedFile(relative: string): string {
  if (path.isAbsolute(relative)) return relative;
  const suffix = `${path.sep}${path.normalize(relative)}`;
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (full.endsWith(suffix)) hits.push(full);
    }
  };
  walk(ARTIFACTS);
  if (hits.length === 0) throw new Error(`no download ${relative} under ${ARTIFACTS}`);
  return hits.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}
