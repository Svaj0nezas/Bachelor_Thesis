'use client';

import { useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { getPublicKeyFromEID, parseSignature } from '../utils/p384Utils';
import Level3Transaction from './setup/Level3Trx';
// Contract addresses
const LEVEL3_FACTORY = '0x68b1d87f95878fe05b998f19b66f4baba5de1aed';

// Factory ABI
const FACTORY_ABI = [
  {
    inputs: [
      { name: 'pkXHigh', type: 'uint128' },
      { name: 'pkXLow', type: 'uint256' },
      { name: 'pkYHigh', type: 'uint128' },
      { name: 'pkYLow', type: 'uint256' },
      { name: 'salt', type: 'uint256' },
    ],
    name: 'createAccount',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'pkXHigh', type: 'uint128' },
      { name: 'pkXLow', type: 'uint256' },
      { name: 'pkYHigh', type: 'uint128' },
      { name: 'pkYLow', type: 'uint256' },
      { name: 'salt', type: 'uint256' },
    ],
    name: 'getAddress',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;


// Type definitions
interface ParsedSignature {
  r: string;
  s: string;
  rHigh: string;
  rLow: string;
  sHigh: string;
  sLow: string;
}

interface SignatureData {
  raw: string;
  der: string;
  messageHash: string;
  parsed: ParsedSignature | null;
}

interface VerificationResult {
  valid: boolean;
  error?: string;
}

export default function Level3() {
  // Account creation state
  const [publicKeyParts, setPublicKeyParts] = useState<any>(null);
  const [accountAddress, setAccountAddress] = useState<string>('');
  const [isDeployed, setIsDeployed] = useState(false);
  
  // Signing state
  const [message, setMessage] = useState<string>('');
  const [signature, setSignature] = useState<SignatureData | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [personalData, setPersonalData] = useState<any>(null);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [activeSection, setActiveSection] = useState<'account' | 'sign' | 'verify' | 'transaction'>('account');
  const [balance, setBalance] = useState<bigint>(0n);

  const SERVER_URL = 'http://localhost:9000';
  const pin = "853344";

  const { address: walletAddress } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  

  // ==================== ACCOUNT CREATION ====================

  const handleGetPublicKey = async () => {
    setLoading(true);
    setError('');
    
    try {
      const parts = await getPublicKeyFromEID(SERVER_URL);
      setPublicKeyParts(parts);
      console.log('Public key parts:', parts);

      const pkXHigh = BigInt(parts.xHigh);
      const pkXLow = BigInt(parts.xLow);
      const pkYHigh = BigInt(parts.yHigh);
      const pkYLow = BigInt(parts.yLow);
      console.log('Public key bigints:', { pkXHigh, pkXLow, pkYHigh, pkYLow });
      // Calculate counterfactual address
      if (publicClient) {
        const salt = 0n;
        const address = await publicClient.readContract({
          address: LEVEL3_FACTORY,
          abi: FACTORY_ABI,
          functionName: 'getAddress',
          args: [pkXHigh, pkXLow, pkYHigh, pkYLow, salt],
        });
        console.log('Counterfactual address:', address);
        setAccountAddress(address as string);
        
        
        // Check if already deployed
        const code = await publicClient.getBytecode({ address: address as `0x${string}` });
        setIsDeployed(code !== undefined && code !== '0x');
        if (code && code !== '0x') {
          console.log('\n========== READING STORED PUBLIC KEY FROM CONTRACT ==========');
          
          const storedPkXHigh = await publicClient.readContract({
            address: address as `0x${string}`,
            abi: [{
              name: 'pkXHigh',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ type: 'uint128' }],
            }],
            functionName: 'pkXHigh',
          });
          
          const storedPkXLow = await publicClient.readContract({
            address: address as `0x${string}`,
            abi: [{
              name: 'pkXLow',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ type: 'uint256' }],
            }],
            functionName: 'pkXLow',
          });
          
          const storedPkYHigh = await publicClient.readContract({
            address: address as `0x${string}`,
            abi: [{
              name: 'pkYHigh',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ type: 'uint128' }],
            }],
            functionName: 'pkYHigh',
          });
          
          const storedPkYLow = await publicClient.readContract({
            address: address as `0x${string}`,
            abi: [{
              name: 'pkYLow',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ type: 'uint256' }],
            }],
            functionName: 'pkYLow',
          });
          
          console.log('Stored in contract:');
          console.log('  pkXHigh:', '0x' + storedPkXHigh.toString(16));
          console.log('  pkXLow:', '0x' + storedPkXLow.toString(16));
          console.log('  pkYHigh:', '0x' + storedPkYHigh.toString(16));
          console.log('  pkYLow:', '0x' + storedPkYLow.toString(16));
          
          console.log('\nFrom current eID:');
          console.log('  pkXHigh:', parts.xHigh);
          console.log('  pkXLow:', parts.xLow);
          console.log('  pkYHigh:', parts.yHigh);
          console.log('  pkYLow:', parts.yLow);
          
          console.log('\nMatches:');
          console.log('  xHigh match:', storedPkXHigh === pkXHigh);
          console.log('  xLow match:', storedPkXLow === pkXLow);
          console.log('  yHigh match:', storedPkYHigh === pkYHigh);
          console.log('  yLow match:', storedPkYLow === pkYLow);
          console.log('========== END PUBLIC KEY CHECK ==========\n');
          
          // Check balance while we're at it
          const balance = await publicClient.getBalance({ 
            address: address as `0x${string}` 
          });
          console.log('Account balance:', balance.toString(), 'wei');
          console.log('Account balance (ETH):', (Number(balance) / 1e18).toFixed(6), 'ETH');
          setBalance((Number(balance) / 1e18).toFixed(6) as unknown as bigint);
        }
        // ========== END PUBLIC KEY CHECK ==========
      }
    } catch (err) {
      console.error('Error getting public key:', err);
      setError(err instanceof Error ? err.message : 'Failed to get public key');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!publicKeyParts || !walletClient) {
      setError('Please get public key first and connect wallet');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const salt = 0n;
      
      const hash = await walletClient.writeContract({
        address: LEVEL3_FACTORY,
        abi: FACTORY_ABI,
        functionName: 'createAccount',
        args: [
          publicKeyParts.xHigh,
          publicKeyParts.xLow,
          publicKeyParts.yHigh,
          publicKeyParts.yLow,
          salt,
        ],
      });
      
      console.log('Transaction hash:', hash);
      
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log('Transaction receipt:', receipt);
        
        if (receipt.status === 'success') {
          setIsDeployed(true);
        }
      }
    } catch (err) {
      console.error('Error creating account:', err);
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  
  // ==================== SIGNING & VERIFICATION ====================

  const handleGetPersonalData = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${SERVER_URL}/personal`);
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      setPersonalData(result.personalData);
      console.log('Personal Data:', result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get personal data');
    } finally {
      setLoading(false);
    }
  };

  const parseDERSignature = (derHex: string): ParsedSignature | null => {
    try {
      if (derHex.startsWith('0x')) {
        derHex = derHex.slice(2);
      }

      const bytes: number[] = [];
      for (let i = 0; i < derHex.length; i += 2) {
        bytes.push(parseInt(derHex.substring(i, i + 2), 16));
      }

      let index = 0;
      if (bytes[index++] !== 0x30) throw new Error('Invalid DER signature');
      
      const totalLength = bytes[index++];
      
      if (bytes[index++] !== 0x02) throw new Error('Invalid R INTEGER tag');
      const rLength = bytes[index++];
      const rBytes = bytes.slice(index, index + rLength);
      index += rLength;
      
      if (bytes[index++] !== 0x02) throw new Error('Invalid S INTEGER tag');
      const sLength = bytes[index++];
      const sBytes = bytes.slice(index, index + sLength);
      
      const rValue = rBytes[0] === 0 ? rBytes.slice(1) : rBytes;
      const sValue = sBytes[0] === 0 ? sBytes.slice(1) : sBytes;
      
      const r = '0x' + rValue.map(b => b.toString(16).padStart(2, '0')).join('');
      const s = '0x' + sValue.map(b => b.toString(16).padStart(2, '0')).join('');
      
      const rSplit = split384Bit(r);
      const sSplit = split384Bit(s);
      
      return {
        r,
        s,
        rHigh: rSplit.high,
        rLow: rSplit.low,
        sHigh: sSplit.high,
        sLow: sSplit.low,
      };
    } catch (err) {
      console.error('Error parsing DER signature:', err);
      return null;
    }
  };

  const split384Bit = (value: string): { high: string; low: string } => {
    if (value.startsWith('0x')) {
      value = value.slice(2);
    }
    
    value = value.padStart(96, '0');
    const high = '0x' + value.slice(0, 32);
    const low = '0x' + value.slice(32);
    
    return { high, low };
  };

  const handleSign = async () => {
    if (!message.trim()) {
      setError('Please enter a message to sign');
      return;
    }

    setLoading(true);
    setError('');
    setSignature(null);
    setVerificationResult(null);

    try {
      const response = await fetch(`${SERVER_URL}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, pin }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      const parsed = parseDERSignature(result.DER_signature);

      setSignature({
        raw: result.signature,
        der: result.DER_signature,
        messageHash: result.messageHash,
        parsed,
      });

      console.log('Signature created:', result);
    } catch (err) {
      console.error('Signing error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign message');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!message.trim()) {
      setError('Please enter the message');
      return;
    }

    if (!signature?.raw) {
      setError('Please sign a message first');
      return;
    }

    setLoading(true);
    setError('');
    setVerificationResult(null);

    try {
      const response = await fetch(`${SERVER_URL}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          signature: signature.raw,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const result = await response.json();
      setVerificationResult(result);

      console.log('Verification result:', result);
    } catch (err) {
      console.error('Verification error:', err);
      setError(err instanceof Error ? err.message : 'Failed to verify signature');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyWrong = async () => {
    if (!signature?.raw) {
      setError('Please sign a message first');
      return;
    }

    setLoading(true);
    setError('');
    setVerificationResult(null);

    try {
      const response = await fetch(`${SERVER_URL}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'wrong',
          signature: signature.raw,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const result = await response.json();
      setVerificationResult(result);

      console.log('Verification result:', result);
    } catch (err) {
      console.error('Verification error:', err);
      setError(err instanceof Error ? err.message : 'Failed to verify signature');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string): void => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  // ==================== RENDER ====================

  return (
    <div className="min-h-screen  p-8 bg-black">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-black mb-2">
            Level 3: Lithuanian eID Account
          </h1>
          <p className="text-black">
            Create smart contract accounts and sign transactions with government eID
          </p>
        </div>

        {/* Section Tabs */}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setActiveSection('account')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeSection === 'account'
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-white text-black hover:bg-gray-100'
            }`}
          >
            Create Account
          </button>

          <button
          onClick={() => setActiveSection('transaction')}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            activeSection === 'transaction'
              ? 'bg-orange-500 text-white shadow-md'
              : 'bg-white text-black hover:bg-gray-100'
          }`}
          >
          Send Transaction
          </button>

          
          


          <button
            onClick={() => setActiveSection('sign')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeSection === 'sign'
                ? 'bg-green-500 text-white shadow-md'
                : 'bg-white text-black hover:bg-gray-100'
            }`}
          >
            Sign Message
          </button>
          <button
            onClick={() => setActiveSection('verify')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeSection === 'verify'
                ? 'bg-purple-500 text-white shadow-md'
                : 'bg-white text-black hover:bg-gray-100'
            }`}
          >
            Verify & Personal Data
          </button>
        </div>

        {/* ==================== ACCOUNT CREATION SECTION ==================== */}
        {activeSection === 'account' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-black mb-4">
              Create Level3Account
            </h2>

            {/* Step 1 */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-black mb-2">Step 1: Extract eID Public Key</h3>
              <button
                onClick={handleGetPublicKey}
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Loading...' : 'Get Public Key from eID'}
              </button>
            </div>

            {/* Public Key Display */}
            {publicKeyParts && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-black mb-2">✓ Public Key Retrieved</h4>
                <div className="space-y-1 text-xs font-mono text-black">
                  <div>xHigh: {publicKeyParts.xHigh}</div>
                  <div>xLow: {publicKeyParts.xLow}</div>
                  <div>yHigh: {publicKeyParts.yHigh}</div>
                  <div>yLow: {publicKeyParts.yLow}</div>
                </div>
              </div>
            )}

            {/* Account Address */}
            {accountAddress && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-black mb-2">
                  {isDeployed ? ' Account Address (Deployed)' : 'Account Address (Not Deployed)'}
                </h4>
                <div className="font-mono text-sm text-black break-all">
                  {accountAddress}
                </div>
                <div className="font-mono text-sm text-black break-all">
                  Account balance: {balance.toString()} ETH
                </div>
                <a
                  href={`https://sepolia.etherscan.io/address/${accountAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 text-sm hover:underline mt-2 inline-block"
                  
                />
              </div>
            )}

            {/* Step 2 */}
            {publicKeyParts && !isDeployed && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-black mb-2">Step 2: Deploy Account</h3>
                <p className="text-sm text-black mb-3">
                  Connected wallet: {walletAddress ? walletAddress : 'Not connected'}
                </p>
                <button
                  onClick={handleCreateAccount}
                  disabled={loading || !walletAddress}
                  className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Deploying...' : 'Deploy Level3Account'}
                </button>
              </div>
            )}

            {/* Success */}
            {isDeployed && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-black mb-2">
                  Account is Deployed!
                </h4>
                <p className="text-sm text-black">
                  Level3Account is live on Sepolia.
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-black text-sm">
                  <strong>Error:</strong> {error}
                </p>
              </div>
            )}
          </div>
        )}
{/* ==================== Send trx SECTION ==================== */}

        {activeSection === 'transaction' && isDeployed && (
        <Level3Transaction accountAddress={accountAddress} />
        )}

         

        {/* ==================== SIGN MESSAGE SECTION ==================== */}
        {activeSection === 'sign' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-black mb-4">Sign Message</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-black mb-2">
                  Message to Sign
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter your message here..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-black placeholder-gray-400"
                  rows={4}
                />
              </div>

              <button
                onClick={handleSign}
                disabled={loading || !message.trim()}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Signing...' : 'Sign with eID Card'}
              </button>

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-black text-sm">
                    <strong>Error:</strong> {error}
                  </p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-black mb-4">Signature Details</h2>

              {signature ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-black">RAW Signature (96 bytes)</label>
                      <button onClick={() => copyToClipboard(signature.raw)} className="text-xs text-blue-500 hover:text-blue-700">
                        Copy
                      </button>
                    </div>
                    <div className="p-3 bg-gray-50 rounded border border-gray-200 font-mono text-xs break-all text-black">
                      {signature.raw}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-black">Message Hash (SHA-384)</label>
                      <button onClick={() => copyToClipboard(signature.messageHash)} className="text-xs text-blue-500 hover:text-blue-700">
                        Copy
                      </button>
                    </div>
                    <div className="p-3 bg-gray-50 rounded border border-gray-200 font-mono text-xs break-all text-black">
                      {signature.messageHash}
                    </div>
                  </div>

                  {signature.parsed && (
                    <div className="border-t pt-4">
                      <h3 className="text-sm font-bold text-black mb-3">Solidity Format</h3>
                      <div className="space-y-3 text-xs">
                        <div>
                          <div className="text-black mb-1">R (high, low):</div>
                          <div className="font-mono bg-purple-50 p-2 rounded break-all text-black">
                            <div className="mb-1">rHi: {signature.parsed.rHigh}</div>
                            <div>rLo: {signature.parsed.rLow}</div>
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-black mb-1">S (high, low):</div>
                          <div className="font-mono bg-purple-50 p-2 rounded break-all text-black">
                            <div className="mb-1">sHi: {signature.parsed.sHigh}</div>
                            <div>sLo: {signature.parsed.sLow}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-black">
                  <p>Sign a message to see signature details</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== VERIFY & PERSONAL DATA SECTION ==================== */}
        {activeSection === 'verify' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-black mb-4">Verify Signature</h2>
              
              <div className="space-y-3">
                <button
                  onClick={handleVerify}
                  disabled={loading || !message.trim() || !signature}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Verifying...' : 'Verify Signature'}
                </button>
                
                <button
                  onClick={handleVerifyWrong}
                  disabled={loading || !signature}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-6 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Test with Wrong Message
                </button>
              </div>

              {verificationResult && (
                <div className={`mt-4 p-4 border rounded-lg ${verificationResult.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <span className={`font-bold ${verificationResult.valid ? 'text-green-800' : 'text-red-800'}`}>
                    {verificationResult.valid ? '✓ Signature Valid' : '✗ Signature Invalid'}
                  </span>
                  {verificationResult.error && <p className="text-sm text-black mt-2">{verificationResult.error}</p>}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-black mb-4">Personal Data</h2>
              
              <button
                onClick={handleGetPersonalData}
                disabled={loading}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors mb-4"
              >
                {loading ? 'Loading...' : 'Read Personal Data'}
              </button>

              {personalData && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-bold mb-2 text-black">Personal Information:</h3>
                  <div className="space-y-1 text-sm text-black">
                    <p><strong>Name:</strong> {personalData.name}</p>
                    <p><strong>Personal Code:</strong> {personalData.personalCode}</p>
                    {personalData.age && <p><strong>Age:</strong> {personalData.age}</p>}
                    <p><strong>Country:</strong> {personalData.country}</p>
                    <p><strong>Valid Until:</strong> {new Date(personalData.certificateValidUntil).toLocaleDateString()}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}