// Capture flow: drive the real app and record it. Run: repotage capture run <project> capture/flow.mjs
// Stage anything slow, costly or external (AI calls, ticketing, email) with s.mock; block the rest with s.block.
const { open } = await import(process.env.REPOTAGE_HOME + "/capture/recorder.mjs");
// external: "block-writes" (default) refuses POST/PUT/PATCH/DELETE to any other origin; "block" refuses all
// cross-origin requests; "allow" turns the guard off. clipboard: true grants clipboard access to `base`.
const s = await open({ base: "http://127.0.0.1:3000", out: "capture/clips" });
// await s.block(/\/api\/(jira|ai)\//);                                  // register first
// await s.mock("**/api/ai/analyze", { json: { report: "..." } }, 2500); // later routes win
await s.page.goto(s.base + "/", { waitUntil: "networkidle" });
const clip = await s.clip("flow");
clip.mark("scene", { name: "start" });
await s.sleep(1200);
// await s.click(clip, s.page.locator("button#run"), { label: "Run" });
// await s.type(clip, process.env.DEMO_PASSWORD, { secret: true });   // never logged
// await s.measure(clip, "results", { table: "#results" }, { hero: ["#results", "62.60.226.50"] });
await s.sleep(1500);
await clip.stop();
await s.close();
