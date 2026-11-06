#!/usr/bin/env bash
# Checks every tool and model repotage uses. Exit 1 if anything required is missing.
# shellcheck disable=SC2088  # "~/.claude/..." below is display text, not a path to expand
HOME_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VOICE_PY="${REPOTAGE_VOICE_PY:-$HOME_DIR/.venvs/voice/bin/python}"
ALIGN_PY="${REPOTAGE_ALIGN_PY:-$HOME_DIR/.venvs/align/bin/python}"
ACE="${REPOTAGE_ACESTEP:-$HOME_DIR/.vendor/ACE-Step-1.5}"
fail=0
if [[ -t 1 || -n "${FORCE_COLOR:-}" ]]; then G=$'\033[32m'; Dm=$'\033[90m'; R=$'\033[0m'; else G=; Dm=; R=; fi
row() { local c="$Dm"; [[ "$1" == "ok" ]] && c="$G"; printf "  %s%-3s%s %-22s %s%s%s\n" "$c" "$1" "$R" "$2" "$Dm" "$3" "$R"; }
ok() { row "ok" "$1" "$2"; }
bad() { row "--" "$1" "$2"; fail=1; }
echo "repotage doctor"
[[ "$(uname -sm)" == "Darwin arm64" ]] && ok "Apple Silicon" "$(sysctl -n machdep.cpu.brand_string 2>/dev/null)" || bad "Apple Silicon" "MLX voice and music need an M-series Mac"
command -v ffmpeg >/dev/null && ok "ffmpeg" "$(ffmpeg -version | head -1 | awk '{print $3}')" || bad "ffmpeg" "brew install ffmpeg"
command -v vhs >/dev/null && ok "VHS" "$(vhs --version 2>/dev/null | awk '{print $3}')" || bad "VHS" "brew install vhs"
command -v node >/dev/null && ok "Node.js" "$(node --version)" || bad "Node.js" "22 or newer"
command -v uv >/dev/null && ok "uv" "$(uv --version | awk '{print $2}')" || bad "uv" "brew install uv"
[[ -d "$HOME_DIR/node_modules/playwright" ]] && ok "Playwright" "$(node -p "require('$HOME_DIR/node_modules/playwright/package.json').version")" || bad "Playwright" "./setup.sh"
"$VOICE_PY" -c "import mlx_audio" 2>/dev/null && ok "mlx-audio" "$("$VOICE_PY" -c 'import importlib.metadata as m;print(m.version("mlx-audio"))')" || bad "mlx-audio" "./setup.sh"
ls ~/.cache/huggingface/hub/models--mlx-community--VoxCPM2-bf16/snapshots/*/config.json >/dev/null 2>&1 && ok "VoxCPM2 bf16" "voice design + cloning, 48 kHz" || bad "VoxCPM2 bf16" "./setup.sh (5 GB)"
"$ALIGN_PY" -c "import whisperx" 2>/dev/null && ok "WhisperX" "$("$ALIGN_PY" -c 'import importlib.metadata as m;print(m.version("whisperx"))') · large-v3" || bad "WhisperX" "./setup.sh"
[[ -f "$ACE/cli.py" ]] && ok "ACE-Step 1.5" "turbo DiT + 1.7B LM (MLX)" || bad "ACE-Step 1.5" "./setup.sh"
"$HOME_DIR/node_modules/.bin/hyperframes" --version >/dev/null 2>&1 && ok "HyperFrames" "$("$HOME_DIR/node_modules/.bin/hyperframes" --version 2>/dev/null | tail -1) + GSAP 3.15" || bad "HyperFrames" "./setup.sh"
[[ -d "$HOME/.claude/skills/hyperframes" ]] && ok "HyperFrames skills" "~/.claude/skills" || row "--" "HyperFrames skills" "optional: npx hyperframes skills update"
[[ -e "$HOME/.claude/skills/repotage" ]] && ok "repotage skill" "~/.claude/skills/repotage" || row "--" "repotage skill" "optional: ./setup.sh --skill"
exit $fail
