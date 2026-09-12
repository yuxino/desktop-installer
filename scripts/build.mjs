import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root, productIds, compileProduct, readPreviewIcon } from '../src/compiler.mjs';

for (const id of productIds) {
  const { files, compressed, lock } = compileProduct(id);
  const folder = join(root, 'dist', id);
  mkdirSync(folder, { recursive: true });
  for (const [name, data] of Object.entries(files)) writeFileSync(join(folder, name), data);
  // Preview-only input; production installers keep the application's own icon.
  writeFileSync(join(folder, 'preview.ico'), readPreviewIcon(id));
  writeFileSync(join(folder, 'theme.bundle.br'), compressed);
  writeFileSync(join(folder, 'theme.lock.json'), JSON.stringify(lock, null, 2) + '\n');
  console.log(`${id}: 4x artwork, 3 languages, ${Math.round(compressed.length / 1024)} KiB offline bundle`);
}
