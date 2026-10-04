import TimeIntervalIndex from "../../utils/TimeIntervalIndex";
import DrawableFollowPoint from "../appearance/DrawableFollowPoint";
import {evaluateFollowPoint, FollowPointConnection, FollowPointState} from "./FollowPoint";

/** Selects visible connections and owns per-renderer animation scratch state. */
export default class FollowPointRenderer {
    private index?: TimeIntervalIndex;
    private readonly visibleIndices: number[] = [];
    private readonly painter = new DrawableFollowPoint();
    private readonly state: FollowPointState = {x: 0, y: 0, rotationRadians: 0, scale: 1, opacity: 0};

    constructor(private connections: readonly FollowPointConnection[]) {
        this.index = new TimeIntervalIndex(connections);
    }

    public draw(ctx: CanvasRenderingContext2D, beatmapTimeMs: number): void {
        if (!this.index) return;
        this.index.query(beatmapTimeMs, beatmapTimeMs, this.visibleIndices);
        for (const index of this.visibleIndices) {
            for (const point of this.connections[index].points) {
                if (evaluateFollowPoint(point, beatmapTimeMs, this.state)) this.painter.draw(ctx, this.state);
            }
        }
    }

    public dispose(): void {
        this.connections = [];
        this.index = undefined;
        this.visibleIndices.length = 0;
        this.painter.dispose();
    }
}
