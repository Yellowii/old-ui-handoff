import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const forbidden = /(?:^|\/)(?:node_modules|dist|public|dist-ui|build-output|asset-cache|cache|history|reports)(?:\/|$)|^Assets(?:\/|$)|\.(?:glb|gltf|bin|tga|ktx2?|dds|apk|npk|ppk|wppk|png|jpe?g|webp|gif|bmp|ogg|mp3|wav|mp4|webm)$/i;
const all = [];
async function walk(dir) {
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    if (dir === root && ['node_modules', 'build-output'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const relative = path.relative(root, full).split(path.sep).join('/');
    if (forbidden.test(relative)) throw new Error(`forbidden package entry: ${relative}`);
    if (entry.isSymbolicLink()) throw new Error(`symlink is not portable: ${relative}`);
    if (entry.isDirectory()) await walk(full); else all.push(relative);
  }
}
await walk(root);
for (const required of ['MIGRATION.md', 'src/handoff/services.js']) {
  if (!all.includes(required)) throw new Error(`${required} missing`);
}
const files = new Set(all);
let modules = 0, relativeImports = 0, embeddedUiImages = 0;
for (const file of all) {
  if (file.endsWith('.svg')) {
    const text = await readFile(path.join(root, file), 'utf8');
    if (/<image\b|base64,/i.test(text)) {
      if (!['src/appearance/assets/标题.svg', 'src/appearance/assets/返回.svg'].includes(file)) throw new Error(`unreviewed SVG bitmap: ${file}`);
      embeddedUiImages++;
    }
  }
  if (!/\.(?:js|mjs)$/.test(file)) continue;
  modules++;
  const checked = spawnSync(process.execPath, ['--check', path.join(root, file)], {encoding: 'utf8'});
  if (checked.status !== 0) throw new Error(`syntax: ${file}\n${checked.stderr}`);
  const text = await readFile(path.join(root, file), 'utf8');
  if (/[A-Z]:[\\/](?:Proj|project)\b/i.test(text)) throw new Error(`absolute workspace coupling: ${file}`);
  const imports = text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"]([^'"]+)['"]/g);
  for (const match of imports) {
    if (!match[1].startsWith('.')) continue;
    relativeImports++;
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1]));
    if (!files.has(target)) throw new Error(`missing relative import: ${file} -> ${match[1]}`);
  }
}
console.log(JSON.stringify({allowedFiles: all.length, syntaxModules: modules, relativeImports, reviewedEmbeddedUiImages: embeddedUiImages, forbiddenEntries: 0}, null, 2));
