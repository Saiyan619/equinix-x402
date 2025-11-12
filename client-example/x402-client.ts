
import { Connection, Keypair, PublicKey, Transaction, clusterApiUrl } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const API_URL = process.env.API_URL;

function loadWallet(filepath: string): Keypair {
  const keypairData = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  return Keypair.fromSecretKey(Uint8Array.from(keypairData));
}

async function main() {
  console.log('Payment Splitter Client with Anchor Integration');
  console.log('===================================================\n');

  const walletPath = process.env.WALLET_PATH || './payer-wallet.json';
  let keypair: Keypair;
  
  try {
    keypair = loadWallet(walletPath);
  } catch {
    console.log('No wallet found. Creating new one...');
    keypair = Keypair.generate();
    fs.writeFileSync(walletPath, JSON.stringify(Array.from(keypair.secretKey)));
    console.log(`Wallet saved to: ${walletPath}`);
    console.log(`Airdrop devnet SOL to: ${keypair.publicKey.toBase58()}`);
    return;
  }

  console.log(`Wallet: ${keypair.publicKey.toBase58()}\n`);

  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  const splitterPDA = process.env.SPLITTER_PDA;
  
  if (!splitterPDA) {
    console.log('Please set SPLITTER_PDA in .env');
    return;
  }

  console.log(`Using splitter: ${splitterPDA}\n`);

  try {
    console.log('Step 1: Calling API (will require payment)...\n');
    
    // First call - will get 402
    const initialResponse = await fetch(`${API_URL}/api/demo/get-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ splitterPDA }),
    });

    // client-example/x402-client.ts - LINE ~55-75

if (initialResponse.status === 402) {
  console.log('Payment required (402 response)');
  
  const paymentReq = await initialResponse.json();
  
  console.log('\nRaw 402 Response:');
  console.log(JSON.stringify(paymentReq, null, 2));

  const methods = paymentReq.accepts || paymentReq.methods || [];
  
  if (!methods || methods.length === 0) {
    console.log('Could not find payment methods');
    console.log('Available keys:', Object.keys(paymentReq));
    throw new Error('No payment methods in 402 response');
  }

  const method = methods[0];
  const amount = parseInt(method.maxAmountRequired || '0');
  const recipient = method.payTo;
  const asset = method.asset;

  console.log('\nPayment Details:');
  console.log(`Amount: ${amount / 1_000_000} USDC`);
  console.log(`Token: ${asset}`);
  console.log(`Recipient (Splitter PDA): ${recipient}`);
  console.log(`Network: ${method.network}`);

  // Verify it's the correct splitter PDA
  if (recipient !== splitterPDA) {
    console.log(`\n WARNING: Recipient mismatch!`);
    console.log(`   Expected: ${splitterPDA}`);
    console.log(`   Got: ${recipient}`);
  } else {
    console.log(`\nPayment recipient matches splitter PDA`);
  }

  // Get splitter info from your backend
  console.log('\n🔍 Fetching splitter configuration...');
  const splitterResponse = await fetch(`${API_URL}/api/splitter/${splitterPDA}`);
  
  if (!splitterResponse.ok) {
    throw new Error(`Failed to fetch splitter config: ${splitterResponse.status}`);
  }
  
  const splitterConfig = await splitterResponse.json();

  console.log('\nSplit Configuration:');
  console.log(` Merchant: ${splitterConfig.merchantShare}% → ${splitterConfig.merchant}`);
  console.log(` Agent: ${splitterConfig.agentShare}% → ${splitterConfig.agent}`);
  console.log(` Platform: ${splitterConfig.platformShare}% → ${splitterConfig.platform}`);

  console.log('\nStep 2: Building split transaction...\n');
  
  // Get the split transaction from your backend
  const txResponse = await fetch(`${API_URL}/api/payment/build-split-tx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      splitterPDA,
      payerAddress: keypair.publicKey.toBase58(),
      amount: amount,
    }),
  });

  if (!txResponse.ok) {
    const errorText = await txResponse.text();
    throw new Error(`Failed to build transaction: ${txResponse.status} - ${errorText}`);
  }

  const txData = await txResponse.json();
  
  if (!txData.success) {
    throw new Error(`Failed to build transaction: ${txData.error}`);
  }

  console.log('Transaction received from backend');
  console.log('\nCalculated split amounts:');
  console.log(` Merchant: ${txData.splits.merchant.amount / 1_000_000} USDC (${txData.splits.merchant.percentage}%)`);
  console.log(` Agent: ${txData.splits.agent.amount / 1_000_000} USDC (${txData.splits.agent.percentage}%)`);
  console.log(` Platform: ${txData.splits.platform.amount / 1_000_000} USDC (${txData.splits.platform.percentage}%)`);

  // Deserialize and sign transaction
  console.log('\nStep 3: Signing transaction...');
  const transaction = Transaction.from(Buffer.from(txData.transaction, 'base64'));
  transaction.partialSign(keypair);

  console.log('Step 4: Sending transaction to Solana...');
  const signature = await connection.sendRawTransaction(
    transaction.serialize()
  );

  console.log(`\nTransaction sent: ${signature}`);
  console.log(`Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

  console.log('\nStep 5: Waiting for confirmation...');
  await connection.confirmTransaction(signature, 'confirmed');
  console.log('Transaction confirmed! Funds split on-chain!\n');

  console.log('Step 6: Retrying API with payment proof...\n');
  
  // Retry with payment signature
  const finalResponse = await fetch(`${API_URL}/api/demo/get-data`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-payment-signature': signature,
      'x-payer-address': keypair.publicKey.toBase58(),
    },
    body: JSON.stringify({ splitterPDA }),
  });

  if (!finalResponse.ok) {
    const errorText = await finalResponse.text();
    throw new Error(`API call failed: ${finalResponse.status} - ${errorText}`);
  }

  const data = await finalResponse.json();
  
  console.log('Response received:');
  console.log(JSON.stringify(data, null, 2));
  
  console.log('\n🎉 Complete! Payment split successfully using Faremeter x402!');
  console.log('✨ All recipients received their shares on-chain!');
}else {
      console.log(`❌ Unexpected response status: ${initialResponse.status}`);
      const text = await initialResponse.text();
      console.log('Response:', text);
    }
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export default main;