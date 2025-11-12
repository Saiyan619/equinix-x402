import { Connection, PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';

dotenv.config();

export const CONFIG = {
  PORT: process.env.PORT || 3001,
  SOLANA_RPC_URL: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  PROGRAM_ID: new PublicKey(process.env.PROGRAM_ID || '8My2SGb47iBJW6D5dkCmfXoRU4cjg1p77aiuHDmwakJo'),
  USDC_MINT_DEVNET: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
  PAYMENT_AMOUNT: 10000, // 0.01 USDC
  FACILITATOR_URL: process.env.FACILITATOR_URL || 'https://facilitator.corbits.dev',
};

export const connection = new Connection(CONFIG.SOLANA_RPC_URL, 'confirmed');