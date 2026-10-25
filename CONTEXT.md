# macOS Responsibility Disclaim

This context defines the language for TCC permission attribution on macOS and the re-exec that changes it.

## Language

**TCC**:
The macOS privacy system (Transparency, Consent, and Control). It owns microphone, camera, Accessibility, screen recording, and file permissions.
_Avoid_: Sandbox, entitlement

**Responsible Process**:
The process that TCC charges for a permission request. TCC shows its app name in the prompt and stores the grant for it.
_Avoid_: Parent process, owner

**Launcher**:
A process that starts an app's executable directly with `posix_spawn` or `exec`, for example Steam, a terminal, or an IDE. The app inherits the Responsible Process of the Launcher.
_Avoid_: Host, parent

**Disclaim**:
The `posix_spawn` attribute that starts a new image as its own Responsible Process. Apple names it with `responsibility_spawnattrs_setdisclaim()`.
_Avoid_: Detach, reparent

**Self-Responsible**:
A process that is its own Responsible Process. Finder, the Dock, and `open` start apps in this state.
_Avoid_: Independent, top-level

**Re-exec**:
The replacement of the current process image with `POSIX_SPAWN_SETEXEC` and Disclaim. The PID does not change.
_Avoid_: Relaunch, restart, respawn

**Architecture Package**:
An npm package that contains the Node-API addon for one CPU architecture, with `os` and `cpu` set.
_Avoid_: Prebuild, platform binary
