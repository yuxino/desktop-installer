// Cross-platform authoring path for a sidebar composed in an external image editor.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, constants } from 'node:zlib';
import { root, readProduct } from '../src/compiler.mjs';
import { normalizeBitmap } from './prepare-art.mjs';
import { digest } from '../src/consumer.mjs';

const [id, input] = process.argv.slice(2);
if (!id || !input || process.argv.length !== 4) throw new Error('Usage: import-bitmap.mjs <product-id> <sidebar.bmp>');
readProduct(id);
const folder = join(root, 'assets', id), bitmap = normalizeBitmap(readFileSync(input));
const preview = readFileSync(join(folder, 'sidebar.png'));
if (!preview.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || preview.readUInt32BE(16) !== 656 || preview.readUInt32BE(20) !== 1256) throw new Error('Provide the matching 656 x 1256 sidebar.png preview');
writeFileSync(join(folder, 'sidebar.bmp.br'), brotliCompressSync(bitmap, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }));
writeFileSync(join(folder, 'bitmap.json'), JSON.stringify({ width: 656, height: 1256, size: bitmap.length,
  portraitSha256: digest(readFileSync(join(folder, 'portrait.png'))), sha256: digest(bitmap) }, null, 2) + '\n');
console.log(`${id}: imported full-color 4x sidebar`);
