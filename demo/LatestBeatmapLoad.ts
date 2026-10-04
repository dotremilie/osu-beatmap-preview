/** A single request sequence shared by showcase imports and local file reads. */
export default class LatestBeatmapLoad {
    private sequence = 0;
    private disposed = false;

    public async run(read: () => Promise<string>, apply: (text: string) => void, failed: (error: unknown) => void): Promise<void> {
        if (this.disposed) return;
        const sequence = ++this.sequence;
        try {
            const text = await read();
            if (!this.disposed && sequence === this.sequence) apply(text);
        } catch (error) {
            if (!this.disposed && sequence === this.sequence) failed(error);
        }
    }

    public dispose(): void { this.disposed = true; this.sequence++; }
}
