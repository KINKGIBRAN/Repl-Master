import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gasRouter from "./gas";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(gasRouter);

export default router;
