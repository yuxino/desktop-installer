import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { root, productIds, languages } from '../src/compiler.mjs';

export function stageTauriLanguageFiles(directory) {
  const output = join(directory, '.tauri-languages');
  mkdirSync(output, { recursive: true });
  // Tauri's NSIS bundler unconditionally prepends a UTF-8 BOM to custom
  // language bytes. Do not strip one here: that would hide a broken bundle.
  for (const [name] of Object.values(languages)) {
    const content = readFileSync(join(directory, `${name}.nsh`));
    writeFileSync(join(output, `${name}.nsh`), Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), content]));
  }
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const compiler = process.env.NSIS_COMPILER || 'makensis';
  const prefix = process.platform === 'win32' ? '/' : '-';
  for (const id of productIds) {
    const directory = join(root, 'dist', id);
    const languageDirectory = stageTauriLanguageFiles(directory);
    for (const [locale, [, language]] of Object.entries(languages)) {
      const output = join(directory, `preview-${locale}.exe`);
      const result = spawnSync(compiler, [`${prefix}V2`, `${prefix}DPREVIEW_LANGUAGE=${language}`,
        `${prefix}DPREVIEW_LANGUAGE_DIR=${languageDirectory}`, `${prefix}DPREVIEW_OUTPUT=${output}`, 'preview.nsi'], {
        cwd: directory, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
      });
      if (result.status !== 0) { console.error(result.error || result.stderr || result.stdout); process.exit(1); }
      console.log(`${id}: ${locale} NSIS compiled through Tauri's custom-language encoding`);
    }
  }
}
