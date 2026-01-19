import {
  createPublicClient,
  http,
  Hex,
  concat,
  encodeFunctionData,
  toHex,
  pad,
} from "viem";
import { sepolia } from "viem/chains";
import { CONTRACTS } from "../contracts/addresses";
import { signWithPasskey } from "./passkey";
import type { WebAuthnSignature } from "./passkey";

interface UserOperationInternal {
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

interface UserOperationV7 {
  sender: Hex;
  nonce: Hex;
  factory: Hex | null;
  factoryData: Hex | null;
  callData: Hex;
  callGasLimit: Hex;
  verificationGasLimit: Hex;
  preVerificationGas: Hex;
  maxFeePerGas: Hex;
  maxPriorityFeePerGas: Hex;
  paymaster: Hex | null;
  paymasterVerificationGasLimit: Hex | null;
  paymasterPostOpGasLimit: Hex | null;
  paymasterData: Hex | null;
  signature: Hex;
}

export class Level2Wallet {
  private publicClient: any;
  private bundlerClient: any;
  private factoryAddress: `0x${string}`;
  private entryPointAddress: `0x${string}`;

  constructor() {
    this.factoryAddress = CONTRACTS.sepolia.level2Factory;
    this.entryPointAddress = CONTRACTS.sepolia.entryPoint;

    this.publicClient = createPublicClient({
      chain: sepolia,
      transport: http(CONTRACTS.sepolia.rpcUrl),
    });

    this.bundlerClient = createPublicClient({
      chain: sepolia,
      transport: http(CONTRACTS.sepolia.bundlerUrl),
    });
  }

  async getAccountAddress(
    publicKeyX: bigint,
    publicKeyY: bigint,
    salt = BigInt(0)
  ): Promise<`0x${string}`> {
    const address = await this.publicClient.readContract({
      address: this.factoryAddress,
      abi: [
        {
          inputs: [
            { name: "publicKeyX", type: "uint256" },
            { name: "publicKeyY", type: "uint256" },
            { name: "salt", type: "uint256" },
          ],
          name: "getAddress",
          outputs: [{ name: "", type: "address" }],
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "getAddress",
      args: [publicKeyX, publicKeyY, salt],
    });

    return address as `0x${string}`;
  }

  async isDeployed(accountAddress: `0x${string}`): Promise<boolean> {
    const bytecode = await this.publicClient.getBytecode({
      address: accountAddress,
    });
    return bytecode !== undefined && bytecode !== "0x";
  }

  async getNonce(accountAddress: `0x${string}`): Promise<bigint> {
    try {
      const nonce = await this.publicClient.readContract({
        address: this.entryPointAddress,
        abi: [
          {
            inputs: [
              { name: "sender", type: "address" },
              { name: "key", type: "uint192" },
            ],
            name: "getNonce",
            outputs: [{ name: "", type: "uint256" }],
            stateMutability: "view",
            type: "function",
          },
        ],
        functionName: "getNonce",
        args: [accountAddress, BigInt(0)],
      });
      return nonce as bigint;
    } catch (error) {
      return BigInt(0);
    }
  }

  async getBalance(accountAddress: `0x${string}`): Promise<bigint> {
    return await this.publicClient.getBalance({ address: accountAddress });
  }

  async sendUserOp(
    accountAddress: `0x${string}`,
    credentialId: string,
    publicKeyX: bigint,
    publicKeyY: bigint,
    to: `0x${string}`,
    value: bigint,
    debugCallback?: (data: any) => void
  ) {
    console.log("🔧 Building UserOperation...");

    const deployed = await this.isDeployed(accountAddress);
    const nonce = await this.getNonce(accountAddress);

    console.log("Account deployed:", deployed);
    console.log("Nonce:", nonce.toString());

    // Build initCode (only if not deployed)
    let initCode: Hex = "0x";
    if (!deployed) {
      const createAccountData = encodeFunctionData({
        abi: [
          {
            inputs: [
              { name: "publicKeyX", type: "uint256" },
              { name: "publicKeyY", type: "uint256" },
              { name: "salt", type: "uint256" },
            ],
            name: "createAccount",
            outputs: [{ name: "account", type: "address" }],
            stateMutability: "nonpayable",
            type: "function",
          },
        ],
        functionName: "createAccount",
        args: [publicKeyX, publicKeyY, BigInt(0)],
      });
      initCode = concat([this.factoryAddress, createAccountData]);
      console.log("InitCode (deploying):", initCode);
      
    }
    console.log("pubkey:::::", publicKeyX)
    console.log(publicKeyY)
    // Build callData
    const callData = encodeFunctionData({
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
      args: [to, value, "0x"],
    });
    console.log("CallData:", callData);

    // Get gas fees
    const { maxFeePerGas, maxPriorityFeePerGas } = await this.getGasFees();

    // Build UserOp
    const userOp: UserOperationInternal = {
      sender: accountAddress,
      nonce,
      initCode,
      callData,
      callGasLimit: BigInt(300000),
      verificationGasLimit: BigInt(3000000),
      preVerificationGas: BigInt(300000),
      maxFeePerGas,
      maxPriorityFeePerGas,
      paymasterAndData: "0x",
      signature: "0x",
    };

    console.log("UserOp built:", userOp);

    // Get UserOpHash from EntryPoint
    const userOpHash = await this.getEntryPointUserOpHash(userOp);
    console.log("🔑 EntryPoint UserOpHash:", userOpHash);

    // Sign with Touch ID and get WebAuthn components!
    console.log("🔐 Requesting Touch ID signature...");
    const webauthnSig = await signWithPasskey(credentialId, userOpHash);
    console.log("✅ Touch ID signature obtained!");
    console.log("  r:", "0x" + webauthnSig.r.toString(16));
    console.log("  s:", "0x" + webauthnSig.s.toString(16));
    console.log("  authenticatorData length:", webauthnSig.authenticatorData.length);
    console.log("  clientDataJSON length:", webauthnSig.clientDataJSON.length);
    console.log("  challengeIndex:", webauthnSig.challengeIndex);
    console.log("  typeIndex:", webauthnSig.typeIndex);

    if (debugCallback) {
      debugCallback({
        userOpHash,
        authenticatorData: webauthnSig.authenticatorData,
        clientDataJSON: webauthnSig.clientDataJSON,
        challengeIndex: webauthnSig.challengeIndex,
        typeIndex: webauthnSig.typeIndex,
        r: webauthnSig.r,
        s: webauthnSig.s,
        signature: null, // Will add after encoding
      });
    }

    // Encode WebAuthn signature in contract format
    const signature = this.encodeWebAuthnSignature(webauthnSig);
    userOp.signature = signature;

    if (debugCallback) {
      debugCallback({
        userOpHash,
        authenticatorData: webauthnSig.authenticatorData,
        clientDataJSON: webauthnSig.clientDataJSON,
        challengeIndex: webauthnSig.challengeIndex,
        typeIndex: webauthnSig.typeIndex,
        r: webauthnSig.r,
        s: webauthnSig.s,
        signature: signature,
      });
    }
  

    console.log("Signature (WebAuthn format):", signature.slice(0, 66) + "...");
    console.log("Signature length:", (signature.length - 2) / 2, "bytes");

    // Convert to v0.7 format
    const userOpV7 = this.toV7Format(userOp);
    console.log("UserOp v0.7 format:", userOpV7);

    // Submit to bundler
    console.log("📤 Submitting to bundler...");
    const userOpHashResult = await this.submitUserOp(userOpV7);
    console.log("✅ UserOp submitted:", userOpHashResult);

    return userOpHashResult;
  }

  /**
   * Encode WebAuthn signature in contract format:
   * [authDataLen (2)][authData][clientDataLen (2)][clientData][challengeIdx (2)][typeIdx (2)][r (32)][s (32)]
   */
  private encodeWebAuthnSignature(sig: WebAuthnSignature): Hex {
    const authDataLen = sig.authenticatorData.length;
    const clientDataBytes = new TextEncoder().encode(sig.clientDataJSON);
    const clientDataLen = clientDataBytes.length;

    // Calculate total length
    const totalLen = 2 + authDataLen + 2 + clientDataLen + 2 + 2 + 32 + 32;
    const buffer = new Uint8Array(totalLen);
    let offset = 0;

    // Write authenticatorData length (2 bytes, big-endian)
    buffer[offset] = (authDataLen >> 8) & 0xff;
    buffer[offset + 1] = authDataLen & 0xff;
    offset += 2;

    // Write authenticatorData
    buffer.set(sig.authenticatorData, offset);
    offset += authDataLen;

    // Write clientDataJSON length (2 bytes, big-endian)
    buffer[offset] = (clientDataLen >> 8) & 0xff;
    buffer[offset + 1] = clientDataLen & 0xff;
    offset += 2;

    // Write clientDataJSON
    buffer.set(clientDataBytes, offset);
    offset += clientDataLen;

    // Write challengeIndex (2 bytes, big-endian)
    buffer[offset] = (sig.challengeIndex >> 8) & 0xff;
    buffer[offset + 1] = sig.challengeIndex & 0xff;
    offset += 2;

    // Write typeIndex (2 bytes, big-endian)
    buffer[offset] = (sig.typeIndex >> 8) & 0xff;
    buffer[offset + 1] = sig.typeIndex & 0xff;
    offset += 2;

    // Write r (32 bytes)
    const rHex = sig.r.toString(16).padStart(64, "0");
    const rBytes = new Uint8Array(
      rHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );
    buffer.set(rBytes, offset);
    offset += 32;

    // Write s (32 bytes)
    const sHex = sig.s.toString(16).padStart(64, "0");
    const sBytes = new Uint8Array(
      sHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );
    buffer.set(sBytes, offset);

    // Convert to hex
    return (
      "0x" +
      Array.from(buffer)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    ) as Hex;
  }

  private async getGasFees() {
    try {
      // Get Pimlico's recommended prices
      const gasPrice: any = await this.bundlerClient.request({
        method: "pimlico_getUserOperationGasPrice" as any,
      });
  
      console.log("Pimlico gas prices:", gasPrice);
  
      // Use the "fast" tier
      return {
        maxFeePerGas: BigInt(gasPrice.fast.maxFeePerGas),
        maxPriorityFeePerGas: BigInt(gasPrice.fast.maxPriorityFeePerGas),
      };
    } catch (error) {
      console.warn("Pimlico gas price API failed, using high static values:", error);
      
      // Fallback to safe high values
      return {
        maxFeePerGas: BigInt(4000000000),      // 3 gwei
        maxPriorityFeePerGas: BigInt(3000000000), // 2 gwei
      };
    }
  }

  private async getEntryPointUserOpHash(
    userOp: UserOperationInternal
  ): Promise<Hex> {
    const verificationHex = pad(toHex(userOp.verificationGasLimit), {
      size: 16,
    });
    const callHex = pad(toHex(userOp.callGasLimit), { size: 16 });
    const accountGasLimits = concat([verificationHex, callHex]);

    const priorityHex = pad(toHex(userOp.maxPriorityFeePerGas), { size: 16 });
    const maxFeeHex = pad(toHex(userOp.maxFeePerGas), { size: 16 });
    const gasFees = concat([priorityHex, maxFeeHex]);

    try {
      const hash = await this.publicClient.readContract({
        address: this.entryPointAddress,
        abi: [
          {
            inputs: [
              {
                components: [
                  { name: "sender", type: "address" },
                  { name: "nonce", type: "uint256" },
                  { name: "initCode", type: "bytes" },
                  { name: "callData", type: "bytes" },
                  { name: "accountGasLimits", type: "bytes32" },
                  { name: "preVerificationGas", type: "uint256" },
                  { name: "gasFees", type: "bytes32" },
                  { name: "paymasterAndData", type: "bytes" },
                  { name: "signature", type: "bytes" },
                ],
                name: "packedUserOp",
                type: "tuple",
              },
            ],
            name: "getUserOpHash",
            outputs: [{ name: "", type: "bytes32" }],
            stateMutability: "view",
            type: "function",
          },
        ],
        functionName: "getUserOpHash",
        args: [
          {
            sender: userOp.sender,
            nonce: userOp.nonce,
            initCode: userOp.initCode,
            callData: userOp.callData,
            accountGasLimits: accountGasLimits,
            preVerificationGas: userOp.preVerificationGas,
            gasFees: gasFees,
            paymasterAndData: userOp.paymasterAndData,
            signature: "0x",
          },
        ],
      });

      return hash as Hex;
    } catch (error) {
      console.error("❌ EntryPoint getUserOpHash failed:", error);
      throw error;
    }
  }

  private toV7Format(userOp: UserOperationInternal): UserOperationV7 {
    let factory: Hex | null = null;
    let factoryData: Hex | null = null;

    if (
      userOp.initCode &&
      userOp.initCode !== "0x" &&
      userOp.initCode.length > 2
    ) {
      factory = userOp.initCode.slice(0, 42) as Hex;
      factoryData = ("0x" + userOp.initCode.slice(42)) as Hex;
    }

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
      paymaster: null,
      paymasterVerificationGasLimit: null,
      paymasterPostOpGasLimit: null,
      paymasterData: null,
      signature: userOp.signature,
    };
  }

  private async submitUserOp(userOpV7: UserOperationV7): Promise<Hex> {
    const userOpHash = await this.bundlerClient.request({
      method: "eth_sendUserOperation" as any,
      params: [userOpV7, this.entryPointAddress],
    });

    return userOpHash as Hex;
  }

  async getUserOpReceipt(userOpHash: Hex) {
    const receipt = await this.bundlerClient.request({
      method: "eth_getUserOperationReceipt" as any,
      params: [userOpHash],
    });

    return receipt;
  }
}