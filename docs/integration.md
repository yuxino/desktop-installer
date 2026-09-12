# Integrating a Tauri application

## 1. Add a profile

Copy one of `products/*.json` to `products/my-app.json`. Set:

```json
{
  "id": "my-app",
  "directory": "my-app",
  "name": "My App",
  "publisher": "Your Name",
  "repository": "https://github.com/your-name/my-app",
  "description": {
    "en": "A short sentence about what your app does.",
    "zh-Hans": "用一句话介绍应用。",
    "ja": "アプリを短い一文で紹介します。"
  },
  "tip": {
    "en": "One useful thing to try after installation.",
    "zh-Hans": "安装后可以试试的一个功能。",
    "ja": "インストール後に試せる機能を一つ紹介します。"
  }
}
```

The filename, ID, and directory must match a lowercase slug. The display name
can contain Unicode, up to 24 characters, excluding NSIS control characters.
Use a GitHub repository URL. Publisher metadata can be empty and is not rendered
over the character. Keep each description
and tip to one short sentence (maximum 130 characters); verify actual wrapping
in all languages. Products are discovered from the directory, not hardcoded in
the compiler. Remove profiles you do not maintain before syncing all products.

## 2. Add artwork

Save a high-resolution half-body PNG as `assets/my-app/portrait.png`. Use an
uncluttered white background, keep the face large, and leave room around hair,
headwear, and hands. Do not include welcome copy or a slogan in the image.

On macOS the included authoring tool composes the master into the shared layout:

```sh
npm run art -- my-app
```

This requires Apple Command Line Tools and uses AppKit plus `sips`; it does not
call an image-generation service. The tool is an asset-authoring step only.
Normal builds on Windows, Linux, and macOS use the checked-in bitmaps.

On any platform you can compose a **656 × 1256** white sidebar in your preferred
image editor and export matching `assets/my-app/sidebar.png` and a 24-bit BMP.
Keep the sidebar free of image text; the native caption identifies your app. Import the BMP:

```sh
node scripts/import-bitmap.mjs my-app path/to/sidebar.bmp
```

The import validates dimensions and full color, normalizes row orientation,
and generates the compressed bitmap and hash metadata. Commit `portrait.png`,
`sidebar.png`, `sidebar.bmp.br`, and `bitmap.json`. Raw BMP intermediates are
ignored. Add your source/generation notes to `docs/artwork.md`.

## 3. Validate and sync

```sh
npm test
npm run build
npm run test:nsis
node scripts/sync.mjs --project ../my-app --product my-app
```

`test:nsis` needs NSIS 3.11. `sync` writes the presentation bundle and lock into
`src-tauri/installer-theme/`, together with the identical loader and integration
test. It updates `src-tauri/tauri.windows.conf.json`, preserving unrelated fields
and the existing application build command. It does not change versions,
identifiers, signing keys, updater endpoints, or install modes.

Tauri automatically merges `tauri.windows.conf.json` on Windows. The resulting
Windows `beforeBuildCommand` begins with:

```sh
node src-tauri/installer-theme/build.mjs
```

followed by your existing frontend build command. If you use an object-form
command with a custom working directory or an existing custom NSIS template /
hooks, automatic sync stops. Integrate manually: run the loader before bundling,
include generated `theme.nsh` after `MUI2.nsh` and before the MUI welcome/finish macros, point
`sidebarImage` to `installer-theme/generated/sidebar.bmp`, and configure the
three generated language tables. Preserve your original hook logic. Combining
two sets of MUI settings may require resolving duplicate defines. The theme wraps
the welcome/finish entry macros to reposition native controls; existing SHOW
callbacks are chained, and PRE/LEAVE callbacks remain in the stock declarations.

## 4. Verify the consumer

From the application root:

```sh
node src-tauri/installer-theme/build.mjs
node --test src-tauri/installer-theme/theme.node.mjs
node src-tauri/installer-theme/build.mjs --check
```

Build the real Windows package through your normal pipeline. Review the native
welcome and finish pages at 100%, 150%, and 200% scaling in English, Chinese,
and Japanese; confirm all text fits, Run behaves normally, and the GitHub link
only opens when clicked. Also exercise your app's existing upgrade path. This
theme does not implement or change that path.

Commit the generated loader, test, compressed bundle, lock, config, and small
README. Do not commit `generated/` or preview executables to the application.
Application builds never fetch this repository or an image service.

## Updating a family of applications

Maintain source here, increment the theme version when releasing a change, and
run `npm run sync -- --root <parent-of-app-repositories>`. Run it again with
`--check` to confirm parity. Review and commit each application's updated bundle;
your normal application release process adopts it. Sync is explicit so an old
application version remains reproducible even after the shared theme changes.

The shared build produces `dist/<id>/theme.bundle.br` and `theme.lock.json` plus
unpacked previews. You may distribute these together with the matching loader
as offline inputs. SHA-256 hashes detect corruption; review provenance and never
replace only the lock to bless an unexpected payload.
