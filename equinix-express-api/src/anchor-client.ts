// backend/src/anchor-client.ts
import { 
  Connection, 
  PublicKey, 
  Transaction,
  Keypair,
  SystemProgram 
} from '@solana/web3.js';
import { 
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress, 
  TOKEN_PROGRAM_ID 
} from '@solana/spl-token';
import { Program, AnchorProvider, BN, Wallet } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as path from 'path';
import idl from './idl/equinix_contract.json'

// const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);

const USDC_MINT_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');



/**
 * Build a split_payment transaction
 */
export async function buildSplitPaymentTransaction(
  connection: Connection,
  splitterPDA: PublicKey,
  payerPublicKey: PublicKey,
  merchantPublicKey: PublicKey,
  agentPublicKey: PublicKey,
  platformPublicKey: PublicKey,
  amount: number
): Promise<Transaction> {
  
  console.log('🔨 Building split payment transaction...');
  
  const transaction = new Transaction();
  
  // Get all token accounts
  const payerTokenAccount = await getAssociatedTokenAddress(
    USDC_MINT_DEVNET,
    payerPublicKey
  );
  const merchantTokenAccount = await getAssociatedTokenAddress(
    USDC_MINT_DEVNET,
    merchantPublicKey
  );
  const agentTokenAccount = await getAssociatedTokenAddress(
    USDC_MINT_DEVNET,
    agentPublicKey
  );
  const platformTokenAccount = await getAssociatedTokenAddress(
    USDC_MINT_DEVNET,
    platformPublicKey
  );

  // ✅ CHECK AND CREATE MISSING TOKEN ACCOUNTS
  const accountsToCheck = [
    { address: merchantTokenAccount, owner: merchantPublicKey, name: 'Merchant' },
    { address: agentTokenAccount, owner: agentPublicKey, name: 'Agent' },
    { address: platformTokenAccount, owner: platformPublicKey, name: 'Platform' },
  ];

  for (const acc of accountsToCheck) {
    const accountInfo = await connection.getAccountInfo(acc.address);
    if (!accountInfo) {
      console.log(`⚠️  ${acc.name} token account doesn't exist, creating...`);
      const createIx = createAssociatedTokenAccountInstruction(
        payerPublicKey,
        acc.address,
        acc.owner,
        USDC_MINT_DEVNET
      );
      transaction.add(createIx);
    } else {
      console.log(`✅ ${acc.name} token account exists`);
    }
  }

  // Create program
  const dummyKeypair = Keypair.generate();
  const wallet = new Wallet(dummyKeypair);
  const provider = new AnchorProvider(connection, wallet, {});
  const program = new Program(idl, provider);

  // Build split payment instruction
  const splitIx = await program.methods
    .splitPayment(new BN(amount))
    .accounts({
      splitter: splitterPDA,
      payer: payerPublicKey,
      payerTokenAccount,
      merchantTokenAccount,
      agentTokenAccount,
      platformTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  transaction.add(splitIx);
  
  console.log('✅ Transaction built with', transaction.instructions.length, 'instructions');
  return transaction;
}

/**
 * Serialize transaction to base64 for client signing
 */
export function serializeTransaction(transaction: Transaction): string {
  return transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  }).toString('base64');
}

/**
 * Get expected split amounts
 */
export function calculateSplitAmounts(
  totalAmount: number,
  merchantShare: number,
  agentShare: number,
  platformShare: number
): {
  merchantAmount: number;
  agentAmount: number;
  platformAmount: number;
} {
  return {
    merchantAmount: Math.floor((totalAmount * merchantShare) / 100),
    agentAmount: Math.floor((totalAmount * agentShare) / 100),
    platformAmount: Math.floor((totalAmount * platformShare) / 100),
  };
}