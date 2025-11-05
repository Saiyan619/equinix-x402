import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { DollarSign, Users, Zap, TrendingUp, Settings, Plus, Loader2 } from 'lucide-react';

const API_URL = 'http://localhost:3001';

interface SplitterConfig {
  splitterPDA: string;
  merchant: string;
  agent: string;
  platform: string;
  merchantShare: number;
  agentShare: number;
  platformShare: number;
  authority: string;
  createdAt: string;
}

export default function App() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  
  const [activeTab, setActiveTab] = useState('create');
  const [splitters, setSplitters] = useState<SplitterConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ totalSplitters: 0, uniqueMerchants: 0, uniqueAgents: 0 });

  const [formData, setFormData] = useState({
    merchant: '',
    agent: '',
    platform: '',
    merchantShare: 70,
    agentShare: 20,
    platformShare: 10,
  });

  useEffect(() => {
    loadStats();
    if (publicKey) {
      loadSplitters();
    }
  }, [publicKey]);

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/stats`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadSplitters = async () => {
    if (!publicKey) return;
    try {
      const response = await fetch(`${API_URL}/api/splitters/${publicKey.toBase58()}`);
      const data = await response.json();
      setSplitters(data);
    } catch (error) {
      console.error('Error loading splitters:', error);
    }
  };

  const handleCreateSplitter = async () => {
    if (!publicKey) {
      alert('Please connect your wallet first!');
      return;
    }

    const total = formData.merchantShare + formData.agentShare + formData.platformShare;
    if (total !== 100) {
      alert(`Shares must equal 100%! Current total: ${total}%`);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/splitter/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          authority: publicKey.toBase58(),
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        alert(`✅ Splitter created!\n\nPDA: ${data.splitterPDA}\n\nNow initialize it on-chain using Anchor!`);
        await loadSplitters();
        await loadStats();
        
        // Reset form
        setFormData({
          merchant: '',
          agent: '',
          platform: '',
          merchantShare: 70,
          agentShare: 20,
          platformShare: 10,
        });
      } else {
        alert('Failed to create splitter: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating splitter:', error);
      alert('Failed to create splitter. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleTestPayment = async (splitterPDA: string) => {
    if (!publicKey) {
      alert('Please connect your wallet first!');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/demo/get-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ splitterPDA }),
      });

      const data = await response.json();

      if (response.status === 402) {
        // Payment required
        const msg = `💳 Payment Required!\n\n` +
          `Amount: ${data.amount / 1_000_000} USDC\n\n` +
          `Split Distribution:\n` +
          `• Merchant: ${data.recipients[0].share}% (${data.recipients[0].amount / 1_000_000} USDC)\n` +
          `• Agent: ${data.recipients[1].share}% (${data.recipients[1].amount / 1_000_000} USDC)\n` +
          `• Platform: ${data.recipients[2].share}% (${data.recipients[2].amount / 1_000_000} USDC)\n\n` +
          `In production, this would automatically:\n` +
          `1. Build split payment transaction\n` +
          `2. Request your signature\n` +
          `3. Submit to Solana\n` +
          `4. Retry API call with proof`;
        
        alert(msg);
      } else if (data.success) {
        alert('✅ Payment successful!\n\n' + data.data.message);
      }
    } catch (error) {
      console.error('Error testing payment:', error);
      alert('Failed to test payment. Check console.');
    } finally {
      setLoading(false);
    }
  };

  const totalShares = formData.merchantShare + formData.agentShare + formData.platformShare;
  const sharesValid = totalShares === 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <nav className="bg-black/30 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-purple-500 to-blue-500 p-2 rounded-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">SplitPay</h1>
              <p className="text-xs text-purple-300">x402 Payment Splitter</p>
            </div>
          </div>
          <WalletMultiButton />
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex items-center gap-4">
              <div className="bg-green-500/20 p-3 rounded-xl">
                <DollarSign className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-gray-300 text-sm">Total Splitters</p>
                <p className="text-2xl font-bold text-white">{stats.totalSplitters}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex items-center gap-4">
              <div className="bg-blue-500/20 p-3 rounded-xl">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-gray-300 text-sm">Active Merchants</p>
                <p className="text-2xl font-bold text-white">{stats.uniqueMerchants}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex items-center gap-4">
              <div className="bg-purple-500/20 p-3 rounded-xl">
                <TrendingUp className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-gray-300 text-sm">Agents Enrolled</p>
                <p className="text-2xl font-bold text-white">{stats.uniqueAgents}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'create'
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            <Plus className="w-4 h-4" />
            Create Splitter
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'manage'
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            <Settings className="w-4 h-4" />
            Manage Splitters
          </button>
        </div>

        {activeTab === 'create' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6">Create New Payment Splitter</h2>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Merchant Wallet
                  </label>
                  <input
                    type="text"
                    value={formData.merchant}
                    onChange={(e) => setFormData({...formData, merchant: e.target.value})}
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Merchant address..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Agent Wallet
                  </label>
                  <input
                    type="text"
                    value={formData.agent}
                    onChange={(e) => setFormData({...formData, agent: e.target.value})}
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Agent address..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Platform Wallet
                  </label>
                  <input
                    type="text"
                    value={formData.platform}
                    onChange={(e) => setFormData({...formData, platform: e.target.value})}
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Platform address..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Merchant Share (%)
                  </label>
                  <input
                    type="number"
                    value={formData.merchantShare}
                    onChange={(e) => setFormData({...formData, merchantShare: parseInt(e.target.value) || 0})}
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    min="0"
                    max="100"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Agent Share (%)
                  </label>
                  <input
                    type="number"
                    value={formData.agentShare}
                    onChange={(e) => setFormData({...formData, agentShare: parseInt(e.target.value) || 0})}
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    min="0"
                    max="100"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Platform Share (%)
                  </label>
                  <input
                    type="number"
                    value={formData.platformShare}
                    onChange={(e) => setFormData({...formData, platformShare: parseInt(e.target.value) || 0})}
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    min="0"
                    max="100"
                  />
                </div>
              </div>

              <div className={`${sharesValid ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'} border rounded-xl p-4`}>
                <p className={`text-sm ${sharesValid ? 'text-green-300' : 'text-red-300'}`}>
                  Total: {totalShares}%
                  {!sharesValid && <span className="ml-2">⚠️ Must equal 100%</span>}
                  {sharesValid && <span className="ml-2">✅ Valid</span>}
                </p>
              </div>

              <button
                onClick={handleCreateSplitter}
                disabled={loading || !publicKey || !sharesValid}
                className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Splitter'
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'manage' && (
          <div className="space-y-6">
            {splitters.length === 0 ? (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 border border-white/20 text-center">
                <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-300 text-lg">No splitters created yet</p>
                <p className="text-gray-500 text-sm mt-2">Create your first payment splitter to get started</p>
              </div>
            ) : (
              splitters.map((splitter, idx) => (
                <div key={idx} className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">Splitter #{idx + 1}</h3>
                      <p className="text-sm text-gray-400 font-mono break-all">{splitter.splitterPDA}</p>
                      <p className="text-xs text-gray-500 mt-1">Created: {new Date(splitter.createdAt).toLocaleString()}</p>
                    </div>
                    <button
                      onClick={() => handleTestPayment(splitter.splitterPDA)}
                      disabled={loading}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Test Payment
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white/5 rounded-lg p-4">
                      <p className="text-xs text-gray-400 mb-1">Merchant</p>
                      <p className="text-lg font-bold text-green-400">{splitter.merchantShare}%</p>
                      <p className="text-xs text-gray-500 mt-1 truncate">{splitter.merchant}</p>
                    </div>
                    
                    <div className="bg-white/5 rounded-lg p-4">
                      <p className="text-xs text-gray-400 mb-1">Agent</p>
                      <p className="text-lg font-bold text-blue-400">{splitter.agentShare}%</p>
                      <p className="text-xs text-gray-500 mt-1 truncate">{splitter.agent}</p>
                    </div>
                    
                    <div className="bg-white/5 rounded-lg p-4">
                      <p className="text-xs text-gray-400 mb-1">Platform</p>
                      <p className="text-lg font-bold text-purple-400">{splitter.platformShare}%</p>
                      <p className="text-xs text-gray-500 mt-1 truncate">{splitter.platform}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}