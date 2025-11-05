// examples/x402-client.ts
// Complete x402 client integration with payment splitter

import { 
  Keypair, 
  PublicKey, 
  VersionedTransaction, 
  Connection,
  Transaction,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { 
  getAssociatedTokenAddress, 
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
} from "@solana/spl-token";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config();

// Configuration
const API_URL = process.env.API_URL || "http://localhost:3001";
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID || "YOUR_PROGRAM_ID");
const USDC_MINT = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"); // Devnet USDC

// ============================================
// x402 Payment Handler
// ============================================

interface PaymentRequirement {
  error: string;
  protocol: string;
  splitterPDA: string;
  amount: number;
  mint: string;
  programId: string;
  recipients: Array<{
    type: string;
    address: string;
    share: number;
    amount: number;
  }>;
}

class X402PaymentClient {
  private connection: Connection;
  private payer: Keypair;

  constructor(connection: Connection, payer: Keypair) {
    this.connection = connection;
    this.payer = payer;
  }

  // Main fetch wrapper that handles 402 payments automatically
  async fetchWithPayment(url: string, options: RequestInit = {}): Promise<Response> {
    console.log(`\n🔄 Making request to: ${url}`);
    
    // First attempt without payment
    const response = await fetch(url, options);

    // If 402 Payment Required, handle payment automatically
    if (response.status === 402) {
      console.log('💳 Payment required! Processing...');
      
      const paymentReq: PaymentRequirement = await response.json();
      
      console.log(`💰 Amount: ${paymentReq.amount / 1_000_000} USDC`);
      console.log(`📊 Split:`);
      paymentReq.recipients.forEach(r => {
        console.log(`   - ${r.type}: ${r.share}% (${r.amount / 1_000_000} USDC)`);
      });

      // Build and send payment transaction
      const signature = await this.sendPaymentTransaction(paymentReq);
      
      console.log(`✅ Payment sent: ${signature}`);
      console.log(`🔗 View: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

      // Wait for confirmation
      await this.connection.confirmTransaction(signature, 'confirmed');
      console.log('✅ Payment confirmed!');

      // Retry request with payment proof
      console.log('🔄 Retrying request with payment proof...');
      
      const retryOptions = {
        ...options,
        headers: {
          ...options.headers,
          'x-payment-signature': signature,
          'x-payer-address': this.payer.publicKey.toBase58(),
        },
      };

      return fetch(url, retryOptions);
    }

    return response;
  }

  private async sendPaymentTransaction(paymentReq: PaymentRequirement): Promise<string> {
    const splitterPDA = new PublicKey(paymentReq.splitterPDA);
    const mint = new PublicKey(paymentReq.mint);

    // Get token accounts
    const payerTokenAccount = await getAssociatedTokenAddress(
      mint,
      this.payer.publicKey
    );

    const merchantTokenAccount = await getAssociatedTokenAddress(
      mint,
      new PublicKey(paymentReq.recipients[0].address)
    );

    const agentTokenAccount = await getAssociatedTokenAddress(
      mint,
      new PublicKey(paymentReq.recipients[1].address)
    );

    const platformTokenAccount = await getAssociatedTokenAddress(
      mint,
      new PublicKey(paymentReq.recipients[2].address)
    );

    // For demo purposes, we'll do direct transfers
    // In production, this would call the Anchor program's split_payment instruction
    const transaction = new Transaction();

    // Add transfers for each recipient
    for (const recipient of paymentReq.recipients) {
      const recipientTokenAccount = await getAssociatedTokenAddress(
        mint,
        new PublicKey(recipient.address)
      );

      transaction.add(
        createTransferInstruction(
          payerTokenAccount,
          recipientTokenAccount,
          this.payer.publicKey,
          recipient.amount,
          [],
          TOKEN_PROGRAM_ID
        )
      );
    }

    // Send transaction
    const signature = await this.connection.sendTransaction(
      transaction,
      [this.payer],
      { skipPreflight: false }
    );

    return signature;
  }
}

// ============================================
// Example Usage
// ============================================

async function main() {
  console.log('🚀 x402 Payment Splitter Client Example');
  console.log('==========================================\n');

  // Setup connection and wallet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Load your wallet (make sure you have devnet SOL and USDC!)
  let keypair: Keypair;
  
  try {
    const keypairData = JSON.parse(fs.readFileSync('./payer-wallet.json', 'utf-8'));
    keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  } catch {
    console.log('⚠️  No wallet found, generating new one...');
    keypair = Keypair.generate();
    console.log('📝 Save this keypair for future use:');
    console.log(JSON.stringify(Array.from(keypair.secretKey)));
    console.log('\n🪂 Airdrop some devnet SOL and USDC to:', keypair.publicKey.toBase58());
    console.log('   SOL: https://faucet.solana.com');
    console.log('   USDC: https://spl-token-faucet.com');
    return;
  }
  console.log(`💼 Payer: ${keypair.publicKey.toBase58()}\n`);

  // Create x402 client
  const client = new X402PaymentClient(connection, keypair);

  // Get your splitter PDA (you need to create one first via the frontend or API)
  const SPLITTER_PDA = process.env.SPLITTER_PDA || 'YOUR_SPLITTER_PDA_HERE';

  if (SPLITTER_PDA === 'YOUR_SPLITTER_PDA_HERE') {
    console.log('❌ Please set SPLITTER_PDA in .env or pass it as argument');
    console.log('   Create a splitter first using the frontend or API');
    return;
  }

  try {
    // Example 1: Simple API call with automatic payment
    console.log('📌 Example 1: Simple API Call\n');
    
    const response = await client.fetchWithPayment(`${API_URL}/api/demo/get-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ splitterPDA: SPLITTER_PDA }),
    });

    const data = await response.json();
    console.log('\n✅ Response:', JSON.stringify(data, null, 2));

    // Example 2: Multiple requests (payment is cached after first)
    console.log('\n\n📌 Example 2: Multiple Requests\n');
    
    const requests = [
      { query: 'data1' },
      { query: 'data2' },
      { query: 'data3' },
    ];

    for (const req of requests) {
      console.log(`\n🔹 Request: ${req.query}`);
      
      const res = await client.fetchWithPayment(`${API_URL}/api/demo/get-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          splitterPDA: SPLITTER_PDA,
          ...req 
        }),
      });

      const result = await res.json();
      console.log(`   ✅ Success: ${result.data?.message || 'OK'}`);
    }

    console.log('\n\n🎉 All done!');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

// ============================================
// AI Agent Integration Example
// ============================================

class AIAgentWithSplitPayment {
  private client: X402PaymentClient;
  private splitterPDA: string;

  constructor(client: X402PaymentClient, splitterPDA: string) {
    this.client = client;
    this.splitterPDA = splitterPDA;
  }

  async processUserQuery(query: string): Promise<any> {
    console.log(`\n🤖 AI Agent processing: "${query}"`);

    // Call multiple APIs, each with automatic payment splitting
    const results = await Promise.all([
      this.callAPI('data-service', { query }),
      this.callAPI('analytics-service', { query }),
      this.callAPI('recommendation-service', { query }),
    ]);

    console.log('✅ AI Agent completed processing');
    console.log('💰 Agent earned commission from all API calls!');

    return {
      query,
      data: results[0],
      analytics: results[1],
      recommendations: results[2],
    };
  }

  private async callAPI(service: string, params: any): Promise<any> {
    const response = await this.client.fetchWithPayment(
      `${API_URL}/api/demo/get-data`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          splitterPDA: this.splitterPDA,
          service,
          ...params,
        }),
      }
    );

    return response.json();
  }
}

async function aiAgentExample() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const keypairData = JSON.parse(fs.readFileSync('./payer-wallet.json', 'utf-8'));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  const client = new X402PaymentClient(connection, keypair);
  const agent = new AIAgentWithSplitPayment(client, 'YOUR_SPLITTER_PDA');

  const result = await agent.processUserQuery('Find me the best laptop under $1000');
  console.log('\n📊 Agent Result:', result);
}

// ============================================
// Run Examples
// ============================================

if (require.main === module) {
  main().catch(console.error);
  
  // Uncomment to run AI agent example
  // aiAgentExample().catch(console.error);
}