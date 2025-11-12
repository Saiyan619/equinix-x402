import { connection } from '../config/constants';

export class SolanaService {
  static async verifyTransaction(signature: string): Promise<boolean> {
    try {
      const tx = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      
      return !!(tx && !tx.meta?.err);
    } catch (error) {
      console.error('Error verifying transaction:', error);
      return false;
    }
  }
}