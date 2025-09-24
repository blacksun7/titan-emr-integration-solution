import winston from "winston";
import path from "path";
import fs from "fs";

const logDir = process.env.LOG_DIR || "logs";

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Console logger (structured JSON for dev/debug)
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// Audit logger: successes
export const auditLogger = winston.createLogger({
  level: "info",
  format: winston.format.printf(
    (info) => `${new Date().toISOString()} ${info.message}`
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, "audit.log"),
    }),
  ],
});

// Error logger: failures
export const errorLogger = winston.createLogger({
  level: "error",
  format: winston.format.printf(
    (info) => `${new Date().toISOString()} ${info.message}`
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, "errors.log"),
    }),
  ],
});

export default logger;
