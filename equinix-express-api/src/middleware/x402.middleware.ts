import { Request, Response, NextFunction } from 'express';
import { solana } from '@faremeter/info';
import { SplitterService } from '../services/splitter.service';
import { SolanaService } from '../services/solana.service';
import { CONFIG } from '../config/constants';

export async function x402PaymentMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.log('\n===== X402 PAYMENT CHECK =====');

  try {
    const { splitterPDA } = req.body;
    const paymentSignature = req.headers['x-payment-signature'] as string;
    const payerAddress = req.headers['x-payer-address'] as string;

    if (!splitterPDA) {
      return res.status(400).json({ error: 'splitterPDA required' });
    }

    // Get splitter
    const splitter = await SplitterService.getSplitter(splitterPDA);

    if (!splitter.isInitializedOnChain) {
      return res.status(400).json({ error: 'Splitter not initialized on-chain' });
    }

    // No payment signature - send 402
    if (!paymentSignature) {
      console.log('💳 Sending 402 Payment Required');

      const x402Spec = solana.x402Exact({
        network: 'devnet',
        asset: 'USDC',
        amount: CONFIG.PAYMENT_AMOUNT,
        payTo: splitterPDA,
      })[0];

      const paymentSpec = {
        ...x402Spec,
        resource: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        description: 'Premium API access with payment splitting',
        asset: CONFIG.USDC_MINT_DEVNET.toBase58(),
      };

      return res.status(402).json({
        x402Version: 1,
        accepts: [paymentSpec],
      });
    }

    // Verify payment
    console.log('Verifying payment:', paymentSignature);
    const isValid = await SolanaService.verifyTransaction(paymentSignature);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid payment transaction' });
    }

    console.log('Payment verified');

    // Attach payment data to request
    req.body.paymentData = {
      signature: paymentSignature,
      payer: payerAddress,
      splitter,
    };

    next();
  } catch (error: any) {
    console.error('X402 Error:', error.message);
    res.status(500).json({ error: 'Payment check failed', details: error.message });
  }
}