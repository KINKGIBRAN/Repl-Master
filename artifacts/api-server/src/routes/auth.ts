import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

router.post("/auth/login", (req: Request, res: Response) => {
  const { pin } = req.body as { pin?: string };
  const adminPin = process.env.ADMIN_PIN || "admin123";
  if (pin && pin === adminPin) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, message: "PIN salah" });
  }
});

export default router;
