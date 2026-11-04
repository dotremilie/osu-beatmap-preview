import TimeIntervalIndex from "../../utils/TimeIntervalIndex";
import DrawableFollowPoint from "../../drawables/standard/DrawableFollowPoint";
import type {FollowPointConnection} from "./FollowPoint";

/** Selects visible connections; each follow point owns its animation and drawing. */
export default class FollowPointRenderer {
    private index?: TimeIntervalIndex;
    private readonly visibleIndices: number[] = [];
    private drawables: readonly (readonly DrawableFollowPoint[])[];

    constructor(connections: readonly FollowPointConnection[]) {
        this.index = new TimeIntervalIndex(connections);
        this.drawables = connections.map(connection => connection.points.map(point => new DrawableFollowPoint(point)));
    }

    public draw(ctx: CanvasRenderingContext2D, beatmapTimeMs: number): void {
        if (!this.index) return;
        this.index.query(beatmapTimeMs, beatmapTimeMs, this.visibleIndices);
        for (const index of this.visibleIndices) {
            for (const point of this.drawables[index]) point.draw(ctx, beatmapTimeMs);
        }
    }

    public dispose(): void {
        this.drawables = [];
        this.index = undefined;
        this.visibleIndices.length = 0;
    }
}
