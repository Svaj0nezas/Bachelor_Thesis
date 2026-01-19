import hre from "hardhat";
const { viem, networkHelpers } = await hre.network.connect();


async function main() {
  console.log("🔍 Testing RIP-7212 precompile on Sepolia...\n");
  
  const publicClient = await viem.getPublicClient();
  
  // Create dummy input (160 bytes: all zeros)
  const hash = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const r = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const s = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const qx = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const qy = "0x0000000000000000000000000000000000000000000000000000000000000000";
  
  const input = hash + r.slice(2) + s.slice(2) + qx.slice(2) + qy.slice(2);
  
  console.log("Calling precompile at 0x100...");
  console.log("Input length:", input.length / 2 - 1, "bytes\n");
  
  try {
    const result = await publicClient.call({
      to: "0x0000000000000000000000000000000000000100",
      data: input as `0x${string}`,
    });
    
    console.log("Raw result:", result);
    
    if (result && result.data && result.data !== "0x") {
      console.log("\n✅ SUCCESS! Precompile returned data:", result.data);
      console.log("✅ RIP-7212 IS available on this network!");
    } else {
      console.log("\n❌ FAILED! Precompile returned no data or empty data");
      console.log("❌ RIP-7212 is NOT available on this network");
      console.log("\n💡 Solution: Switch to Base Sepolia or Optimism Sepolia");
    }
  } catch (error: any) {
    console.log("\n❌ ERROR! Precompile call reverted");
    console.log("Error:", error.message);
    console.log("\n❌ RIP-7212 is NOT available on this network");
    console.log("\n💡 Solution: Switch to Base Sepolia or Optimism Sepolia");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });