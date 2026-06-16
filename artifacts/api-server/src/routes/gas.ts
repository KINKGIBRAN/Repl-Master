import { Router, type IRouter, type Request, type Response } from "express";
const router: IRouter = Router();

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbydQf3RsnjCwkMPO3r_oyvsJx5IDtGiUfELHPN0Srut3pbdpw_38dUla3mPVQ4RsOlxog/exec";

// ─── GET /api/gas?sheet=SHEET_NAME ───────────────────────────────────────────
router.get("/gas", async (req: Request, res: Response) => {
  const params = new URLSearchParams(req.query as Record<string, string>);
  const url = `${GAS_URL}?${params.toString()}`;
  req.log.info({ url }, "Proxying GET to GAS");
  try {
    const gasRes = await fetch(url);
    const text = await gasRes.text();
    res.status(gasRes.status).type("json").send(text);
  } catch (err: any) {
    req.log.error({ err }, "GAS proxy GET failed");
    res.status(502).json({ error: "GAS proxy error", detail: err.message });
  }
});

// ─── POST /api/gas?sheet=SHEET_NAME&action=insert|update|delete ──────────────
router.post("/gas", async (req: Request, res: Response) => {
  const params = new URLSearchParams(req.query as Record<string, string>);
  const url = `${GAS_URL}?${params.toString()}`;
  req.log.info({ url }, "Proxying POST to GAS");
  try {
    const gasRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: typeof req.body === "string" ? req.body : JSON.stringify(req.body),
    });
    const text = await gasRes.text();
    res.status(gasRes.status).type("json").send(text);
  } catch (err: any) {
    req.log.error({ err }, "GAS proxy POST failed");
    res.status(502).json({ error: "GAS proxy error", detail: err.message });
  }
});

// ─── DELETE /api/gas?sheet=SHEET_NAME&filterColumn=COL&filterValue=VAL ───────
router.delete("/gas", async (req: Request, res: Response) => {
  const params = new URLSearchParams(req.query as Record<string, string>);
  params.set("action", "delete");
  const url = `${GAS_URL}?${params.toString()}`;
  req.log.info({ url }, "Proxying DELETE to GAS");
  try {
    const gasRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({}),
    });
    const text = await gasRes.text();
    res.status(gasRes.status).type("json").send(text);
  } catch (err: any) {
    req.log.error({ err }, "GAS proxy DELETE failed");
    res.status(502).json({ error: "GAS proxy error", detail: err.message });
  }
});

// ─── POST /api/auth/login — baca dari Replit Secret USERS ────────────────────
router.post("/auth/login", async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    return res.status(400).json({ ok: false, message: "Username dan password wajib diisi" });
  }

  try {
    const usersJson = process.env.USERS;
    if (!usersJson) {
      return res.status(500).json({ ok: false, message: "Konfigurasi user tidak ditemukan" });
    }

    const users: Array<{
      username: string;
      password: string;
      role: string;
      nama: string;
    }> = JSON.parse(usersJson);

    const found = users.find(
      (u) =>
        u.username.trim().toUpperCase() === username.trim().toUpperCase() &&
        u.password.trim() === String(password).trim()
    );

    if (!found) {
      return res.status(401).json({ ok: false, message: "Username atau password salah" });
    }

    return res.json({
      ok: true,
      user: {
        username: found.username,
        nama: found.nama,
        role: found.role,
      },
    });
  } catch (err: any) {
    req.log.error({ err }, "Auth login failed");
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

export default router;