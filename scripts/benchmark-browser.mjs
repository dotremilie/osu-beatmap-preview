import {spawn} from "node:child_process";
import {mkdtemp, readFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve, sep} from "node:path";

const server = process.argv[2] ?? "http://127.0.0.1:5173";
const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profile = await mkdtemp(join(tmpdir(), "osu-preview-benchmark-"));
const browser = spawn(chrome, ["--headless=new", "--no-first-run", "--no-default-browser-check",
    "--disable-extensions", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"],
{windowsHide: true, stdio: "ignore"});

const sleep = (milliseconds) => new Promise(done => setTimeout(done, milliseconds));

async function connect() {
    let port;
    for (let attempt = 0; attempt < 100; attempt++) {
        try {
            port = Number((await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]);
            if (port) break;
        } catch { /* Chrome is still starting. */ }
        await sleep(100);
    }
    if (!port) throw new Error("Chrome did not start its debugging endpoint");
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = targets.find(target => target.type === "page");
    if (!page) throw new Error("Chrome opened no page target");
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((done, fail) => {
        socket.addEventListener("open", done, {once: true});
        socket.addEventListener("error", fail, {once: true});
    });
    let nextId = 0;
    const pending = new Map();
    socket.addEventListener("message", event => {
        const message = JSON.parse(event.data);
        if (!message.id) return;
        const request = pending.get(message.id);
        if (!request) return;
        pending.delete(message.id);
        if (message.error) request.reject(new Error(message.error.message));
        else request.resolve(message.result);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++nextId;
        pending.set(id, {resolve, reject});
        socket.send(JSON.stringify({id, method, params}));
    });
    await send("Page.enable");
    await send("Runtime.enable");
    return {socket, send};
}

try {
    const {socket, send} = await connect();
    const cases = [
        ["renatus", 800, 600], ["renatus", 2560, 1440],
        ["aspire", 800, 600], ["aspire", 2560, 1440],
        ["neto", 800, 600], ["neto", 2560, 1440],
    ];
    for (const [map, width, height] of cases) {
        const url = new URL("/benchmark.html", server);
        url.searchParams.set("map", map);
        url.searchParams.set("width", String(width));
        url.searchParams.set("height", String(height));
        if (process.argv.includes("--full")) url.searchParams.set("full", "1");
        await send("Page.navigate", {url: url.href});
        let result;
        for (let attempt = 0; attempt < 1200; attempt++) {
            const response = await send("Runtime.evaluate", {
                expression: "document.querySelector('#results')?.textContent",
                returnByValue: true,
            });
            const value = response.result?.value;
            if (value && value !== "Running…") {
                result = JSON.parse(value);
                break;
            }
            await sleep(100);
        }
        if (!result) throw new Error(`Timed out on ${map} ${width}x${height}`);
        if (result.error) throw new Error(result.error);
        console.log(JSON.stringify(result));
    }
    socket.close();
} finally {
    browser.kill();
    const tempRoot = resolve(tmpdir()) + sep;
    const target = resolve(profile);
    if (!target.startsWith(tempRoot)) throw new Error("Refusing to remove a profile outside the temporary directory");
    for (let attempt = 0; attempt < 10; attempt++) {
        try { await rm(target, {recursive: true, force: true}); break; }
        catch { await sleep(100); }
    }
}
