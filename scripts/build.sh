#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir/vendor/asusctl"
cargo build --release --locked --features rog-control-center/x11 -j "${BUILD_JOBS:-4}"
python3 "$repo_dir/scripts/generate-legacy-panel.py"
package_args=()
if [ "${PORTABLE_BUILD:-0}" = 1 ]; then package_args+=(--portable); fi
python3 "$repo_dir/scripts/package.py" --version "${VERSION:-1.6.0}" "${package_args[@]}"
