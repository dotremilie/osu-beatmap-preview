import {BeatmapLoader, StandardBeatmapPreviewer, StandardTimelinePreviewer} from "../src";

// Developer-only benchmark: open /benchmark.html?map=aspire&width=800&height=600
// from `npm run demo`. Times measure Canvas command submission, not finished frames.
const maps = {
    renatus: {load: () => import("./beatmaps/Renatus.osu?raw").then(module => module.default), time: 155_000},
    aspire: {load: () => import("./beatmaps/aspire.osu?raw").then(module => module.default), time: 58_000},
    neto: {load: () => import("./beatmaps/neto.osu?raw").then(module => module.default), time: 57_000},
} as const;

const output = document.getElementById("results")!;
const params = new URLSearchParams(location.search);
const mapName = params.get("map") ?? "aspire";
const width = Number(params.get("width") ?? 800);
const height = Number(params.get("height") ?? 600);
const dpr = Number(params.get("dpr") ?? 1);
const fullMap = params.get("full") === "1";

if (!(mapName in maps) || ![width, height, dpr].every(value => Number.isFinite(value) && value > 0)) {
    output.textContent = "Invalid map or canvas size";
} else {
    const nativeOffscreenCanvas = globalThis.OffscreenCanvas;
    const surfaces = new Set<OffscreenCanvas>();
    if (nativeOffscreenCanvas) {
        globalThis.OffscreenCanvas = class extends nativeOffscreenCanvas {
            constructor(canvasWidth: number, canvasHeight: number) {
                super(canvasWidth, canvasHeight);
                surfaces.add(this);
            }
        };
    }

    try {
        const map = maps[mapName as keyof typeof maps];
        const prepared = new BeatmapLoader().loadBeatmapText(await map.load());
        const playfield = new StandardBeatmapPreviewer(document.createElement("canvas"),
            {width, height, devicePixelRatio: dpr});
        const timeline = new StandardTimelinePreviewer(document.createElement("canvas"),
            {width: 640, height: 46, timeRange: 4000, devicePixelRatio: 1});
        playfield.loadPreparedBeatmap(prepared);
        timeline.loadPreparedBeatmap(prepared);

        const retainedBytes = () => [...surfaces].reduce((bytes, canvas) => bytes + canvas.width * canvas.height * 4, 0);
        let peakBytes = 0;
        const sampleMemory = () => { peakBytes = Math.max(peakBytes, retainedBytes()); };
        const playfieldTimes: number[] = [];
        const timelineTimes: number[] = [];
        const draw = (time: number, measure: boolean) => {
            const start = performance.now();
            playfield.render(time);
            const middle = performance.now();
            timeline.render(time);
            const end = performance.now();
            if (measure) {
                playfieldTimes.push(middle - start);
                timelineTimes.push(end - middle);
            }
            sampleMemory();
        };

        for (let i = 0; i < 15; i++) draw(map.time - 250 + i * 16, false);
        for (let i = 0; i < 40; i++) draw(map.time + i * 16, true);
        if (fullMap) {
            for (let time = 0; time <= prepared.beatmap.totalLength; time += 100) draw(time, false);
        }
        const median = (values: number[]) => {
            const sorted = [...values].sort((a, b) => a - b);
            return (sorted[19] + sorted[20]) / 2;
        };
        const result = {
            map: mapName, width, height, dpr, fullMap,
            browser: navigator.userAgent,
            samples: playfieldTimes.length,
            playfieldMedianMs: median(playfieldTimes),
            timelineMedianMs: median(timelineTimes),
            peakNominalRasterMiB: peakBytes / 1024 / 1024,
            retainedNominalRasterMiB: retainedBytes() / 1024 / 1024,
        };
        playfield.dispose();
        timeline.dispose();
        output.textContent = JSON.stringify({...result, afterDisposeNominalRasterMiB: retainedBytes() / 1024 / 1024});
    } catch (error) {
        output.textContent = JSON.stringify({error: error instanceof Error ? error.stack : String(error)});
    } finally {
        globalThis.OffscreenCanvas = nativeOffscreenCanvas;
    }
}
