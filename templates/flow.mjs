// Capture flow: drive the real app and record it. Run: demoforge capture run <project> capture/flow.mjs
// Stage anything slow, costly or external (AI calls, ticketing, email) with s.mock; block the rest with s.block.
const { open } = await import(process.env.DEMOFORGE_HOME + "/capture/recorder.mjs");
const s = await open({ base: "http://127.0.0.1:3000", out: "capture/clips" });
// await s.block(/\/api\/(jira|ai)\//);                                  // register first
// await s.mock("**/api/ai/analyze", { json: { report: "..." } }, 2500); // later routes win
await s.page.goto(s.base + "/", { waitUntil: "networkidle" });
const clip = await s.clip("flow");
clip.mark("scene", { name: "start" });
await s.sleep(1200);
// await s.click(clip, s.page.locator("button#run"), { label: "Run" });
// await s.measure(clip, "results", { table: "#results" }, { hero: ["#results", "62.60.226.50"] });
await s.sleep(1500);
await clip.stop();
await s.close();
