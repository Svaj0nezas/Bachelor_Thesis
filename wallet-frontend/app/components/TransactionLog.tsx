'use client';

import { useState, useEffect } from 'react';

export interface Transaction {
  hash: string;
  to: string;
  value: string;
  timestamp: number;
  status: 'pending' | 'success' | 'failed';
}

interface TransactionLogProps {
  transactions: Transaction[];
}

export function TransactionLog({ transactions }: TransactionLogProps) {
  if (transactions.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4 text-black">Transaction History</h3>
        <p className="text-gray-500 text-center py-8">
          No transactions yet. Send your first UserOperation above!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-xl font-semibold mb-4">Transaction History</h3>
      
      <div className="space-y-3">
        {transactions.map((tx, index) => (
          <div
            key={tx.hash || index}
            className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  {tx.status === 'pending' && (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
                      ⏳ Pending
                    </span>
                  )}
                  {tx.status === 'success' && (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                      ✅ Success
                    </span>
                  )}
                  {tx.status === 'failed' && (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-red-100 text-red-800">
                      ❌ Failed
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    {new Date(tx.timestamp).toLocaleString()}
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-sm">
                    <span className="text-gray-600">To:</span>{' '}
                    <span className="font-mono text-xs">{tx.to}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-gray-600">Value:</span>{' '}
                    <span className="font-semibold">{tx.value} ETH</span>
                  </p>
                  {tx.hash && (
                    <a
                      href={`https://sepolia.etherscan.io/tx/${tx.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 hover:underline inline-block"
                   >
                      View on Etherscan
                      </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}