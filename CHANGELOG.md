# Changelog

## 2.1.1 — 2026-09-13

- Exercise all 18 native Windows previews in CI and capture welcome, directory, and finish pages.
- Export a self-contained screenshot gallery, control geometry, DPI, and executable hashes.
- Resample portraits to the actual native control size with GDI+ instead of STATIC's aliased stretch.
- Use standard Windows UI fonts for English, Simplified Chinese, and Japanese.
- Match native localized captions in preview executables while keeping their payload empty.

## 2.1.0 — 2026-09-12

- Refine welcome/finish spacing with shared native and preview geometry.
- Group Open and desktop-shortcut options, shorten copy, and use one quieter Star link.
- Remove repeated sidebar wordmarks while preserving all six character masters.
- Match the full native Finish page in previews, including the shortcut checkbox.
- Localize the preview controls and provide separate English / Chinese / Japanese screenshots.
- Preserve native install/update actions, existing page hooks, and reboot layout.

## 2.0.0 — 2026-09-12

First standalone source repository, replacing the duplicated v1 installer themes.

- Shared Tauri 2 / NSIS presentation with six distinct half-body illustrations.
- English, Simplified Chinese, and Japanese welcome, thanks, and maintenance text.
- Optional native Finish-page GitHub link; no automatic browser launch.
- Lossless full-color 4x sidebars; no generic corner logo or slogan.
- Offline bundles with size/hash validation, synchronized integration, and previews.
- Compilation fixtures for all products and languages. Windows runtime layout and
  application installation/update acceptance must still be checked separately.
