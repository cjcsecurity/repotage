#!/usr/bin/env bash
# One-time setup on an Apple Silicon Mac. About 12 GB of models and environments.
#   ./setup.sh            everything
#   ./setup.sh --skill    only link the Claude Code skill into ~/.claude/skills
set -euo pipefail
cd "$(dirname "$0")"
# Pinned to the versions this release was tested with. Bump deliberately.
ACESTEP_REPO=https://github.com/ace-step/ACE-Step-1.5.git
ACESTEP_COMMIT=ca1e85fe9430179831e6bc6be790c332190a3866
VOXCPM_MODEL=mlx-community/VoxCPM2-bf16
VOXCPM_REVISION=a7fb80d9056983135a54ca3f71fcc5a637ccddf5
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
npm ci --no-audit --no-fund   # package-lock.json pins and integrity-checks Playwright and HyperFrames
npx playwright install chromium

echo "== voice: VoxCPM2 on mlx-audio"
[[ -x .venvs/voice/bin/python ]] || uv venv --python 3.12 .venvs/voice
VIRTUAL_ENV="$ROOT/.venvs/voice" uv pip install "mlx-audio==0.6.4" "mlx==0.32.4" "huggingface_hub[cli]==2.4.0" "soundfile==0.14.0" "numpy==2.5.4"
.venvs/voice/bin/hf download "$VOXCPM_MODEL" --revision "$VOXCPM_REVISION"

echo "== timing + scoring: WhisperX"
[[ -x .venvs/align/bin/python ]] || uv venv --python 3.12 .venvs/align
VIRTUAL_ENV="$ROOT/.venvs/align" uv pip install "whisperx==3.8.6" "torch==2.8.0" "librosa==1.0.0" "pyloudnorm==0.2.0" "scipy==1.18.1" "soundfile==0.14.0"

echo "== music: ACE-Step 1.5"
mkdir -p .vendor
if [[ ! -d .vendor/ACE-Step-1.5 ]]; then
  git init -q .vendor/ACE-Step-1.5
  git -C .vendor/ACE-Step-1.5 fetch -q --depth 1 "$ACESTEP_REPO" "$ACESTEP_COMMIT"
  git -C .vendor/ACE-Step-1.5 checkout -q FETCH_HEAD
fi
[[ "$(git -C .vendor/ACE-Step-1.5 rev-parse HEAD)" == "$ACESTEP_COMMIT" ]] || { echo "ACE-Step checkout is not $ACESTEP_COMMIT" >&2; exit 1; }
(cd .vendor/ACE-Step-1.5 && uv sync --frozen)

echo "== HyperFrames skills (Claude Code)"
node_modules/.bin/hyperframes skills update || echo "skipped: run 'npx hyperframes skills update' later"
link_skill

echo
bin/repotage doctor || true
echo "ACE-Step downloads its models (about 8 GB) on the first 'repotage music gen'."
