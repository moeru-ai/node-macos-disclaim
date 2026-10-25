---
status: accepted
---

# Re-exec in place instead of a launcher process

`ensureSelfResponsible()` replaces the current process image with `posix_spawn`, `POSIX_SPAWN_SETEXEC`, and the Disclaim attribute.

We considered a small native launcher that spawns the app with Disclaim and waits for it. Steam and other Launchers track the process that they started. A launcher process must stay alive, wait for the app, and forward signals.

The Re-exec keeps the PID. The Launcher keeps tracking the same process, and no process waits or forwards signals.

The app calls one function at the top of its entry. The code before that call runs twice.

A Finder launch is already Self-Responsible, so the function does nothing there.

The function sets `DISCLAIM_REEXEC` on the new image and removes it in the new image. If a future macOS ignores Disclaim, the process does not Re-exec in a loop.
