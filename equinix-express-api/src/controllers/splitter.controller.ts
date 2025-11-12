import { Request, Response } from 'express';
import { PublicKey } from '@solana/web3.js';
import { SplitterService } from '../services/splitter.service';

export class SplitterController {
  static async create(req: Request, res: Response) {
    try {
      const {
        merchant, agent, platform,
        merchantShare, agentShare, platformShare,
        authority, splitterPDA, initializationSignature
      } = req.body;

      // Validate shares
      if (merchantShare + agentShare + platformShare !== 100) {
        return res.status(400).json({ error: 'Shares must add up to 100' });
      }

      // Validate addresses
      try {
        new PublicKey(merchant);
        new PublicKey(agent);
        new PublicKey(platform);
        new PublicKey(authority);
        new PublicKey(splitterPDA);
      } catch {
        return res.status(400).json({ error: 'Invalid Solana address' });
      }

      // Verify PDA
      const authorityPubkey = new PublicKey(authority);
      if (!SplitterService.validatePDA(authorityPubkey, splitterPDA)) {
        return res.status(400).json({ error: 'Invalid PDA' });
      }

      const splitter = await SplitterService.createSplitter({
        splitterPDA, merchant, agent, platform,
        merchantShare, agentShare, platformShare,
        authority, initializationSignature
      });

      res.json({
        success: true,
        splitterPDA,
        config: splitter,
        message: 'Splitter created successfully!',
      });
    } catch (error: any) {
      console.error('Error:', error.message);
      res.status(500).json({ error: error.message || 'Failed to create splitter' });
    }
  }

  static async getOne(req: Request, res: Response) {
    try {
      const splitter = await SplitterService.getSplitter(req.params.splitterPDA);
      res.json(splitter);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }

  static async getByAuthority(req: Request, res: Response) {
    try {
      const splitters = await SplitterService.getSplittersByAuthority(req.params.authority);
      res.json(splitters);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch splitters' });
    }
  }
}