# osu-beatmap-preview [WIP]

An osu!standard beatmap renderer based on [JerryZhu99/osu-preview](https://github.com/JerryZhu99/osu-preview) that utilizes HTML canvas.

The package uses `osu-parsers`, `osu-classes`, and `osu-standard-stable` for most non-rendering work. The goal is to provide a ready-to-use library that lets developers render osu! beatmap previews in a lightweight way while keeping playback controls, UI, fetching, and application integration in userland.

## Features

- Beatmap combo colors.
- Correctly computed complex slider shapes. The original `osu-preview` implementation freezes on Bezier sliders with multiple anchors due to incorrect computation. It is mathematically correct for a Bezier curve, but osu! uses approximation for Beziers. For more details, see [PathApproximator.cs#L79](https://github.com/ppy/osu-framework/blob/master/osu.Framework/Utils/PathApproximator.cs#L79).
- Aspire maps are supported.
- Catmull sliders are rendered correctly.
- Multiple previews can be created at once without noticeable performance drawbacks.
- Canvas-first API with no React, browser extension, or UI dependency.
- osu!standard mod bitmasks can be passed when loading a beatmap.
- Torus font assets are included for combo number rendering.

## Missing, Planned Features

- Slider repeats and tails are not fully implemented.
- Full skinning API.
- Mania rendering is not part of the public package yet.

## Installation

```bash
npm install osu-beatmap-preview
```

## Usage

Load the bundled Torus font CSS before rendering if you want combo numbers to match the default renderer:

```ts
import "osu-beatmap-preview/assets/fonts/torus.css";
```

```ts
import {StandardBeatmapPreview} from "osu-beatmap-preview";

const canvas = document.querySelector("canvas")!;
const preview = new StandardBeatmapPreview(canvas, {
  width: 640,
  height: 480,
});

const osuText = await fetch(`https://osu.ppy.sh/osu/${beatmapId}`).then((response) => response.text());

preview.loadBeatmapText(osuText, {
  mods: 0,
});

preview.render(42_000);
```

## API

- `new StandardBeatmapPreview(canvas, options?)`
- `loadBeatmapText(osuText, options?)`
- `loadBeatmap(beatmap, options?)`
- `render(timeMs)`
- `resize(width, height, devicePixelRatio?)`
- `clear()`
- `dispose()`
- `beatmap`

The renderer accepts an existing `HTMLCanvasElement`. It does not query the DOM, fetch beatmaps, manage playback time, or provide UI controls.

## Development

### Prerequisites

- Node.js 18 or newer.
- npm.

### Setup

```bash
git clone https://github.com/dotremilie/osu-beatmap-preview.git
cd osu-beatmap-preview
npm install
```

### Build

```bash
npm run build
```

### Typecheck

```bash
npm run typecheck
```

## Releasing

Releases are published to npm from GitHub Actions when a GitHub Release is published.

1. Update the package version and create a matching Git tag:

   ```bash
   npm version patch -m "Release v%s"
   ```

   Use `minor`, `major`, or an explicit version when appropriate.

2. Push the commit and tag:

   ```bash
   git push origin master --follow-tags
   ```

3. Create and publish the GitHub Release:

   ```bash
   gh release create v0.1.1 --generate-notes
   ```

The release tag must match `package.json` exactly, using the `v` prefix. For example, package version `0.1.1` must be released as `v0.1.1`.

Before the first automated npm release, configure npm Trusted Publishing for this package:

- Publisher: GitHub Actions.
- Repository: `dotremilie/osu-beatmap-preview`.
- Workflow filename: `publish.yml`.
- Allowed action: `npm publish`.

## Acknowledgements

- [osu!](https://osu.ppy.sh/)
- [JerryZhu99/osu-preview](https://github.com/JerryZhu99/osu-preview)
- kionell's [osu-parsers](https://github.com/kionell/osu-parsers), [osu-classes](https://github.com/kionell/osu-classes), and related libraries.
