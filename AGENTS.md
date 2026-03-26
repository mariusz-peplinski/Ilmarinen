# Repository Guidelines

## Project Structure & Module Organization

This repository is an Electron + Vite + TypeScript desktop game prototype using PixiJS.

- `src/main/`: Electron main-process entry (`index.ts`).
- `src/preload/`: Electron preload bridge.
- `src/renderer/`: renderer HTML shell.
- `src/renderer/src/`: game code and UI styles.
  - `game.ts`: core gameplay, terrain rendering, camera, input, and movement.
  - `main.ts`: renderer bootstrap and asset loading.
  - `style.css`: HUD and overlay styling.
- Root-level art assets such as `characters.png` and `new-tileset.png` are loaded directly by the renderer.

## Build, Test, and Development Commands

- `npm run dev`: start the Electron app in development mode with hot reload.
- `npm run typecheck`: run TypeScript checks without emitting files.
- `npm run build`: produce production renderer/main/preload bundles in `out/`.
- `npm run dist`: build and package the Linux desktop app with `electron-builder`.

Use `npm run typecheck && npm run build` before committing gameplay or rendering changes.

## Coding Style & Naming Conventions

- Use TypeScript with 2-space indentation and semicolons omitted, matching the existing codebase.
- Prefer small helper functions for math/projection logic (`clamp`, `approach`, `projectWorld`).
- Use `camelCase` for variables/functions, `PascalCase` for classes/interfaces, and `UPPER_SNAKE_CASE` for gameplay constants.
- Keep renderer behavior in `game.ts`; keep Electron bootstrapping in `src/main` and `src/preload`.
- Preserve pixel-art friendliness: nearest-neighbor textures, explicit sizes, and minimal hidden magic numbers.

## Direction Convention

Screen-direction language is intentional and has been sanity-checked against in-code movement.

- The HUD/compass uses `N-up`, `E-up`, `S-up`, `W-up` to describe which world direction is currently at the top of the screen.
- In the default `N-up` view:
  - `+X = SE`
  - `-X = NW`
  - `+Y = SW`
  - `-Y = NE`
  - `N = (-1, -1)`
  - `S = (+1, +1)`
- `Tab` rotates the view `+90` degrees and `Shift+Tab` rotates `-90` degrees.

When discussing visual bugs, prefer the on-screen compass terms first, then include world-axis equivalents if useful.

## Testing Guidelines

There is no automated gameplay test suite yet. For now:

- Run `npm run typecheck`.
- Run `npm run build`.
- Manually verify movement, jumping, camera follow, and terrain rendering in `npm run dev`.

When adding tests later, place them near the relevant module or in a dedicated `tests/` folder and prefer behavior-focused names such as `movement.spec.ts`.

## Commit & Pull Request Guidelines

Recent commits use short, imperative summaries, for example:

- `Initial isometric prototype`
- `Checkpoint terrain reset and movement tuning`
- `Tune movement feel and pixel snapping`

Follow that style: brief, readable, and outcome-focused. For pull requests, include:

- a short summary of gameplay/rendering changes
- verification steps run (`typecheck`, `build`, manual checks)
- screenshots or clips for visual changes
- notes about any known regression or unfinished sorting/rendering work
