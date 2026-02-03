import { createClient, http, type Hex } from 'viem';
import { createBundlerClient, type UserOperation } from 'viem/account-abstraction';
import { hardhat } from 'viem/chains';
import { createPublicClient, createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const ENTRYPOINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
const testAccount = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');

const client = createPublicClient({
  chain: hardhat,
  transport: http("http://127.0.0.1:8545")
});

const walletClient = createWalletClient({
  account: testAccount,
  chain: hardhat,
  transport: http('http://127.0.0.1:8545')
});

const ENTRYPOINT_ABI = [
  {
    inputs: [
      { name: 'ops', type: 'tuple[]', components: [
        { name: 'sender', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'initCode', type: 'bytes' },
        { name: 'callData', type: 'bytes' },
        { name: 'accountGasLimits', type: 'bytes32' },
        { name: 'preVerificationGas', type: 'uint256' },
        { name: 'gasFees', type: 'bytes32' },
        { name: 'paymasterAndData', type: 'bytes' },
        { name: 'signature', type: 'bytes' }
      ]},
      { name: 'beneficiary', type: 'address' }
    ],
    name: 'handleOps',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;

export async function submitUserOp(userOp: UserOperation<'0.7'>): Promise<Hex> {
  console.log('🚀 Submitting UserOperation to local EntryPoint...');
  
  const packedUserOp = packUserOp(userOp);
  
  const hash = await walletClient.writeContract({
    address: ENTRYPOINT_V07,
    abi: ENTRYPOINT_ABI,
    functionName: 'handleOps',
    args: [[packedUserOp], testAccount.address],
    gas: 50000000000n, // 7805995
    account: testAccount,
    chain: hardhat,
  });

  console.log('✅ UserOp submitted, transaction hash:', hash);
  return hash;
}

function packUserOp(userOp: UserOperation<'0.7'>) {
  const initCode = userOp.factory && userOp.factoryData
    ? `${userOp.factory}${userOp.factoryData.slice(2)}` as Hex
    : '0x' as Hex;
  
  const accountGasLimits = packGasLimits(userOp.verificationGasLimit, userOp.callGasLimit);
  const gasFees = packGasFees(userOp.maxPriorityFeePerGas, userOp.maxFeePerGas);
  
  const paymasterAndData = userOp.paymaster && userOp.paymasterVerificationGasLimit
    ? packPaymasterData(userOp.paymaster, userOp.paymasterVerificationGasLimit, userOp.paymasterPostOpGasLimit || 0n, userOp.paymasterData || '0x')
    : '0x' as Hex;
  
  return {
    sender: userOp.sender,
    nonce: userOp.nonce,
    initCode,
    callData: userOp.callData,
    accountGasLimits,
    preVerificationGas: userOp.preVerificationGas,
    gasFees,
    paymasterAndData,
    signature: userOp.signature,
  };
}

function packGasLimits(verificationGasLimit: bigint, callGasLimit: bigint): Hex {
  const packed = (verificationGasLimit << 128n) | callGasLimit;
  return `0x${packed.toString(16).padStart(64, '0')}` as Hex;
}

function packGasFees(maxPriorityFeePerGas: bigint, maxFeePerGas: bigint): Hex {
  const packed = (maxPriorityFeePerGas << 128n) | maxFeePerGas;
  return `0x${packed.toString(16).padStart(64, '0')}` as Hex;
}

function packPaymasterData(paymaster: Hex, verificationGasLimit: bigint, postOpGasLimit: bigint, paymasterData: Hex): Hex {
  const gasLimits = packGasLimits(verificationGasLimit, postOpGasLimit);
  return `${paymaster}${gasLimits.slice(2)}${paymasterData.slice(2)}` as Hex;
}
export async function waitForUserOpReceipt(txHash: Hex): Promise<any> {
  console.log('⏳ Waiting for transaction receipt...');
  
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    timeout: 60000,
  });
  
  console.log('✅ Transaction mined!');
  console.log('Gas used:', receipt.gasUsed);
  return receipt;
}