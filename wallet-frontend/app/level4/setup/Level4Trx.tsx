'use client';

import { useState } from 'react';
import { usePublicClient } from 'wagmi';
import { createUserOp, getUserOpHash } from './Level4Help';
import { encodeAbiParameters, formatEther } from 'viem';
import type { UserOperation } from 'viem/account-abstraction';
import { submitUserOp, waitForUserOpReceipt } from '../../level3/setup/pimlicoCli';

const SERVER_URL = 'http://localhost:9000';
const PIN = '853344';

interface Props {
  accountAddress: string;
}

export default function Level4Transaction({ accountAddress }: Props) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('');
  const [userOp, setUserOp] = useState<UserOperation<'0.7'>>();
  const [userOpHash, setUserOpHash] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [userOpFinal, setUserOpFinal] = useState<UserOperation<'0.7'> | null>(null);
  const [balanceBefore, setBalanceBefore] = useState<string | null>(null);
  const [balanceAfter, setBalanceAfter] = useState<string | null>(null);
  
  const publicClient = usePublicClient();

  const handleSendTransaction = async () => {
    if (!recipient || !amount) {
      setError('Please enter recipient and amount');
      return;
    }
    
    setUserOp(undefined);
    setUserOpHash(null);
    setSignature(null);
    setUserOpFinal(null);
    setBalanceBefore(null);
    setBalanceAfter(null);

    if (!publicClient) {
      setError('Public client not available');
      return;
    }

    setLoading(true);
    setError('');
    setStep('');

    try {
      setStep('Checking recipient balance...');
      const balBefore = await publicClient.getBalance({
        address: recipient as `0x${string}`
      });
      const balBeforeEth = formatEther(balBefore);
      setBalanceBefore(balBeforeEth);
      console.log(`Recipient balance BEFORE: ${balBeforeEth} ETH`);

      setStep('Creating UserOperation...');
      const userOp = await createUserOp(
        accountAddress,
        recipient as `0x${string}`,
        BigInt(Math.floor(parseFloat(amount) * 1e18)),
        publicClient
      );
      console.log('UserOp created:', userOp);
      setUserOp(userOp);

      setStep('Getting hash to sign...');
      const userOpHash = await getUserOpHash(userOp, publicClient);
      console.log('UserOpHash:', userOpHash);
      setUserOpHash(userOpHash);

      setStep('Please insert eID and enter PIN on card reader...');
      const response = await fetch(`${SERVER_URL}/sign-userop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userOpHash, pin: PIN }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const signResult = await response.json();
      console.log('Signature result:', signResult);
      setSignature(signResult.DER_signature);

      if (!signResult.parsed) {
        throw new Error('Failed to parse signature');
      }

      setStep('Encoding signature...');
      const signature = encodeAbiParameters(
        [
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'uint256' }
        ],
        [
          BigInt(signResult.parsed.rHigh),
          BigInt(signResult.parsed.rLow),
          BigInt(signResult.parsed.sHigh),
          BigInt(signResult.parsed.sLow),
        ]
      );
      console.log('Encoded signature:', signature);

      setStep('Submitting to bundler...');
      const completeUserOp: UserOperation<'0.7'> = {
        ...userOp,
        signature,
      };
      setUserOpFinal(completeUserOp);

      console.log('Submitting UserOp to bundler...');
      const userOpHashFromBundler = await submitUserOp(completeUserOp);
      console.log('UserOp submitted, hash:', userOpHashFromBundler);

      setStep('Transaction submitted! Waiting for confirmation...');
      const receipt = await waitForUserOpReceipt(userOpHashFromBundler);
      console.log('Transaction receipt:', receipt);

      setStep('Checking final balance...');
      const balAfter = await publicClient.getBalance({
        address: recipient as `0x${string}`
      });
      const balAfterEth = formatEther(balAfter);
      setBalanceAfter(balAfterEth);
      console.log(`Recipient balance AFTER: ${balAfterEth} ETH`);
      
      const difference = parseFloat(balAfterEth) - parseFloat(balBeforeEth);
      console.log(`Difference: ${difference.toFixed(6)} ETH`);

      setStep('Transaction complete!');
      
    } catch (err) {
      console.error('Transaction error:', err);
      setError(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-black mb-4">
        Send Transaction with eID (Age-Verified Account)
      </h2>
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-black">
          <strong>Smart Account:</strong>{' '}
          <span className="font-mono text-xs">{accountAddress}</span>
        </p>
        <p className="text-xs text-black mt-1">
          Age verified via ZK proof
        </p>
      </div>

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
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-black mb-2">
            Amount (ETH)
          </label>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.001"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
          />
        </div>

        <button
          onClick={handleSendTransaction}
          disabled={loading}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Processing...' : 'Send Transaction with eID'}
        </button>

        {step && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-black">{step}</p>
          </div>
        )}

        {(balanceBefore || balanceAfter) && (
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <h3 className="text-lg font-bold text-black mb-2">Recipient Balance:</h3>
            <div className="space-y-1 text-sm text-black">
              {balanceBefore && (
                <div>
                  <strong>Before:</strong> {balanceBefore} ETH
                </div>
              )}
              {balanceAfter && (
                <>
                  <div>
                    <strong>After:</strong> {balanceAfter} ETH
                  </div>
                  <div className="text-green-600 font-bold">
                    <strong>Received:</strong>{' '}
                    {(parseFloat(balanceAfter) - parseFloat(balanceBefore!)).toFixed(6)} ETH
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-black">
              <strong>Error:</strong> {error}
            </p>
          </div>
        )}
      </div>

      {userOp !== undefined && userOpFinal === null && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-lg font-bold text-black mb-2">
            UserOperation Details (Unsigned):
          </h3>
          <div className="space-y-2 text-sm text-black font-mono">
            <div><strong>Sender:</strong> {userOp.sender}</div>
            <div><strong>Nonce:</strong> {userOp.nonce.toString()}</div>
            <div><strong>CallData:</strong> {userOp.callData.slice(0, 66)}...</div>
            <div><strong>Call Gas Limit:</strong> {userOp.callGasLimit.toString()}</div>
            <div><strong>Verification Gas:</strong> {userOp.verificationGasLimit.toString()}</div>
          </div>
        </div>
      )}

      {userOpFinal !== null && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-lg font-bold text-black mb-2">
            UserOperation Details (Signed):
          </h3>
          <div className="space-y-2 text-sm text-black font-mono">
            <div><strong>Sender:</strong> {userOpFinal.sender}</div>
            <div><strong>Nonce:</strong> {userOpFinal.nonce.toString()}</div>
            <div><strong>CallData:</strong> {userOpFinal.callData.slice(0, 66)}...</div>
            <div className="text-wrap break-all">
              <strong>Signature:</strong> {userOpFinal.signature.slice(0, 66)}...
            </div>
          </div>
        </div>
      )}

      {userOpHash && (
        <div className="mt-2 p-2 bg-gray-50 rounded">
          <p className="text-xs text-black font-mono break-all">
            <strong>UserOp Hash:</strong> {userOpHash}
          </p>
        </div>
      )}
    </div>
  );
}