import {
  createWalletClient,
  createPublicClient,
  http,
  custom,
  Hex,
  concat,
  encodePacked,
  encodeFunctionData,
  keccak256,
  toHex,
  pad
} from "viem";
import { sepolia } from "viem/chains";
import { CONTRACTS } from "../contracts/addresses";
import {
  UserOpBuilder,
  UserOperationInternal,
  UserOperationV7,
} from "../userOps/userOpBuilder";

export class Level1Wallet {
  private walletClient: any;
  private publicClient: any;
  private bundlerClient: any;
  private factoryAddress: `0x${string}`;
  private entryPointAddress: `0x${string}`;

  constructor() {
    this.factoryAddress = CONTRACTS.sepolia.level1Factory;
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

  async connect(ethereum: any) {
    this.walletClient = createWalletClient({
      chain: sepolia,
      transport: custom(ethereum),
    });
  }

  async getAccountAddress(
    ownerAddress: `0x${string}`,
    salt = BigInt(0)
  ): Promise<`0x${string}`> {
    const address = await this.publicClient.readContract({
      address: this.factoryAddress,
      abi: [
        {
          inputs: [
            { name: "owner", type: "address" },
            { name: "salt", type: "uint256" },
          ],
          name: "getAddress",
          outputs: [{ name: "", type: "address" }],
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "getAddress",
      args: [ownerAddress, salt],
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

  async deployAccount(ownerAddress: `0x${string}`, salt = BigInt(0)) {
    const [address] = await this.walletClient.getAddresses();

    const hash = await this.walletClient.writeContract({
      address: this.factoryAddress,
      abi: [
        {
          inputs: [
            { name: "owner", type: "address" },
            { name: "salt", type: "uint256" },
          ],
          name: "createAccount",
          outputs: [{ name: "account", type: "address" }],
          stateMutability: "nonpayable",
          type: "function",
        },
      ],
      functionName: "createAccount",
      args: [ownerAddress, salt],
      account: address,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    return receipt;
  }

  async getBalance(accountAddress: `0x${string}`): Promise<bigint> {
    return await this.publicClient.getBalance({ address: accountAddress });
  }

  async sendUserOp(
    accountAddress: `0x${string}`,
    ownerAddress: `0x${string}`,
    to: `0x${string}`,
    value: bigint
  ) {
    console.log("🔧 Building UserOperation...");
  
    const deployed = await this.isDeployed(accountAddress);
    const nonce = await this.getNonce(accountAddress);
  
    console.log("Account deployed:", deployed);
    console.log("Nonce:", nonce.toString());
  
    let initCode: Hex = "0x";
    if (!deployed) {
      const createAccountData = encodeFunctionData({
        abi: [
          {
            inputs: [
              { name: "owner", type: "address" },
              { name: "salt", type: "uint256" },
            ],
            name: "createAccount",
            outputs: [{ name: "account", type: "address" }],
            stateMutability: "nonpayable",
            type: "function",
          },
        ],
        functionName: "createAccount",
        args: [ownerAddress, BigInt(0)],
      });
      initCode = concat([this.factoryAddress, createAccountData]);
    }
  
    const callData = UserOpBuilder.buildExecuteCallData(to, value, "0x");
    const { maxFeePerGas, maxPriorityFeePerGas } = await this.getGasFees();
  
    const userOp = new UserOpBuilder()
      .setSender(accountAddress)
      .setNonce(nonce)
      .setInitCode(initCode)
      .setCallData(callData)
      .setGasLimits(BigInt(100000), BigInt(300000), BigInt(50000))
      .setGasFees(maxFeePerGas, maxPriorityFeePerGas)
      .setSignature("0x")
      .build();
  
    console.log("UserOp built:", userOp);
  
    // ✅ NEW: Ask EntryPoint to calculate the hash
    const userOpHash = await this.getEntryPointUserOpHash(userOp);
    console.log("EntryPoint UserOpHash:", userOpHash);
    
    // Also calculate our way for comparison
    const ourHash = this.getUserOpHash(userOp);
    console.log("Our calculated hash:", ourHash);
    
    if (userOpHash !== ourHash) {
      console.error("⚠️ HASH MISMATCH!");
      console.error("EntryPoint hash:", userOpHash);
      console.error("Our hash:      ", ourHash);
    }
  
    // Sign using EntryPoint's hash
    const signature = await this.signUserOpHash(userOpHash);
    console.log("Signature:", signature);
    userOp.signature = signature;
  
    const userOpV7 = UserOpBuilder.toV7Format(userOp);
    console.log("UserOp v0.7 format:", userOpV7);
  
    console.log("Submitting to bundler...");
    const userOpHashResult = await this.submitUserOp(userOpV7);
    console.log("✅ UserOp submitted:", userOpHashResult);
  
    return userOpHashResult;
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

  private getUserOpHash(userOp: UserOperationInternal): Hex {
    const chainId = sepolia.id;
  
    // Pack gas fields for v0.7
    const verificationHex = pad(toHex(userOp.verificationGasLimit), { size: 16 });
    const callHex = pad(toHex(userOp.callGasLimit), { size: 16 });
    const accountGasLimits = concat([verificationHex, callHex]);
  
    const priorityHex = pad(toHex(userOp.maxPriorityFeePerGas), { size: 16 });
    const maxFeeHex = pad(toHex(userOp.maxFeePerGas), { size: 16 });
    const gasFees = concat([priorityHex, maxFeeHex]);
  
    console.log("📊 UserOp Hash Calculation:");
    console.log("  sender:", userOp.sender);
    console.log("  nonce:", userOp.nonce.toString());
    console.log("  initCode hash:", keccak256(userOp.initCode));
    console.log("  callData hash:", keccak256(userOp.callData));
    console.log("  accountGasLimits:", accountGasLimits);
    console.log("  preVerificationGas:", userOp.preVerificationGas.toString());
    console.log("  gasFees:", gasFees);
    console.log("  paymasterAndData hash:", keccak256(userOp.paymasterAndData));
  
    const packed = encodePacked(
      [
        "address",
        "uint256", 
        "bytes32",
        "bytes32",
        "bytes32", // accountGasLimits is bytes32
        "uint256",
        "bytes32", // gasFees is bytes32
        "bytes32",
      ],
      [
        userOp.sender,
        userOp.nonce,
        keccak256(userOp.initCode),
        keccak256(userOp.callData),
        accountGasLimits,
        userOp.preVerificationGas,
        gasFees,
        keccak256(userOp.paymasterAndData),
      ]
    );
  
    console.log("  packed:", packed);
    const packedHash = keccak256(packed);
    console.log("  packedHash:", packedHash);
  
    const userOpHash = keccak256(
      encodePacked(
        ["bytes32", "address", "uint256"],
        [packedHash, this.entryPointAddress, BigInt(chainId)]
      )
    );
  
    console.log("  final userOpHash:", userOpHash);
    return userOpHash;
  }
  
  private async signUserOpHash(userOpHash: Hex): Promise<Hex> {
    const [address] = await this.walletClient.getAddresses();
  
    console.log("✍️ Signing UserOpHash:");
    console.log("  userOpHash (raw):", userOpHash);
    
    // Calculate what the prefixed hash would be
    const prefixedHash = keccak256(
      encodePacked(
        ["string", "bytes32"],
        ["\x19Ethereum Signed Message:\n32", userOpHash]
      )
    );
    console.log("  prefixedHash (what gets signed):", prefixedHash);
    console.log("  signer address:", address);
  
    const signature = await this.walletClient.signMessage({
      account: address,
      message: { raw: userOpHash },
    });
  
    console.log("  signature:", signature);
    return signature;
  }
  async getOwner(accountAddress: `0x${string}`): Promise<`0x${string}`> {
    const owner = await this.publicClient.readContract({
      address: accountAddress,
      abi: [
        {
          inputs: [],
          name: "owner",
          outputs: [{ name: "", type: "address" }],
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "owner",
    });
  
    return owner as `0x${string}`;
  }

  private async submitUserOp(userOp: UserOperationV7): Promise<Hex> {
    const userOpHash = await this.bundlerClient.request({
      method: "eth_sendUserOperation" as any,
      params: [userOp, this.entryPointAddress],
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

  async getEntryPointUserOpHash(userOp: UserOperationInternal): Promise<Hex> {
    // Convert to the format EntryPoint expects
    const verificationHex = pad(toHex(userOp.verificationGasLimit), { size: 16 });
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
            signature: "0x", // Placeholder for hash calculation
          },
        ],
      });
  
      console.log("✅ EntryPoint calculated hash:", hash);
      return hash as Hex;
    } catch (error) {
      console.error("❌ EntryPoint getUserOpHash failed:", error);
      throw error;
    }
  }
}