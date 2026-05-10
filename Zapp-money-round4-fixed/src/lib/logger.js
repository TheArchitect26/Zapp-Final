/**
 * Structured logger.
 * All output goes to stdout/stderr as JSON lines for easy parsing by log aggregators.
 * Use [INFO], [WARN], [ERROR], [INIT] prefixes for filtering.
 */

function ts() {
  return new Date().toISOString();
}

export const logger = {
  info(msg, meta = {}) {
    console.log(JSON.stringify({ level: "INFO", msg, ...meta, ts: ts() }));
  },

  warn(msg, meta = {}) {
    console.warn(JSON.stringify({ level: "WARN", msg, ...meta, ts: ts() }));
  },

  error(msg, meta = {}) {
    const serialized = {};
    if (meta instanceof Error) {
      serialized.err = meta.message;
      serialized.stack = meta.stack;
    } else {
      Object.assign(serialized, meta);
    }
    console.error(JSON.stringify({ level: "ERROR", msg, ...serialized, ts: ts() }));
  },

  init(name, success, err = null) {
    if (success) {
      console.log(JSON.stringify({ level: "INIT", status: "SUCCESS", name, ts: ts() }));
    } else {
      console.error(JSON.stringify({
        level: "INIT",
        status: "FAILED",
        name,
        err: err?.message ?? String(err),
        ts: ts(),
      }));
    }
  },

  request(req, statusCode, durationMs) {
    console.log(JSON.stringify({
      level: "INFO",
      type: "request",
      method: req.method,
      url: req.originalUrl,
      status: statusCode,
      durationMs,
      ip: req.ip,
      ts: ts(),
    }));
  },
};
