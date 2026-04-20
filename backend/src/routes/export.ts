import { Router } from 'express';
import { exportController } from '../controllers/exportController';

const router = Router();

router.post('/svg', exportController.exportSVG);
router.post('/png', exportController.exportPNG);
router.post('/pdf', exportController.exportPDF);

export default router;