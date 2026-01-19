import hre from "hardhat";
const { viem, networkHelpers } = await hre.network.connect();

const PUBLIC_KEY_X = BigInt("0x4c1ed7f52d20946ce630c3620b8806c317e2cb9d34e9656889a960240b83f8ae");
  const PUBLIC_KEY_Y = BigInt("0x2c41630bf853729580c3ea3ca6b39430c1f2d57194b6ab656e5477aa45b15d1d");

async function main() {
  const FACTORY_ADDRESS = "0x36ae15e9f691d163881060ecac33b0b30c9787a7" as `0x${string}`;
  const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as `0x${string}`;
  
  console.log("🧪 Testing direct deployment (bypassing getAddress)...\n");
  
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();
  
  // Try deploying directly
  console.log("Step 1: Deploying Level2Account directly...");
  
  try {
    const account = await viem.deployContract("Level2Account", [
      ENTRYPOINT,
      PUBLIC_KEY_X, // test X
      PUBLIC_KEY_Y, // test Y
    ]);
    
    console.log("✅ Direct deployment worked!");
    console.log("Account address:", account.address);
    
    // Now try getAddress from factory
    console.log("\nStep 2: Testing factory.getAddress...");
    
    const factoryAddress = await publicClient.readContract({
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
    
    console.log("Factory.getAddress returned:", factoryAddress);
    
  } catch (err: any) {
    console.log("❌ Failed!");
    console.log("Error:", err.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });