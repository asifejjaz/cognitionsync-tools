import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

describe('edge configuration preparation', () => {
  it('preserves existing hosts, replaces only its own block and is idempotent', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'filework-edge-'));
    try {
      const source =
        'events {}\nhttp {\n    server { listen 80; server_name existing.example; }\n}\n';
      const input = join(dir, 'original.conf'),
        http = join(dir, 'http.conf'),
        https = join(dir, 'https.conf');
      await writeFile(input, source);
      const prepare = (from: string, to: string, phase: string) =>
        execFileSync(process.execPath, [
          'scripts/prepare-edge.mjs',
          from,
          to,
          phase,
          '127.0.0.1:8050',
        ]);
      prepare(input, http, 'http');
      prepare(http, https, 'https');
      const output = await readFile(https, 'utf8');
      const stripped = output.replace(
        /\n    # BEGIN FILEWORK MANAGED HOST[\s\S]*?    # END FILEWORK MANAGED HOST\n/,
        '',
      );
      expect(stripped).toBe(source);
      expect(output).toContain('proxy_pass http://127.0.0.1:8050;');
      prepare(https, http, 'https');
      expect(await readFile(http, 'utf8')).toBe(output);
      await writeFile(input, 'http {}\nhttp {}');
      expect(() => prepare(input, http, 'http')).toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
