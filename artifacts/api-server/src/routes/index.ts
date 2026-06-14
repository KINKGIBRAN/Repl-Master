import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gasRouter from "./gas";

const router: IRouter = Router();

router.use(healthRouter);
router.use(gasRouter);

export default router;
