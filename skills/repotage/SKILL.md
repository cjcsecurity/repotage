---
name: repotage
description: Make a narrated, scored, captioned demo film of a repo or app, end to end, with local models on Apple Silicon. Use when someone asks for a demo video, product walkthrough, launch film or explainer for a codebase, a web app or a CLI ("make a demo of this repo", "film the dashboard", "a 60-second video of this tool"). Covers story, real product capture (Playwright, VHS), narration (VoxCPM2 on mlx-audio), take scoring and word timing (WhisperX), music (ACE-Step 1.5), composition (HyperFrames + GSAP) and mastering (ffmpeg).
---

# repotage

Turn a repo into a 45–90 s film that shows the real product doing one real task. The CLI is `$REPOTAGE_HOME/bin/repotage` (run `repotage doctor` first; `./setup.sh` installs everything). Read the HyperFrames skill (`/hyperframes`) before writing compositions: its contract applies to every scene.

## The loop

1. **Understand the target.** Read the README, the entry points and the UI or CLI surface. For a big repo, `npx repomix` packs it. Find the one task a user does, start to finish, and one real piece of data that travels through it (an IP, a file, a query). Note what must stay private (tokens, internal hostnames, customer data, internal index names).
2. **Story.** `repotage new <dir> --target <repo>`. Write `STORYLINES.md` (three storylines, pick one; `/hyperframes` references/story.md) and `SPEC.md` (numbers, not adjectives; references/spec.md). The voice is the clock: about 2.3 words a second, one scene per narration line, about 19 words a line, 120–160 words a film.
3. **Script.** `script.json`: `voice` (a one-sentence voice-design prompt), `style` (delivery), `audition` (a sentence with the film's hardest words), `lines` [{id, text}]. Spell sounds, not letters: "O T X", "Mac O S", "Vox C P M", "Gee Sap". For a brand name, keep `text` as written and add `say` with the spoken spelling ("Repo-tahzh"); check it with a few spellings first. Never put a claim on screen or in the voice that the source does not support; mark staged data as staged in the delivery note.
4. **Capture the real product.** Web apps: write `capture/flow.mjs` with `capture/recorder.mjs`. It films at native 2x (2560x1600, ~60 fps) and logs every move, click, drag and DOM box (`s.measure`). Run the app as an isolated instance (throwaway database, demo user, only the credentials the shot needs). Intercept anything slow, paid or outward-facing with `s.block` (register first) and `s.mock` (later routes win). Never let a capture create real tickets, send mail or call paid APIs. Then `repotage capture encode capture/clips/<name>`. CLIs: a VHS tape (`terminal/*.tape`), real commands only; a shell function may trim noise from output but must not invent it.
5. **Voice.** `repotage voice audition <dir> 4` designs four candidate narrators and scores them. Keep the one with a complete transcript and a calm pace (`repotage voice use <dir> <k>`). `repotage voice lines <dir>`, then `repotage voice score <dir>`. Re-roll any line flagged in the score output (character errors, `tail` above -45 dB = cut off, `uptalk`, `glitchy`, `flat`, `erratic`, `pause`) or with a pitch far from the reference (`repotage voice takes <dir> 2 s03 s06`), score again, then `repotage voice finalize <dir>` (best take per line, trimmed, -16 LUFS, word timings in `audio/vo_words.json`). Override a pick with `"pick": {"s03": "s03_t1"}`.
6. **Music.** Set `demo.json` `music.caption/bpm/key`, then `repotage music gen <dir>`. Pick the take whose lift lands where the product is revealed (`npx hyperframes audio take0.wav --only sections,loudness --json`), set `music.use`, `music.align` [film_s, file_s] and `music.quiet_until`.
7. **Compose.** Write `video/build/build.mjs` with `compose/kit.mjs`: `K.plan()` the scene slots from the narration durations, then build each scene. `K.productScene` puts real footage in a window, camera framed on exact DOM boxes (`K.frame(K.box(src, measure, key))`) and replays the real cursor. `K.footageScene` does full-frame footage (VHS). `K.scene` takes any hand-built scene. `K.at(line, word, scene)` gives the frame where a word is spoken: land every reveal on its word. Finish with `K.captions()` and `K.write()`. Then `repotage build`, `repotage music bed` (ducks under the voice), and `repotage build` again.
8. **Review.** `repotage report <dir>` (listen-through page: takes, scores, word timing, music, timeline). `repotage check <dir>` must pass. Snapshot every scene and seam (`npx hyperframes snapshot --review` in `video/`) and look at them. Fix: frames with stray pixels at a scene's first frame (hide initial states in CSS, not `tl.set` at 0), camera moves that arrive before the UI does, window edges at full zoom, text under 28 px, cursor jumps. Re-check after every fix.
9. **Render.** `repotage render <dir>` (check, delivery render, master to -14 LUFS / -1 dBTP). Write `REVIEW.md`. Say what was measured and what was only listened to by a model.

## Defaults that make it look made, not generated

- Show the real product: real UI, real labels, real data where it is safe. Rebuild a component large only to land the payoff, keeping its real values.
- One carrier the eye follows through the film (the data from step 1).
- Camera moves 0.5–0.6 s `power2.inOut`, then hold while the UI acts. One move per beat.
- The accent colour only on the carrier, highlight boxes, the payoff and the end card.
- Sound on real clicks, a riser into the single payoff, music low until the reveal, ducked under every line.
- Captions on: muted autoplay (Slack) is the common case.

## Delivery note

Report: the film path, length, what is real and what is staged, anything internal visible on screen, what was checked (check, snapshots, loudness) and what nobody has listened to yet.
