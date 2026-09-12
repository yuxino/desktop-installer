import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliCompressSync, brotliDecompressSync } from 'node:zlib';
import { compileProduct, productIds, readProduct, readPreviewIcon, themeText, languages, layout, root } from '../src/compiler.mjs';
import { decodeBundle, digest, buildTheme } from '../src/consumer.mjs';
import { patchConfig, patchPreviewWorkflow, planSync, applyPlan } from '../scripts/sync.mjs';
import { normalizeBitmap } from '../scripts/prepare-art.mjs';
import { stageTauriLanguageFiles } from '../scripts/compile-nsis.mjs';

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
      assert.notEqual(text.charCodeAt(0), 0xfeff, 'Tauri adds the custom-language BOM');
      assert.doesNotMatch(text, /@APP@/);
      identifiers.push([...text.matchAll(/^LangString (\w+) /gm)].map(m => m[1]).sort());
      // These live Tauri variables must survive translation, not become literal text.
      for (const placeholder of ['${PRODUCTNAME}', '${VERSION}', '$R4', '$0', '$1']) assert.ok(text.includes(placeholder), `${id} ${name}: ${placeholder}`);
    }
    assert.equal(identifiers[0].length, 27);
    assert.deepEqual(identifiers[0], identifiers[1]); assert.deepEqual(identifiers[0], identifiers[2]);
    const theme = files['theme.nsh'].toString();
    assert.equal(theme.charCodeAt(0), 0xfeff, 'directly included theme keeps its UTF-8 BOM');
    assert.equal((theme.match(/^LangString /gm) || []).length, 24);
    assert.doesNotMatch(theme, /^\s*(?:Section|Exec(?:Shell|Wait)?|WriteReg\w+|Delete|RMDir)\b/m);
    assert.doesNotMatch(theme, /!define MUI_PAGE_CUSTOMFUNCTION_(?:PRE|LEAVE)/);
    assert.ok(theme.includes(`MUI_FINISHPAGE_LINK_LOCATION "${bundle.product.repository}"`));
  }
  assert.equal(fingerprints.size, productIds.length, 'every product must have its own artwork');
});

test('native fixtures use Tauri BOM rewriting without hiding malformed custom-language input', t => {
  const folder = temporary(t), { files } = first();
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  for (const [name] of Object.values(languages)) writeFileSync(join(folder, `${name}.nsh`), files[`${name}.nsh`]);
  const staged = stageTauriLanguageFiles(folder);
  for (const [name] of Object.values(languages)) {
    const original = files[`${name}.nsh`];
    const rewritten = readFileSync(join(staged, `${name}.nsh`));
    assert.deepEqual(rewritten.subarray(0, 3), bom);
    assert.deepEqual(rewritten.subarray(3), original, 'Tauri preserves every source byte');
    assert.notEqual(rewritten.toString().charCodeAt(1), 0xfeff, 'NSIS must receive exactly one BOM');
    assert.deepEqual(readFileSync(join(folder, `${name}.nsh`)), original, 'staging leaves the distributable unchanged');
  }
  // A bundle with the original bug must reach makensis unchanged and fail;
  // the fixture must not silently repair it before the native compiler runs.
  writeFileSync(join(folder, 'English.nsh'), Buffer.concat([bom, files['English.nsh']]));
  stageTauriLanguageFiles(folder);
  assert.deepEqual(readFileSync(join(staged, 'English.nsh')).subarray(0, 6), Buffer.concat([bom, bom]));
});

test('preview icons preserve each application asset and stay outside the production bundle', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'assets/preview-icons.json')));
  for (const id of productIds) {
    const entry = manifest.icons[id], bytes = readPreviewIcon(id);
    assert.equal(entry.sourceRepository, readProduct(id).repository);
    assert.match(entry.sourcePath, /^src-tauri\/.+\.ico$/);
    assert.equal(bytes.length, entry.size);
    assert.equal(digest(bytes), entry.sha256);
    const { files } = compileProduct(id);
    assert.deepEqual(Object.keys(files).sort(), ['English.nsh', 'Japanese.nsh', 'SimpChinese.nsh', 'preview.nsi', 'sidebar.bmp', 'theme.nsh']);
    const fixture = files['preview.nsi'].toString();
    assert.match(fixture, /!ifndef PREVIEW_ICON\n!error "PREVIEW_ICON is required/);
    assert.ok(fixture.includes('!define MUI_ICON "${PREVIEW_ICON}"'));
    assert.ok(fixture.indexOf('!define MUI_ICON "${PREVIEW_ICON}"') < fixture.indexOf('!include "MUI2.nsh"'));
  }
});

test('consumer preview workflow resolves its configured icon before changing directories', () => {
  const source = `name: Installer theme
on:
  push:
    branches: [feat/yuxino-installer-theme-v1]
    paths: ['src-tauri/installer-theme/**', 'src-tauri/tauri.windows.conf.json']
jobs:
  theme:
    steps:
      - run: |
          Push-Location src-tauri/installer-theme
          try {
            & $compiler /V3 preview.nsi
          } finally { Pop-Location }
        path: src-tauri/installer-theme/preview-only-setup.exe
`;
  const workflow = patchPreviewWorkflow(source);
  assert.equal(patchPreviewWorkflow(workflow), workflow, 'workflow synchronization is idempotent');
  assert.match(workflow, /\$iconPath = \$windowsConfig\.bundle\.windows\.nsis\.installerIcon/);
  assert.match(workflow, /Resolve-Path -LiteralPath \(Join-Path \$tauriDirectory \$iconPath\)/);
  assert.ok(workflow.indexOf('$previewIcon =') < workflow.indexOf('Push-Location'));
  assert.ok(workflow.includes('& $compiler /V3 "/DPREVIEW_ICON=$previewIcon" preview.nsi'), 'paths with spaces remain one argument');
  assert.ok(workflow.includes("'src-tauri/icons/**'"), 'icon changes trigger a fresh preview');
  assert.doesNotMatch(workflow, /icons\/icon\.ico/);
  assert.throws(() => patchPreviewWorkflow('custom preview runner'), /Custom preview workflow/);
});

test('native layout fits the dialog, separates actions, and preserves MUI behavior', () => {
  for (const [key,r] of Object.entries(layout)) {
    if (key === 'page') continue;
    assert.ok(r.x >= layout.page.sidebarWidth && r.y >= 0 && r.x+r.width <= layout.page.width && r.y+r.height <= layout.page.height);
  }
  const ordered = ['title','finishText','run','shortcut','link'].map(key=>layout[key]);
  for (let i=1;i<ordered.length;i++) assert.ok(ordered[i-1].y+ordered[i-1].height <= ordered[i].y);
  const bundle = first(), theme = bundle.files['theme.nsh'].toString(), fixture = bundle.files['preview.nsi'].toString();
  assert.match(theme, /MapDialogRect/); assert.match(theme, /SetWindowPos/);
  assert.match(theme, /Call "\$\{YUXINO_FINISH_PREVIOUS_SHOW\}"/);
  assert.match(theme, /IfRebootFlag yuxino_finish_native/);
  for (const page of ['WELCOME','FINISH']) assert.ok(theme.includes(`!insertmacro MUI_PAGEDECLARATION_${page}`));
  for (const name of ['RUN','SHOWREADME']) assert.ok(fixture.includes(`MUI_FINISHPAGE_${name}_FUNCTION PreviewNoop`));
});

test('preview shell translations align and README screenshots match their language', () => {
  const ui = JSON.parse(readFileSync(join(root, 'locales/preview.json')));
  assert.deepEqual(Object.keys(ui).sort(), Object.keys(languages).sort());
  for (const locale of Object.keys(languages)) {
    assert.deepEqual(Object.keys(ui[locale]).sort(), Object.keys(ui.en).sort());
    assert.ok(Object.values(ui[locale]).every(s => typeof s === 'string' && s.trim()));
  }
  assert.match(readFileSync(join(root, 'README.md'), 'utf8'), /src="docs\/preview\.en\.png"/);
  assert.doesNotMatch(readFileSync(join(root, 'README.md'), 'utf8'), /src="docs\/preview\.zh-Hans\.png"/);
  assert.match(readFileSync(join(root, 'README_ZH.md'), 'utf8'), /src="docs\/preview\.zh-Hans\.png"/);
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
