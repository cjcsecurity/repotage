# Repotage

Point it at a repo, get a film. Repotage makes a narrated, scored and captioned demo video of the real product: it films the actual app, designs a narrator from a sentence of text, checks every take, writes the music, cuts it together in HTML and masters it. All the media renders locally on an Apple Silicon Mac with open models.

<!-- A playable embed needs a GitHub-hosted upload: edit this file on github.com, drag docs/repotage-demo.mp4 onto the next line, and keep the https://github.com/user-attachments/assets/... line GitHub inserts. -->


https://github.com/user-attachments/assets/1208ace2-822b-44cf-93be-36c7cea59762



**▶ [Watch the full film with sound (57 s)](docs/repotage-demo.mp4).** It was made by Repotage, from this repo ([`examples/self-demo`](examples/self-demo)). Its voice, music, captions and cuts all came out of the pipeline below, and it shows its own artifacts: the voice prompt, the takes and their scores, the review page, the build and the check.

To re-render the example yourself: `repotage sfx examples/self-demo && repotage build examples/self-demo && repotage render examples/self-demo`. The narration, music and footage are committed, so no models run.

## How it works

| Stage | Tool | What it does |
|---|---|---|
| Story | Claude Code + the `repotage` skill | Reads the target, picks one task and one piece of data to follow, writes `STORYLINES.md`, `SPEC.md` and the narration script |
| Capture | [Playwright](https://github.com/microsoft/playwright) via `capture/recorder.mjs` | Films the real web app at native 2x (2560×1600, ~60 fps); logs every cursor move, click, drag and DOM box; stages slow or outward-facing calls with route mocks |
| Terminal | [VHS](https://github.com/charmbracelet/vhs) | Scripted, real terminal recordings |
| Voice | [VoxCPM2](https://github.com/OpenBMB/VoxCPM) on [mlx-audio](https://github.com/Neywa-Labs/mlx-audio) | Designs a narrator from a text prompt, then reads every line as a continuation of the line before it, so the narration flows like one read. Lines get a light broadcast polish (rumble cut, de-essing, gentle compression). A line can carry a spoken spelling (`"say": "Repo-tahzh"`) separate from its text |
| Checking + timing | [WhisperX](https://github.com/m-bain/whisperX) + pitch analysis | Scores every take: words (character error), a cut-off ending, pitch against the reference voice, pace, and intonation (statements that end rising, pitch glitches, flat or erratic range, hesitations where the script has no punctuation). Picks the best take per line, steering toward the voice's typical pitch so it stays one person, trims to where speech really ends, and times every word |
| Music | [ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5) | Generates the score; repotage places it so the lift lands on the reveal and ducks it under every line |
| Edit | [HyperFrames](https://github.com/heygen-com/hyperframes) + [GSAP](https://github.com/greensock/GSAP) via `compose/kit.mjs` | Product-window scenes with camera moves framed on real DOM boxes, a replay of the real cursor, highlights, captions from word timings, sound on every click |
| Review | `repotage report`, `hyperframes check` and snapshots | A listen-through page for takes and timing, a lint of the film, and stills of every scene and cut |
| Master | ffmpeg | Two-pass loudness normalization to -14 LUFS / -1 dBTP |

## Requirements

- Apple Silicon Mac (voice and music run on MLX), macOS 14 or later
- About 12 GB of disk for models and environments
- Homebrew, Node.js 22+, and [Claude Code](https://claude.com/claude-code) for the automated story and edit

## Install

```bash
git clone https://github.com/cjcsecurity/repotage.git
cd repotage
./setup.sh              # ffmpeg, VHS, pinned Python envs, VoxCPM2, WhisperX, ACE-Step, Playwright, HyperFrames, Claude Code skill
bin/repotage doctor    # every row should say ok
```

`setup.sh` installs exact, tested versions (see the pins at the top of the script and `package-lock.json`) and links the skill into `~/.claude/skills/repotage`. Add `bin/` to your `PATH` if you like.

## Make a film

With Claude Code, in any repo:

> Make a 60-second demo video of this repo with repotage.

The skill runs the loop: story, capture, voice, music, compose, review, render. Or drive it by hand:

```bash
repotage new films/my-app --target ../my-app   # demo.json, script.json, HyperFrames project
# write script.json, capture/flow.mjs, video/build/build.mjs (see examples/self-demo)
repotage voice audition films/my-app 4         # design 4 candidate narrators, scored
repotage voice use films/my-app 2              # keep audition 2 as the voice
repotage voice lines films/my-app              # read every line in that voice
repotage voice score films/my-app              # WhisperX checks every take
repotage voice takes films/my-app 2 s03        # re-roll anything that came out wrong
repotage voice chain films/my-app 3             # optional polish pass: 3 takes per line, each continuing the line before
repotage voice finalize films/my-app           # best take per line + word timings
repotage music gen films/my-app                # ACE-Step takes
repotage capture run films/my-app capture/flow.mjs && repotage capture encode films/my-app/capture/clips/flow
repotage build films/my-app && repotage music bed films/my-app && repotage build films/my-app
repotage report films/my-app                   # open films/my-app/report.html and listen
repotage check films/my-app
repotage render films/my-app                   # -> films/my-app/video/renders/my-app.mp4
```

## Capturing safely

A demo capture drives a real app, so treat it like a test run against production code:

- By default the recorder refuses state-changing requests (anything but GET, HEAD or OPTIONS) to other sites. Pass `external: "block"` to refuse all cross-origin traffic, or `external: "allow"` to turn the guard off.
- Run an isolated instance (throwaway database, demo user, only the credentials the shot needs).
- `s.block(/\/api\/(tickets|email|ai)\//)` first, then `s.mock(...)` the calls you want to stage. Later routes win.
- Typed text is recorded in `meta.json`: use `s.type(clip, value, { secret: true })` for anything sensitive.
- Say what is staged in the film's delivery note, and blur or trim internal hostnames, index names or customer data before sharing outside your team.

## Layout

```
bin/          repotage CLI, doctor
capture/      recorder.mjs (Playwright 2x capture library), encode.py (30 fps CFR)
compose/      kit.mjs (HyperFrames scene kit: product windows, cursor, camera, captions, audio map)
pipeline/     voice.py, score.py, score_project.py, finalize.py, music.py, master.sh
report/       report.mjs (review page)
skills/       repotage/SKILL.md (Claude Code skill)
templates/    files for `repotage new`
examples/     self-demo: the film above, from script to render
docs/         toolchain.md: the open-source landscape this was picked from
```

## Security and privacy

Everything renders locally. The network is used only to install pinned dependencies, download model weights at pinned versions, fetch fonts and GSAP during a render, and for HyperFrames' optional telemetry (`npx hyperframes telemetry disable`). See [SECURITY.md](SECURITY.md) for details and how to report a vulnerability.

## Licences

Repotage is MIT. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the projects it installs and calls. It calls, and does not include: HyperFrames (Apache-2.0), GSAP (standard no-charge licence), Playwright (Apache-2.0), VHS (MIT), mlx-audio (MIT), VoxCPM2 (Apache-2.0), WhisperX (BSD-2-Clause), ACE-Step 1.5 (MIT), ffmpeg (LGPL/GPL). Sound effects come from the HyperFrames skill library (Pixabay licence) and are copied into each project, not redistributed here. Remotion is deliberately not used: it needs a paid company licence above three employees.
