---
status: accepted
---

# Clear FD_CLOEXEC on stdio before the Re-exec

The new image keeps stdin, stdout, and stderr. It does not keep other file descriptors.

The addon sets `POSIX_SPAWN_CLOEXEC_DEFAULT` and adds an `addinherit_np` action for each open stdio descriptor.

libuv sets `FD_CLOEXEC` on stdio in Node.js and Electron. With `POSIX_SPAWN_SETEXEC`, `posix_spawn` returns `EBADF` for an `addinherit_np` or `adddup2(fd, fd)` action on an `FD_CLOEXEC` descriptor. We saw this on macOS 26.3 (25D2125).

The addon clears `FD_CLOEXEC` on stdio with `fcntl()` before `posix_spawn`. If `posix_spawn` fails, the addon restores the flags.

The addon also unblocks all signals and resets all signals to their default action. `exec(2)` keeps ignored signals, and Node.js ignores `SIGPIPE`.
