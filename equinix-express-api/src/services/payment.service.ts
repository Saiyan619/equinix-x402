import { PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { Payment, ApiUsage } from '../database';
import { CONFIG, connection } from '../config/constants';
import { buildSplitPaymentTransaction, serializeTransaction, calculateSplitAmounts } from '../anchor-client';

export class PaymentService {
  static async recordPayment(data: {
    signature: string;
    splitterPDA: string;
    payer: string;
    amount: number;
    merchantAmount: number;
    agentAmount: number;
    platformAmount: number;
    apiEndpoint: string;
  }) {
    const payment = new Payment({
      ...data,
      mint: CONFIG.USDC_MINT_DEVNET.toBase58(),
      status: 'confirmed',
    });

    await payment.save();

    await ApiUsage.create({
      splitterPDA: data.splitterPDA,
      endpoint: data.apiEndpoint,
      payer: data.payer,
      paymentSignature: data.signature,
    });

    return payment;
  }

  static async buildSplitTransaction(
    splitterPDA: string,
    payerAddress: string,
    amount: number,
    merchant: string,
    agent: string,
    platform: string
  ) {
    const splitterPubkey = new PublicKey(splitterPDA);
    const payerPubkey = new PublicKey(payerAddress);

    const transaction = new Transaction();

    // Check if splitter token account exists
    const splitterTokenAccount = getAssociatedTokenAddressSync(
      CONFIG.USDC_MINT_DEVNET,
      splitterPubkey,
      true
    );

    const accountInfo = await connection.getAccountInfo(splitterTokenAccount);

    if (!accountInfo) {
      console.log('Creating splitter token account...');
      const createATAIx = createAssociatedTokenAccountInstruction(
        payerPubkey,
        splitterTokenAccount,
        splitterPubkey,
        CONFIG.USDC_MINT_DEVNET
      );
      transaction.add(createATAIx);
    }

    // Build split payment transaction
    const splitTx = await buildSplitPaymentTransaction(
      connection,
      splitterPubkey,
      payerPubkey,
      new PublicKey(merchant),
      new PublicKey(agent),
      new PublicKey(platform),
      amount
    );

    transaction.add(...splitTx.instructions);

    // Set blockhash and fee payer
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payerPubkey;

    return serializeTransaction(transaction);
  }

  static async getPaymentHistory(splitterPDA: string, limit = 50) {
    return Payment.find({ splitterPDA })
      .sort({ createdAt: -1 })
      .limit(limit);
  }
}