
import hre from "hardhat";
const { viem, networkHelpers } = await hre.network.connect();

async function main() {
  const FACTORY_ADDRESS = "0x809bf61b0254c3602438d01e1ba57ee932746256"; // Your factory
  
  // Your actual public key from the error
  const PUBLIC_KEY_X = "0x4c1ed7f52d20946ce630c3620b8806c317e2cb9d34e9656889a960240b83f8ae";
  const PUBLIC_KEY_Y = "0x2c41630bf853729580c3ea3ca6b39430c1f2d57194b6ab656e5477aa45b15d1d";
  
  console.log("🧪 Testing Factory Deployment\n");
  console.log("Factory:", FACTORY_ADDRESS);
  console.log("Public Key X:", PUBLIC_KEY_X);
  console.log("Public Key Y:", PUBLIC_KEY_Y);
  console.log();
  
  const [deployer] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();
  
  const factory = await viem.getContractAt("Level2Factory", FACTORY_ADDRESS);
  
  // Step 1: Calculate expected address
  console.log("Step 1: Calculating counterfactual address...");
  const expectedAddress = await factory.read.getAddress([
    BigInt(PUBLIC_KEY_X),
    BigInt(PUBLIC_KEY_Y),
    0n
  ]);
  console.log("Expected address:", expectedAddress);
  
  // Step 2: Check if already deployed
  const bytecode = await publicClient.getBytecode({ address: expectedAddress });
  const isDeployed = bytecode !== undefined && bytecode !== "0x";
  console.log("Already deployed:", isDeployed);
  
  if (isDeployed) {
    console.log("\n✅ Account already exists! No need to deploy.");
    return;
  }
  
  // Step 3: Try to deploy directly
  console.log("\nStep 2: Attempting direct deployment via factory...");
  
  try {
    const hash = await factory.write.createAccount([
      BigInt(PUBLIC_KEY_X),
      BigInt(PUBLIC_KEY_Y),
      0n
    ]);
    
    console.log("Transaction hash:", hash);
    console.log("Waiting for confirmation...");
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    if (receipt.status === "success") {
      console.log("\n✅ Deployment succeeded!");
      console.log("Gas used:", receipt.gasUsed.toString());
      
      // Verify deployment
      const newBytecode = await publicClient.getBytecode({ address: expectedAddress });
      console.log("Account deployed:", newBytecode !== undefined && newBytecode !== "0x");
    } else {
      console.log("\n❌ Deployment transaction reverted");
    }
    
  } catch (error: any) {
    console.log("\n❌ Deployment failed!");
    console.log("Error:", error.message);
    
    if (error.message.includes("P-256")) {
      console.log("\n💡 Issue: P-256 precompile not available");
      console.log("Solution: Switch to Base Sepolia");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });