---
status: accepted
---

# Use a raw Node-API bridge in C

The addon is one C file that uses Node-API directly.

The addon wraps three private libSystem functions and `posix_spawn`. napi-rs adds a Rust toolchain and generated loaders, but no behavior for a wrapper of this size.

Node-API is ABI-stable. One build for each architecture loads in every Node.js and Electron version.

The addon finds the private functions with `dlsym()`. If Apple removes them, the addon still loads, `isSupported()` returns `false`, and `ensureSelfResponsible()` does nothing.

The build script calls clang with the Node.js headers. It does not use node-gyp.
