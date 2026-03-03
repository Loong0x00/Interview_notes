import { Router, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  getUserByUsername,
  createUser,
  getInviteCode,
  markInviteCodeUsed,
  getUserCount,
  migrateOrphanReports,
} from "./db.js";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET!;

// Augment Express Request
declare global {
  namespace Express {
    interface Request {
      user?: { userId: number; username: string };
    }
  }
}

// ── requireAuth middleware ──

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      userId: number;
      username: string;
    };
    req.user = { userId: payload.userId, username: payload.username };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// ── POST /register ──

router.post("/register", async (req: Request, res: Response) => {
  const { username, password, inviteCode } = req.body;

  if (!username || !password || !inviteCode) {
    res.status(400).json({ error: "Missing username, password, or inviteCode" });
    return;
  }

  if (typeof username !== "string" || username.length < 2 || username.length > 32) {
    res.status(400).json({ error: "Username must be 2-32 characters" });
    return;
  }

  if (typeof password !== "string" || password.length < 4) {
    res.status(400).json({ error: "Password must be at least 4 characters" });
    return;
  }

  // Check invite code
  const code = getInviteCode(inviteCode);
  if (!code || code.used_by !== null) {
    res.status(400).json({ error: "Invalid or already used invite code" });
    return;
  }

  // Check username uniqueness
  if (getUserByUsername(username)) {
    res.status(400).json({ error: "Username already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = createUser(username, passwordHash);
  markInviteCodeUsed(inviteCode, userId);

  // If first user, migrate orphan reports
  if (getUserCount() === 1) {
    migrateOrphanReports(userId);
  }

  const token = jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { userId, username } });
});

// ── POST /login ──

router.post("/login", async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "Missing username or password" });
    return;
  }

  const user = getUserByUsername(username);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.json({ token, user: { userId: user.id, username: user.username } });
});

// ── GET /me ──

router.get("/me", requireAuth, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

export default router;
