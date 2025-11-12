import express from 'express';
import cors from 'cors';
import { connectDB, Splitter } from './database';
import { CONFIG } from './config/constants';
import splitterRoutes from './routes/splitter.routes';
import paymentRoutes from './routes/payment.routes';

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
  const dbStatus = await Splitter.countDocuments();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    network: CONFIG.SOLANA_RPC_URL,
    programId: CONFIG.PROGRAM_ID.toBase58(),
    database: { connected: true, splitters: dbStatus },
    x402: { enabled: true, facilitator: CONFIG.FACILITATOR_URL },
  });
});

// Routes
app.use('/api', splitterRoutes);
app.use('/api', paymentRoutes);

// Start server
async function startServer() {
  await connectDB();
  app.listen(CONFIG.PORT, () => {
    console.log(`Server: http://localhost:${CONFIG.PORT}`);
    console.log(`Ready!`);
  });
}

startServer().catch(console.error);