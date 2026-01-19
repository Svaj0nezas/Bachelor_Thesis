import { encodeFunctionData, Hex, concat, pad, toHex, slice } from "viem";

/**
 * UserOperation v0.7 format (for Pimlico v2 bundler)
 */
export interface UserOperationV7 {
  sender: Hex;
  nonce: Hex;
  factory: Hex | null; // "0x" if account already deployed
  factoryData: Hex | null; // "0x" if account already deployed
  callData: Hex;
  callGasLimit: Hex;
  verificationGasLimit: Hex;
  preVerificationGas: Hex;
  maxFeePerGas: Hex;
  maxPriorityFeePerGas: Hex;
  paymaster: Hex | null; // "0x" if no paymaster
  paymasterVerificationGasLimit: Hex | null;
  paymasterPostOpGasLimit: Hex | null;
  paymasterData: Hex | null;
  signature: Hex;
}

/**
 * Internal format for building
 */
export interface UserOperationInternal {
  sender: Hex;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: Hex;
  signature: Hex;
}

export class UserOpBuilder {
  private userOp: Partial<UserOperationInternal>;

  constructor() {
    this.userOp = {
      paymasterAndData: "0x",
      signature: "0x",
    };
  }

  setSender(sender: Hex) {
    this.userOp.sender = sender;
    return this;
  }

  setNonce(nonce: bigint) {
    this.userOp.nonce = nonce;
    return this;
  }

  setInitCode(initCode: Hex) {
    this.userOp.initCode = initCode;
    return this;
  }

  setCallData(callData: Hex) {
    this.userOp.callData = callData;
    return this;
  }

  setGasLimits(
    callGasLimit: bigint,
    verificationGasLimit: bigint,
    preVerificationGas: bigint
  ) {
    this.userOp.callGasLimit = callGasLimit;
    this.userOp.verificationGasLimit = verificationGasLimit;
    this.userOp.preVerificationGas = preVerificationGas;
    return this;
  }

  setGasFees(maxFeePerGas: bigint, maxPriorityFeePerGas: bigint) {
    this.userOp.maxFeePerGas = maxFeePerGas;
    this.userOp.maxPriorityFeePerGas = maxPriorityFeePerGas;
    return this;
  }

  setSignature(signature: Hex) {
    this.userOp.signature = signature;
    return this;
  }

  build(): UserOperationInternal {
    if (!this.userOp.sender) throw new Error("Sender not set");
    if (this.userOp.nonce === undefined) throw new Error("Nonce not set");
    if (!this.userOp.initCode) throw new Error("InitCode not set");
    if (!this.userOp.callData) throw new Error("CallData not set");
    if (!this.userOp.callGasLimit) throw new Error("CallGasLimit not set");
    if (!this.userOp.verificationGasLimit)
      throw new Error("VerificationGasLimit not set");
    if (this.userOp.preVerificationGas === undefined)
      throw new Error("PreVerificationGas not set");
    if (!this.userOp.maxFeePerGas) throw new Error("MaxFeePerGas not set");
    if (!this.userOp.maxPriorityFeePerGas)
      throw new Error("MaxPriorityFeePerGas not set");
    if (!this.userOp.signature) throw new Error("Signature not set");

    return this.userOp as UserOperationInternal;
  }

  /**
   * Convert to v0.7 format for Pimlico bundler
   * Splits initCode into factory + factoryData
   * Splits paymasterAndData into paymaster + gas limits + data
   */
  static toV7Format(userOp: UserOperationInternal): UserOperationV7 {
    // Split initCode
    let factory: Hex | null = null;
    let factoryData: Hex | null = null;

    if (userOp.initCode && userOp.initCode !== "0x" && userOp.initCode.length > 2) {
      // initCode format: factory_address (20 bytes) + factoryData
      factory = slice(userOp.initCode, 0, 20); // First 20 bytes
      factoryData = slice(userOp.initCode, 20); // Rest
    }

    // Split paymasterAndData (we don't use paymaster, so all null)
    let paymaster: Hex | null = null;
    let paymasterVerificationGasLimit: Hex | null = null;
    let paymasterPostOpGasLimit: Hex | null = null;
    let paymasterData: Hex | null = null;

    return {
      sender: userOp.sender,
      nonce: toHex(userOp.nonce),
      factory,
      factoryData,
      callData: userOp.callData,
      callGasLimit: toHex(userOp.callGasLimit),
      verificationGasLimit: toHex(userOp.verificationGasLimit),
      preVerificationGas: toHex(userOp.preVerificationGas),
      maxFeePerGas: toHex(userOp.maxFeePerGas),
      maxPriorityFeePerGas: toHex(userOp.maxPriorityFeePerGas),
      paymaster,
      paymasterVerificationGasLimit,
      paymasterPostOpGasLimit,
      paymasterData,
      signature: userOp.signature,
    };
  }

  static buildExecuteCallData(dest: Hex, value: bigint, func: Hex = "0x"): Hex {
    return encodeFunctionData({
      abi: [
        {
          inputs: [
            { name: "dest", type: "address" },
            { name: "value", type: "uint256" },
            { name: "func", type: "bytes" },
          ],
          name: "execute",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function",
        },
      ],
      functionName: "execute",
      args: [dest, value, func],
    });
  }
}