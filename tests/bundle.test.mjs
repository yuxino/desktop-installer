import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliCompressSync, brotliDecompressSync } from 'node:zlib';
import { compileProduct, productIds, readProduct, themeText, languages } from '../src/compiler.mjs';
import { decodeBundle, digest, buildTheme } from '../src/consumer.mjs';
import { patchConfig, planSync, applyPlan } from '../scripts/sync.mjs';
import { normalizeBitmap } from '../scripts/prepare-art.mjs';

const first = () => compileProduct(productIds[0]);
const temporary = t => { const folder = mkdtempSync(join(tmpdir(), 'installer-test-')); t.after(() => rmSync(folder, { recursive: true, force: true })); return folder; };

test('all products build deterministically with native full-color 4x artwork and aligned languages', () => {
  const fingerprints = new Set();
  for (const id of productIds) {
    const bundle = compileProduct(id), again = compileProduct(id);
    assert.deepEqual(bundle.compressed, again.compressed);
    assert.deepEqual(bundle.lock, again.lock);
    const files = decodeBundle(bundle.compressed, bundle.lock);
    fingerprints.add(digest(files['sidebar.bmp']));
    assert.equal(files['sidebar.bmp'].readUInt16LE(28), 24);
    assert.equal(files['sidebar.bmp'].readInt32LE(18), 656);
    assert.equal(files['sidebar.bmp'].readInt32LE(22), 1256);
    const identifiers = [];
    for (const [name] of Object.values(languages)) {
      const text = files[`${name}.nsh`].toString();
      assert.equal(text.charCodeAt(0), 0xfeff);
      assert.doesNotMatch(text, /@APP@/);
      identifiers.push([...text.matchAll(/^LangString (\w+) /gm)].map(m => m[1]).sort());
      // These live Tauri variables must survive translation, not become literal text.
      for (const placeholder of ['${PRODUCTNAME}', '${VERSION}', '$R4', '$0', '$1']) assert.ok(text.includes(placeholder), `${id} ${name}: ${placeholder}`);
    }
    assert.equal(identifiers[0].length, 27);
    assert.deepEqual(identifiers[0], identifiers[1]); assert.deepEqual(identifiers[0], identifiers[2]);
    const theme = files['theme.nsh'].toString();
    assert.equal((theme.match(/^LangString /gm) || []).length, 21);
    assert.doesNotMatch(theme, /^(Function|Section|Exec|SetFont|!define MUI_PAGE_CUSTOMFUNCTION)/m);
    assert.ok(theme.includes(`MUI_FINISHPAGE_LINK_LOCATION "${bundle.product.repository}"`));
  }
  assert.equal(fingerprints.size, productIds.length, 'every product must have its own artwork');
});

test('tampered or oversized bundles fail before any output is written', t => {
  const { compressed, lock } = first();
  const corrupt = Buffer.from(compressed); corrupt[10] ^= 1;
  assert.throws(() => decodeBundle(corrupt, lock), /corrupt/);
  assert.throws(() => decodeBundle(compressed, { ...lock, unpackedSize: 9 * 1024 * 1024 }), /Invalid/);
  assert.throws(() => decodeBundle(compressed, { ...lock, product: 'wrong-product' }), /Wrong product/);
  const folder = temporary(t), output = join(folder, 'generated');
  writeFileSync(join(folder, 'theme.bundle.br'), corrupt);
  writeFileSync(join(folder, 'theme.lock.json'), JSON.stringify(lock));
  assert.throws(() => buildTheme(output, false, folder));
  assert.equal(existsSync(output), false);
});

test('entry allow-list rejects traversal and checks each entry even with a fresh outer hash', () => {
  const { compressed, lock } = first();
  for (const change of [
    pack => { pack.files['../escape.nsh'] = pack.files['theme.nsh']; },
    pack => { pack.files['theme.nsh'].data = Buffer.from('broken').toString('base64'); },
    pack => { pack.files['sidebar.bmp'].sha256 = '0'.repeat(64); },
  ]) {
    const pack = JSON.parse(brotliDecompressSync(compressed)); change(pack);
    const bytes = Buffer.from(JSON.stringify(pack)), altered = brotliCompressSync(bytes);
    assert.throws(() => decodeBundle(altered, { ...lock, size: altered.length, unpackedSize: bytes.length, sha256: digest(altered) }));
  }
});

test('offline extraction is repeatable and check mode catches stale files', t => {
  const { compressed, lock } = first(), folder = temporary(t), output = join(folder, 'generated');
  writeFileSync(join(folder, 'theme.bundle.br'), compressed);
  writeFileSync(join(folder, 'theme.lock.json'), JSON.stringify(lock));
  buildTheme(output, false, folder); buildTheme(output, true, folder);
  writeFileSync(join(output, 'theme.nsh'), 'stale');
  assert.throws(() => buildTheme(output, true, folder), /Stale/);
  buildTheme(output, false, folder); buildTheme(output, true, folder);
});

test('theme escapes translated dollar signs and quotes without NSIS injection', () => {
  const p = structuredClone(readProduct(productIds[0]));
  p.tip.en = 'A $variable and "quoted words"';
  const theme = themeText(p).toString();
  assert.ok(theme.includes('A $$variable and $\\"quoted words$\\"'));
});

test('config integration preserves updater, installer identity, resources, and build commands', () => {
  const config = { build: { beforeBuildCommand: 'npm run build' }, plugins: { updater: { pubkey: 'preserve', endpoints: ['https://example.com/feed'] } },
    bundle: { resources: ['data.json'], windows: { nsis: { installerHooks: 'installer-theme/theme.nsh', installMode: 'perUser', installerIcon: 'icons/icon.ico', compression: 'lzma' } } } };
  const next = patchConfig(config);
  assert.deepEqual(next.plugins, config.plugins); assert.deepEqual(next.bundle.resources, config.bundle.resources);
  for (const key of ['installMode', 'installerIcon', 'compression']) assert.equal(next.bundle.windows.nsis[key], config.bundle.windows.nsis[key]);
  assert.equal(next.build.beforeBuildCommand, 'node src-tauri/installer-theme/build.mjs && npm run build');
  assert.deepEqual(patchConfig(next), next);
  assert.throws(() => patchConfig({ bundle: { windows: { nsis: { installerHooks: 'custom-hooks.nsh' } } } }), /Custom/);
  assert.throws(() => patchConfig({ build: { beforeBuildCommand: { script: 'npm run build', cwd: 'web' } } }), /Object-form/);
});

test('single-project sync supports a fresh app, is idempotent, and leaves unrelated files intact', t => {
  const folder = temporary(t), tauri = join(folder, 'src-tauri'); mkdirSync(tauri);
  writeFileSync(join(tauri, 'tauri.conf.json'), JSON.stringify({ build: { beforeBuildCommand: 'npm run build' }, identifier: 'dev.example.test' }));
  writeFileSync(join(tauri, 'keep.txt'), 'unrelated work');
  assert.ok(applyPlan(planSync(productIds[0], folder)) > 0);
  assert.equal(applyPlan(planSync(productIds[0], folder)), 0);
  assert.equal(applyPlan(planSync(productIds[0], folder), true), 0);
  assert.equal(readFileSync(join(tauri, 'keep.txt'), 'utf8'), 'unrelated work');
  const windows = JSON.parse(readFileSync(join(tauri, 'tauri.windows.conf.json')));
  assert.ok(windows.build.beforeBuildCommand.endsWith(' && npm run build'));
});

test('bitmap normalization handles top-down images without losing full color', () => {
  const source = Buffer.alloc(62); source.write('BM'); source.writeUInt32LE(54, 10); source.writeUInt32LE(40, 14);
  source.writeInt32LE(1, 18); source.writeInt32LE(-2, 22); source.writeUInt16LE(1, 26); source.writeUInt16LE(24, 28);
  Buffer.from([1, 2, 3, 0, 4, 5, 6, 0]).copy(source, 54);
  const bmp = normalizeBitmap(source, 1, 2);
  assert.deepEqual([...bmp.subarray(54)], [4, 5, 6, 0, 1, 2, 3, 0]);
  assert.throws(() => normalizeBitmap(source), /Unexpected/);
});
