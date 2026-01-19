import hre from "hardhat";
const { viem, networkHelpers } = await hre.network.connect();
async function main() {
  const FACTORY_ADDRESS = "0x36ae15e9f691d163881060ecac33b0b30c9787a7" as `0x${string}`;
  
  // Your actual passkey public key (from frontend localStorage)
  const PUBLIC_KEY_X = BigInt("0x98c3626087a98586c9032d56003825c93e01578b4bf5c16999b2ce52eb6e61ee");
  const PUBLIC_KEY_Y = BigInt("0x559a1213bb521f0b382e30f942c51262049e17fb2ef9c199d3643baf4ddece9d");
  
  console.log("🚀 Deploying Level 2 Account...\n");
  console.log("Factory:", FACTORY_ADDRESS);
  console.log("Public Key X:", PUBLIC_KEY_X.toString());
  console.log("Public Key Y:", PUBLIC_KEY_Y.toString());
  console.log();
  
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();
  
  // Get the factory contract
  const factory = await viem.getContractAt("Level2Factory", FACTORY_ADDRESS);
  
  // Step 1: Calculate expected address
  console.log("Step 1: Calculating counterfactual address...");
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
  
  // Check if already deployed
  const bytecode = await publicClient.getBytecode({ address: expectedAddress });
  const isDeployed = bytecode !== undefined && bytecode !== "0x";
  
  if (isDeployed) {
    console.log("✅ Account already deployed!");
    console.log("\nYou can now try sending a transaction from the frontend.");
    return;
  }
  
  console.log("Account not deployed yet. Deploying now...\n");
  
  // Step 2: Deploy via factory
  console.log("Step 2: Calling factory.createAccount...");
  
  try {
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
      console.log("\n✅ Deployment successful!");
      console.log("Gas used:", receipt.gasUsed.toString());
      
      // Verify
      const newBytecode = await publicClient.getBytecode({ address: expectedAddress });
      console.log("Account deployed:", newBytecode !== undefined && newBytecode !== "0x");
      
      console.log("\n🎉 Your Level 2 account is ready!");
      console.log("Address:", expectedAddress);
      console.log("\nNow try sending a transaction from the frontend.");
    } else {
      console.log("\n❌ Deployment failed!");
    }
    
  } catch (err: any) {
    console.log("\n❌ Deployment failed!");
    console.log("Error:", err.message);
    
    if (err.message.includes("P-256")) {
      console.log("\n💡 The P-256 verifier might not be working correctly.");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });