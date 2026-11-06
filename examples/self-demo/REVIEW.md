# Review: demoforge-self-demo.mp4

58.1 s, 1920x1080, 30 fps. Made with demoforge from this repo; every artifact on screen is this film's own.

Checked: `hyperframes check` (0 errors, 0 warnings), `snapshot --review` (every scene and cut), loudness -13.9 LUFS / -0.9 dBTP, no clipping.

Narration: VoxCPM2, voice designed from the prompt in script.json (audition 2 kept). 19 takes scored with WhisperX; lines 4, 5, 6 and 8 were re-rolled for pitch drift, and line 6 has four extra takes because "Ace Step" kept coming out as "A step".

Staged: nothing. The review page, the terminal runs (`build`, `check`, `doctor`) and the timeline are real. The terminal wrapper in `terminal/setup.zsh` drops font-cache INFO lines and local report paths from `check` output.

Not verified by ear: voice character across lines, music mix. Measured only.
