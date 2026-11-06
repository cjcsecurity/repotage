# sourced by the tapes; run vhs from the repotage repo root
export PATH="$PWD/bin:$PATH"
export PS1='%F{#ff6a1a}repotage%f %F{#6f6a62}❯%f '
# Same command, minus font-cache INFO lines and local report paths (they print the home directory).
repotage() { FORCE_COLOR=1 command repotage "$@" 2>&1 | grep -v -E '^\[INFO\]|^\[hyperframes\]|^Report:|^Revision:'; }
