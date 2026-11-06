#!/usr/bin/env bash
# One-time setup on an Apple Silicon Mac. About 12 GB of models and environments.
#   ./setup.sh            everything
#   ./setup.sh --skill    only link the Claude Code skill into ~/.claude/skills
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(pwd)"

link_skill() {
  mkdir -p "$HOME/.claude/skills"
  ln -sfn "$ROOT/skills/repotage" "$HOME/.claude/skills/repotage"
  echo "skill linked: ~/.claude/skills/repotage -> $ROOT/skills/repotage"
}
if [[ "${1:-}" == "--skill" ]]; then link_skill; exit 0; fi

[[ "$(uname -sm)" == "Darwin arm64" ]] || { echo "repotage needs an Apple Silicon Mac (MLX)." >&2; exit 1; }
command -v brew >/dev/null || { echo "Install Homebrew first: https://brew.sh" >&2; exit 1; }

echo "== system tools"
for f in ffmpeg vhs uv node; do command -v "$f" >/dev/null || HOMEBREW_NO_AUTO_UPDATE=1 brew install "$f"; done

echo "== Playwright"
npm install --no-audit --no-fund
npx playwright install chromium

echo "== voice: VoxCPM2 on mlx-audio"
[[ -x .venvs/voice/bin/python ]] || uv venv --python 3.12 .venvs/voice
VIRTUAL_ENV="$ROOT/.venvs/voice" uv pip install -U mlx-audio "huggingface_hub[cli]" soundfile numpy
.venvs/voice/bin/hf download mlx-community/VoxCPM2-bf16

echo "== timing + scoring: WhisperX"
[[ -x .venvs/align/bin/python ]] || uv venv --python 3.12 .venvs/align
VIRTUAL_ENV="$ROOT/.venvs/align" uv pip install -U whisperx librosa pyloudnorm scipy soundfile

echo "== music: ACE-Step 1.5"
mkdir -p .vendor
[[ -d .vendor/ACE-Step-1.5 ]] || git clone --depth 1 https://github.com/ace-step/ACE-Step-1.5.git .vendor/ACE-Step-1.5
(cd .vendor/ACE-Step-1.5 && uv sync)

echo "== HyperFrames skills (Claude Code)"
npx --yes hyperframes@0.9.19 skills update || echo "skipped: run 'npx hyperframes skills update' later"
link_skill

echo
bin/repotage doctor || true
echo "ACE-Step downloads its models (about 8 GB) on the first 'repotage music gen'."
