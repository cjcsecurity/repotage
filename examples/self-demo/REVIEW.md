# Review: repotage-self-demo.mp4

57.1 s, 1920x1080, 30 fps. Made with repotage from this repo; every artifact on screen is this film's own.

Checked: `hyperframes check` (0 errors, 0 warnings), `snapshot --review` (every scene and cut), loudness -14.0 LUFS / -1.0 dBTP, no clipping.

Narration: VoxCPM2, voice designed from the prompt in script.json (audition 2 kept), every line read as a continuation of that audition. Second pass after review: the first cut clipped the end of seven lines (alignment ended words early; trimming now follows loudness) and two lines had a rising ending. All takes were rescored for intonation, and each line now uses a take with no flags except line 6 (CER 0.045, "Ace Step" heard as "ASTEP"). The finished film was transcribed back and every line ends complete.

Staged: nothing. The review page, the terminal runs (`build`, `check`, `doctor`) and the timeline are real. The terminal wrapper in `terminal/setup.zsh` drops font-cache INFO lines and local report paths from `check` output.

Not verified by ear: voice character across lines, music mix. Measured only.
