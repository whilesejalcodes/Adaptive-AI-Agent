import { Router, type IRouter } from "express";
import healthRouter from "./health";
import conversationsRouter from "./conversations";
import memoriesRouter from "./memories";

const router: IRouter = Router();

router.use(healthRouter);
router.use(conversationsRouter);
router.use(memoriesRouter);

export default router;
