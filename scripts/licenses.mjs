import { spawnSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';

if (!process.env.npm_execpath) throw new Error('Run this script through pnpm.');
const listed = spawnSync(
  process.execPath,
  [process.env.npm_execpath, 'licenses', 'list', '--prod', '--json'],
  {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  },
);
if (listed.status !== 0) throw new Error(listed.stderr || 'Cannot enumerate dependency licenses.');
const packages = Object.values(JSON.parse(listed.stdout)).flat();
const notices = [
  'Filework third-party notices\nGenerated from the installed production dependency graph.\n',
  await readFile('THIRD-PARTY.md', 'utf8'),
];
let texts = 0;
for (const pkg of packages.sort((a, b) => a.name.localeCompare(b.name))) {
  notices.push(
    `\n---\n${pkg.name} ${pkg.versions.join(', ')}\nLicense: ${pkg.license}\n${pkg.homepage || ''}`,
  );
  const seen = new Set();
  for (const directory of pkg.paths) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !/^(license|licence|copying|notice)([.-]|$)/i.test(entry.name))
        continue;
      const value = await readFile(`${directory}/${entry.name}`, 'utf8');
      if (!seen.has(value)) {
        notices.push(value);
        seen.add(value);
        texts++;
      }
    }
  }
}
for (const file of await readdir('licenses'))
  notices.push(`\n---\n${file}\n${await readFile(`licenses/${file}`, 'utf8')}`);
await writeFile('dist/THIRD-PARTY-NOTICES.txt', notices.join('\n'));
console.log(`Included ${packages.length} dependency records and ${texts} installed license texts.`);
