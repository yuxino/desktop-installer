# Desktop Installer

[简体中文](README_ZH.md)

A shared, character-led Windows installer theme for **Tauri 2 + NSIS**.
Maintain the layout, translations, and artwork in one repository. Give each app
its own half-body mascot, welcome message, and optional GitHub link.

<table><tr>
<td align="center"><img src="assets/kiri/sidebar.png" width="132" alt="Kiri"><br>Kiri</td>
<td align="center"><img src="assets/mimi/sidebar.png" width="132" alt="Mimi"><br>Mimi</td>
<td align="center"><img src="assets/satori/sidebar.png" width="132" alt="Satori"><br>Satori</td>
<td align="center"><img src="assets/viva/sidebar.png" width="132" alt="Viva"><br>Viva</td>
<td align="center"><img src="assets/tick/sidebar.png" width="132" alt="Tick"><br>Tick</td>
<td align="center"><img src="assets/wnacg/sidebar.png" width="132" alt="WNACG"><br>WNACG</td>
</tr></table>

The images above are the actual sidebar assets. Windows supplies the native
dialog layout, fonts, buttons, and scaling.

<img src="docs/preview.zh-Hans.png" width="680" alt="Kiri finish-page layout preview in Simplified Chinese">

*Layout preview using the real artwork and copy, not a Windows screenshot.*

- Distinct high-resolution character masters; lossless 656 × 1256, 24-bit sidebars.
- English, Simplified Chinese, and Japanese, including Tauri maintenance/error dialogs.
- Native welcome and finish pages with an optional, click-only GitHub/Star link.
- Pinned, hash-checked offline bundles. Application builds need only Node.js.
- One command updates every registered app. No hand-maintained template copies.
- Tauri continues to own installation, updates, uninstall, shortcuts, and WebView2.

## Try it

Requires Node.js 22 or newer. No npm dependencies or image-service credentials.

```sh
git clone https://github.com/yuxino/desktop-installer.git
cd desktop-installer
npm test
npm run build
npm run preview
```

Open `dist/preview.html` to switch between products, languages, and welcome/finish
pages. This is a layout preview, not a Windows screenshot.

With NSIS 3.11 on PATH, `npm run test:nsis` compiles a harmless preview executable
for each product/language. These previews install and launch no application.
CI also compiles them on Windows.

## Use it in your app

Fork or clone the repository, add your profile and artwork, then sync a pinned
bundle into your Tauri project:

```sh
node scripts/sync.mjs --project ../my-app --product my-app
```

The [integration guide](docs/integration.md) covers profiles, artwork, an existing
custom installer, build commands, and updating the bundle. It works with your
own app name, publisher, and GitHub repository; the six included profiles are examples.

For all registered apps under one parent directory:

```sh
npm run sync -- --root ../
npm run sync -- --root ../ --check
```

Review and commit generated bundles in the application repositories. Updating
this source does not silently change existing releases or consumers: run sync
and build the next application version when you are ready.

## Scope

This project styles Windows NSIS installers. It does not issue signing
certificates, remove OS security prompts, implement download progress inside
your app, or replace its updater. macOS DMG/PKG styling is not included.
See the [architecture decision](docs/architecture.md) for these boundaries.

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md). Code, templates, and included illustrations
are available under the [MIT license](LICENSE). Character illustrations are
AI-generated using each project's existing mascot as reference; generation
records are in [docs/artwork.md](docs/artwork.md).
Product names identify their respective projects; using this toolkit does not
imply endorsement by those projects.
