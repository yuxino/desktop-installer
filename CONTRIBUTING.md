# Contributing

Use Node.js 22+; normal builds have no package dependencies. Work from source,
not from generated consumer bundles. Preserve individual product identities.

Before submitting:

```sh
npm test
npm run build
npm run preview
npm run test:nsis
git diff --check
```

`test:nsis` requires NSIS 3.11. Set `NSIS_COMPILER` if the executable is not on
PATH. On Windows use the Unicode NSIS build. Windows CI builds every native
preview. Do not execute preview `.exe` files as part of build automation.

For artwork changes, include the high-resolution half-body master, sidebar PNG,
compressed 24-bit BMP, metadata, and generation/source notes. Do not flatten
translated welcome or thanks text into images. Do not add suggestive character
art, third-party characters without permission, or unnecessary decorative text.

For copy changes, keep English, Simplified Chinese, and Japanese in sync. Preserve
all NSIS runtime variables. Keep Finish copy short enough for the Run checkbox
and optional link; check all three languages at 100%, 150%, and 200% on Windows.
Record which checks were actually performed. A browser preview is not native QA.

For shared releases, bump `package.json`, update `CHANGELOG.md`, rebuild and sync
consumers deliberately. Tag a reviewed commit; do not silently overwrite a
published version. Application versioning/releases remain separate.
