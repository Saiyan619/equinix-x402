import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useSplitter } from './hooks/useSplitter';

export default function App() {
  const { formData, setFormData, loading, handleCreateSplitter, isConnected } = useSplitter();

  const totalShares = formData.merchantShare + formData.agentShare + formData.platformShare;
  const isValid = totalShares === 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
      {/* Wallet Button */}
      <div className="fixed flex justify-between items-center w-full top-6 right-6">
        <span className='ml-10 text-white font-bold text-2xl'>Equinix</span>
        <WalletMultiButton />
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto mt-20 bg-white/10 backdrop-blur-lg rounded-2xl p-8">
        <h2 className="text-2xl font-bold text-white mb-6">
          Create New Payment Splitter
        </h2>

        <div className="space-y-6">
          {/* Merchant */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Merchant Wallet
            </label>
            <input
              type="text"
              value={formData.merchant}
              onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white"
              placeholder="Merchant Solana address..."
            />
          </div>

          {/* Agent */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Agent Wallet
            </label>
            <input
              type="text"
              value={formData.agent}
              onChange={(e) => setFormData({ ...formData, agent: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white"
              placeholder="Agent Solana address..."
            />
          </div>

          {/* Platform */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Platform Wallet
            </label>
            <input
              type="text"
              value={formData.platform}
              onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white"
              placeholder="Platform Solana address..."
            />
          </div>

          {/* Shares */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Merchant %
              </label>
              <input
                type="number"
                value={formData.merchantShare}
                onChange={(e) => setFormData({ ...formData, merchantShare: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white"
                min="0"
                max="100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Agent %
              </label>
              <input
                type="number"
                value={formData.agentShare}
                onChange={(e) => setFormData({ ...formData, agentShare: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white"
                min="0"
                max="100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Platform %
              </label>
              <input
                type="number"
                value={formData.platformShare}
                onChange={(e) => setFormData({ ...formData, platformShare: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white"
                min="0"
                max="100"
              />
            </div>
          </div>

          {/* Validation */}
          <div className={`${isValid ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'} border rounded-xl p-4`}>
            <p className="text-sm text-white">
              Total: {totalShares}%
              {isValid ? <span className="ml-2">✅ Valid</span> : <span className="ml-2">⚠️ Must equal 100%</span>}
            </p>
          </div>

          {/* Submit */}
          <button
            onClick={handleCreateSplitter}
            disabled={loading || !isConnected}
            className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create & Initialize Splitter'}
          </button>

          {/* Info */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <p className="text-sm text-blue-300">
              ℹ️ This will:
              <br />1. Initialize splitter on Solana
              <br />2. Save configuration to database
              <br />3. Require wallet signature
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}