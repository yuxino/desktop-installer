# One source, pinned consumer bundles

Status: accepted, 2026-09-12.

Six Tauri applications previously carried separate JavaScript generators, NSIS
hooks, images, and translation choices. A style change required editing every
repository. Their delivery requirements are shared, while their character
identities and product copy are different.

## Decision

Keep the presentation source here: product JSON, three language tables, MUI2
settings, half-body PNG masters, and authored 4x bitmaps. Compile a deterministic
Brotli bundle and a SHA-256 lock for each product. The same small Node loader
and integration test are generated into every consumer.

The lock pins version, product, compressed size/hash, and decompressed size.
Every file also has its own size/hash. The loader validates everything before
writing only six allow-listed filenames into `generated/`. Limits bound
decompression and output sizes. Hashes detect damage and drift; they are not
publisher signatures. Trust comes from reviewing the source and committing the
bundle/lock together, not from fetching an untrusted lock at build time.

`sync` compiles and validates all target integrations before writing any target.
It preserves application commands and unrelated configuration, rejects unknown
custom hooks/templates, and removes only listed obsolete presentation sources.
`--check` is read-only. Generated files are deliberately committed: they are
offline build inputs, not independently authored copies.

## Native boundary

Use documented Tauri NSIS `installerHooks`, `sidebarImage`, and
`customLanguageFiles`. The hook sets MUI appearance/text and presentation-only
SHOW callbacks. It does not define install/uninstall actions, registry writes,
or process execution. The optional link uses MUI2's native Finish-page link and requires a
click. Tauri's passive updater path skips interactive pages.

The sidebar is a 656 × 1256 true-color BMP, four times the standard 164 × 314
asset dimensions. It uses aspect-preserving fit. The sidebar contains only the
character; product identity stays in the native caption, avoiding repeated names.
No corner header art is supplied, avoiding low-resolution brand tiles.

Native language tables select fonts. All three tables preserve Tauri's current
27 custom string identifiers and live NSIS variables. Finish text leaves room
for Tauri's Run and desktop-shortcut checkboxes and the optional link. Compile fixtures exercise all
18 product/language combinations; real Windows DPI/layout acceptance remains a
separate check.

Custom language files are emitted as UTF-8 without a byte-order mark: Tauri's
bundler always prepends its own UTF-8 BOM before including them. Supplying a
BOM in the bundle produces two markers, and NSIS rejects the second as part of
the first command. The directly included `theme.nsh` keeps its BOM. Compile
fixtures first perform the same unconditional prefixing as Tauri; direct
standalone previews explicitly select UTF-8 for the unprefixed language files.

## Layout refinement in 2.1.0

The first HTML preview incorrectly anchored Run at the bottom and omitted
Tauri's desktop-shortcut checkbox. It also reused the Chinese screenshot in the
English README. Version 2.1.0 shares `src/layout.json` between native geometry
and the HTML preview, includes both real checkbox roles, and supplies separate
English, Chinese, and Japanese screenshots. Preview controls and explanations
also follow the selected locale.

The hook wraps only MUI2's small welcome/finish entry macros, then calls their
stock page declarations. It chains any existing SHOW hook, preserves PRE and
LEAVE hooks, and repositions existing controls with `MapDialogRect` plus
`SetWindowPos` using dialog units. It does not replace native control handlers,
checkbox defaults, focus/tab order, launch, shortcut creation, or passive-update
logic. A required reboot retains the original native layout and radio buttons.
Compile fixtures exercise PRE/SHOW/LEAVE chaining and both checkbox callbacks.

## Alternatives

- **Floating download from main on each build:** fewer checked-in assets, but
  adds network availability, non-repeatable releases, and changing build input.
- **A full custom NSIS template:** more layout freedom, but forks Tauri's update,
  WebView2, uninstall, and shortcut behavior. Maintenance cost is unnecessary.
- **Manually copying generators into every app:** works offline but repeats the
  original maintenance problem. Only this source repository is edited now.
- **Git submodules or an npm runtime dependency:** valid alternatives, but add
  checkout/package steps to existing release pipelines for a small bundle.

The trade-off is one explicit synchronization/review step before applications
adopt a new theme version. Nothing hot-updates already shipped installers.

## Platform and signing scope

This version targets Windows NSIS presentation for Tauri 2. macOS apps do not
all share the same packaging technology; they are not forced into this Windows
theme. Application updater signatures, OS code-signing identities, notarization,
and in-app download progress stay owned by each application/release pipeline.

References: [Tauri Windows installers](https://v2.tauri.app/distribute/windows-installer/),
[NSIS Modern UI 2](https://nsis.sourceforge.io/Docs/Modern%20UI%202/Readme.html).
