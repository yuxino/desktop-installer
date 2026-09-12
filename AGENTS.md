# Desktop installer source

This is the only authoring source for the Windows installer family. Change templates,
translations, product profiles, and character masters here; consumer bundles are generated.

- Keep each product's existing identity and its own approved half-body character.
- Keep English, Simplified Chinese, and Japanese key sets and placeholders aligned.
- Keep Tauri's install, update, downgrade, shortcut, WebView2, and uninstall logic intact.
- The GitHub/Star link is optional and opens only when explicitly clicked on Finish.
- Do not add networking, telemetry, extra software, or automatic browser opening.
- Run `npm test`, `npm run build`, and the NSIS compile fixtures before syncing.
- `npm run sync -- --root <parent-of-app-repositories>` updates every registered consumer.
- Preserve unrelated application changes and caches. Do not release application versions
  or change updater keys/endpoints while changing installer presentation.
