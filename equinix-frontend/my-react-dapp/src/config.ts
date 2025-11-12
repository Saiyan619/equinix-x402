import { PublicKey } from '@solana/web3.js';

export const API_URL = 'http://localhost:3001';
export const PROGRAM_ID = new PublicKey('8My2SGb47iBJW6D5dkCmfXoRU4cjg1p77aiuHDmwakJo');

export const INITIAL_FORM = {
  merchant: '',
  agent: '',
  platform: '',
  merchantShare: 70,
  agentShare: 20,
  platformShare: 10,
};