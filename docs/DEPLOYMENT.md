# EW-UX · Parametric Architectural Module Atlas

Independent visual and geometry research for the **Expandable Worlds** project. Public G1-M1 **v0.3**, not Authority/WP1.1 code.

## Open the Atlas

After Pages is enabled: https://happygq.github.io/ew-ux-atlas/

On iPhone Safari: choose MH/RF/EV from the module selector, drag to orbit, pinch to zoom, use **≋ 拼接验证** for parallel roof/eave joins. If WebGL is unavailable, Canvas2D and static screenshots provide fallbacks.

## Status

- 12 parametric studies, three generator families (gable, curved-tile roof, timber eave).
- Shared world-X phase for repeated tiles, rafters and ridge details; corrected gable stepped cap height.
- Original source artifact v0.3: the program code is in `src/atlas.js` (annotated by original module files); the standalone source package also includes modular JavaScript and Node regression tests.
- Previous isolated Node test evidence: 17/17 pass. **No claim of native iOS/WebGL acceptance.** The visual Gate remains OPEN.
- No WP1.1/Authority integration and no production write access.

## GitHub Pages configuration

Go to **Settings → Pages → Build and deployment → Deploy from a branch → main → /(root) → Save**. This account's ChatGPT GitHub integration can write repository files, but cannot change repository Pages settings directly.

Reference asset is served in on-demand fragments to work around connector upload size limits; this does not affect the image contents. All rendering remains client-side; no external JavaScript libraries or API keys.
