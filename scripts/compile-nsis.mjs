import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { root, productIds, languages } from '../src/compiler.mjs';

const compiler = process.env.NSIS_COMPILER || 'makensis';
const prefix = process.platform === 'win32' ? '/' : '-';
for (const id of productIds) {
  for (const [locale, [, language]] of Object.entries(languages)) {
    const output = join(root, 'dist', id, `preview-${locale}.exe`);
    const result = spawnSync(compiler, [`${prefix}V2`, `${prefix}DPREVIEW_LANGUAGE=${language}`, `${prefix}DPREVIEW_OUTPUT=${output}`, 'preview.nsi'], {
      cwd: join(root, 'dist', id), encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
    });
    if (result.status !== 0) { console.error(result.error || result.stderr || result.stdout); process.exit(1); }
    console.log(`${id}: ${locale} NSIS compiled`);
  }
}
