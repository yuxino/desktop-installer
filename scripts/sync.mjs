import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { root, productIds, compileProduct } from '../src/compiler.mjs';

export const obsolete = ['artwork.lock.json', 'ensure-artwork.mjs', 'theme.nsh', 'preview.nsi',
  'render-brand.swift', 'pack-brand.mjs', 'brand/manifest.json', 'brand/sidebar.bmp.br', 'brand/header.bmp.br',
  'languages/English.nsh', 'languages/SimpChinese.nsh', 'languages/Japanese.nsh'];
const generated = 'installer-theme/generated/';
const buildCommand = 'node src-tauri/installer-theme/build.mjs';

export function patchConfig(config) {
  const result = structuredClone(config);
  result.bundle ??= {}; result.bundle.windows ??= {};
  const nsis = result.bundle.windows.nsis ??= {};
  if (nsis.template || (nsis.installerHooks && !nsis.installerHooks.startsWith('installer-theme/'))) {
    throw new Error('Custom NSIS template or hooks detected. Integrate the theme manually; see docs/integration.md.');
  }
  for (const key of ['sidebarImage', 'headerImage', 'uninstallerHeaderImage']) {
    if (nsis[key] && !nsis[key].startsWith('installer-theme/')) throw new Error(`Custom ${key} detected; integrate manually.`);
  }
  nsis.installerHooks = generated + 'theme.nsh'; nsis.sidebarImage = generated + 'sidebar.bmp';
  delete nsis.headerImage; delete nsis.uninstallerHeaderImage;
  nsis.languages = ['English', 'SimpChinese', 'Japanese']; nsis.displayLanguageSelector = false;
  nsis.customLanguageFiles = Object.fromEntries(nsis.languages.map(l => [l, generated + l + '.nsh']));
  // Preserve string commands; custom cwd/wait object commands require manual integration.
  if (result.build?.beforeBuildCommand) {
    const command = result.build.beforeBuildCommand;
    if (typeof command === 'string') {
      if (!command.startsWith(buildCommand + ' && ') && command !== buildCommand) result.build.beforeBuildCommand = `${buildCommand} && ${command}`;
    } else {
      throw new Error('Object-form beforeBuildCommand detected. Add the theme build explicitly in the project; see docs/integration.md.');
    }
  }
  return result;
}

export function patchPreviewWorkflow(source) {
  let workflow = source.replaceAll('\r\n', '\n')
    .replace('branches: [feat/yuxino-installer-theme-v1]', 'branches: [main, master]')
    .replace('Push-Location src-tauri/installer-theme\n', 'Push-Location src-tauri/installer-theme/generated\n')
    .replace('path: src-tauri/installer-theme/preview-only-setup.exe', 'path: src-tauri/installer-theme/generated/preview-only-setup.exe');
  if (!workflow.includes('"/DPREVIEW_ICON=$previewIcon"')) {
    const directory = '          Push-Location src-tauri/installer-theme/generated';
    const command = '& $compiler /V3 preview.nsi';
    if (!workflow.includes(directory) || !workflow.includes(command)) {
      throw new Error('Custom preview workflow detected. Pass the configured installerIcon as PREVIEW_ICON manually.');
    }
    const setup = [
      '          $tauriDirectory = (Resolve-Path -LiteralPath "src-tauri").Path',
      '          $windowsConfig = Get-Content -LiteralPath (Join-Path $tauriDirectory "tauri.windows.conf.json") -Raw | ConvertFrom-Json',
      '          $iconPath = $windowsConfig.bundle.windows.nsis.installerIcon',
      '          if ([string]::IsNullOrWhiteSpace($iconPath)) { throw "Configure installerIcon before compiling the preview" }',
      '          $previewIcon = (Resolve-Path -LiteralPath (Join-Path $tauriDirectory $iconPath)).Path',
    ].join('\n');
    workflow = workflow.replace(directory, () => `${setup}\n${directory}`)
      .replace(command, () => '& $compiler /V3 "/DPREVIEW_ICON=$previewIcon" preview.nsi');
  }
  if (!workflow.includes("'src-tauri/icons/**'")) {
    workflow = workflow.replaceAll("'src-tauri/installer-theme/**',", "'src-tauri/installer-theme/**', 'src-tauri/icons/**',");
  }
  return workflow;
}

export function planSync(id, projectPath) {
  const bundle = compileProduct(id), folder = join(projectPath, 'src-tauri/installer-theme');
  const configPath = join(projectPath, 'src-tauri/tauri.windows.conf.json');
  const basePath = join(projectPath, 'src-tauri/tauri.conf.json');
  if (!existsSync(basePath)) throw new Error(`Not a Tauri JSON project: ${projectPath}`);
  const base = JSON.parse(readFileSync(basePath));
  // The platform overlay must not conceal hooks or artwork inherited from base config.
  if (base.bundle?.windows?.nsis) patchConfig({ bundle: { windows: { nsis: base.bundle.windows.nsis } } });
  const windows = existsSync(configPath) ? JSON.parse(readFileSync(configPath)) : { $schema: 'https://schema.tauri.app/config/2' };
  // Windows config replaces beforeBuildCommand; copy the normal build only when needed.
  windows.build ??= {};
  windows.build.beforeBuildCommand ??= base.build?.beforeBuildCommand ?? '';
  if (!windows.build.beforeBuildCommand) windows.build.beforeBuildCommand = buildCommand;
  const config = patchConfig(windows);
  const files = new Map([
    [join(folder, 'build.mjs'), readFileSync(join(root, 'src/consumer.mjs'))],
    [join(folder, 'theme.node.mjs'), readFileSync(join(root, 'src/consumer-test.mjs'))],
    [join(folder, 'theme.bundle.br'), bundle.compressed],
    [join(folder, 'theme.lock.json'), Buffer.from(JSON.stringify(bundle.lock, null, 2) + '\n')],
    [join(folder, '.gitignore'), Buffer.from('/generated/\n/artwork/\n/.cache/\n*.exe\n*.tmp\n')],
    [join(folder, '.gitattributes'), Buffer.from('* text=auto eol=lf\n*.br binary\n*.bmp binary\n')],
    [join(folder, 'README.md'), Buffer.from(`# ${bundle.product.name} installer\n\nPresentation source: [yuxino/desktop-installer](https://github.com/yuxino/desktop-installer).\nPinned version: **${bundle.lock.version}**. This directory is generated; edit the shared repository.\n\nBuild offline from the application root:\n\n\x60\x60\x60sh\nnode src-tauri/installer-theme/build.mjs\nnode --test src-tauri/installer-theme/theme.node.mjs\nnode src-tauri/installer-theme/build.mjs --check\n\x60\x60\x60\n\nThe Windows config uses native Tauri/NSIS installation and update behavior, a lossless\n4x full-color half-body sidebar, and English / Simplified Chinese / Japanese dialogs.\nThe optional GitHub link opens only when clicked on Finish.\n\nUpdate all consumers from the shared repository:\n\n\x60\x60\x60sh\nnpm run sync -- --root <parent-of-application-repositories>\n\x60\x60\x60\n\nCommit the resulting bundle and lock together. Old releases keep their pinned artwork.\nNo network, Swift, image service, or package install is needed to unpack this bundle.\n`)],
    [configPath, Buffer.from(JSON.stringify(config, null, 2) + '\n')],
  ]);
  const workflowPath = join(projectPath, '.github/workflows/installer-theme.yml');
  if (existsSync(workflowPath)) {
    const workflow = patchPreviewWorkflow(readFileSync(workflowPath, 'utf8'));
    files.set(workflowPath, Buffer.from(workflow));
  }
  return { id, files, remove: obsolete.map(p => join(folder, p)).filter(existsSync) };
}

export function applyPlan(plan, check = false) {
  const changes = [...plan.files].filter(([p, data]) => !existsSync(p) || !readFileSync(p).equals(data));
  if (check && (changes.length || plan.remove.length)) throw new Error(`${plan.id}: consumer is out of sync`);
  if (!check) {
    for (const [path, bytes] of changes) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes); }
    for (const path of plan.remove) unlinkSync(path);
  }
  return changes.length + plan.remove.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), options = {};
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--check') options.check = true;
      else if (['--root', '--project', '--product'].includes(args[i]) && args[i + 1] && !args[i + 1].startsWith('--')) options[args[i].slice(2)] = args[++i];
      else throw new Error('Usage: sync.mjs --root <app-parent> [--check] OR --project <tauri-app> --product <id> [--check]');
    }
    if (Boolean(options.root) === Boolean(options.project) || (options.project && !options.product) || (options.root && options.product)) throw new Error('Choose --root OR --project and --product');
    const targets = options.root ? productIds.map(id => [id, resolve(options.root, id)]) : [[options.product, resolve(options.project)]];
    // Validate every consumer before changing any application.
    const plans = targets.map(([id, folder]) => planSync(id, folder));
    for (const plan of plans) console.log(`${plan.id}: ${applyPlan(plan, options.check)} changes${options.check ? ' (check)' : ''}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
