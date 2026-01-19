import { CONTRACTS } from '@/app/lib/contracts/addresses';
import { encodeFunctionData } from 'viem';
import type { UserOperation } from 'viem/account-abstraction';
import { getUserOperationHash } from 'viem/account-abstraction';

const LEVEL3_ACCOUNT_ABI = [{
  inputs: [],
  name: 'getNonce',
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function',
}, {
  inputs: [
    { name: 'dest', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'func', type: 'bytes' },
  ],
  name: 'execute',
  outputs: [],
  stateMutability: 'nonpayable',
  type: 'function',
}] as const;

export async function createUserOp(
  addressAcc: string,
  to: string,
  value: bigint,
  publicClient: any
): Promise<UserOperation<'0.7'>> {
  
  const nonce = await publicClient.readContract({ 
    address: addressAcc as `0x${string}`,
    abi: LEVEL3_ACCOUNT_ABI,
    functionName: 'getNonce',
  }) as bigint;

  const callData = encodeFunctionData({
    abi: LEVEL3_ACCOUNT_ABI,
    functionName: 'execute',
    args: [to as `0x${string}`, value, '0x'],
  });

  const gasPrice = await publicClient.getGasPrice();
  
  const userOp: UserOperation<'0.7'> = {
    sender: addressAcc as `0x${string}`,
    nonce,
    factory: undefined,
    factoryData: undefined,
    callData,
    callGasLimit: 2000000000n,
    verificationGasLimit: 2000000000n,  // 10M for local network
    preVerificationGas: 2000000000n,      // 100K for local network
    maxFeePerGas: gasPrice * 2n,
    maxPriorityFeePerGas: gasPrice,
    paymaster: undefined,
    paymasterVerificationGasLimit: undefined,
    paymasterPostOpGasLimit: undefined,
    paymasterData: undefined,
    signature: '0x',
  };
  
  
  return userOp;
}

export async function getUserOpHash(
  userOp: UserOperation<'0.7'>,
  publicClient: any
): Promise<string> {
  const userOpHash = getUserOperationHash({
    userOperation: userOp,
    entryPointAddress: CONTRACTS.anvil.entryPoint,
    entryPointVersion: '0.7',
    chainId: 31337,
  });

  console.log('UserOpHash from viem:', userOpHash);
  console.log('Length:', userOpHash.length);
  console.log('Should be 66 chars (0x + 64 hex)');
  
  return userOpHash;
}