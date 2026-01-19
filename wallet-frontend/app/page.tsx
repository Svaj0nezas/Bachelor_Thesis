'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import Link from 'next/link';

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Multi-Level ERC-4337 Wallet</h1>
          <ConnectButton />
        </div>

        {isConnected ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <p className="text-green-800 mb-4">
              Wallet connected successfully!
            </p>
            <Link
              href="/dashboard"
              className="inline-block bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <p className="text-gray-600">
              Please connect your wallet to continue
            </p>
          </div>
        )}
      </div>
    </main>
  );
}