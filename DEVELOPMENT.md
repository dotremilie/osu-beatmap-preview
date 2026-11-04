# Development

## Prerequisites

- Node.js 20.19 or newer (Node.js 22.12+ is also supported).
- npm.

## Setup

```bash
git clone https://github.com/dotremilie/osu-beatmap-preview.git
cd osu-beatmap-preview
npm install
```

## Build

```bash
npm run build
```

## Typecheck

```bash
npm run typecheck
```

## Interactive demo

Start the local renderer demo:

```bash
npm run demo
```

Open the URL printed by Vite (normally `http://localhost:5173`). The demo includes playback controls, a hitobject timeline, the repository's Renatus, Aspire, and Net0 showcase maps, and an **Open .osu** button for previewing a local beatmap file. Drag or scroll the hitobject timeline to seek; use the zoom buttons or Ctrl/⌘ + scroll to zoom. Choose **Beat snap** to change ruler subdivisions from `1/1` through `1/16`, including triplets. A focused timeline also supports arrow keys, Home/End, and +/−.

To create a production build of the demo:

```bash
npm run demo:build
```

The static output is written to `demo-dist/`.
