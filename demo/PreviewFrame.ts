interface PreviewView { render(playbackTimeMs: number): void; }

/** Both views use the same clock; hidden timelines are refreshed when visible again. */
export function renderPreviewFrame(playfield: PreviewView, timeline: PreviewView, playbackTimeMs: number, fullscreen: boolean): void {
    playfield.render(playbackTimeMs);
    if (!fullscreen) timeline.render(playbackTimeMs);
}
