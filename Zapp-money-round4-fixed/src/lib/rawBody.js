/**
 * Middleware that captures the raw request body into req.rawBody
 * and parses JSON into req.body. Must be used BEFORE express.json()
 * on any route that needs HMAC signature verification.
 */
const RAW_BODY_LIMIT = Number(process.env.RAW_BODY_LIMIT_BYTES || 102_400); // 100 KB default

export function captureRawBody(req, res, next) {
  let data = Buffer.alloc(0);
  req.on("data", (chunk) => {
    data = Buffer.concat([data, chunk]);
    if (data.length > RAW_BODY_LIMIT) {
      req.destroy();
      res.status(413).json({ success: false, error: "PAYLOAD_TOO_LARGE" });
    }
  });
  req.on("end", () => {
    req.rawBody = data;
    try { req.body = JSON.parse(data.toString("utf8")); } catch { req.body = {}; }
    next();
  });
}
