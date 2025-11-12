import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import idl from '../idl/equinix_contract.json';
import { API_URL } from '../config';

export interface SplitterFormData {
  merchant: string;
  agent: string;
  platform: string;
  merchantShare: number;
  agentShare: number;
  platformShare: number;
}

export class SplitterService {
  // Initialize on-chain
  static async initializeOnChain(
    connection: Connection,
    publicKey: PublicKey,
    signTransaction: any,
    formData: SplitterFormData
  ) {
    const provider = new AnchorProvider(
      connection,
      { publicKey, signTransaction, signAllTransactions: async (txs) => Promise.all(txs.map(tx => signTransaction(tx))) },
      { commitment: 'confirmed' }
    );

    const program = new Program(idl, provider);

    // Derive PDA
    const [splitterPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('splitter'), publicKey.toBuffer()],
      program.programId
    );

    console.log('🔨 Initializing splitter on-chain...');

    // Build transaction
    const tx = await program.methods
      .initializeSplitter(
        formData.merchantShare,
        formData.agentShare,
        formData.platformShare
      )
      .accounts({
        splitter: splitterPDA,
        authority: publicKey,
        merchant: new PublicKey(formData.merchant),
        agent: new PublicKey(formData.agent),
        platform: new PublicKey(formData.platform),
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    tx.feePayer = publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;

    // Sign and send
    const signedTx = await signTransaction(tx);
    const signature = await connection.sendRawTransaction(signedTx.serialize());

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    if (confirmation.value.err) {
      throw new Error('Transaction failed');
    }

    console.log('On-chain initialization complete');

    return { signature, splitterPDA: splitterPDA.toBase58() };
  }

  // Save to database
  static async saveToDatabase(
    formData: SplitterFormData,
    authority: string,
    splitterPDA: string,
    signature: string
  ) {
    console.log('💾 Saving to database...');

    const response = await fetch(`${API_URL}/api/splitter/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        authority,
        splitterPDA,
        initializationSignature: signature,
      }),
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to save to database');
    }

    console.log('Saved to database');
    return result;
  }

  // Validation helpers
  static validateShares(formData: SplitterFormData): string | null {
    const total = formData.merchantShare + formData.agentShare + formData.platformShare;
    if (total !== 100) return `Shares must equal 100%! Current: ${total}%`;
    return null;
  }

  static validateAddresses(formData: SplitterFormData): string | null {
    try {
      new PublicKey(formData.merchant);
      new PublicKey(formData.agent);
      new PublicKey(formData.platform);
      return null;
    } catch {
      return 'Invalid Solana address format!';
    }
  }
}