# Security

## Reporting a vulnerability

Please report security issues privately through GitHub's **Report a vulnerability** button on the Security tab of this repository, not in a public issue. Include steps to reproduce and the version or commit you tested. Expect an acknowledgement within a week.

## What Repotage does on your machine

- **Runs locally.** Voice, scoring, music and rendering run on your Mac. Nothing you record is uploaded by Repotage.
- **Network access** is limited to: installing pinned dependencies (Homebrew, npm with `package-lock.json`, pip with exact versions, a pinned ACE-Step commit), downloading model weights from Hugging Face (VoxCPM2 at a pinned revision; WhisperX and ACE-Step weights through their own pinned library versions), fonts that HyperFrames fetches from Google Fonts during a render, and GSAP from jsDelivr with a subresource-integrity hash. HyperFrames has usage telemetry, which you can turn off with `npx hyperframes telemetry disable`.
- **Captures drive a real app.** `capture/recorder.mjs` refuses state-changing requests (anything but GET, HEAD or OPTIONS) to any origin other than the app under test, unless you pass `external: "allow"`. Same-origin requests reach your app: run an isolated instance with a throwaway database and a demo account, and stage slow, paid or outward-facing endpoints with `s.mock()` and `s.block()`.
- **Recorded data is committed with a project** (`capture/clips/*/meta.json`: cursor moves, clicks, element boxes, typed text). Type secrets with `s.type(clip, value, { secret: true })` so they are logged as dots, and review what is on screen before you publish a film.
- **Generated HTML** (compositions and `report.html`) escapes script and caption text, and `report.html` ships a Content Security Policy that blocks remote loads.
