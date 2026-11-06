# sourced by the tapes; run vhs from the demoforge repo root
export PATH="$PWD/bin:$PATH"
export PS1='%F{#ff6a1a}demoforge%f %F{#6f6a62}❯%f '
# Same command, minus font-cache INFO lines and local report paths (they print the home directory).
demoforge() { FORCE_COLOR=1 command demoforge "$@" 2>&1 | grep -v -E '^\[INFO\]|^\[hyperframes\]|^Report:|^Revision:'; }
