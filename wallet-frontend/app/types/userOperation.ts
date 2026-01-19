export interface UserOperationV07 {
    sender: `0x${string}`;
    nonce: bigint;
    factory: `0x${string}` | undefined;
    factoryData: `0x${string}` | undefined;
    callData: `0x${string}`;
    callGasLimit: bigint;
    verificationGasLimit: bigint;
    preVerificationGas: bigint;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
    paymaster: `0x${string}` | undefined;
    paymasterVerificationGasLimit: bigint | undefined;
    paymasterPostOpGasLimit: bigint | undefined;
    paymasterData: `0x${string}` | undefined;
    signature: `0x${string}`;
  }