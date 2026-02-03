'use client';

import { useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import Level4Transaction from './setup/Level4Trx';

// Update with your deployed addresses
const LEVEL4_FACTORY = '0xe6e340d132b5f46d1e472debcd681b2abc16e57e';
const SERVER_URL = 'http://localhost:9000';

const FACTORY_ABI = [
  {
    inputs: [
      { name: 'pkXHigh', type: 'uint128' },
      { name: 'pkXLow', type: 'uint256' },
      { name: 'pkYHigh', type: 'uint128' },
      { name: 'pkYLow', type: 'uint256' },
      { name: 'salt', type: 'uint256' },
      { name: 'a', type: 'uint256[2]' },
      { name: 'b', type: 'uint256[2][2]' },
      { name: 'c', type: 'uint256[2]' },
      { name: 'publicSignals', type: 'uint256[1]' }
    ],
    name: 'createAccountWithAgeProof',
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
      { name: 'salt', type: 'uint256' }
    ],
    name: 'getAddress',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

interface ProofResult {
  success: boolean;
  proof: {
    a: [string, string];
    b: [[string, string], [string, string]];
    c: [string, string];
  };
  publicSignals: string[];
  publicKey: string;
  metadata: {
    age: number;
    name: string;
    proofGenerationTime: string;
  };
}

interface PublicKeyParts {
  xHigh: bigint;
  xLow: bigint;
  yHigh: bigint;
  yLow: bigint;
}

export default function Level4Page() {
  // Proof generation state
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [proofResult, setProofResult] = useState<ProofResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Account state
  const [publicKeyParts, setPublicKeyParts] = useState<PublicKeyParts | null>(null);
  const [accountAddress, setAccountAddress] = useState<string>('');
  const [isDeployed, setIsDeployed] = useState(false);
  const [balance, setBalance] = useState<string>('0');
  
  // UI state
  const [activeSection, setActiveSection] = useState<'proof' | 'account' | 'transaction'| 'details'>('proof');

  const { address: walletAddress } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // Parse public key from proof
  const parsePublicKey = (publicKeyHex: string): PublicKeyParts => {
    // Remove 0x prefix
    const pkClean = publicKeyHex.startsWith('0x') ? publicKeyHex.slice(2) : publicKeyHex;
    
    // 96 bytes total: 48 bytes X + 48 bytes Y
    const xHex = pkClean.substring(0, 96);  // 48 bytes = 96 hex chars
    const yHex = pkClean.substring(96, 192);
    
    // Split into high/low parts (similar to Level3)
    const xBigInt = BigInt('0x' + xHex);
    const yBigInt = BigInt('0x' + yHex);
    
    // Split 384 bits: high 128 bits, low 256 bits
    const xHigh = xBigInt >> 256n;
    const xLow = xBigInt & ((1n << 256n) - 1n);
    const yHigh = yBigInt >> 256n;
    const yLow = yBigInt & ((1n << 256n) - 1n);
    
    return {
      xHigh,
      xLow,
      yHigh,
      yLow
    };
  };

  const convertProofToBigInt = (proof: ProofResult['proof']) => {
    return {
      a: [BigInt(proof.a[0]), BigInt(proof.a[1])] as [bigint, bigint],
      b: [
        [BigInt(proof.b[0][0]), BigInt(proof.b[0][1])],
        [BigInt(proof.b[1][0]), BigInt(proof.b[1][1])]
      ] as [[bigint, bigint], [bigint, bigint]],
      c: [BigInt(proof.c[0]), BigInt(proof.c[1])] as [bigint, bigint]
    };
  };
  

  // ==================== GENERATE PROOF ====================
  
  const generateProof = async () => {
    setLoading(true);
    setError(null);
    setProofResult(null);
    setCurrentStep(0);

    try {
      setCurrentStep(1);
      
      const response = await fetch(`${SERVER_URL}/create-account-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to generate proof');
      }

      setCurrentStep(5);
      setProofResult(data);
      
      // Parse public key
      const pkParts = parsePublicKey(data.publicKey);
      setPublicKeyParts(pkParts);
      
      // Calculate counterfactual address
      if (publicClient) {
        const salt = 0n;
        const address = await publicClient.readContract({
          address: LEVEL4_FACTORY,
          abi: FACTORY_ABI,
          functionName: 'getAddress',
          args: [pkParts.xHigh, pkParts.xLow, pkParts.yHigh, pkParts.yLow, salt],
        });
        
        setAccountAddress(address as string);
        console.log('proof result:', proofResult);
        
        // Check if deployed
        const code = await publicClient.getBytecode({ address: address as `0x${string}` });
        const deployed = code !== undefined && code !== '0x';
        setIsDeployed(deployed);
        
        if (deployed) {
          const bal = await publicClient.getBalance({ address: address as `0x${string}` });
          setBalance((Number(bal) / 1e18).toFixed(6));
        }
      }
      
      setActiveSection('account');

    } catch (err: any) {
      setError(err.message);
      setCurrentStep(0);
    } finally {
      setLoading(false);
    }
  };

  // ==================== CREATE ACCOUNT ====================
  
  const createAccount = async () => {
    if (!proofResult || !publicKeyParts || !walletClient) {
      setError('Please generate proof first and connect wallet');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const salt = 0n;

      const proofBigInt = convertProofToBigInt(proofResult.proof);
      
      const hash = await walletClient.writeContract({
        address: LEVEL4_FACTORY,
        abi: FACTORY_ABI,
        functionName: 'createAccountWithAgeProof',
        args: [
          publicKeyParts.xHigh,
          publicKeyParts.xLow,
          publicKeyParts.yHigh,
          publicKeyParts.yLow,
          salt,
          proofBigInt.a,
            proofBigInt.b,
            proofBigInt.c,
          [BigInt(proofResult.publicSignals[0])]
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
    } catch (err: any) {
      console.error('Error creating account:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==================== HELPERS ====================
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  // ==================== RENDER ====================

  return (
    <div className="min-h-screen p-8 bg-black">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-black mb-2">
            Level 4: ZK Age-Verified Account
          </h1>
          <p className="text-black">
            Create age-verified accounts using Lithuanian eID + Zero-Knowledge Proofs
          </p>
        </div>

        {/* Section Tabs */}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setActiveSection('proof')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeSection === 'proof'
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-white text-black hover:bg-gray-100'
            }`}
          >
            1. Generate Proof
          </button>
          
          <button
            onClick={() => setActiveSection('account')}
            disabled={!proofResult}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeSection === 'account'
                ? 'bg-green-500 text-white shadow-md'
                : 'bg-white text-black hover:bg-gray-100 disabled:bg-gray-200 disabled:cursor-not-allowed'
            }`}
          >
            2. Create Account
          </button>
          
          <button
            onClick={() => setActiveSection('details')}
            disabled={!proofResult}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeSection === 'details'
                ? 'bg-purple-500 text-white shadow-md'
                : 'bg-white text-black hover:bg-gray-100 disabled:bg-gray-200 disabled:cursor-not-allowed'
            }`}
          >
            3. Proof Details
          </button>
          <button
  onClick={() => setActiveSection('transaction')}
  disabled={!isDeployed}
  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
    activeSection === 'transaction'
      ? 'bg-orange-500 text-white shadow-md'
      : 'bg-white text-black hover:bg-gray-100 disabled:bg-gray-200 disabled:cursor-not-allowed'
  }`}
>
  4. Send Transaction
</button>

        </div>

        {/* ==================== PROOF SECTION ==================== */}
        {activeSection === 'proof' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-black mb-4">
              Generate ZK Age Proof
            </h2>

            {/* Info Box */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-black mb-2">How it works:</h3>
              <ul className="text-sm text-black space-y-1 list-disc list-inside">
                <li>Reads your eID certificate and verifies government signature</li>
                <li>Extracts personal code and proves age ≥ 18</li>
                <li>Generates zero-knowledge proof without revealing birth date</li>
                <li>Proof can be verified on blockchain without exposing personal data</li>
              </ul>
            </div>

            {/* Generate Button */}
            <div className="mb-6">
              <button
                onClick={generateProof}
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors w-full"
              >
                {loading ? 'Generating Proof...' : 'Generate ZK Proof'}
              </button>
              <p className="text-sm text-black mt-2 text-center">
                Make sure your eID card is inserted
              </p>
            </div>

            {/* Progress Steps */}
            {loading && (
              <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h3 className="font-semibold text-black mb-3">Progress:</h3>
                <div className="space-y-2">
                  {[
                    'Verifying Certificate',
                    'Extracting Personal Data',
                    'Verifying Age Requirement',
                    'Extracting Public Key',
                    'Generating ZK Proof'
                  ].map((step, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      {currentStep > idx + 1 ? (
                        <span className="text-green-500 font-bold">✓</span>
                      ) : currentStep === idx + 1 ? (
                        <span className="text-blue-500 font-bold">→</span>
                      ) : (
                        <span className="text-gray-300 font-bold">○</span>
                      )}
                      <span className="text-sm text-black">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-black text-sm">
                  <strong>Error:</strong> {error}
                </p>
              </div>
            )}

            {/* Success Message */}
            {proofResult && !loading && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-black mb-2">
                  ✓ Proof Generated Successfully!
                </h4>
                <p className="text-sm text-black">
                  Name: {proofResult.metadata.name} | Age: {proofResult.metadata.age}
                </p>
                <p className="text-sm text-black mt-2">
                  Click "Create Account" tab to deploy your age-verified account.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ==================== ACCOUNT SECTION ==================== */}
        {activeSection === 'account' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-black mb-4">
              Create Level4Account
            </h2>

            {/* Metadata Display */}
            {proofResult && (
              <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm font-medium text-black mb-1">Name</div>
                  <div className="text-lg font-bold text-black">{proofResult.metadata.name}</div>
                </div>
                
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-sm font-medium text-black mb-1">Age Verified</div>
                  <div className="text-lg font-bold text-black">{proofResult.metadata.age}+ ✓</div>
                </div>
                
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="text-sm font-medium text-black mb-1">Proof Time</div>
                  <div className="text-lg font-bold text-black">{proofResult.metadata.proofGenerationTime}</div>
                </div>
              </div>
            )}

            {/* Public Key Display */}
            {publicKeyParts && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-black mb-2">✓ Public Key Retrieved</h4>
                <div className="space-y-1 text-xs font-mono text-black">
                  <div>xHigh: {publicKeyParts.xHigh.toString()}</div>
                  <div>xLow: {publicKeyParts.xLow.toString()}</div>
                  <div>yHigh: {publicKeyParts.yHigh.toString()}</div>
                  <div>yLow: {publicKeyParts.yLow.toString()}</div>
                </div>
              </div>
            )}

            {/* Account Address */}
            {accountAddress && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-black mb-2">
                  {isDeployed ? '✓ Account Address (Deployed)' : 'Account Address (Not Deployed)'}
                </h4>
                <div className="font-mono text-sm text-black break-all mb-2">
                  {accountAddress}
                </div>
                {isDeployed && (
                  <div className="text-sm text-black">
                    Balance: {balance} ETH
                  </div>
                )}
              </div>
            )}

            {/* Deploy Button */}
            {publicKeyParts && !isDeployed && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-black mb-2">Deploy Account</h3>
                <p className="text-sm text-black mb-3">
                  Connected wallet: {walletAddress ? walletAddress : 'Not connected'}
                </p>
                <button
                  onClick={createAccount}
                  disabled={loading || !walletAddress}
                  className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors w-full"
                >
                  {loading ? 'Deploying...' : 'Deploy Age-Verified Account'}
                </button>
              </div>
            )}

            {/* Success */}
            {isDeployed && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-black mb-2">
                  ✓ Account Deployed!
                </h4>
                <p className="text-sm text-black">
                  Your age-verified Level4Account is live on local net. You can now use it for transactions!
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

        {/* ==================== DETAILS SECTION ==================== */}
        {activeSection === 'details' && proofResult && (
          <div className="space-y-6">
            {/* Public Signals */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-black mb-4">
                Public Data (On-Chain)
              </h2>
              
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-black">Public Key Hash</label>
                    <button
                      onClick={() => copyToClipboard(proofResult.publicSignals[0])}
                      className="text-xs text-blue-500 hover:text-blue-700"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="p-3 bg-gray-50 rounded border border-gray-200 font-mono text-xs break-all text-black">
                    {proofResult.publicSignals[0]}
                  </div>
                  <p className="text-xs text-black mt-1">
                    This hash commits to your public key without revealing the coordinates
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-black">Public Key (96 bytes)</label>
                    <button
                      onClick={() => copyToClipboard(proofResult.publicKey)}
                      className="text-xs text-blue-500 hover:text-blue-700"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="p-3 bg-gray-50 rounded border border-gray-200 font-mono text-xs break-all text-black">
                    {proofResult.publicKey}
                  </div>
                </div>
              </div>
            </div>

            {/* Proof Components */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-black mb-4">
                ZK Proof Components
              </h2>
              
              <div className="space-y-4">
                {/* Proof A */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-black">Proof A</label>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(proofResult.proof.a))}
                      className="text-xs text-blue-500 hover:text-blue-700"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-1">
                    <div className="font-mono text-xs break-all text-black">[0]: {proofResult.proof.a[0]}</div>
                    <div className="font-mono text-xs break-all text-black">[1]: {proofResult.proof.a[1]}</div>
                  </div>
                </div>

                {/* Proof B */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-black">Proof B</label>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(proofResult.proof.b))}
                      className="text-xs text-blue-500 hover:text-blue-700"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-1">
                    <div className="font-mono text-xs break-all text-black">[0][0]: {proofResult.proof.b[0][0]}</div>
                    <div className="font-mono text-xs break-all text-black">[0][1]: {proofResult.proof.b[0][1]}</div>
                    <div className="font-mono text-xs break-all text-black">[1][0]: {proofResult.proof.b[1][0]}</div>
                    <div className="font-mono text-xs break-all text-black">[1][1]: {proofResult.proof.b[1][1]}</div>
                  </div>
                </div>

                {/* Proof C */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-black">Proof C</label>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(proofResult.proof.c))}
                      className="text-xs text-blue-500 hover:text-blue-700"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-1">
                    <div className="font-mono text-xs break-all text-black">[0]: {proofResult.proof.c[0]}</div>
                    <div className="font-mono text-xs break-all text-black">[1]: {proofResult.proof.c[1]}</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-black">
                  <strong>What this proves:</strong> This cryptographic proof mathematically guarantees that 
                  someone who knows a birth year making them 18+ generated this proof, and it's bound to 
                  the specific eID public key. The proof can be verified on-chain without revealing 
                  the actual birth year.
                </p>
              </div>
            </div>

            {/* Export All Data */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-black mb-4">
                Export Proof Data
              </h2>
              
              <button
                onClick={() => {
                  const json = JSON.stringify(proofResult, null, 2);
                  copyToClipboard(json);
                }}
                className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded-lg transition-colors w-full"
              >
                Copy All Proof Data (JSON)
              </button>
            </div>
          </div>
        )}
        {activeSection === 'transaction' && isDeployed && (
  <Level4Transaction accountAddress={accountAddress} />
)}
      </div>
    </div>
  );
}