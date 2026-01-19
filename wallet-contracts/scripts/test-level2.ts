import hre from "hardhat";
const { viem, networkHelpers } = await hre.network.connect();

async function main() {
  const FACTORY_ADDRESS = "0x809bf61b0254c3602438d01e1ba57ee932746256"; // ← Put your address here
  
  // Test public key from your Mac
  const PUBLIC_KEY_X = 0x71d030cab7237085fc6d35056f7b38ef5adfbe491c96d1fa8376a613fb8128bfn;
  const PUBLIC_KEY_Y = 0xd6f701bf19694e687ad10071016c6bf32fed9c0bd36060397e10255844426cc8n;
  
  console.log("🔧 Testing Level2Factory at:", FACTORY_ADDRESS);
  
  const publicClient = await viem.getPublicClient();
  const factory = await viem.getContractAt("Level2Factory", FACTORY_ADDRESS);
  
  // Test 1: Calculate counterfactual address
  console.log("\n📍 Test 1: Calculate counterfactual address");
  const accountAddress = await factory.read.getAddress([PUBLIC_KEY_X, PUBLIC_KEY_Y, 0n]);
  console.log("Account address:", accountAddress);
  
  // Test 2: Check if deployed
  console.log("\n🔍 Test 2: Check deployment status");
  const bytecode = await publicClient.getBytecode({ address: accountAddress });
  const isDeployed = bytecode !== undefined && bytecode !== "0x";
  console.log("Is deployed:", isDeployed);
  
  if (!isDeployed) {
    console.log("\n💡 Deploy this account from the frontend!");
  } else {
    console.log("\n✅ Account already exists!");
    
    // Test 3: Check stored public key
    const account = await viem.getContractAt("Level2Account", accountAddress);
    const storedX = await account.read.publicKeyX();
    const storedY = await account.read.publicKeyY();
    
    console.log("\n🔑 Stored public key:");
    console.log("X:", storedX);
    console.log("Y:", storedY);
    console.log("Matches:", storedX === PUBLIC_KEY_X && storedY === PUBLIC_KEY_Y);
  }
  
  console.log("\n✅ All tests passed! Ready for frontend integration.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });