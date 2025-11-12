import { PublicKey } from '@solana/web3.js';
import { Splitter } from '../database';
import { CONFIG } from '../config/constants';

export class SplitterService {
  static validatePDA(authority: PublicKey, providedPDA: string): boolean {
    const [expectedPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('splitter'), authority.toBuffer()],
      CONFIG.PROGRAM_ID
    );
    return expectedPDA.toBase58() === providedPDA;
  }

  static async createSplitter(data: {
    splitterPDA: string;
    merchant: string;
    agent: string;
    platform: string;
    merchantShare: number;
    agentShare: number;
    platformShare: number;
    authority: string;
    initializationSignature: string;
  }) {
    const existing = await Splitter.findOne({ splitterPDA: data.splitterPDA });
    if (existing) {
      throw new Error('Splitter already exists');
    }

    const newSplitter = new Splitter({
      ...data,
      isInitializedOnChain: true,
    });

    await newSplitter.save();
    return newSplitter;
  }

  static async getSplitter(splitterPDA: string) {
    const splitter = await Splitter.findOne({ splitterPDA });
    if (!splitter) {
      throw new Error('Splitter not found');
    }
    return splitter;
  }

  static async getSplittersByAuthority(authority: string) {
    return Splitter.find({ authority }).sort({ createdAt: -1 });
  }
}