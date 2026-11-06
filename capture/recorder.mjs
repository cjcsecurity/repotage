// demoforge capture library: record a real web app at native 2x (2560x1600 for a
// 1280x800 viewport, ~60 fps) with the CDP screencast, and log every cursor move,
// click, drag and DOM box so the edit can draw the cursor and frame the camera.
//
//   import { open } from "demoforge/capture/recorder.mjs";
//   const s = await open({ base: "http://127.0.0.1:3000", out: "capture/clips" });
//   await s.mock("**/api/expensive", { json: {...} }, 1200);  // stage slow or external calls
//   await s.page.goto(s.base + "/");
//   const clip = await s.clip("flow");
//   await s.click(clip, s.page.locator("button#run"), { label: "Run" });
//   await s.measure(clip, "after-run", { table: "#results" });
//   await clip.stop();
//   await s.close();
//
// Then: demoforge capture encode capture/clips/flow  ->  capture/clips/flow.mp4 (30 fps CFR)
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now() / 1000;
const easeIO = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

export async function open({ base, out, width = 1280, height = 800, dsf = 2, colorScheme = "dark", storageState, headless = true } = {}) {
  // A native 2x window. Emulated deviceScaleFactor does NOT raise screencast resolution.
  const browser = await chromium.launch({
    headless,
    args: ["--force-color-profile=srgb", "--hide-scrollbars", `--force-device-scale-factor=${dsf}`, `--window-size=${width},${height}`],
  });
  const context = await browser.newContext({ viewport: null, colorScheme, storageState });
  if (base) await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base }).catch(() => {});
  const page = await context.newPage();
  fs.mkdirSync(out, { recursive: true });
  let cur = { x: width * 0.82, y: height * 0.92 };

  const s = {
    base, browser, context, page, width, height, dsf,
    get cursor() { return { ...cur }; },

    /** Fulfil matching requests locally after `delayMs` (routes added later win). */
    async mock(pattern, response, delayMs = 0) {
      await context.route(pattern, async (route) => { if (delayMs) await sleep(delayMs); await route.fulfill(response); });
    },
    /** Refuse anything matching (register this FIRST so specific mocks override it). */
    async block(pattern, status = 503) {
      await context.route(pattern, (r) => r.fulfill({ status, json: { detail: "blocked during demo capture" } }));
    },

    async clip(name) {
      const dir = path.join(out, name);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      const cdp = await context.newCDPSession(page);
      const frames = [], events = [];
      cdp.on("Page.screencastFrame", (f) => {
        const file = `f${String(frames.length).padStart(5, "0")}.jpg`;
        frames.push({ file, t: f.metadata.timestamp });
        fs.writeFileSync(path.join(dir, file), Buffer.from(f.data, "base64"));
        cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
      });
      await cdp.send("Page.startScreencast", { format: "jpeg", quality: 94, maxWidth: width * dsf, maxHeight: height * dsf, everyNthFrame: 1 });
      const t0 = now();
      await page.mouse.move(cur.x, cur.y);
      return {
        dir, frames, events, t0,
        mark: (type, data = {}) => events.push({ type, t: now(), ...data }),
        async stop() {
          await sleep(150);
          await cdp.send("Page.stopScreencast");
          const tEnd = now();
          fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ t0, tEnd, viewport: { w: width, h: height, dsf }, frames, events }, null, 1));
          await cdp.detach();
          console.log(`clip ${name}: ${frames.length} frames over ${(tEnd - t0).toFixed(1)} s`);
        },
      };
    },

    async moveTo(clip, x, y, ms = 700) {
      const from = { ...cur };
      const steps = Math.max(10, Math.round(ms / 16));
      const start = now();
      for (let i = 1; i <= steps; i++) {
        const e = easeIO(i / steps);
        await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
        await sleep(ms / steps);
      }
      cur = { x, y };
      clip.events.push({ type: "move", t: start, tEnd: now(), from, to: { x, y } });
    },

    async box(locator) {
      await locator.waitFor({ state: "visible" });
      await locator.scrollIntoViewIfNeeded().catch(() => {});
      const b = await locator.boundingBox();
      if (!b) throw new Error("element has no box");
      return b;
    },

    /** Glide to the element, wait until nothing (a toast, an overlay) covers it, then click. */
    async click(clip, locator, { ms = 700, pre = 220, fx = 0.5, fy = 0.5, label = "" } = {}) {
      const b = await s.box(locator);
      const x = b.x + b.width * fx, y = b.y + b.height * fy;
      const h = await locator.elementHandle();
      for (let i = 0; i < 80; i++) {
        const ok = await page.evaluate(([el, x, y]) => { const e = document.elementFromPoint(x, y); return !!e && (el === e || el.contains(e) || e.contains(el)); }, [h, x, y]);
        if (ok) break;
        await sleep(100);
      }
      await s.moveTo(clip, x, y, ms);
      await sleep(pre);
      clip.mark("click", { x, y, label });
      await page.mouse.down();
      await sleep(90);
      await page.mouse.up();
    },

    async hover(clip, locator, ms = 650) {
      const b = await s.box(locator);
      await s.moveTo(clip, b.x + b.width / 2, b.y + b.height / 2, ms);
    },

    async type(clip, text, delay = 75) {
      clip.mark("typeStart", { text });
      await page.keyboard.type(text, { delay });
      clip.mark("typeEnd", { text });
    },

    /** Drag a file in from off-screen right and drop it on `target` (fires real drag events). */
    async dropFile(clip, target, { name, content, type = "text/plain" }) {
      const b = await s.box(target);
      const sel = await target.evaluate((el) => { el.dataset.dfDrop = "1"; return "[data-df-drop='1']"; });
      cur = { x: width + 60, y: b.y + b.height * 0.55 };
      clip.mark("dragStart", { file: name, x: cur.x, y: cur.y });
      const dx = b.x + b.width / 2, dy = b.y + b.height / 2;
      await s.moveTo(clip, dx + 120, dy + 10, 650);
      await page.evaluate((sel) => { const z = document.querySelector(sel); z.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() })); }, sel);
      await s.moveTo(clip, dx, dy, 380);
      await sleep(350);
      clip.mark("drop", { x: dx, y: dy });
      await page.evaluate(([sel, name, content, type]) => {
        const z = document.querySelector(sel);
        const dt = new DataTransfer();
        dt.items.add(new File([content], name, { type }));
        z.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
      }, [sel, name, content, type]);
    },

    /** Record exact viewport boxes for selectors, and for text ranges ([rootSelector, needle]). */
    async measure(clip, name, selectors = {}, texts = {}) {
      const rects = await page.evaluate(([selectors, texts]) => {
        const out = {};
        const r4 = (r) => [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10);
        for (const [k, sel] of Object.entries(selectors)) { const el = document.querySelector(sel); if (el) out[k] = r4(el.getBoundingClientRect()); }
        for (const [k, [sel, needle]] of Object.entries(texts)) {
          const root = document.querySelector(sel); if (!root) continue;
          const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
          while ((n = w.nextNode())) { const i = n.textContent.indexOf(needle); if (i >= 0) { const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + needle.length); out[k] = [...rg.getClientRects()].map(r4); break; } }
        }
        return out;
      }, [selectors, texts]);
      clip.mark("measure", { name, rects });
      return rects;
    },

    sleep,
    async close() { await browser.close(); },
  };
  return s;
}
