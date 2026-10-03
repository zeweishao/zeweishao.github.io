import { copyFile, lstat, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');

// Only public website files belong in dist; api/ remains a Vercel function source.
const rootFiles = [
  'CNAME', 'albums.html', 'app.js', 'archive-theme.css', 'asset-config.js',
  'backend-config.js', 'comic.html', 'config.config', 'daily-messages.config',
  'figure-lock.css', 'figure-lock.js', 'figure-stories.css', 'figure-story.js', 'figures.html', 'home.css', 'index.html',
  'journal.css', 'journal.js', 'messages.html', 'milk-tea.css', 'milk-tea.html',
  'milk-tea.js', 'motion-system.css', 'motion-system.js', 'orbit-refresh.css',
  'star-rail-comic.css', 'star-rail-comic.js', 'stories.css', 'stories.html',
  'stories.js', 'style.css', 'videos.html',
];
const imageTypes = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico'];
const mediaTypes = [...imageTypes, '.mp3', '.mp4', '.webm', '.ogg', '.wav', '.mov', '.m4v'];
const directories = {
  assets: new Set(mediaTypes),
  data: new Set(['.json']),
  figures: new Set(['.js']),
  'figures-data': new Set(['.json']),
  photos: new Set(imageTypes),
  videos: new Set(mediaTypes),
  vendor: new Set(['.js']),
  'story-data': new Set(['.json']),
};
// Vercel redirects preserve these public paths while R2 serves the large media.
const cloudMediaDirectories = new Set(['assets', 'photos', 'videos']);
const extraFiles = new Set([
  'vendor/FFLATE_LICENSE.txt',
  'assets/star-rail-comic/stories/chapter-01.md',
  'assets/star-rail-comic/stories/chapter-02.md',
  'assets/star-rail-comic/stories/chapter-03.md',
]);
const excludedDirectories = new Set(['node_modules', 'tmp', 'archive', 'archives', 'backup', 'backups', '原片', '归档']);

// Check required inputs before replacing only this script's own output directory.
for (const name of rootFiles) {
  const info = await lstat(path.join(root, name));
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Expected a regular public file: ${name}`);
}
for (const name of Object.keys(directories)) {
  if (cloudMediaDirectories.has(name)) continue;
  const info = await lstat(path.join(root, name));
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Expected a regular public directory: ${name}`);
}
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

let files = 0;
let bytes = 0;
async function copyPublicFile(relative) {
  const source = path.join(root, relative);
  const info = await lstat(source);
  if (!info.isFile() || info.isSymbolicLink()) return;
  const destination = path.join(output, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
  files += 1;
  bytes += info.size;
}
async function copyDirectory(relative, extensions) {
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    if (entry.isSymbolicLink() || entry.name.startsWith('.')) continue;
    const child = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) {
      if (!excludedDirectories.has(entry.name)) await copyDirectory(child, extensions);
    } else if (entry.isFile() && (extensions.has(path.extname(entry.name).toLowerCase()) || extraFiles.has(child))) {
      await copyPublicFile(child);
    }
  }
}
for (const name of rootFiles) await copyPublicFile(name);
for (const [directory, extensions] of Object.entries(directories)) {
  if (!cloudMediaDirectories.has(directory)) await copyDirectory(directory, extensions);
}

console.log(`Static website: ${files} files, ${bytes} bytes in dist/`);
