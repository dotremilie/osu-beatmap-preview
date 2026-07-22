import {defineConfig} from "vite";

export default defineConfig({
    root: "demo",
    base: "./",
    build: {
        outDir: "../demo-dist",
        emptyOutDir: true,
    },
});
