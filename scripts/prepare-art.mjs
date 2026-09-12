import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { brotliCompressSync, constants } from 'node:zlib';
import { root, productIds, readProduct } from '../src/compiler.mjs';
import { digest } from '../src/consumer.mjs';

export function normalizeBitmap(source, width = 656, height = 1256) {
  if (source.length < 54 || source.toString('ascii', 0, 2) !== 'BM') throw new Error('Missing BMP header');
  const bits = source.readUInt16LE(28), offset = source.readUInt32LE(10), compression = source.readUInt32LE(30);
  const masks = bits === 32 && compression === 3 && source.length >= 70 &&
    [0xff0000, 0xff00, 0xff, 0xff000000].every((mask, i) => source.readUInt32LE(54 + i * 4) === mask);
  const sourceStride = (width * bits / 8 + 3) & ~3;
  if (source.readInt32LE(18) !== width || Math.abs(source.readInt32LE(22)) !== height ||
      ![24, 32].includes(bits) || (compression !== 0 && !masks) ||
      offset < 54 || offset + sourceStride * height > source.length) throw new Error('Unexpected source BMP format');
  const stride = (width * 3 + 3) & ~3;
  const bitmap = Buffer.alloc(54 + stride * height);
  bitmap.write('BM'); bitmap.writeUInt32LE(bitmap.length, 2); bitmap.writeUInt32LE(54, 10);
  bitmap.writeUInt32LE(40, 14); bitmap.writeInt32LE(width, 18); bitmap.writeInt32LE(height, 22);
  bitmap.writeUInt16LE(1, 26); bitmap.writeUInt16LE(24, 28); bitmap.writeUInt32LE(stride * height, 34);
  for (let y = 0; y < height; y++) {
    const sy = source.readInt32LE(22) < 0 ? height - 1 - y : y;
    for (let x = 0; x < width; x++) {
      const from = offset + sy * sourceStride + x * bits / 8;
      if (bits === 32 && source[from + 3] !== 255) throw new Error('Installer bitmap must be opaque');
      source.copy(bitmap, 54 + y * stride + x * 3, from, from + 3);
    }
  }
  return bitmap;
}

if (process.argv[1]?.endsWith('/prepare-art.mjs')) {
  if (process.platform !== 'darwin') throw new Error('Artwork authoring uses macOS; normal builds are platform independent.');
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : productIds;
  for (const id of ids) {
    const product = readProduct(id), folder = join(root, 'assets', id);
    for (const [command, args] of [
      ['swift', [join(root, 'scripts/render.swift'), root, id, product.name, product.publisher]],
      ['sips', ['-s', 'format', 'bmp', join(folder, 'sidebar.png'), '--out', join(folder, 'sidebar.bmp')]],
    ]) {
      const result = spawnSync(command, args, { encoding: 'utf8', env: { ...process.env, DEVELOPER_DIR: '/Library/Developer/CommandLineTools' } });
      if (result.status !== 0) throw new Error(result.stderr || result.stdout);
    }
    const bitmap = normalizeBitmap(readFileSync(join(folder, 'sidebar.bmp')));
    writeFileSync(join(folder, 'sidebar.bmp.br'), brotliCompressSync(bitmap, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }));
    writeFileSync(join(folder, 'bitmap.json'), JSON.stringify({ width: 656, height: 1256, size: bitmap.length,
      portraitSha256: digest(readFileSync(join(folder, 'portrait.png'))), sha256: digest(bitmap) }, null, 2) + '\n');
    console.log(`${id}: full-color 4x sidebar authored`);
  }
}
