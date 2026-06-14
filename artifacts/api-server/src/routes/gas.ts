import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbydQf3RsnjCwkMPO3r_oyvsJx5IDtGiUfELHPN0Srut3pbdpw_38dUla3mPVQ4RsOlxog/exec";

// GET /api/gas?sheet=SHEET_NAME  — proxy read requests to GAS
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

// POST /api/gas?sheet=SHEET_NAME&action=insert|update|delete
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

export default router;
