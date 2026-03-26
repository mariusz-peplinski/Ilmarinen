# IsoGame Prototype

Desktop isometric prototype built with Electron, Vite, TypeScript, and PixiJS.

## Controls

- `WASD` or arrow keys: move in screen-relative isometric directions
- `Space`: jump

## Scripts

- `npm run dev`: launch the desktop game in development mode
- `npm run build`: build the application bundles
- `npm run dist`: build a packaged desktop artifact

## Notes

- The prototype uses generated shaded terrain blocks so movement, jumping, collision, depth sorting, and camera systems can be iterated quickly.
- Your `tileset.png` is left in the repo for a later sprite-swap pass once the gameplay foundations feel right.
