// frontend/src/lib/wallet/Level1Wallet.ts
import { ethers } from "ethers";
import { BundlerClient } from "../bundler";
import { TransactionLogger } from "../logger";

export class Level1Wallet {
  private provider: ethers.BrowserProvider;
  private signer: ethers.Signer;
  private accountAddress: string;
  private factoryAddress: string;
  private entryPointAddress: string;
  private bundler: BundlerClient;
  private logger: TransactionLogger;
  
  constructor(
    provider: ethers.BrowserProvider,
    factoryAddress: string,
    entryPointAddress: string,
    bundlerUrl: string
  ) {
    this.provider = provider;
    this.factoryAddress = factoryAddress;
    this.entryPointAddress = entryPointAddress;
    this.bundler = new BundlerClient(bundlerUrl, entryPointAddress);
    this.logger = new TransactionLogger();
  }
  
  async initialize() {
    this.signer = await this.provider.getSigner();
    this.accountAddress = await this.getAccountAddress();
    this.logger.log("Level 1 Account initialized", { accountAddress: this.accountAddress });
  }
  
  async getAccountAddress(): Promise<string> {
    const ownerAddress = await this.signer.getAddress();
    const factory = new ethers.Contract(
      this.factoryAddress,
      ["function getAddress(address,uint256) view returns (address)"],
      this.provider
    );
    
    return await factory.getAddress(ownerAddress, 0);
  }
  
  async sendTransaction(to: string, value: bigint, data: string = "0x") {
    this.logger.log("Creating Level 1 transaction", { to, value: value.toString(), data });
    
    // 1. Create UserOperation
    const userOp = await this.createUserOperation(to, value, data);
    this.logger.log("UserOperation created", userOp);
    
    // 2. Sign with EOA
    const signature = await this.signUserOperation(userOp);
    userOp.signature = signature;
    this.logger.log("UserOperation signed", { signature });
    
    // 3. Submit to bundler
    this.logger.log("Submitting to bundler...");
    const userOpHash = await this.bundler.sendUserOperation(userOp);
    this.logger.log("UserOperation submitted", { userOpHash });
    
    // 4. Wait for receipt
    this.logger.log("Waiting for transaction...");
    const receipt = await this.bundler.waitForUserOperation(userOpHash);
    this.logger.log("Transaction successful!", receipt);
    
    return receipt;
  }
  
  async createUserOperation(target: string, value: bigint, data: string) {
    const code = await this.provider.getCode(this.accountAddress);
    const accountExists = code !== "0x";
    
    const entryPoint = new ethers.Contract(
      this.entryPointAddress,
      ["function getNonce(address,uint192) view returns (uint256)"],
      this.provider
    );
    const nonce = await entryPoint.getNonce(this.accountAddress, 0);
    
    const accountInterface = new ethers.Interface([
      "function execute(address,uint256,bytes)"
    ]);
    const callData = accountInterface.encodeFunctionData("execute", [target, value, data]);
    
    const feeData = await this.provider.getFeeData();
    
    return {
      sender: this.accountAddress,
      nonce: nonce.toString(),
      initCode: accountExists ? "0x" : await this.getInitCode(),
      callData,
      callGasLimit: "100000",
      verificationGasLimit: "500000",
      preVerificationGas: "50000",
      maxFeePerGas: feeData.maxFeePerGas?.toString() || "2000000000",
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString() || "1000000000",
      paymasterAndData: "0x",
      signature: "0x"
    };
  }
  
  async signUserOperation(userOp: any): Promise<string> {
    const userOpHash = await this.getUserOpHash(userOp);
    return await this.signer.signMessage(ethers.getBytes(userOpHash));
  }
  
  async getUserOpHash(userOp: any): Promise<string> {
    // Simplified - in production, properly encode the UserOp
    const packed = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "bytes32", "bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
      [
        userOp.sender,
        userOp.nonce,
        ethers.keccak256(userOp.initCode),
        ethers.keccak256(userOp.callData),
        userOp.callGasLimit,
        userOp.verificationGasLimit,
        userOp.preVerificationGas,
        userOp.maxFeePerGas,
        userOp.maxPriorityFeePerGas,
        ethers.keccak256(userOp.paymasterAndData)
      ]
    );
    
    const chainId = (await this.provider.getNetwork()).chainId;
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "uint256"],
        [ethers.keccak256(packed), this.entryPointAddress, chainId]
      )
    );
  }
  
  async getInitCode(): Promise<string> {
    const ownerAddress = await this.signer.getAddress();
    const factoryInterface = new ethers.Interface([
      "function createAccount(address,uint256) returns (address)"
    ]);
    
    const initCallData = factoryInterface.encodeFunctionData("createAccount", [
      ownerAddress,
      0
    ]);
    
    return ethers.concat([this.factoryAddress, initCallData]);
  }
  
  getLogger(): TransactionLogger {
    return this.logger;
  }
}