'use client';

import { useState, useEffect } from 'react';
import { formatEther, parseEther } from 'viem';
import { Level2Wallet } from '../lib/wallet/Level2Wallet';
import { createPasskey } from '../lib/wallet/passkey';
import { DebugPanel } from '../components/DebugPanel';

export default function Level2Page() {
  const [wallet] = useState(() => new Level2Wallet());
  
  // Passkey state
  const [hasPasskey, setHasPasskey] = useState(false);
  const [credentialId, setCredentialId] = useState<string>('');
  const [publicKeyX, setPublicKeyX] = useState<bigint | null>(null);
  const [publicKeyY, setPublicKeyY] = useState<bigint | null>(null);
  const [username, setUsername] = useState('');

  const [debugData, setDebugData] = useState<any>({});
  
  // Account state
  const [accountAddress, setAccountAddress] = useState<string>('');
  const [isDeployed, setIsDeployed] = useState(false);
  const [balance, setBalance] = useState<string>('0');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState('');
  
  // Transaction state
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  
  // Transaction history
  const [transactions, setTransactions] = useState<Array<{
    hash: string;
    to: string;
    value: string;
    status: 'pending' | 'success' | 'failed';
    timestamp: number;
  }>>([]);

  // Load saved passkey from localStorage
  useEffect(() => {
    const savedCredentialId = localStorage.getItem('level2_credential_id');
    const savedPublicKeyX = localStorage.getItem('level2_public_key_x');
    const savedPublicKeyY = localStorage.getItem('level2_public_key_y');
    
    if (savedCredentialId && savedPublicKeyX && savedPublicKeyY) {
      setCredentialId(savedCredentialId);
      setPublicKeyX(BigInt(savedPublicKeyX));
      setPublicKeyY(BigInt(savedPublicKeyY));
      setHasPasskey(true);
    }
  }, []);

  // Load account info when passkey exists
  useEffect(() => {
    if (publicKeyX && publicKeyY) {
      loadAccountInfo();
    }
  }, [publicKeyX, publicKeyY]);

  const loadAccountInfo = async () => {
    if (!publicKeyX || !publicKeyY) return;

    setLoading(true);
    setError('');

    try {
      const addr = await wallet.getAccountAddress(publicKeyX, publicKeyY);
      setAccountAddress(addr);

      const deployed = await wallet.isDeployed(addr);
      setIsDeployed(deployed);

      const bal = await wallet.getBalance(addr);
      setBalance(formatEther(bal));

      console.log('Account info loaded:', { addr, deployed, balance: formatEther(bal) });
    } catch (err: any) {
      console.error('Error loading account info:', err);
      setError('Failed to load account info: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePasskey = async () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    setCreating(true);
    setError('');

    try {
      console.log('Creating passkey...');
      const credential = await createPasskey(username);
      
      console.log('Passkey created!');
      console.log('Credential ID:', credential.id);
      console.log('Public Key X:', credential.publicKeyX.toString(16));
      console.log('Public Key Y:', credential.publicKeyY.toString(16));

      const addr = await wallet.getAccountAddress(
        credential.publicKeyX,
        credential.publicKeyY
      );
      console.log("Calculated address:", addr);
    

      // Save to state
      setCredentialId(credential.id);
      setPublicKeyX(credential.publicKeyX);
      setPublicKeyY(credential.publicKeyY);
      setHasPasskey(true);

      // Save to localStorage
      localStorage.setItem('level2_credential_id', credential.id);
      localStorage.setItem('level2_public_key_x', credential.publicKeyX.toString());
      localStorage.setItem('level2_public_key_y', credential.publicKeyY.toString());

      console.log('✅ Passkey saved!');
    } catch (err: any) {
      console.error('Failed to create passkey:', err);
      setError('Failed to create passkey: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleSendTransaction = async () => {
    if (!recipient || !amount) {
      setError('Please fill in all fields');
      return;
    }
  
    if (!credentialId || !publicKeyX || !publicKeyY) {
      setError('No passkey found');
      return;
    }
    
    setDebugData({}); // Clear previous debug data
    setSending(true);
    setError('');
  
    const txId = Date.now().toString();
    const newTx = {
      hash: txId,
      to: recipient,
      value: amount,
      status: 'pending' as const,
      timestamp: Date.now(),
    };
    
    setTransactions(prev => [newTx, ...prev]);
  
    try {
      console.log('Sending transaction...');
      console.log('To:', recipient);
      console.log('Amount:', amount, 'ETH');
  
      const valueInWei = parseEther(amount);
  
      // Add debug callback here
      const userOpHash = await wallet.sendUserOp(
        accountAddress as `0x${string}`,
        credentialId,
        publicKeyX,
        publicKeyY,
        recipient as `0x${string}`,
        valueInWei,
        // Debug callback - capture WebAuthn data
        (debugInfo) => {
          console.log('📊 Debug data captured:', debugInfo);
          setDebugData(debugInfo);
        }
      );
  
      console.log('✅ Transaction sent!');
      console.log('UserOp Hash:', userOpHash);
  
      // Update transaction status
      setTransactions(prev =>
        prev.map(tx =>
          tx.hash === txId
            ? { ...tx, hash: userOpHash, status: 'success' as const }
            : tx
        )
      );
  
      // Clear form
      setRecipient('');
      setAmount('');
  
      // Refresh balance after a few seconds
      setTimeout(() => {
        loadAccountInfo();
      }, 3000);
  
    } catch (err: any) {
      console.error('Transaction failed:', err);
      setError('Transaction failed: ' + err.message);
      
      // Update transaction status
      setTransactions(prev =>
        prev.map(tx =>
          tx.hash === txId
            ? { ...tx, status: 'failed' as const }
            : tx
        )
      );
    } finally {
      setSending(false);
    }
  };

  const handleResetPasskey = () => {
    if (confirm('Are you sure? This will delete your passkey from this browser.')) {
      localStorage.removeItem('level2_credential_id');
      localStorage.removeItem('level2_public_key_x');
      localStorage.removeItem('level2_public_key_y');
      
      setHasPasskey(false);
      setCredentialId('');
      setPublicKeyX(null);
      setPublicKeyY(null);
      setAccountAddress('');
      setIsDeployed(false);
      setBalance('0');
      setTransactions([]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Level 2: Passkey Wallet
          </h1>
          <p className="text-black">
            Signing transactions with apple Touch ID
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Create Passkey Section */}
        {!hasPasskey && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4 text-black">Create Your Passkey</h2>
            <p className="text-black mb-4">
                Passkey is stored securely in your device's Secure Enclave.
              
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-black mb-2">
                  Username for passkey
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter a username"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                />
              </div>

              <button
                onClick={handleCreatePasskey}
                disabled={creating || !username.trim()}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creating ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Creating Passkey...
                  </>
                ) : (
                  <>Create Passkey with Touch ID</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Account Info Section */}
        {hasPasskey && (
          <>
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-black">Your Account</h2>
                <button
                  onClick={handleResetPasskey}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Reset Passkey
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-black mb-1">Account Address</p>
                    <p className="font-mono text-sm bg-gray-50 p-3 rounded break-all text-black">
                      {accountAddress}
                    </p>
                    <p className="text-sm text-black mb-1">Passkey Info: </p>
                    <p className="font-mono text-sm bg-gray-50 p-3 rounded break-all text-black">
                      ID: {localStorage.getItem("level2_credential_id")}
                      </p>
                      <p className="font-mono text-sm bg-gray-50 p-3 rounded break-all text-black">
                      Pub_key_X: {localStorage.getItem("level2_public_key_x")}
                      </p>
                      <p className="font-mono text-sm bg-gray-50 p-3 rounded break-all text-black">
                      Pub_key_Y: {localStorage.getItem("level2_public_key_y")}
                      
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-black mb-1">Status</p>
                      <p className="font-semibold">
                        {isDeployed ? (
                          <span className="text-green-600">✅ Deployed</span>
                        ) : (
                          <span className="text-yellow-600">Not Deployed Yet</span>
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-black mb-1">Balance</p>
                      <p className="font-semibold text-lg text-black">{balance} ETH</p>
                    </div>
                  </div>

                  <button
                    onClick={loadAccountInfo}
                    disabled={loading}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Refresh
                  </button>
                </div>
              )}
            </div>
            <DebugPanel data={debugData} />

            {/* Send Transaction Section */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-2xl font-bold mb-4 text-black">Send Transaction</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Recipient Address
                  </label>
                  <input
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm text-black"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Amount (ETH)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.001"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                    />
                    <button
                      onClick={() => setAmount((parseFloat(balance) * 0.9).toString())}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                    >
                      Max
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleSendTransaction}
                  disabled={sending || !recipient || !amount || parseFloat(balance) === 0}
                  className="w-full bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {sending ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Signing with Touch ID...
                    </>
                  ) : (
                    <>Sign with Touch ID</>
                  )}
                </button>

                {!isDeployed && (
                  <p className="text-sm text-blue-600 bg-blue-50 p-3 rounded text-blac">
                    First transaction will deploy the account automatically
                  </p>
                )}
              </div>
            </div>

            {/* Transaction History */}
            {transactions.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-bold mb-4 text-black">Transaction History</h2>
                
                <div className="space-y-3">
                  {transactions.map((tx) => (
                    <div
                      key={tx.hash}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-sm text-black">To</p>
                          <p className="font-mono text-sm text-black">{tx.to.slice(0, 10)}...{tx.to.slice(-8)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-black">Amount</p>
                          <p className="font-semibold">{tx.value} ETH</p>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            tx.status === 'success'
                              ? 'bg-green-100 text-green-800'
                              : tx.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {tx.status === 'success' ? 'Success' : tx.status === 'pending' ? 'Pending' : 'Failed'}
                        </span>
                        
                        {tx.status === 'success' && tx.hash.startsWith('0x') && (
                          <a
                            href={`https://sepolia.etherscan.io/tx/${tx.hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 text-sm"
                          >
                            View on Etherscan
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* How It Works */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 mt-6">
              <h3 className="text-xl font-bold mb-4 text-black"> How Level 2 wallet Works</h3>
              <ol className="space-y-2 text-sm text-black">
                <li><strong>1. Passkey Creation:</strong> Your Mac generates a P-256 key pair in the Secure Enclave</li>
                <li><strong>2. Account Deployment:</strong> Smart contract stores your public key (X, Y coordinates)</li>
                <li><strong>3. Transaction Signing:</strong> Touch ID signs the transaction hash with your private key</li>
                <li><strong>4. On-Chain Verification:</strong> Contract verifies P-256 signature using RIP-7212 precompile</li>
                <li><strong>5. Execution:</strong> Transaction executes if signature is valid!</li>
              </ol>
            </div>
          </>
        )}
      </div>
    </div>
  );
}