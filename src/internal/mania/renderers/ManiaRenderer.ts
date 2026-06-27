import {Color4} from "osu-classes";
import {Hold, ManiaBeatmap, ManiaHitObject, Note} from "osu-mania-stable";
import {DrawableManiaHitObject} from "../drawables/mania/DrawableManiaHitObject";
import {DrawableNote} from "../drawables/mania/DrawableNote";
import {DrawableHoldNote} from "../drawables/mania/DrawableHoldNote";
import Renderer from "../../../renderers/Renderer";

export const LEFT_MARGIN = 32;
export const SCROLL_FACTOR = 1;
export const NOTE_HEIGHT = 32;
export const COLUMN_WIDTH = 64;
export const DEFAULT_COLORS = [
    new Color4(255, 255, 255),
    new Color4(240, 160, 240),
    new Color4(255, 200, 40),
];

export default class ManiaRenderer extends Renderer<ManiaBeatmap, DrawableManiaHitObject<ManiaHitObject>>{
    protected initializeDrawableHitObjects(): void {
        this.beatmap.hitObjects.forEach((object) => {
            const color = DEFAULT_COLORS[
                object.column % 2 === 0 ? 0 :
                    object.column === Math.floor(this.beatmap.totalColumns / 2) ? 2 : 1
                ];

            if (object instanceof Hold) {
                this.drawableHitObjects.push(new DrawableHoldNote(object, color));
            } else if (object instanceof Note) {
                this.drawableHitObjects.push(new DrawableNote(object, color));
            }
        })
    }

    public render(time: number) {
        let hitObjects = this.drawableHitObjects.filter(object => {
            return time >= object.hitObject.startTime - (NOTE_HEIGHT / SCROLL_FACTOR);
        }).reverse();

        this.drawColumns();

        hitObjects.forEach((object) => {
            object.draw(this.ctx, time);
        });
    }

    private drawColumns() {
        const {totalColumns} = this.beatmap;

        this.ctx.fillStyle = 'rgba(255, 255, 255, 1)';

        for (let i = 0; i < totalColumns + 1; i++) {
            this.ctx.beginPath();
            this.ctx.rect(i * COLUMN_WIDTH + LEFT_MARGIN, 0, 1, this.ctx.canvas.height);
            this.ctx.fill();
            this.ctx.stroke();
        }
    }
}
