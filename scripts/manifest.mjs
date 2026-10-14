import {readdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = process.argv[2];
if (!sourceRoot) throw new Error('Usage: node scripts/manifest.mjs <original-web-root>');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, {withFileTypes:true})) {
    if (dir === root && ['node_modules', 'build-output'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else {
      const name = path.relative(root, full).split(path.sep).join('/');
      if (name === 'docs/FILE-MANIFEST.json') continue;
      const bytes = await readFile(full);
      let source = null;
      if (name.startsWith('src/') && !name.startsWith('src/handoff/') || name === 'appearance.html') {
        try {
          const original = await readFile(path.join(sourceRoot, name));
          const originalSha256 = hash(original);
          source = {relativePath:name, sha256:originalSha256, status:originalSha256 === hash(bytes) ? 'unchanged-copy' : 'adapted-copy'};
        } catch (error) {if (error.code !== 'ENOENT') throw error;}
      }
      files.push({path:name, bytes:bytes.length, sha256:hash(bytes), source});
    }
  }
}
await walk(root);
files.sort((a,b) => a.path.localeCompare(b.path));
const manifest = {version:1, algorithm:'SHA-256', sourceBoundary:'product/web', note:'Original hashes were observed at final validation, not before extraction. This manifest excludes itself. No resource trees were traversed.', files};
await writeFile(path.join(root, 'docs/FILE-MANIFEST.json'), JSON.stringify(manifest, null, 2)+'\n');
console.log(JSON.stringify({files:files.length, bytes:files.reduce((n,f)=>n+f.bytes,0), unchanged:files.filter(f=>f.source?.status==='unchanged-copy').length, adapted:files.filter(f=>f.source?.status==='adapted-copy').length, new:files.filter(f=>!f.source).length}, null, 2));
