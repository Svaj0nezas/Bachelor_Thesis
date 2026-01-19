'use client';

import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Level1Wallet } from '../lib/wallet/Level1Wallet';
import { formatEther, parseEther } from 'viem';
import { SendTransaction } from '../components/sendTransaction';
import { TransactionLog, Transaction } from '../components/TransactionLog';

export default function Level1() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [accountOwner, setAccountOwner] = useState<string>('');
  
  const [wallet] = useState(() => new Level1Wallet());
  const [accountAddress, setAccountAddress] = useState<string>('');
  const [isDeployed, setIsDeployed] = useState(false);
  const [balance, setBalance] = useState<string>('0');
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string>('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    if (!isConnected) {
      router.push('/');
    }
  }, [isConnected, router]);

  useEffect(() => {
    if (address) {
      loadAccountInfo();
    }
  }, [address]);

  const loadAccountInfo = async () => {
    if (!address) return;
  
    setLoading(true);
    setError('');
  
    try {
      const addr = await wallet.getAccountAddress(address as `0x${string}`);
      setAccountAddress(addr);
  
      const deployed = await wallet.isDeployed(addr);
      setIsDeployed(deployed);
  
      const bal = await wallet.getBalance(addr);
      setBalance(formatEther(bal));
  
      // ✅ ADD: Get the owner if deployed
      if (deployed) {
        const owner = await wallet.getOwner(addr);
        setAccountOwner(owner);
        console.log('Account owner:', owner);
        console.log('Connected address:', address);
        
        if (owner.toLowerCase() !== address.toLowerCase()) {
          setError(`⚠️ Owner mismatch! Account owner is ${owner}, but you're connected as ${address}`);
        }
      }
  
      console.log('Account info loaded:', { addr, deployed, balance: formatEther(bal) });
    } catch (err: any) {
      console.error('Error loading account info:', err);
      setError('Failed to load account info: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (!address || !window.ethereum) {
      setError('MetaMask not connected');
      return;
    }

    setDeploying(true);
    setError('');

    try {
      await wallet.connect(window.ethereum);
      console.log('Deploying account...');
      const receipt = await wallet.deployAccount(address as `0x${string}`);
      console.log('Deployment receipt:', receipt);

      await loadAccountInfo();
      alert('✅ Account deployed successfully!');
    } catch (err: any) {
      console.error('Deployment error:', err);
      setError('Deployment failed: ' + err.message);
    } finally {
      setDeploying(false);
    }
  };

  const handleSendTransaction = async (to: string, amount: string) => {
    if (!address || !window.ethereum || !accountAddress) {
      throw new Error('Wallet not connected');
    }

    console.log('🚀 Sending UserOperation...');
    console.log('From:', accountAddress);
    console.log('To:', to);
    console.log('Amount:', amount, 'ETH');

    // Add pending transaction
    const pendingTx: Transaction = {
      hash: '',
      to,
      value: amount,
      timestamp: Date.now(),
      status: 'pending',
    };
    setTransactions((prev) => [pendingTx, ...prev]);

    try {
      // Connect wallet
      await wallet.connect(window.ethereum);

      // Send UserOperation
      const userOpHash = await wallet.sendUserOp(
        accountAddress as `0x${string}`,
        address as `0x${string}`,
        to as `0x${string}`,
        parseEther(amount)
      );

      console.log('✅ UserOperation submitted:', userOpHash);

      // Update transaction with hash
      setTransactions((prev) =>
        prev.map((tx, i) =>
          i === 0 ? { ...tx, hash: userOpHash, status: 'success' } : tx
        )
      );

      // Wait a bit and refresh balance
      setTimeout(() => {
        loadAccountInfo();
      }, 3000);

      alert(`✅ UserOperation submitted!\n\nHash: ${userOpHash}`);
    } catch (err: any) {
      console.error('❌ Send error:', err);
      
      // Update transaction to failed
      setTransactions((prev) =>
        prev.map((tx, i) => (i === 0 ? { ...tx, status: 'failed' } : tx))
      );

      throw new Error(err.message || 'Failed to send transaction');
    }
  };

  if (!isConnected) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <Link 
          href="/dashboard" 
          className="text-indigo-600 hover:text-indigo-800 mb-6 inline-block"
        >
          ← Back to Dashboard
        </Link>
        
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h1 className="text-3xl font-bold mb-2 text-black">Level 1: Basic Wallet</h1>
          <p className=" mb-8 text-black">
            Account abstraction wallet with ERC-4337 UserOperations
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">❌ {error}</p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading account info...</p>
            </div>
          ) : (
            <>
              {/* Account Info */}
              <div className="space-y-4 mb-8">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Your EOA (Owner)</p>
                  <p className="font-mono text-sm break-all text-black">{address}</p>
                </div>

                <div className="bg-indigo-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Your Smart Wallet Address</p>
                  <p className="font-mono text-sm break-all text-black">{accountAddress}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {isDeployed ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                        Deployed
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-orange-100 text-orange-800">
                        Not deployed yet
                      </span>
                    )}
                  </div>
                  {accountAddress && (
                    <a
                      href={`https://sepolia.etherscan.io/address/${accountAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-indigo-600 hover:underline mt-2 inline-block"
                    >
                      View on Etherscan
                    </a>
                  )}
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Wallet Balance</p>
                  <p className="text-2xl font-bold text-green-800">{balance} ETH</p>
                  {parseFloat(balance) === 0 && !isDeployed && (
                    <p className="text-sm text-gray-600 mt-2">
                      Tip: Send ETH to this address before deploying!
                    </p>
                  )}
                  <button
                    onClick={loadAccountInfo}
                    className="text-sm text-indigo-600 hover:underline mt-2"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {/* Deploy Button */}
              {!isDeployed && (
                <button
                  onClick={handleDeploy}
                  disabled={deploying}
                  className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors mb-6"
                >
                  {deploying ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Deploying...
                    </span>
                  ) : (
                    '🚀 Deploy Account'
                  )}
                </button>
              )}

              {/* Success Message */}
              {isDeployed && parseFloat(balance) === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <p className="text-yellow-800">
                    The wallet is deployed but has no ETH. Send some ETH to {' '}
                    <span className="font-mono text-xs">{accountAddress}</span> to start using it!
                  </p>
                </div>
              )}

              {isDeployed && parseFloat(balance) > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <p className="text-green-800">
                    wallet is ready. You can now send transactions using UserOperations.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
        {isDeployed && accountOwner && (
  <div className="bg-blue-50 p-4 rounded-lg">
    <p className="text-sm text-gray-600 mb-1">Account Owner (who can sign)</p>
    <p className="font-mono text-sm break-all text-black">{accountOwner}</p>
    {accountOwner.toLowerCase() !== address?.toLowerCase() && (
      <p className="text-red-600 text-sm mt-2">
        You're not the owner. Switch to {accountOwner} in MetaMask
      </p>
    )}
  </div>
)}

        {/* Send Transaction Form */}
        {isDeployed && parseFloat(balance) > 0 && (
          <div className="mb-6">
            <SendTransaction
              onSend={handleSendTransaction}
              balance={balance}
              disabled={loading}
            />
          </div>
        )}

        {/* Transaction History */}
        {isDeployed && (
          <TransactionLog transactions={transactions} />
        )}

        {/* Info Section */}
        
      </div>
    </div>
  );
}