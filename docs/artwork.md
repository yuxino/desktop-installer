# Artwork sources

All six illustrations were generated with the built-in OpenAI image-generation
tool on 2026-09-12, then visually reviewed. They are new half-body illustrations
based on the existing mascots of the corresponding yuxino projects. No API key
or generation service is needed to build this repository.

| Profile | Identity reference in the corresponding website source | Direction |
| --- | --- | --- |
| Kiri | `kiri-web/site-public/visuals/kiri-portrait.webp` | Silver-lavender bob, violet eyes, K hairclip, flower bow, white blouse, small camera. |
| Mimi | `mimi-web/public/mimi/mimi-mascot-master.png` | Pink twin tails, purple eyes, M hairclip, flower bows, white/pink outfit, headphones; system-audio identity. |
| Satori | `satori-web/public/satori-portrait.png` | Gray bob, muted violet eyes, ivory cat-ear hood, gold bookmark clasp, cream book. |
| Viva | `viva-web/public/art/writing-studio-petite.webp` | Brown bob and eyes, gold triangular clip, ivory/brown sailor blouse, notebook and pen. |
| Tick | `tick-web/public/timekeeper.webp` | Mint twin tails, teal eyes, clock bows, ivory/teal vintage clothes, small closed pocket watch. |
| WNACG | `wnacg-web/public/art/reading-room.webp` | White bob and small braid, violet eyes, black rabbit headband, modest black/white blouse, closed burgundy book. |

The website paths above describe provenance; references are not runtime
dependencies and are not required in a contributor's checkout.

## Shared generation brief

Create a production-quality, separate half-body portrait from the complete hair
or hood to the waist, using the project image as an identity reference. Draw a
wholesome petite chibi anime mascot with rounded facial proportions, luminous
eyes, modest long sleeves, refined linework, soft cel shading, and natural
warmth. Use a narrow 1024 × 1536 portrait, a pure white background, and room
around hair, headwear, hands, and the small project-specific prop. No scene,
frame, caption, watermark, floating symbols, or additional people. Keep the
character's existing colors and identity; do not use a generic shared avatar.

The initial full-body experiment was discarded after the requested framing
changed to half-body. Tick and WNACG received an additional framing pass to keep
twin tails and rabbit ears within the canvas. Per-image generation prompts and
final master hashes are recorded in `assets/provenance.json`.

## Packaging

`portrait.png` is the high-resolution master. `sidebar.png` previews the shared
layout: product name above, the complete portrait fitted without cropping, and
a small publisher name below. The authoring script exports a true-color BMP,
normalizes it to 24-bit bottom-up RGB, and stores it losslessly as
`sidebar.bmp.br`. `bitmap.json` ties that rendering to its master and checksum.

Welcome, thanks, navigation, errors, and the optional Star link are native
localized text. They are never flattened into the picture. Source images and
the authored PNG are included under the repository's MIT license.
