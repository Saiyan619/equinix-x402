import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { SplitterService } from '../services/splitter.service';
import { calculateSplitAmounts } from '../anchor-client';
import { CONFIG } from '../config/constants';
import { ApiUsage, Payment } from '../database';

export class PaymentController {
  static async handleProtectedEndpoint(req: Request, res: Response) {
    try {
      const { splitterPDA, paymentData } = req.body;
      const splitter = await SplitterService.getSplitter(splitterPDA);

      // Record payment
      await PaymentService.recordPayment({
        signature: paymentData.signature,
        splitterPDA,
        payer: paymentData.payer || 'UNKNOWN',
        amount: CONFIG.PAYMENT_AMOUNT,
        merchantAmount: Math.floor((CONFIG.PAYMENT_AMOUNT * splitter.merchantShare) / 100),
        agentAmount: Math.floor((CONFIG.PAYMENT_AMOUNT * splitter.agentShare) / 100),
        platformAmount: Math.floor((CONFIG.PAYMENT_AMOUNT * splitter.platformShare) / 100),
        apiEndpoint: '/api/demo/get-data',
      });

      // Send response with premium data
      res.json({
        success: true,
        data: {
          message: 'Payment successful! Here is your premium data.',
          requestedAt: new Date().toISOString(),
          splitterUsed: splitterPDA,
          paymentSignature: paymentData.signature,
          splits: {
            merchant: `${splitter.merchantShare}% (${Math.floor((CONFIG.PAYMENT_AMOUNT * splitter.merchantShare) / 100) / 1_000_000} USDC) → ${splitter.merchant}`,
            agent: `${splitter.agentShare}% (${Math.floor((CONFIG.PAYMENT_AMOUNT * splitter.agentShare) / 100) / 1_000_000} USDC) → ${splitter.agent}`,
            platform: `${splitter.platformShare}% (${Math.floor((CONFIG.PAYMENT_AMOUNT * splitter.platformShare) / 100) / 1_000_000} USDC) → ${splitter.platform}`,
          },
          demoData: {
            result: 'This is the protected premium data you requested',
            items: ['Premium data 1', 'Premium data 2', 'Premium data 3'],
            analytics: {
              totalRequests: await ApiUsage.countDocuments({ splitterPDA }),
              totalPayments: await Payment.countDocuments({ splitterPDA }),
            },
          },
        },
      });
    } catch (error: any) {
      console.error('Error:', error.message);
      res.status(500).json({ error: 'Failed to process request' });
    }
  }

  static async buildSplitTransaction(req: Request, res: Response) {
    try {
      const { splitterPDA, payerAddress, amount } = req.body;

      if (!splitterPDA || !payerAddress || !amount) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const splitter = await SplitterService.getSplitter(splitterPDA);

      if (!splitter.isInitializedOnChain) {
        return res.status(400).json({ error: 'Splitter not initialized on-chain' });
      }

      const splits = calculateSplitAmounts(
        amount,
        splitter.merchantShare,
        splitter.agentShare,
        splitter.platformShare
      );

      const serializedTx = await PaymentService.buildSplitTransaction(
        splitterPDA,
        payerAddress,
        amount,
        splitter.merchant,
        splitter.agent,
        splitter.platform
      );

      res.json({
        success: true,
        transaction: serializedTx,
        splits: {
          merchant: { address: splitter.merchant, amount: splits.merchantAmount, percentage: splitter.merchantShare },
          agent: { address: splitter.agent, amount: splits.agentAmount, percentage: splitter.agentShare },
          platform: { address: splitter.platform, amount: splits.platformAmount, percentage: splitter.platformShare },
        },
      });
    } catch (error: any) {
      console.error('Error:', error.message);
      res.status(500).json({ error: 'Failed to build transaction' });
    }
  }

  static async getPaymentHistory(req: Request, res: Response) {
    try {
      const payments = await PaymentService.getPaymentHistory(req.params.splitterPDA);
      res.json(payments);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch payments' });
    }
  }
}