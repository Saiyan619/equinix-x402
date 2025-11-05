import mongoose from 'mongoose';

// Splitter Schema
const splitterSchema = new mongoose.Schema({
  splitterPDA: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  merchant: {
    type: String,
    required: true,
  },
  agent: {
    type: String,
    required: true,
  },
  platform: {
    type: String,
    required: true,
  },
  merchantShare: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  agentShare: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  platformShare: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  authority: {
    type: String,
    required: true,
    index: true,
  },
  isInitializedOnChain: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Payment Transaction Schema
const paymentSchema = new mongoose.Schema({
  signature: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  splitterPDA: {
    type: String,
    required: true,
    index: true,
  },
  payer: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  mint: {
    type: String,
    required: true,
  },
  merchantAmount: {
    type: Number,
    required: true,
  },
  agentAmount: {
    type: Number,
    required: true,
  },
  platformAmount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed'],
    default: 'pending',
  },
  apiEndpoint: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// API Usage Stats Schema
const apiUsageSchema = new mongoose.Schema({
  splitterPDA: {
    type: String,
    required: true,
    index: true,
  },
  endpoint: {
    type: String,
    required: true,
  },
  payer: {
    type: String,
    required: true,
  },
  paymentSignature: {
    type: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

export const Splitter = mongoose.model('Splitter', splitterSchema);
export const Payment = mongoose.model('Payment', paymentSchema);
export const ApiUsage = mongoose.model('ApiUsage', apiUsageSchema);

// Connect to MongoDB
export async function connectDB() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/payment-splitter';
    
    await mongoose.connect(mongoURI);
    
    console.log('✅ MongoDB connected successfully');
    console.log(`📊 Database: ${mongoose.connection.name}`);
    
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});