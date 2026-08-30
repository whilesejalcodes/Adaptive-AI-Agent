import { Router, type IRouter } from "express";
import healthRouter from "./health";
import conversationsRouter from "./conversations";
import memoriesRouter from "./memories";
import feedbackRouter from "./feedback";

const router: IRouter = Router();

router.use(healthRouter);
router.use(conversationsRouter);
router.use(memoriesRouter);
router.use(feedbackRouter);

export default router;
