import "../assets/fonts/torus.css";
import "./style.css";
import {StandardBeatmapPreview} from "../src";
import renatus from "./beatmaps/Renatus.osu?raw";
import aspire from "./beatmaps/aspire.osu?raw";
import neto from "./beatmaps/neto.osu?raw";

const SHOWCASE_BEATMAPS = {
    renatus: {text: renatus, label: "Renatus"},
    aspire: {text: aspire, label: "Aspire"},
    neto: {text: neto, label: "Net0"},
} as const;

type ShowcaseBeatmap = keyof typeof SHOWCASE_BEATMAPS;

const canvas = getElement<HTMLCanvasElement>("preview");
const playButton = getElement<HTMLButtonElement>("play");
const restartButton = getElement<HTMLButtonElement>("restart");
const timeline = getElement<HTMLInputElement>("timeline");
const currentTime = getElement<HTMLElement>("current-time");
const durationLabel = getElement<HTMLElement>("duration");
const title = getElement<HTMLElement>("title");
const artist = getElement<HTMLElement>("artist");
const status = getElement<HTMLElement>("status");
const fileInput = getElement<HTMLInputElement>("beatmap-file");
const beatmapSelect = getElement<HTMLSelectElement>("beatmap-select");

const preview = new StandardBeatmapPreview(canvas, {
    width: 640,
    height: 480,
    devicePixelRatio: Math.min(globalThis.devicePixelRatio ?? 1, 2),
});

let duration = 1;
let position = 0;
let playing = true;
let previousFrame = performance.now();

loadShowcase("renatus");
requestAnimationFrame(frame);

playButton.addEventListener("click", togglePlayback);
restartButton.addEventListener("click", () => {
    position = 0;
    playing = true;
    previousFrame = performance.now();
    syncControls();
});

timeline.addEventListener("input", () => {
    position = Number(timeline.value);
    preview.render(position);
    syncControls();
});

beatmapSelect.addEventListener("change", () => {
    loadShowcase(beatmapSelect.value as ShowcaseBeatmap);
});

fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];

    if (!file) return;

    try {
        loadBeatmap(await file.text(), `Loaded ${file.name}`);
    } catch (error) {
        status.textContent = error instanceof Error ? error.message : "Could not load that beatmap";
        status.dataset.error = "true";
    } finally {
        fileInput.value = "";
    }
});

document.addEventListener("keydown", (event) => {
    if (event.code !== "Space" || event.target instanceof HTMLInputElement) return;

    event.preventDefault();
    togglePlayback();
});

function loadBeatmap(text: string, message: string): void {
    const beatmap = preview.loadBeatmapText(text);
    const hitObjects = beatmap.hitObjects;

    duration = Math.max(1, beatmap.totalLength);
    const previewTime = beatmap.general.previewTime;
    position = Math.min(previewTime >= 0 ? previewTime : hitObjects[0]?.startTime ?? 0, duration);
    playing = true;
    previousFrame = performance.now();
    timeline.max = String(duration);
    title.textContent = beatmap.metadata.title || "Untitled beatmap";
    artist.textContent = [beatmap.metadata.artist, beatmap.metadata.version].filter(Boolean).join(" · ");
    status.textContent = `${message} · ${hitObjects.length} objects`;
    delete status.dataset.error;
    preview.render(position);
    syncControls();
}

function loadShowcase(key: ShowcaseBeatmap): void {
    const beatmap = SHOWCASE_BEATMAPS[key];
    beatmapSelect.value = key;
    loadBeatmap(beatmap.text, `Loaded ${beatmap.label} showcase`);
}

function frame(now: number): void {
    if (playing) {
        position += now - previousFrame;

        if (position >= duration) {
            position = 0;
        }

        preview.render(position);
        syncControls();
    }

    previousFrame = now;
    requestAnimationFrame(frame);
}

function togglePlayback(): void {
    playing = !playing;
    previousFrame = performance.now();
    preview.render(position);
    syncControls();
}

function syncControls(): void {
    timeline.value = String(Math.round(position));
    timeline.style.setProperty("--progress", `${position / duration * 100}%`);
    currentTime.textContent = formatTime(position);
    durationLabel.textContent = formatTime(duration);
    playButton.dataset.playing = String(playing);
    playButton.setAttribute("aria-label", playing ? "Pause preview" : "Play preview");
    playButton.textContent = playing ? "Pause" : "Play";
}

function formatTime(milliseconds: number): string {
    const minutes = Math.floor(milliseconds / 60_000);
    const seconds = Math.floor(milliseconds % 60_000 / 1000);
    const millis = Math.floor(milliseconds % 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
}

function getElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);

    if (!element) throw new Error(`Missing #${id}`);

    return element as T;
}
