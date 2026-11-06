# Third-party notices

Repotage is MIT-licensed. It installs or calls the following projects. None of their source is vendored here; their licences apply to your use of them.

| Project | Used for | Licence |
|---|---|---|
| [HyperFrames](https://github.com/heygen-com/hyperframes) | Composition and rendering | Apache-2.0 |
| [GSAP](https://github.com/greensock/GSAP) | Animation (loaded from jsDelivr at render time) | GSAP Standard "No Charge" License |
| [Playwright](https://github.com/microsoft/playwright) | Product capture | Apache-2.0 |
| [VHS](https://github.com/charmbracelet/vhs) | Terminal capture | MIT |
| [mlx-audio](https://github.com/Neywa-Labs/mlx-audio) | Voice runtime on Apple Silicon | MIT |
| [VoxCPM2](https://github.com/OpenBMB/VoxCPM) | Voice model | Apache-2.0 |
| [WhisperX](https://github.com/m-bain/whisperX) | Transcription and word timing | BSD-2-Clause |
| [ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5) | Music | MIT |
| [librosa](https://github.com/librosa/librosa), [pyloudnorm](https://github.com/csteinmetz1/pyloudnorm), [SciPy](https://scipy.org), [NumPy](https://numpy.org) | Audio analysis | ISC, MIT, BSD-3-Clause, BSD-3-Clause |
| [FFmpeg](https://ffmpeg.org) | Encoding and mastering | LGPL-2.1+ / GPL-2.0+ depending on build |

Sound effects are copied into each project from the HyperFrames skill library (Pixabay Content License) by `repotage new` and `repotage sfx`; they are not redistributed in this repository.

The example film in `examples/self-demo` contains narration generated with VoxCPM2 and music generated with ACE-Step 1.5, and footage of Repotage's own review page and terminal.
