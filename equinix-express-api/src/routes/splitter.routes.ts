import { Router } from 'express';
import { SplitterController } from '../controllers/splitter.controller';

const router = Router();

router.post('/splitter/create', SplitterController.create);
router.get('/splitter/:splitterPDA', SplitterController.getOne);
router.get('/splitters/:authority', SplitterController.getByAuthority);

export default router;