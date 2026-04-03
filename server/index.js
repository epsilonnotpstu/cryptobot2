import bcrypt from "bcryptjs";
import cors from "cors";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import nodemailer from "nodemailer";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { OAuth2Client } from "google-auth-library";

dotenv.config();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_IDS = [GOOGLE_CLIENT_ID]
  .concat(
    (process.env.GOOGLE_CLIENT_IDS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  )
  .filter(Boolean);
const googleClient = GOOGLE_CLIENT_IDS.length > 0 ? new OAuth2Client() : null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const isVercelRuntime = process.env.VERCEL === "1";
const dataDir = process.env.AUTH_DATA_DIR
  ? path.resolve(process.env.AUTH_DATA_DIR)
  : isVercelRuntime
    ? path.join("/tmp", "cryptobot2-auth-data")
    : path.join(rootDir, "server", "data");

fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "auth.sqlite"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS otp_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    purpose TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    consumed_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    session_token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    reset_token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    consumed_at TEXT,
    created_at TEXT NOT NULL
  );
`);

const createUserStatement = db.prepare(`
  INSERT INTO users (user_id, name, email, password_hash, created_at)
  VALUES (@userId, @name, @email, @passwordHash, @createdAt)
`);
const insertOtpStatement = db.prepare(`
  INSERT INTO otp_codes (email, purpose, otp_hash, expires_at, created_at)
  VALUES (@email, @purpose, @otpHash, @expiresAt, @createdAt)
`);
const latestOtpStatement = db.prepare(`
  SELECT * FROM otp_codes
  WHERE email = ? AND purpose = ? AND consumed_at IS NULL
  ORDER BY id DESC
  LIMIT 1
`);
const consumeOtpStatement = db.prepare(`
  UPDATE otp_codes
  SET consumed_at = ?
  WHERE id = ?
`);
const clearOtpStatement = db.prepare(`
  DELETE FROM otp_codes
  WHERE email = ? AND purpose = ?
`);
const findUserByEmailStatement = db.prepare(`
  SELECT * FROM users
  WHERE email = ?
`);
const findUserByUserIdStatement = db.prepare(`
  SELECT * FROM users
  WHERE user_id = ?
`);
const insertSessionStatement = db.prepare(`
  INSERT INTO sessions (user_id, session_token_hash, expires_at, created_at)
  VALUES (@userId, @sessionTokenHash, @expiresAt, @createdAt)
`);
const findSessionStatement = db.prepare(`
  SELECT sessions.id AS session_row_id, sessions.user_id AS session_user_id, sessions.expires_at AS session_expires_at,
         users.user_id, users.name, users.email
  FROM sessions
  JOIN users ON users.user_id = sessions.user_id
  WHERE sessions.session_token_hash = ?
`);
const deleteSessionStatement = db.prepare(`
  DELETE FROM sessions
  WHERE session_token_hash = ?
`);
const deleteUserSessionsStatement = db.prepare(`
  DELETE FROM sessions
  WHERE user_id = ?
`);
const insertPasswordResetTokenStatement = db.prepare(`
  INSERT INTO password_reset_tokens (email, reset_token_hash, expires_at, created_at)
  VALUES (@email, @resetTokenHash, @expiresAt, @createdAt)
`);
const latestPasswordResetTokenStatement = db.prepare(`
  SELECT * FROM password_reset_tokens
  WHERE reset_token_hash = ? AND consumed_at IS NULL
  ORDER BY id DESC
  LIMIT 1
`);
const consumePasswordResetTokenStatement = db.prepare(`
  UPDATE password_reset_tokens
  SET consumed_at = ?
  WHERE id = ?
`);
const clearPasswordResetTokenStatement = db.prepare(`
  DELETE FROM password_reset_tokens
  WHERE email = ?
`);
const updateUserPasswordStatement = db.prepare(`
  UPDATE users
  SET password_hash = ?
  WHERE email = ?
`);

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || "0.0.0.0";
const APP_NAME = process.env.APP_NAME || "CryptoBot Prime";
const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 10);
const RESET_TOKEN_TTL_MINUTES = Number(process.env.RESET_TOKEN_TTL_MINUTES || 15);
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 30);
const HASH_SECRET = process.env.AUTH_HASH_SECRET || "cryptobot-dev-secret";
const SHOULD_RETURN_DEV_OTP =
  process.env.DEV_RETURN_OTP_IN_RESPONSE === "true" || process.env.NODE_ENV !== "production";

function getNow() {
  return new Date();
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function normalizeEmail(email = "") {
  return email.trim().toLowerCase();
}

function normalizeIdentifier(identifier = "") {
  return identifier.trim();
}

function toIso(date) {
  return date.toISOString();
}

function createHash(value) {
  return crypto.createHash("sha256").update(`${HASH_SECRET}:${value}`).digest("hex");
}

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function generateOpaqueToken() {
  return crypto.randomBytes(32).toString("hex");
}

function isExpired(isoDate) {
  return new Date(isoDate).getTime() < Date.now();
}

function findUserByIdentifier(identifier) {
  const cleanedIdentifier = normalizeIdentifier(identifier);
  if (/^\d{6}$/.test(cleanedIdentifier)) {
    return findUserByUserIdStatement.get(cleanedIdentifier) || null;
  }
  return findUserByEmailStatement.get(normalizeEmail(cleanedIdentifier)) || null;
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass || !process.env.SMTP_FROM) {
    throw new Error(
      "SMTP is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM to .env.",
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function normalizeEmailServiceError(error) {
  const message = error?.message || "";

  if (/535|invalid login|eauth/i.test(message)) {
    return "OTP email service login failed. Use a valid SMTP login and SMTP key in .env.";
  }

  if (/sender/i.test(message) && /invalid|reject|verify|authenticated/i.test(message)) {
    return "OTP email sender is not verified. Update SMTP_FROM to a verified sender/domain.";
  }

  if (/smtp is not configured/i.test(message)) {
    return message;
  }

  return message || "Failed to send OTP email.";
}

async function sendOtpEmail({ email, otp, purpose, name }) {
  const transporter = getTransporter();
  const expiresInText = `${OTP_TTL_MINUTES} minute${OTP_TTL_MINUTES > 1 ? "s" : ""}`;
  const title = purpose === "signup" ? "Your signup verification code" : "Your password reset code";
  const intro =
    purpose === "signup"
      ? "Use this code to complete your CryptoBot Prime signup."
      : "Use this code to continue your CryptoBot Prime password reset.";

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: `${APP_NAME}: ${title}`,
    text: `${intro}\n\nOTP: ${otp}\nExpires in: ${expiresInText}\n\nIf you did not request this, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
        <h2 style="margin-bottom: 12px;">${APP_NAME}</h2>
        <p style="margin-bottom: 8px;">Hello ${name || "Trader"},</p>
        <p style="margin-bottom: 16px;">${intro}</p>
        <div style="font-size: 32px; letter-spacing: 8px; font-weight: 700; color: #2563eb; margin: 24px 0;">
          ${otp}
        </div>
        <p style="margin-bottom: 8px;">This code will expire in ${expiresInText}.</p>
        <p style="color: #64748b;">If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });
}

function buildOtpDeliveryPayload({ emailError, otp, successMessage, fallbackMessage }) {
  if (!emailError) {
    return {
      ok: true,
      message: successMessage,
      delivery: "email",
      otpExpiresInMinutes: OTP_TTL_MINUTES,
    };
  }

  const normalizedError = normalizeEmailServiceError(emailError);
  if (!SHOULD_RETURN_DEV_OTP) {
    return {
      ok: false,
      status: 502,
      error: normalizedError,
    };
  }

  return {
    ok: true,
    message: fallbackMessage,
    delivery: "dev-fallback",
    devOtp: otp,
    otpExpiresInMinutes: OTP_TTL_MINUTES,
    emailError: normalizedError,
  };
}

function cleanupExpiredRecords() {
  const nowIso = toIso(getNow());
  db.prepare("DELETE FROM otp_codes WHERE expires_at < ?").run(nowIso);
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(nowIso);
  db.prepare("DELETE FROM password_reset_tokens WHERE expires_at < ?").run(nowIso);
}

function assertValidPassword(password = "") {
  if (password.trim().length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
}

function assertValidName(name = "") {
  if (name.trim().length < 2) {
    throw new Error("Please enter your full name.");
  }
}

function assertValidEmail(email = "") {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Please enter a valid email address.");
  }
}

function createUniqueUserId() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = String(crypto.randomInt(100000, 1000000));
    if (!findUserByUserIdStatement.get(candidate)) {
      return candidate;
    }
  }
  throw new Error("Unable to generate a unique user ID right now.");
}

function createSessionForUser(userId) {
  const sessionToken = generateOpaqueToken();
  const createdAt = getNow();
  insertSessionStatement.run({
    userId,
    sessionTokenHash: createHash(sessionToken),
    expiresAt: toIso(addDays(createdAt, SESSION_TTL_DAYS)),
    createdAt: toIso(createdAt),
  });
  return sessionToken;
}

function verifyOtp({ email, purpose, otp }) {
  const otpRow = latestOtpStatement.get(email, purpose);
  if (!otpRow) {
    throw new Error("OTP not found. Please request a new one.");
  }
  if (isExpired(otpRow.expires_at)) {
    throw new Error("OTP expired. Please request a new one.");
  }
  if (otpRow.otp_hash !== createHash(otp)) {
    throw new Error("Invalid OTP. Please check the code and try again.");
  }
  consumeOtpStatement.run(toIso(getNow()), otpRow.id);
}

function requireSession(req, res, next) {
  const authorizationHeader = req.headers.authorization || "";
  const sessionToken = authorizationHeader.startsWith("Bearer ")
    ? authorizationHeader.slice(7).trim()
    : "";

  if (!sessionToken) {
    res.status(401).json({ error: "Missing session token." });
    return;
  }

  cleanupExpiredRecords();
  const session = findSessionStatement.get(createHash(sessionToken));
  if (!session || isExpired(session.session_expires_at)) {
    res.status(401).json({ error: "Session expired. Please login again." });
    return;
  }

  req.currentUser = {
    userId: session.user_id,
    name: session.name,
    email: session.email,
  };
  req.sessionToken = sessionToken;
  next();
}

app.get("/api/health", (_req, res) => {
  cleanupExpiredRecords();
  res.json({ ok: true, app: APP_NAME });
});

app.post("/api/auth/signup/send-otp", async (req, res) => {
  try {
    cleanupExpiredRecords();
    const email = normalizeEmail(req.body.email);
    assertValidEmail(email);

    if (findUserByEmailStatement.get(email)) {
      res.status(409).json({ error: "An account with this email already exists. Please login." });
      return;
    }

    const otp = generateOtp();
    const createdAt = getNow();
    clearOtpStatement.run(email, "signup");
    insertOtpStatement.run({
      email,
      purpose: "signup",
      otpHash: createHash(otp),
      expiresAt: toIso(addMinutes(createdAt, OTP_TTL_MINUTES)),
      createdAt: toIso(createdAt),
    });

    console.log(`\n🔑 [DEV MODE] SIGNUP OTP FOR ${email}: ${otp}\n`);

    try {
      await sendOtpEmail({ email, otp, purpose: "signup", name: req.body.name?.trim() });
      res.json(
        buildOtpDeliveryPayload({
          otp,
          successMessage: "OTP sent to your email.",
          fallbackMessage: "OTP email failed, so a dev OTP was returned for local testing.",
        }),
      );
    } catch (emailError) {
      console.error("⚠️ SMTP EMAIL FAILED:", emailError.message);
      const payload = buildOtpDeliveryPayload({
        emailError,
        otp,
        successMessage: "OTP sent to your email.",
        fallbackMessage: "OTP email failed, so a dev OTP was returned for local testing.",
      });
      if (!payload.ok) {
        res.status(payload.status).json({ error: payload.error });
        return;
      }
      res.json(payload);
    }
  } catch (error) {
    res.status(400).json({ error: normalizeEmailServiceError(error) });
  }
});

app.post("/api/auth/signup/complete", async (req, res) => {
  try {
    cleanupExpiredRecords();
    const name = req.body.name?.trim() || "";
    const email = normalizeEmail(req.body.email);
    const otp = req.body.otp?.trim() || "";
    const password = req.body.password || "";

    assertValidName(name);
    assertValidEmail(email);
    assertValidPassword(password);
    if (!otp) {
      throw new Error("Please enter the OTP.");
    }
    if (findUserByEmailStatement.get(email)) {
      res.status(409).json({ error: "An account with this email already exists. Please login." });
      return;
    }

    verifyOtp({ email, purpose: "signup", otp });

    const userId = createUniqueUserId();
    const passwordHash = await bcrypt.hash(password, 12);
    const createdAt = toIso(getNow());

    createUserStatement.run({
      userId,
      name,
      email,
      passwordHash,
      createdAt,
    });

    const sessionToken = createSessionForUser(userId);
    res.json({
      message: "Account created successfully.",
      sessionToken,
      user: { userId, name, email },
    });
  } catch (error) {
    res.status(400).json({ error: error.message || "Signup failed." });
  }
});

app.post("/api/auth/google", async (req, res) => {
  try {
    if (!googleClient) {
      throw new Error("Google authentication is not configured on the server.");
    }
    
    cleanupExpiredRecords();
    const { token } = req.body;
    if (!token) throw new Error("Google token is required.");

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_IDS,
    });
    
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new Error("Invalid verification payload from Google.");
    }
    if (payload.email_verified === false) {
      throw new Error("Google account email is not verified.");
    }
    
    const email = normalizeEmail(payload.email);
    const name = payload.name || "Google User";
    
    let user = findUserByEmailStatement.get(email);
    let isNewUser = false;
    
    if (!user) {
      isNewUser = true;
      const userId = createUniqueUserId();
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
      const createdAt = toIso(getNow());
      
      createUserStatement.run({
        userId,
        name,
        email,
        passwordHash,
        createdAt,
      });
      user = findUserByEmailStatement.get(email);
    }
    
    const sessionToken = createSessionForUser(user.user_id);
    res.json({
      message: isNewUser ? "Account created successfully with Google." : "Login successful.",
      sessionToken,
      user: {
        userId: user.user_id,
        name: user.name,
        email: user.email,
      },
      isNewUser,
    });
  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(400).json({ error: error.message || "Google authentication failed." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    cleanupExpiredRecords();
    const identifier = normalizeIdentifier(req.body.identifier);
    const password = req.body.password || "";

    assertValidPassword(password);
    const user = findUserByIdentifier(identifier);
    if (!user) {
      res.status(404).json({ error: "Account not found." });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      res.status(401).json({ error: "Invalid credentials." });
      return;
    }

    const sessionToken = createSessionForUser(user.user_id);
    res.json({
      message: "Login successful.",
      sessionToken,
      user: {
        userId: user.user_id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(400).json({ error: error.message || "Login failed." });
  }
});

app.get("/api/auth/session", requireSession, (req, res) => {
  res.json({ user: req.currentUser });
});

app.post("/api/auth/logout", requireSession, (req, res) => {
  deleteSessionStatement.run(createHash(req.sessionToken));
  res.json({ message: "Logged out." });
});

app.post("/api/auth/password/lookup", async (req, res) => {
  try {
    cleanupExpiredRecords();
    const identifier = normalizeIdentifier(req.body.identifier);
    const user = findUserByIdentifier(identifier);

    if (!user) {
      res.status(404).json({ error: "Account not found." });
      return;
    }

    const otp = generateOtp();
    const createdAt = getNow();

    clearOtpStatement.run(user.email, "reset");
    clearPasswordResetTokenStatement.run(user.email);

    insertOtpStatement.run({
      email: user.email,
      purpose: "reset",
      otpHash: createHash(otp),
      expiresAt: toIso(addMinutes(createdAt, OTP_TTL_MINUTES)),
      createdAt: toIso(createdAt),
    });

    console.log(`\n🔑 [DEV MODE] RESET OTP FOR ${user.email}: ${otp}\n`);
    try {
      await sendOtpEmail({ email: user.email, otp, purpose: "reset", name: user.name });
      res.json({
        ...buildOtpDeliveryPayload({
          otp,
          successMessage: "Account found. OTP sent to your email.",
          fallbackMessage: "OTP email failed, so a dev OTP was returned for local testing.",
        }),
        email: user.email,
        userId: user.user_id,
        name: user.name,
      });
    } catch (emailError) {
      console.error("⚠️ SMTP EMAIL FAILED:", emailError.message);
      const payload = buildOtpDeliveryPayload({
        emailError,
        otp,
        successMessage: "Account found. OTP sent to your email.",
        fallbackMessage: "OTP email failed, so a dev OTP was returned for local testing.",
      });
      if (!payload.ok) {
        res.status(payload.status).json({ error: payload.error });
        return;
      }
      res.json({
        ...payload,
        email: user.email,
        userId: user.user_id,
        name: user.name,
      });
    }
  } catch (error) {
    res.status(400).json({ error: normalizeEmailServiceError(error) });
  }
});

app.post("/api/auth/password/verify-otp", (req, res) => {
  try {
    cleanupExpiredRecords();
    const identifier = normalizeIdentifier(req.body.identifier);
    const otp = req.body.otp?.trim() || "";
    const user = findUserByIdentifier(identifier);

    if (!user) {
      res.status(404).json({ error: "Account not found." });
      return;
    }
    if (!otp) {
      throw new Error("Please enter the OTP.");
    }

    verifyOtp({ email: user.email, purpose: "reset", otp });

    const resetToken = generateOpaqueToken();
    const createdAt = getNow();
    insertPasswordResetTokenStatement.run({
      email: user.email,
      resetTokenHash: createHash(resetToken),
      expiresAt: toIso(addMinutes(createdAt, RESET_TOKEN_TTL_MINUTES)),
      createdAt: toIso(createdAt),
    });

    res.json({
      message: "OTP verified. You can create a new password now.",
      resetToken,
      user: {
        userId: user.user_id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(400).json({ error: error.message || "OTP verification failed." });
  }
});

app.post("/api/auth/password/reset", async (req, res) => {
  try {
    cleanupExpiredRecords();
    const resetToken = req.body.resetToken?.trim() || "";
    const password = req.body.password || "";
    const confirmPassword = req.body.confirmPassword || "";

    if (!resetToken) {
      throw new Error("Reset token is missing.");
    }
    assertValidPassword(password);
    if (password !== confirmPassword) {
      throw new Error("Passwords do not match.");
    }

    const tokenRow = latestPasswordResetTokenStatement.get(createHash(resetToken));
    if (!tokenRow || isExpired(tokenRow.expires_at)) {
      throw new Error("Reset session expired. Please start the forgot password flow again.");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    updateUserPasswordStatement.run(passwordHash, tokenRow.email);
    consumePasswordResetTokenStatement.run(toIso(getNow()), tokenRow.id);

    const user = findUserByEmailStatement.get(tokenRow.email);
    if (user) {
      deleteUserSessionsStatement.run(user.user_id);
    }

    res.json({ message: "Password updated. Please login with the new password." });
  } catch (error) {
    res.status(400).json({ error: error.message || "Could not reset password." });
  }
});

const isExecutedDirectly = (() => {
  if (!process.argv[1]) {
    return false;
  }
  return path.resolve(process.argv[1]) === __filename;
})();

if (isExecutedDirectly) {
  app.listen(PORT, HOST, () => {
    // eslint-disable-next-line no-console
    console.log(`[auth-api] running on http://${HOST}:${PORT}`);
  });
}

export default app;
