import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { SplitterService, type SplitterFormData } from '../services/splitter.service';
import { INITIAL_FORM } from '../config';

export function useSplitter() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<SplitterFormData>(INITIAL_FORM);

  const handleCreateSplitter = async () => {
    if (!publicKey || !signTransaction) {
      alert('Please connect your wallet first!');
      return;
    }

    // Validate
    const sharesError = SplitterService.validateShares(formData);
    if (sharesError) {
      alert(sharesError);
      return;
    }

    const addressError = SplitterService.validateAddresses(formData);
    if (addressError) {
      alert(addressError);
      return;
    }

    setLoading(true);

    try {
      // Step 1: Initialize on-chain
      const { signature, splitterPDA } = await SplitterService.initializeOnChain(
        connection,
        publicKey,
        signTransaction,
        formData
      );

      // Step 2: Save to database
      await SplitterService.saveToDatabase(
        formData,
        publicKey.toBase58(),
        splitterPDA,
        signature
      );

      alert(
        `Success!\n\n` +
        `Splitter PDA: ${splitterPDA}\n\n` +
        `Transaction: ${signature}\n\n` +
        `You can now use this for payments!`
      );

      setFormData(INITIAL_FORM);
    } catch (error: any) {
      console.error('Error:', error);
      alert(`Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return {
    formData,
    setFormData,
    loading,
    handleCreateSplitter,
    isConnected: !!publicKey,
  };
}