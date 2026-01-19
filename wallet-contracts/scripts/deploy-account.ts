import hre from "hardhat";
const { viem, networkHelpers } = await hre.network.connect();

async function main() {
  const FACTORY_ADDRESS = "0x5c15d9adf23df08046a056ec430dcc908d1b48ef" as `0x${string}`;
  
  // Your public keys - using decimal notation directly!
  const PUBLIC_KEY_X = 75497800853877201302401056675108457983976223451524015093819313387728615413648n;
  const PUBLIC_KEY_Y = 62372115952703789797962943563719511710262806683316835967366744885021020917299n;
  
  console.log("🧪 Testing Level2Account deployment with WebAuthn...\n");
  console.log("Public Key X (decimal):", PUBLIC_KEY_X.toString());
  console.log("Public Key X (hex):", "0x" + PUBLIC_KEY_X.toString(16));
  console.log("Public Key Y (decimal):", PUBLIC_KEY_Y.toString());
  console.log("Public Key Y (hex):", "0x" + PUBLIC_KEY_Y.toString(16));
  console.log();
  
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();
  
  // Calculate expected address
  console.log("Calculating counterfactual address...");
  const expectedAddress = await publicClient.readContract({
    address: FACTORY_ADDRESS,
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
    args: [PUBLIC_KEY_X, PUBLIC_KEY_Y, 0n],
  });
  
  console.log("Expected address:", expectedAddress);
  console.log("\n⚠️ VERIFY: Does this match your frontend address?");
  
  // Check if already deployed
  const bytecode = await publicClient.getBytecode({ address: expectedAddress });
  if (bytecode && bytecode !== "0x") {
    console.log("\n✅ Account already deployed!");
    console.log("You can now try transactions from the frontend.");
    return;
  }
  
  console.log("\nAccount not deployed yet. Deploying now...\n");
  
  try {
    // Estimate gas
    console.log("Estimating gas...");
    const gasEstimate = await publicClient.estimateContractGas({
      address: FACTORY_ADDRESS,
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
      args: [PUBLIC_KEY_X, PUBLIC_KEY_Y, 0n],
      account: walletClient.account,
    });
    
    console.log("✅ Gas estimate:", gasEstimate.toString());
    
    // Deploy
    console.log("\nDeploying account...");
    const hash = await walletClient.writeContract({
      address: FACTORY_ADDRESS,
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
      args: [PUBLIC_KEY_X, PUBLIC_KEY_Y, 0n],
    });
    
    console.log("Transaction hash:", hash);
    console.log("Waiting for confirmation...");
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    if (receipt.status === "success") {
      console.log("\n✅ DEPLOYMENT SUCCESSFUL!");
      console.log("Gas used:", receipt.gasUsed.toString());
      console.log("Account address:", expectedAddress);
      console.log("\n🎉 You can now try sending transactions from the frontend!");
    } else {
      console.log("\n❌ Transaction reverted!");
    }
    
  } catch (err: any) {
    console.log("\n❌ DEPLOYMENT FAILED!");
    console.error("\nError message:", err.message);
    
    if (err.message.includes("revert")) {
      console.log("\n💡 The contract reverted during deployment.");
      console.log("Possible issues:");
      console.log("1. Missing dependencies (check compile output)");
      console.log("2. Import path errors in WebAuthn.sol");
      console.log("3. Contract size exceeds 24KB limit");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });