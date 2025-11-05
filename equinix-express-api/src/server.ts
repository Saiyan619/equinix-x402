const express = require('express');
const cors = require('cors');
import { Connection, PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import { connectDB, Splitter, Payment, ApiUsage } from './database';


dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const connection = new Connection(
  process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'
);

const PROGRAM_ID = new PublicKey(
  process.env.PROGRAM_ID || 'YOUR_PROGRAM_ID_HERE'
);

const USDC_MINT_DEVNET = new PublicKey(
  'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr'
);

// Helper to derive PDA
function deriveSplitterPDA(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('splitter'), authority.toBuffer()],
    PROGRAM_ID
  );
}

// Verify transaction signature on Solana
async function verifyPaymentTransaction(signature: string): Promise<boolean> {
  try {
    const tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
    
    if (!tx || tx.meta?.err) {
      return false;
    }
    
    // Transaction exists and succeeded
    return true;
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return false;
  }
}

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/health', async (req, res) => {
  const dbStatus = await Splitter.countDocuments();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    network: process.env.SOLANA_RPC_URL || 'devnet',
    programId: PROGRAM_ID.toBase58(),
    database: {
      connected: true,
      splitters: dbStatus,
    },
  });
});

// Create splitter configuration
app.post('/api/splitter/create', async (req, res) => {
  try {
    const {
      merchant,
      agent,
      platform,
      merchantShare,
      agentShare,
      platformShare,
      authority,
    } = req.body;

    // Validate
    if (!merchant || !agent || !platform || !authority) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (merchantShare + agentShare + platformShare !== 100) {
      return res.status(400).json({ error: 'Shares must add up to 100' });
    }

    // Validate Solana addresses
    try {
      new PublicKey(merchant);
      new PublicKey(agent);
      new PublicKey(platform);
      new PublicKey(authority);
    } catch {
      return res.status(400).json({ error: 'Invalid Solana address' });
    }

    // Derive PDA
    const authorityPubkey = new PublicKey(authority);
    const [splitterPDA] = deriveSplitterPDA(authorityPubkey);

    // Check if already exists
    const existing = await Splitter.findOne({ splitterPDA: splitterPDA.toBase58() });
    if (existing) {
      return res.status(400).json({ 
        error: 'Splitter already exists for this authority',
        splitterPDA: splitterPDA.toBase58(),
      });
    }

    // Save to database
    const newSplitter = new Splitter({
      splitterPDA: splitterPDA.toBase58(),
      merchant,
      agent,
      platform,
      merchantShare,
      agentShare,
      platformShare,
      authority,
      isInitializedOnChain: false,
    });

    await newSplitter.save();

    console.log('✅ Splitter created:', splitterPDA.toBase58());

    res.json({
      success: true,
      splitterPDA: splitterPDA.toBase58(),
      config: newSplitter,
      message: 'Splitter configuration saved! Initialize on-chain to activate.',
    });
  } catch (error) {
    console.error('Error creating splitter:', error);
    res.status(500).json({ error: 'Failed to create splitter' });
  }
});

// Get splitter configuration
app.get('/api/splitter/:splitterPDA', async (req, res) => {
  try {
    const splitter = await Splitter.findOne({ splitterPDA: req.params.splitterPDA });
    
    if (!splitter) {
      return res.status(404).json({ error: 'Splitter not found' });
    }
    
    res.json(splitter);
  } catch (error) {
    console.error('Error fetching splitter:', error);
    res.status(500).json({ error: 'Failed to fetch splitter' });
  }
});

// List all splitters for an authority
app.get('/api/splitters/:authority', async (req, res) => {
  try {
    const splitters = await Splitter.find({ authority: req.params.authority })
      .sort({ createdAt: -1 });
    
    res.json(splitters);
  } catch (error) {
    console.error('Error fetching splitters:', error);
    res.status(500).json({ error: 'Failed to fetch splitters' });
  }
});

// List all splitters
app.get('/api/splitters', async (req, res) => {
  try {
    const splitters = await Splitter.find().sort({ createdAt: -1 }).limit(100);
    res.json(splitters);
  } catch (error) {
    console.error('Error fetching splitters:', error);
    res.status(500).json({ error: 'Failed to fetch splitters' });
  }
});

// Update splitter shares
app.post('/api/splitter/:splitterPDA/update', async (req, res) => {
  try {
    const { splitterPDA } = req.params;
    const { merchantShare, agentShare, platformShare } = req.body;

    if (merchantShare + agentShare + platformShare !== 100) {
      return res.status(400).json({ error: 'Shares must add up to 100' });
    }

    const splitter = await Splitter.findOneAndUpdate(
      { splitterPDA },
      { 
        merchantShare, 
        agentShare, 
        platformShare,
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (!splitter) {
      return res.status(404).json({ error: 'Splitter not found' });
    }

    res.json({
      success: true,
      message: 'Shares updated!',
      config: splitter,
    });
  } catch (error) {
    console.error('Error updating splitter:', error);
    res.status(500).json({ error: 'Failed to update splitter' });
  }
});

// Mark splitter as initialized on-chain
app.post('/api/splitter/:splitterPDA/initialize', async (req, res) => {
  try {
    const { signature } = req.body;
    
    if (!signature) {
      return res.status(400).json({ error: 'Transaction signature required' });
    }

    // Verify the transaction
    const isValid = await verifyPaymentTransaction(signature);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid or failed transaction' });
    }

    const splitter = await Splitter.findOneAndUpdate(
      { splitterPDA: req.params.splitterPDA },
      { 
        isInitializedOnChain: true,
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (!splitter) {
      return res.status(404).json({ error: 'Splitter not found' });
    }

    res.json({
      success: true,
      message: 'Splitter initialized on-chain!',
      signature,
    });
  } catch (error) {
    console.error('Error initializing splitter:', error);
    res.status(500).json({ error: 'Failed to initialize splitter' });
  }
});

// ============================================
// x402 PAYMENT ENDPOINT
// ============================================

app.post('/api/demo/get-data', async (req, res) => {
  try {
    const { splitterPDA } = req.body;
    const paymentSignature = req.headers['x-payment-signature'] as string;
    const payerAddress = req.headers['x-payer-address'] as string;

    if (!splitterPDA) {
      return res.status(400).json({ error: 'splitterPDA required' });
    }

    // Fetch splitter config
    const splitter = await Splitter.findOne({ splitterPDA });
    if (!splitter) {
      return res.status(404).json({ error: 'Splitter not found' });
    }

    // Check if splitter is initialized
    if (!splitter.isInitializedOnChain) {
      return res.status(400).json({ 
        error: 'Splitter not initialized on-chain',
        message: 'Please initialize the splitter using the Anchor program first',
      });
    }

    const paymentAmount = 1000000; // 0.001 USDC (6 decimals)

    // Calculate split amounts
    const merchantAmount = Math.floor((paymentAmount * splitter.merchantShare) / 100);
    const agentAmount = Math.floor((paymentAmount * splitter.agentShare) / 100);
    const platformAmount = Math.floor((paymentAmount * splitter.platformShare) / 100);

    // If no payment signature, return 402 Payment Required
    if (!paymentSignature) {
      return res.status(402).json({
        error: 'Payment Required',
        protocol: 'x402',
        splitterPDA,
        amount: paymentAmount,
        mint: USDC_MINT_DEVNET.toBase58(),
        programId: PROGRAM_ID.toBase58(),
        recipients: [
          {
            type: 'merchant',
            address: splitter.merchant,
            share: splitter.merchantShare,
            amount: merchantAmount,
          },
          {
            type: 'agent',
            address: splitter.agent,
            share: splitter.agentShare,
            amount: agentAmount,
          },
          {
            type: 'platform',
            address: splitter.platform,
            share: splitter.platformShare,
            amount: platformAmount,
          },
        ],
        instruction: {
          program: PROGRAM_ID.toBase58(),
          method: 'split_payment',
          accounts: {
            splitter: splitterPDA,
            payer: payerAddress || 'PAYER_ADDRESS',
            // Additional accounts needed for the instruction
          },
        },
        message: 'Payment required. Use x402 client to automatically handle payment.',
      });
    }

    // Verify payment signature
    console.log('🔍 Verifying payment signature:', paymentSignature);
    
    // Check if already processed
    const existingPayment = await Payment.findOne({ signature: paymentSignature });
    if (existingPayment) {
      if (existingPayment.status === 'confirmed') {
        // Payment already processed, return data
        await ApiUsage.create({
          splitterPDA,
          endpoint: '/api/demo/get-data',
          payer: payerAddress || existingPayment.payer,
          paymentSignature,
        });

        return res.json({
          success: true,
          cached: true,
          data: {
            message: 'Payment successful! Here is your data.',
            requestedAt: new Date().toISOString(),
            splitterUsed: splitterPDA,
            paymentSignature,
            splits: {
              merchant: `${splitter.merchantShare}% (${merchantAmount / 1_000_000} USDC) to ${splitter.merchant}`,
              agent: `${splitter.agentShare}% (${agentAmount / 1_000_000} USDC) to ${splitter.agent}`,
              platform: `${splitter.platformShare}% (${platformAmount / 1_000_000} USDC) to ${splitter.platform}`,
            },
            demoData: {
              result: 'This is the protected data you requested',
              items: ['Premium data 1', 'Premium data 2', 'Premium data 3'],
            },
          },
        });
      }
    }

    // Verify transaction on-chain
    const isValid = await verifyPaymentTransaction(paymentSignature);
    
    if (!isValid) {
      return res.status(402).json({
        error: 'Invalid payment',
        message: 'Payment transaction not found or failed on-chain',
      });
    }

    // Record payment
    const payment = new Payment({
      signature: paymentSignature,
      splitterPDA,
      payer: payerAddress || 'UNKNOWN',
      amount: paymentAmount,
      mint: USDC_MINT_DEVNET.toBase58(),
      merchantAmount,
      agentAmount,
      platformAmount,
      status: 'confirmed',
      apiEndpoint: '/api/demo/get-data',
    });

    await payment.save();

    // Record API usage
    await ApiUsage.create({
      splitterPDA,
      endpoint: '/api/demo/get-data',
      payer: payerAddress || 'UNKNOWN',
      paymentSignature,
    });

    console.log('✅ Payment verified and recorded:', paymentSignature);

    // Return the protected data
    res.json({
      success: true,
      data: {
        message: 'Payment successful! Here is your data.',
        requestedAt: new Date().toISOString(),
        splitterUsed: splitterPDA,
        paymentSignature,
        splits: {
          merchant: `${splitter.merchantShare}% (${merchantAmount / 1_000_000} USDC) to ${splitter.merchant}`,
          agent: `${splitter.agentShare}% (${agentAmount / 1_000_000} USDC) to ${splitter.agent}`,
          platform: `${splitter.platformShare}% (${platformAmount / 1_000_000} USDC) to ${splitter.platform}`,
        },
        demoData: {
          result: 'This is the protected data you requested',
          items: ['Premium data 1', 'Premium data 2', 'Premium data 3'],
          analytics: {
            totalRequests: await ApiUsage.countDocuments({ splitterPDA }),
            uniquePayers: (await ApiUsage.distinct('payer', { splitterPDA })).length,
          },
        },
      },
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Get payment history for a splitter
app.get('/api/splitter/:splitterPDA/payments', async (req, res) => {
  try {
    const payments = await Payment.find({ 
      splitterPDA: req.params.splitterPDA 
    })
      .sort({ createdAt: -1 })
      .limit(50);
    
    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
  try {
    const [totalSplitters, totalPayments, recentPayments] = await Promise.all([
      Splitter.countDocuments(),
      Payment.countDocuments({ status: 'confirmed' }),
      Payment.find({ status: 'confirmed' }).sort({ createdAt: -1 }).limit(10),
    ]);

    const uniqueMerchants = await Splitter.distinct('merchant');
    const uniqueAgents = await Splitter.distinct('agent');
    const uniquePlatforms = await Splitter.distinct('platform');

    // Calculate total volume
    const totalVolume = await Payment.aggregate([
      { $match: { status: 'confirmed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    res.json({
      totalSplitters,
      totalPayments,
      uniqueMerchants: uniqueMerchants.length,
      uniqueAgents: uniqueAgents.length,
      uniquePlatforms: uniquePlatforms.length,
      totalVolume: totalVolume[0]?.total || 0,
      recentPayments,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3001;

async function startServer() {
  // Connect to MongoDB
  await connectDB();

  app.listen(PORT, () => {
    console.log('');
    console.log('🚀 ================================');
    console.log('🚀 Payment Splitter API Server');
    console.log('🚀 ================================');
    console.log('');
    console.log(`📡 Server: http://localhost:${PORT}`);
    console.log(`🏥 Health: http://localhost:${PORT}/health`);
    console.log(`⚡ Network: ${process.env.SOLANA_RPC_URL || 'devnet'}`);
    console.log(`📝 Program: ${PROGRAM_ID.toBase58()}`);
    console.log(`💾 MongoDB: Connected`);
    console.log('');
    console.log('✅ Ready to accept requests!');
    console.log('');
  });
}

startServer().catch(console.error);