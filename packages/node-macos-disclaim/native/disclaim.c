// Node-API addon that exposes the macOS responsibility SPI.
//
// TCC (the macOS privacy system) attributes a request for a protected resource
// to the "responsible process" of the caller, not to the caller itself. A child
// process inherits the responsible process of its parent. An app that Steam, a
// terminal, or an IDE starts with posix_spawn is attributed to that launcher.
//
// responsibility_spawnattrs_setdisclaim() tells posix_spawn to start the new
// image as its own responsible process. With POSIX_SPAWN_SETEXEC, posix_spawn
// replaces the current image like execve(2), so the PID does not change.
//
// Both functions are private libSystem symbols. LLDB, Chromium (ChromeDriver),
// and Homebrew use them. We look them up with dlsym() so that a removal makes
// the feature unavailable instead of preventing the addon from loading.

#define NAPI_VERSION 8

#include <dlfcn.h>
#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <spawn.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include <node_api.h>

extern char **environ;

typedef int (*setdisclaim_fn)(posix_spawnattr_t *attrs, int disclaim);
typedef pid_t (*get_responsible_fn)(pid_t pid);

static setdisclaim_fn setdisclaim = NULL;
static get_responsible_fn get_responsible = NULL;

#define CHECK(env, call)                                                  \
  do {                                                                    \
    if ((call) != napi_ok) {                                              \
      napi_throw_error((env), "DISCLAIM_NAPI_ERROR", "Node-API call failed: " #call); \
      return NULL;                                                        \
    }                                                                     \
  } while (0)

static void resolve_symbols(void) {
  setdisclaim = (setdisclaim_fn)dlsym(RTLD_DEFAULT, "responsibility_spawnattrs_setdisclaim");
  get_responsible = (get_responsible_fn)dlsym(RTLD_DEFAULT, "responsibility_get_pid_responsible_for_pid");
}

static void free_string_array(char **array) {
  if (array == NULL)
    return;
  for (char **item = array; *item != NULL; item++)
    free(*item);
  free(array);
}

// Reads a JS string into a heap buffer. Returns NULL with a pending exception on failure.
static char *read_string(napi_env env, napi_value value) {
  size_t length = 0;
  if (napi_get_value_string_utf8(env, value, NULL, 0, &length) != napi_ok) {
    napi_throw_type_error(env, "DISCLAIM_INVALID_ARG", "Expected a string");
    return NULL;
  }
  char *buffer = malloc(length + 1);
  if (buffer == NULL) {
    napi_throw_error(env, "DISCLAIM_NO_MEMORY", "Out of memory");
    return NULL;
  }
  napi_get_value_string_utf8(env, value, buffer, length + 1, &length);
  return buffer;
}

// Reads a JS string[] into a NULL-terminated array, with `first` (if set) in slot 0.
static char **read_string_array(napi_env env, napi_value value, const char *first) {
  bool is_array = false;
  if (napi_is_array(env, value, &is_array) != napi_ok || !is_array) {
    napi_throw_type_error(env, "DISCLAIM_INVALID_ARG", "Expected an array of strings");
    return NULL;
  }
  uint32_t count = 0;
  napi_get_array_length(env, value, &count);
  size_t offset = first != NULL ? 1 : 0;
  char **array = calloc(count + offset + 1, sizeof(char *));
  if (array == NULL) {
    napi_throw_error(env, "DISCLAIM_NO_MEMORY", "Out of memory");
    return NULL;
  }
  if (first != NULL && (array[0] = strdup(first)) == NULL) {
    free(array);
    napi_throw_error(env, "DISCLAIM_NO_MEMORY", "Out of memory");
    return NULL;
  }
  for (uint32_t i = 0; i < count; i++) {
    napi_value item;
    napi_get_element(env, value, i, &item);
    if ((array[i + offset] = read_string(env, item)) == NULL) {
      free_string_array(array);
      return NULL;
    }
  }
  return array;
}

static napi_value throw_errno(napi_env env, const char *syscall, int code) {
  napi_value error, message, code_value, errno_value, syscall_value;
  napi_create_string_utf8(env, strerror(code), NAPI_AUTO_LENGTH, &message);
  napi_create_error(env, NULL, message, &error);
  napi_create_string_utf8(env, "DISCLAIM_SPAWN_FAILED", NAPI_AUTO_LENGTH, &code_value);
  napi_create_int32(env, code, &errno_value);
  napi_create_string_utf8(env, syscall, NAPI_AUTO_LENGTH, &syscall_value);
  napi_set_named_property(env, error, "code", code_value);
  napi_set_named_property(env, error, "errno", errno_value);
  napi_set_named_property(env, error, "syscall", syscall_value);
  napi_throw(env, error);
  return NULL;
}

static napi_value is_supported(napi_env env, napi_callback_info info) {
  (void)info;
  napi_value result;
  CHECK(env, napi_get_boolean(env, setdisclaim != NULL && get_responsible != NULL, &result));
  return result;
}

// getResponsiblePid(pid: number): number. Returns -1 when the SPI is missing or the query fails.
static napi_value get_responsible_pid(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  CHECK(env, napi_get_cb_info(env, info, &argc, argv, NULL, NULL));
  int32_t pid = 0;
  if (argc < 1 || napi_get_value_int32(env, argv[0], &pid) != napi_ok) {
    napi_throw_type_error(env, "DISCLAIM_INVALID_ARG", "Expected a pid number");
    return NULL;
  }
  pid_t responsible = get_responsible != NULL ? get_responsible((pid_t)pid) : -1;
  napi_value result;
  CHECK(env, napi_create_int32(env, responsible > 0 ? responsible : -1, &result));
  return result;
}

// execDisclaimed(file: string, args: string[], env: string[] | undefined): never
// `args` excludes argv[0]. `file` is used as argv[0].
static napi_value exec_disclaimed(napi_env env, napi_callback_info info) {
  size_t argc = 3;
  napi_value argv[3];
  CHECK(env, napi_get_cb_info(env, info, &argc, argv, NULL, NULL));
  if (argc < 2) {
    napi_throw_type_error(env, "DISCLAIM_INVALID_ARG", "Expected file and args");
    return NULL;
  }
  if (setdisclaim == NULL) {
    napi_throw_error(env, "DISCLAIM_UNSUPPORTED", "responsibility_spawnattrs_setdisclaim is not available on this system");
    return NULL;
  }

  char *file = NULL;
  char **child_argv = NULL;
  char **child_env = NULL;
  napi_value result = NULL;

  if ((file = read_string(env, argv[0])) == NULL)
    goto cleanup;
  if ((child_argv = read_string_array(env, argv[1], file)) == NULL)
    goto cleanup;
  if (argc >= 3) {
    napi_valuetype type;
    napi_typeof(env, argv[2], &type);
    if (type != napi_undefined && type != napi_null
        && (child_env = read_string_array(env, argv[2], NULL)) == NULL)
      goto cleanup;
  }

  posix_spawnattr_t attr;
  posix_spawn_file_actions_t actions;
  int rc = posix_spawnattr_init(&attr);
  if (rc != 0) {
    result = throw_errno(env, "posix_spawnattr_init", rc);
    goto cleanup;
  }
  rc = posix_spawn_file_actions_init(&actions);
  if (rc != 0) {
    posix_spawnattr_destroy(&attr);
    result = throw_errno(env, "posix_spawn_file_actions_init", rc);
    goto cleanup;
  }

  // Start the new image the way a fresh launch would see it:
  // - only stdin, stdout, and stderr stay open (CLOEXEC_DEFAULT plus addinherit_np),
  // - no blocked signals, and every signal has its default action.
  //   Node.js, for example, ignores SIGPIPE, and exec(2) keeps ignored signals.
  sigset_t empty_mask, all_signals;
  sigemptyset(&empty_mask);
  sigfillset(&all_signals);

  rc = posix_spawnattr_setflags(&attr, POSIX_SPAWN_SETEXEC | POSIX_SPAWN_CLOEXEC_DEFAULT
                                           | POSIX_SPAWN_SETSIGMASK | POSIX_SPAWN_SETSIGDEF);
  if (rc == 0)
    rc = posix_spawnattr_setsigmask(&attr, &empty_mask);
  if (rc == 0)
    rc = posix_spawnattr_setsigdefault(&attr, &all_signals);
  if (rc == 0)
    rc = setdisclaim(&attr, 1);

  // NOTICE:
  // We clear FD_CLOEXEC on stdio ourselves before posix_spawn, and restore it if posix_spawn fails.
  // libuv (Node.js, Electron) sets FD_CLOEXEC on fds 0-2. With POSIX_SPAWN_SETEXEC,
  // posix_spawn returns EBADF for an addinherit_np or adddup2(fd, fd) action on an FD_CLOEXEC fd
  // (seen on macOS 26.3, 25D2125). Without the actions, exec closes stdio.
  // Source: src/index.test.ts runs the exec from Node.js, which reproduces it. See docs/adr/0004.
  // Removal condition: posix_spawn accepts addinherit_np on FD_CLOEXEC fds with POSIX_SPAWN_SETEXEC.
  int saved_fd_flags[3] = { -1, -1, -1 };
  for (int fd = STDIN_FILENO; rc == 0 && fd <= STDERR_FILENO; fd++) {
    int flags = fcntl(fd, F_GETFD);
    if (flags == -1)
      continue; // Not open. Nothing to keep.
    saved_fd_flags[fd] = flags;
    if ((flags & FD_CLOEXEC) != 0 && fcntl(fd, F_SETFD, flags & ~FD_CLOEXEC) == -1)
      rc = errno;
    else
      rc = posix_spawn_file_actions_addinherit_np(&actions, fd);
  }

  if (rc == 0) {
    // On success this call does not return.
    rc = posix_spawn(NULL, file, &actions, &attr, child_argv, child_env != NULL ? child_env : environ);
  }

  for (int fd = STDIN_FILENO; fd <= STDERR_FILENO; fd++) {
    if (saved_fd_flags[fd] != -1)
      fcntl(fd, F_SETFD, saved_fd_flags[fd]);
  }

  posix_spawn_file_actions_destroy(&actions);
  posix_spawnattr_destroy(&attr);
  result = throw_errno(env, "posix_spawn", rc);

cleanup:
  free(file);
  free_string_array(child_argv);
  free_string_array(child_env);
  return result;
}

NAPI_MODULE_INIT(/* napi_env env, napi_value exports */) {
  resolve_symbols();

  napi_property_descriptor properties[] = {
    { "isSupported", NULL, is_supported, NULL, NULL, NULL, napi_default, NULL },
    { "getResponsiblePid", NULL, get_responsible_pid, NULL, NULL, NULL, napi_default, NULL },
    { "execDisclaimed", NULL, exec_disclaimed, NULL, NULL, NULL, napi_default, NULL },
  };
  if (napi_define_properties(env, exports, sizeof(properties) / sizeof(properties[0]), properties) != napi_ok)
    return NULL;
  return exports;
}
