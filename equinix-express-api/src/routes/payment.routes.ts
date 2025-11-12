import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { x402PaymentMiddleware } from '../middleware/x402.middleware';

const router = Router();

router.post('/demo/get-data', x402PaymentMiddleware, PaymentController.handleProtectedEndpoint);
router.post('/payment/build-split-tx', PaymentController.buildSplitTransaction);
router.get('/splitter/:splitterPDA/payments', PaymentController.getPaymentHistory);

export default router;