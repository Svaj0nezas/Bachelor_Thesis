// frontend/src/app/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import Link from 'next/link';

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const [accounts, setAccounts] = useState({
    level1: null,
    level2: null,
    level3: null
  });
  
  if (!isConnected) {
    return <div>Please connect your wallet</div>;
  }
  
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8">Multi-Level ERC-4337 Wallet</h1>
      
      <div className="mb-8">
        <p className="text-gray-600">Connected EOA: {address}</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Level 1 */}
        <div className="border rounded-lg p-6 hover:shadow-lg transition">
          <div className="flex items-center mb-4">
            <span className="text-3xl mr-3"></span>
            <h2 className="text-2xl font-semibold">Level 1</h2>
          </div>
          <p className="text-gray-600 mb-4">
            EOA signature only.
          </p>

          <Link 
            href="/level1"
            className="mt-4 block w-full bg-blue-500 text-white py-2 rounded text-center hover:bg-blue-600"
          >
            Use Level 1
          </Link>
        </div>
        
        {/* Level 2 */}
        <div className="border rounded-lg p-6 hover:shadow-lg transition">
          <div className="flex items-center mb-4">
            <span className="text-3xl mr-3"></span>
            <h2 className="text-2xl font-semibold">Level 2</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Signing with Touch-ID
          </p>
          
          <Link 
            href="/level2"
            className="mt-4 block w-full bg-blue-500 text-white py-2 rounded text-center hover:bg-blue-600"
          >
            Use Level 2
          </Link>
        </div>
        
        {/* Level 3 */}
        <div className="border rounded-lg p-6 hover:shadow-lg transition">
          <div className="flex items-center mb-4">
            <span className="text-3xl mr-3"></span>
            <h2 className="text-2xl font-semibold">Level 3</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Lithuanian eID signing.
          </p>
          
          <Link 
            href="/level3"
            className="mt-4 block w-full bg-blue-500 text-white py-2 rounded text-center hover:bg-blue-600"
          >
            Use Level 3
          </Link>
        </div>
      </div>
      
      <div className="mt-12">
        <h3 className="text-2xl font-semibold mb-4 text-white">How It Works</h3>
        <div className="bg-gray-50 p-6 rounded-lg text-black">
          <ol className="space-y-3">
            <li className="flex items-start ">
              <span className="font-bold mr-2">1.</span>
              <span>Each level creates a separate smart contract account with different validation logic</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">2.</span>
              <span>All accounts use ERC-4337 account abstraction for gasless transactions (with paymasters)</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">3.</span>
              <span>Higher levels provide stronger security guarantees suitable for different use cases</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}