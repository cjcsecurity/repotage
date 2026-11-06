# Toolchain research: open-source projects for automated demo films

Searched 2026-11-05. Criteria: 500+ stars, pushed in the last ~6 months. Hardware: M2 Pro, 32 GB, no CUDA.
Stars and last-push dates come from the GitHub API on that date.

## Recommended stack

```
repo/dir ──► understand ──► capture real footage ──► script + storyboard ──► voice ──► word timings
             (repomix)      (Playwright / VHS)       (Claude)                (VoxCPM2   (WhisperX)
                                                                              via mlx-audio)
                                     ──► compose + animate ──► music/SFX ──► final mux
                                         (HyperFrames + GSAP)  (ACE-Step)    (ffmpeg)
```

Why HyperFrames over Remotion: Remotion needs a paid **company license** for for-profit organizations with more than 3 employees. HyperFrames is Apache-2.0, built for coding agents, and ships a Claude Code plugin.

## 1. Closest to the goal: "point at a project, get a video" (agent skills)

| Repo | ★ | Last push | License | Notes |
|---|---|---|---|---|
| latent-spaces/brag | 20.4k | 2026-10-23 | MIT | `/brag` turns the project you just built into a ~20s launch video with music and share copy. Built on HyperFrames; `/brag-slim` is tuned for Opus 5.5. **Start here.** |
| Vincentwei1021/video-shotcraft | 17.2k | 2026-10-29 | Apache-2.0 | Product promos from *your real pages*: captures screenshots, picks from 150 tuned shot recipes, storyboards, cuts to the beat, adds SFX, checks every frame. Remotion-based (license caveat). Best reference for shot design. |
| Vincentwei1021/video-talkcraft | 2.1k | 2026-10-12 | custom | Sibling of shotcraft for narration-driven videos: word-level voice sync, 108 motion cards. README mostly Chinese. |
| vincentsch/explainroo | 0.8k | 2026-10-20 | MIT | Explainer videos and product demos with a local Kokoro voice, word timing and a camera that follows the narration. Small but clean design. |
| feitangyuan/onetake | 3.8k | 2026-11-05 | non-commercial | "One continuous take" launch films with a continuity checker. Great look, but business use needs the $79 Pro license. |
| calesthio/OpenMontage | 77k | 2026-11-03 | AGPL-3.0 | Full agentic production studio (12 pipelines, 100+ tools). Heavy, and leans on paid gen-video APIs (Veo, Kling). Mine it for ideas. |
| openfilm/openfilm | 4.9k | 2026-11-04 | MIT | Agent writes the film as `film.html`; a local Studio editor lets you tweak any element by hand afterward. New (Oct 2026). |
| ahmedkhaleel2004/gitdiagram | 18.8k | 2026-11-04 | MIT | Repo → architecture diagram + 1-min narrated explainer. Has an MCP server and a Claude Code plugin. Video generation is early access. |
| zhuyansen/awesome-claude-video-skills | 1.6k | 2026-11-05 | — | Curated list of ~180 video skills for coding agents. |

## 2. Video-as-code engines (composition + animation)

| Repo | ★ | Last push | License | Notes |
|---|---|---|---|---|
| heygen-com/hyperframes | 79.4k | 2026-11-05 | Apache-2.0 | HTML/CSS + seekable animations → deterministic MP4. CLI, desktop studio, 9 agent skills, Claude Code plugin. **Primary pick.** |
| remotion-dev/remotion | 71k | 2026-11-05 | Remotion (company license) | Most mature React video framework. Paid for companies over 3 employees. |
| motion-canvas/motion-canvas | 19.7k | 2026-07-02 | MIT | TypeScript, generator-based; strong for technical/diagram animation. |
| midrender/revideo | 4.2k | 2026-07-15 | MIT | Motion Canvas fork aimed at headless rendering via API. |
| nexu-io/html-video | 4.8k | 2026-06-21 | Apache-2.0 | HTML → MP4 for agents, with 21 polished templates (NYT-style charts, title cards, logo outros). |
| ManimCommunity/manim | 42.3k | 2026-11-05 | MIT | Best for algorithm/math/architecture explainers. |
| greensock/GSAP + gsap-skills | 30.2k / 17.9k | 2026-11-04 | free (GSAP std) / MIT | Animation engine HyperFrames pairs with; official agent skills teach correct usage. |
| motiondivision/motion | 34.9k | 2026-11-05 | MIT | React/JS animation, if building in React. |
| LottieFiles/motion-design-skill | 2.8k | 2026-05-18 | MIT | Timing, easing and choreography principles for agents. |
| Tejashmakwana/motionmaxxing | 1.4k | 2026-10-06 | Apache-2.0 | Skill aimed at making agent-made motion look less "AI slop". |

## 3. Capturing real product footage

| Repo | ★ | Last push | License | Notes |
|---|---|---|---|---|
| microsoft/playwright | 99.4k | 2026-11-05 | Apache-2.0 | Scripted, repeatable web-app walkthroughs, screenshots and video. The backbone. |
| vercel-labs/agent-browser | 45.8k | 2026-11-05 | Apache-2.0 | Browser automation CLI built for agents. Lets Claude explore an app to find demo-worthy flows. |
| charmbracelet/vhs | 21.3k | 2026-11-02 | MIT | Scripted terminal recordings (`.tape` files) for CLI demos. |
| charmbracelet/freeze | 4.9k | 2026-09-16 | MIT | Beautiful code/terminal screenshots. |
| simonw/shot-scraper | 2.6k | 2026-10-14 | Apache-2.0 | CLI screenshots and video demos of websites. |
| getopenscreen/openscreen | 6.3k | 2026-11-04 | MIT | Screen Studio-style auto-zoom, cursor smoothing, backgrounds, for human-recorded takes. (Original siddharthvaddem/openscreen, 40k★, is archived.) |

## 4. Voice (the open-source ElevenLabs alternatives)

| Repo | ★ | Last push | License | Notes |
|---|---|---|---|---|
| OpenBMB/VoxCPM (VoxCPM2) | 41.1k | 2026-11-05 | Apache-2.0 | 2B, 48 kHz, 30 languages, voice design from a text description + cloning. Clean commercial license. **Primary pick for quality.** |
| Neywa-Labs/mlx-audio | 8.2k | 2026-11-05 | MIT | Runs TTS natively on Apple Silicon: Kokoro, Qwen3-TTS, OmniVoice, Higgs v3, Chatterbox, Dia and more. **The runtime for this Mac.** |
| remsky/Kokoro-FastAPI | 5.6k | 2026-11-04 | Apache-2.0 | Kokoro-82M behind an OpenAI-compatible API. Very fast; good for drafts, a bit less expressive. |
| QwenLM/Qwen3-TTS | 14.2k | 2026-03-17 | Apache-2.0 | Voice design and cloning; MLX port available. |
| debpalash/VoiceStudio | 101.7k | 2026-11-05 | AGPL-3.0 | Self-described "fully-local ElevenLabs alternative": a desktop app for cloning, voice design and dubbing. Likely the one you were thinking of. Good for auditioning voices. |
| jamiepine/voicebox | 59.5k | 2026-10-07 | MIT | Open-source voice studio app (Qwen3-TTS based, MLX support). |
| index-tts/index-tts (IndexTTS2) | 25k | 2026-09-29 | custom | Can hit a target duration, useful for fitting narration to a fixed animation. Check the license before work use. |
| fishaudio/fish-speech | 33.6k | 2026-11-02 | research/community | Top-tier quality, but the weights license is restrictive for business use. |
| k2-fsa/OmniVoice | 16.3k | 2026-11-02 | Apache-2.0 | 600+ languages, zero-shot cloning. |

Skip: resemble-ai/chatterbox (retired Aug 2026), microsoft/VibeVoice (now focused on speech recognition).

## 5. Timing, captions, music, assembly

| Repo | ★ | Last push | License | Notes |
|---|---|---|---|---|
| m-bain/whisperX | 25.1k | 2026-10-22 | BSD-2 | Word-level timestamps, so animation beats land on spoken words. |
| SYSTRAN/faster-whisper | 26.5k | 2026-11-02 | MIT | Fast transcription backend. |
| veedstudio/open-edit | 1.8k | 2026-11-05 | Apache-2.0 | Agent-driven subtitles, motion graphics and render (VEED). WhisperX runs locally. |
| ace-step/ACE-Step-1.5 | 14.4k | 2026-10-11 | MIT | Local music generation for background tracks. |
| multimodal-art-projection/YuE | 13.1k | 2026-11-01 | Apache-2.0 | Music generation alternative. |
| kajisho5/ffmpeg-skill | 4.6k | 2026-11-05 | MIT | 42 ffmpeg tools for agents, with an MCP server. |
| WyattBlue/auto-editor | 5.8k | 2026-11-05 | Unlicense | Auto-cuts silence and dead air from recordings. |

## 6. Understanding the target repo

| Repo | ★ | Last push | License | Notes |
|---|---|---|---|---|
| yamadashy/repomix | 29.2k | 2026-11-05 | MIT | Packs a repo into one LLM-friendly file. |
| The-Pocket/PocketFlow-Tutorial-Codebase-Knowledge | 12.7k | 2026-05-31 | MIT | Codebase → tutorial; useful for finding the story to tell. |
| AsyncFuncAI/deepwiki-open | 18.4k | 2026-11-04 | MIT | Self-hosted DeepWiki-style docs for any repo. |

## Caveats

- Several repos are only months old with very fast star growth (VoiceStudio, OpenMontage, HyperFrames, brag). Fork ratios look organic, but kick the tires before committing.
- Avoid in a company pipeline: Remotion (paid company license), onetake (non-commercial), Fish Speech (restrictive weights). AGPL tools (VoiceStudio, OpenMontage) are fine to *run* locally; don't ship their code inside a product.
