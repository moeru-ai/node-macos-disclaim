---
status: accepted
---

# Publish separate Darwin architecture packages

The project publishes one main package and two Architecture Packages:

```text
@moeru/node-macos-disclaim
@moeru/node-macos-disclaim-darwin-arm64
@moeru/node-macos-disclaim-darwin-x64
```

The main package contains the TypeScript API and no native binary. It lists both Architecture Packages in `optionalDependencies`. All three packages use the same version.

Each Architecture Package contains one `.node` file and sets `os: ["darwin"]` and the matching `cpu`. Package managers do not install them on Linux or Windows.

The main package loads the package for `process.arch` by name. It does not look for a binary from another architecture.

The release workflow builds each addon on a macOS runner of its architecture and tests it there. A job on Linux publishes the packages.

This layout follows `moeru-ai/xsai-apple-speech`.
