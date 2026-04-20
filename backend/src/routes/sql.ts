import { Router } from 'express';
import { sqlController } from '../controllers/sqlController';

const router = Router();

router.post('/parse', sqlController.parse);
router.post('/generate', sqlController.generateDiagram);
router.post('/transform-preview', sqlController.transformPreview);

export default router;