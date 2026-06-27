import {defineConfig} from "vite";

export default defineConfig({
    build: {
        lib: {
            entry: "src/index.ts",
            formats: ["es"],
            fileName: "index",
        },
        rollupOptions: {
            external: [
                "osu-classes",
                "osu-parsers",
                "osu-standard-stable",
            ],
        },
        sourcemap: true,
    },
});
