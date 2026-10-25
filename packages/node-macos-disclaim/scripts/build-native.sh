#!/bin/sh
set -eu

package_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
architecture=${TARGET_ARCH:-$(uname -m)}
case "$architecture" in
  arm64) node_arch=arm64 ;;
  x86_64) node_arch=x64 ;;
  *) echo "Unsupported macOS architecture: $architecture" >&2; exit 1 ;;
esac

node_executable=$(node -p 'process.execPath')
node_prefix=$(dirname -- "$(dirname -- "$node_executable")")
node_include_dir=${NODE_INCLUDE_DIR:-"$node_prefix/include/node"}
if [ ! -f "$node_include_dir/node_api.h" ]; then
  echo "node_api.h was not found under $node_include_dir. Set NODE_INCLUDE_DIR." >&2
  exit 1
fi

output_dir="$package_dir/npm/darwin-$node_arch"
mkdir -p "$output_dir"

# Node-API is ABI-stable, so the same file loads in every Node.js and Electron version.
clang \
  -target "$architecture-apple-macosx11.0" \
  -O2 \
  -Wall \
  -Wextra \
  -Werror \
  -shared \
  -undefined dynamic_lookup \
  -I"$node_include_dir" \
  "$package_dir/native/disclaim.c" \
  -o "$output_dir/disclaim.node"

echo "Built $output_dir/disclaim.node"
