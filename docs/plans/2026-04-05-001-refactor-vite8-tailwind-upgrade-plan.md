---
title: "refactor: Upgrade to Vite 8 and TailwindCSS 4.2"
type: refactor
status: completed
date: 2026-04-05
---

# Upgrade to Vite 8 and TailwindCSS 4.2

## Overview

Upgrade the build toolchain from Vite 7.3 to Vite 8.0 and TailwindCSS from 4.1.x to 4.2.2. Vite 8 replaces Rollup with Rolldown as the production bundler and esbuild with Oxc for transforms. Also clean up unused PostCSS dependencies.

## Problem Frame

The project is on Vite 7, which uses Rollup + esbuild. Vite 8 is now stable (8.0.3) and brings Rolldown (faster Rust-based bundler), Oxc transforms, and Lightning CSS as default minifier. TailwindCSS 4.2.2 adds Vite 8 peer dep support. Staying current prevents drift and gives access to faster builds.

## Requirements Trace

- R1. Build produces the same `dist/` output structure (flat naming, no hashes) required by `manifest.json`
- R2. All Chrome extension functionality works after upgrade (side panel, content scripts, background worker)
- R3. TailwindCSS styling remains identical
- R4. Remove unused dependencies to reduce install footprint

## Scope Boundaries

- This plan covers dependency upgrades and config migration only
- No feature changes, no code refactoring beyond what the upgrade requires
- No migration to Lightning CSS config — only accepting it as the new default minifier

## Context & Research

### Relevant Code and Patterns

- `vite.config.ts` — minimal config: two plugins, one entry point, flat output naming via `rollupOptions`
- `package.json` — `@tailwindcss/postcss`, `autoprefixer`, `postcss` are installed but unused (no `postcss.config.*` exists; Tailwind runs via `@tailwindcss/vite` plugin)
- `tsconfig.json` — uses `moduleResolution: "bundler"`, `jsx: "react-jsx"`, no path aliases
- `public/manifest.json` — references `sidepanel.html`, `background.js`, `content.js`, `injected.js` by exact name

### Key Vite 8 Breaking Changes (from migration guide)

1. **`build.rollupOptions` → `build.rolldownOptions`** — old name is deprecated but still works via compatibility layer
2. **`esbuild` config → `oxc`** — not applicable (this project has no `esbuild` config)
3. **CSS minifier default changed to Lightning CSS** — no action needed, improves output
4. **Default browser target raised** — Chrome 107→111, Safari 16.0→16.4 (acceptable for a Chrome extension)
5. **`@vitejs/plugin-react` v5 → v6** — drops bundled Babel deps, uses `@rolldown/pluginutils`; optional peer deps `@rolldown/plugin-babel` and `babel-plugin-react-compiler` (not needed for this project)
6. **Removed plugin hooks** — `shouldTransformCachedModule`, `resolveImportMeta`, `resolveFileUrl` (not used here)
7. **`build.commonjsOptions` removed** — not used here
8. **esbuild no longer a direct dependency** — only matters if plugins use `transformWithEsbuild` (not the case here)

## Key Technical Decisions

- **Rename `rollupOptions` to `rolldownOptions`**: Even though the compat layer supports the old name, renaming now avoids deprecation warnings and future breakage.
- **Remove unused PostCSS deps**: `@tailwindcss/postcss`, `autoprefixer`, and `postcss` are dead weight — Tailwind integration uses the Vite plugin path exclusively. Note: `postcss` is a dependency of Vite itself, so it remains available transitively if needed.
- **Pin exact beta-free versions**: Use `^8.0.3` for vite, `^6.0.1` for plugin-react, `^4.2.2` for tailwind packages.

## Open Questions

### Resolved During Planning

- **Does `@tailwindcss/vite` support Vite 8?** Yes — v4.2.2 declares `vite: ^5.2.0 || ^6 || ^7 || ^8`
- **Is `@vitejs/plugin-react` v6 stable?** Yes — 6.0.1 is the current `latest` dist-tag
- **Does the flat output naming still work?** Yes — `entryFileNames`/`chunkFileNames`/`assetFileNames` are supported in `rolldownOptions.output`
- **Are optional peer deps needed?** No — `@rolldown/plugin-babel` and `babel-plugin-react-compiler` are optional and not needed for this project's JSX handling (React plugin handles it)

### Deferred to Implementation

- **Does the built output byte-for-byte match?** Rolldown + Lightning CSS will produce slightly different output than Rollup + esbuild. Functional equivalence is what matters, verified by loading the extension.

## Implementation Units

- [x] **Unit 1: Update dependencies**

  **Goal:** Upgrade all build dependencies to their Vite 8-compatible versions and remove unused packages.

  **Requirements:** R4

  **Dependencies:** None

  **Files:**
  - Modify: `package.json`
  - Regenerate: `bun.lock`

  **Approach:**
  - Update `vite` from `^7.3.0` to `^8.0.3`
  - Update `@vitejs/plugin-react` from `^5.1.2` to `^6.0.1`
  - Update `tailwindcss` from `^4.1.18` to `^4.2.2`
  - Update `@tailwindcss/vite` from `^4.1.18` to `^4.2.2`
  - Remove `@tailwindcss/postcss` (unused — no PostCSS config exists)
  - Remove `autoprefixer` (unused)
  - Remove `postcss` (unused as direct dep — Vite 8 bundles it)
  - Run `bun install` to regenerate lockfile

  **Test expectation:** none — dependency version changes only, verified by build in Unit 3

  **Verification:**
  - `bun install` completes without peer dep conflicts
  - No `@tailwindcss/postcss`, `autoprefixer`, or `postcss` in `package.json` devDependencies

- [x] **Unit 2: Migrate vite.config.ts**

  **Goal:** Rename `rollupOptions` to `rolldownOptions` and verify config compatibility.

  **Requirements:** R1

  **Dependencies:** Unit 1

  **Files:**
  - Modify: `vite.config.ts`

  **Approach:**
  - Rename `build.rollupOptions` → `build.rolldownOptions`
  - Keep the same `input`, `output.entryFileNames`, `output.chunkFileNames`, `output.assetFileNames` structure
  - No other config changes needed — no `esbuild` block exists to migrate

  **Patterns to follow:**
  - Current config is minimal and should stay minimal

  **Test expectation:** none — config rename only, verified by build in Unit 3

  **Verification:**
  - No TypeScript errors in `vite.config.ts`
  - No deprecation warnings from Vite about `rollupOptions`

- [x] **Unit 3: Build and verify**

  **Goal:** Confirm the extension builds correctly and the output structure matches Chrome extension requirements.

  **Requirements:** R1, R2, R3

  **Dependencies:** Unit 1, Unit 2

  **Files:**
  - Verify: `dist/` output

  **Approach:**
  - Run `bun run build` and confirm it succeeds
  - Verify `dist/` contains: `sidepanel.html`, `sidepanel.js`, `sidepanel.css`, `background.js`, `content.js`, `injected.js`, `manifest.json`, `icons/`
  - Verify no content-hashed filenames appear (e.g., no `sidepanel-abc123.js`)
  - Load the extension in Chrome and verify the side panel opens and captures requests

  **Test scenarios:**
  - Happy path: `bun run build` exits 0 and produces all expected files in `dist/`
  - Happy path: `dist/sidepanel.js` and `dist/sidepanel.css` exist with flat names (no hash)
  - Happy path: Extension loads in Chrome without errors in `chrome://extensions`
  - Edge case: `bun run zip` produces a valid `reqpane.zip`

  **Verification:**
  - Build succeeds with no errors or deprecation warnings
  - Extension loads and the side panel renders with correct styling
  - No console errors from the extension on a test page

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Rolldown output differs subtly from Rollup (chunk splitting, tree shaking) | Verify flat output naming is preserved; functional testing in Chrome |
| Lightning CSS minifies differently than esbuild | Acceptable — output may be slightly different but functionally equivalent |
| Plugin-react v6 changes JSX transform behavior | Unlikely — React 19 JSX runtime is well-supported; verify side panel renders |

## Sources & References

- Vite 8 announcement: https://vite.dev/blog/announcing-vite8
- Vite 7→8 migration guide: https://vite.dev/guide/migration.html
- `vite@8.0.3` on npm
- `@vitejs/plugin-react@6.0.1` on npm
- `@tailwindcss/vite@4.2.2` on npm (added `vite ^8` peer dep)
