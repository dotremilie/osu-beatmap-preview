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

## Missing, Planned Features

- Slider repeats and tails are not fully implemented.
- Full skinning API.
- Mania rendering is not part of the public package yet.

## Installation

```bash
npm install osu-beatmap-preview
```

## Usage

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

## Acknowledgements

- [osu!](https://osu.ppy.sh/)
- [JerryZhu99/osu-preview](https://github.com/JerryZhu99/osu-preview)
- kionell's [osu-parsers](https://github.com/kionell/osu-parsers), [osu-classes](https://github.com/kionell/osu-classes), and related libraries.
