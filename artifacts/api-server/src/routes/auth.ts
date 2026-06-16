import { Router, type IRouter, type Request, type Response } from "express";
const router: IRouter = Router();

router.post("/auth/login", (req: Request, res: Response) => {
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
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

export default router;