import { readFile, writeFile } from 'node:fs/promises';

const [original, output, phase, upstream] = process.argv.slice(2);
if (!original || !output || !['http', 'https'].includes(phase))
  throw new Error('Usage: node scripts/prepare-edge.mjs original output http|https [host:port]');
if (phase === 'https' && !/^[a-zA-Z0-9.-]+:\d{1,5}$/.test(upstream || ''))
  throw new Error('An explicit trusted upstream host:port is required.');
const source = await readFile(original, 'utf8');
const begin = '    # BEGIN FILEWORK MANAGED HOST';
const end = '    # END FILEWORK MANAGED HOST';
const template = (await readFile(`deploy/edge-${phase}.conf`, 'utf8')).replace(
  'FILEWORK_UPSTREAM',
  upstream || '',
);
const block = `${begin}\n${template.trimEnd()}\n${end}`;
let result;
if (source.includes(begin)) {
  if (source.split(begin).length !== 2 || source.split(end).length !== 2)
    throw new Error('Ambiguous managed markers.');
  const start = source.indexOf(begin),
    finish = source.indexOf(end) + end.length;
  if (finish <= start) throw new Error('Invalid managed marker ordering.');
  result = source.slice(0, start) + block + source.slice(finish);
} else {
  const anchor = /^http\s*\{\s*$/gm;
  const matches = [...source.matchAll(anchor)];
  if (matches.length !== 1) throw new Error('Expected exactly one top-level http opening.');
  const at = matches[0].index + matches[0][0].length;
  result = source.slice(0, at) + '\n' + block + '\n' + source.slice(at);
}
await writeFile(output, result);
console.log(`Prepared ${phase} config. Validate with nginx -t before applying.`);
