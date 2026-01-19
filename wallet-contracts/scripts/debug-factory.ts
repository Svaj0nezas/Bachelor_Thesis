import hre from "hardhat";
const { viem, networkHelpers } = await hre.network.connect();

async function main() {
  const FACTORY_ADDRESS = "0x36ae15e9f691d163881060ecac33b0b30c9787a7" as `0x${string}`;
  
  console.log("🔍 Debugging factory at:", FACTORY_ADDRESS);
  console.log();
  
  const publicClient = await viem.getPublicClient();
  
  // Step 1: Check if bytecode exists
  console.log("Step 1: Checking deployment...");
  const bytecode = await publicClient.getBytecode({ address: FACTORY_ADDRESS });
  const isDeployed = bytecode !== undefined && bytecode !== "0x";
  
  console.log("Deployed:", isDeployed);
  console.log("Bytecode length:", bytecode ? bytecode.length : 0);
  
  if (!isDeployed) {
    console.log("\n❌ Factory is NOT deployed at this address!");
    console.log("Please redeploy the contracts.");
    return;
  }
  
  console.log("✅ Factory bytecode exists");
  console.log();
  
  // Step 2: Test getAddress function using direct contract call
  console.log("Step 2: Testing getAddress function...");
  
  try {
    const testAddress = await publicClient.readContract({
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
      args: [BigInt(0xffdfeb90a489c62169f90bbc152ecd43651d0abb2888d124d7bce15d0becbb0en), BigInt(0x0b9a2b52a94dc4d35b5a81f59967cbfba6cdbe1f2bb8f78b5d8d74a11466e08bn), 0n],
    });
    
    console.log("✅ getAddress works!");
    console.log("Returned address:", testAddress);
  } catch (err: any) {
    console.log("❌ getAddress FAILED!");
    console.log("Error:", err.message);
    
    if (err.cause) {
      console.log("Cause:", err.cause);
    }
    
    console.log();
    console.log("Possible issues:");
    console.log("1. Wrong factory address");
    console.log("2. Contract deployment failed");
    console.log("3. Solidity version mismatch");
    console.log("4. Level2Account constructor issue");
  }
  
  console.log();
  
  // Step 3: Check EntryPoint
  console.log("Step 3: Checking EntryPoint...");
  try {
    const entryPoint = await publicClient.readContract({
      address: FACTORY_ADDRESS,
      abi: [
        {
          inputs: [],
          name: "entryPoint",
          outputs: [{ name: "", type: "address" }],
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "entryPoint",
    });
    
    console.log("Factory EntryPoint:", entryPoint);
    
    const epBytecode = await publicClient.getBytecode({ address: entryPoint as `0x${string}` });
    console.log("EntryPoint exists:", epBytecode !== undefined && epBytecode !== "0x");
  } catch (err: any) {
    console.log("Could not read EntryPoint:", err.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });