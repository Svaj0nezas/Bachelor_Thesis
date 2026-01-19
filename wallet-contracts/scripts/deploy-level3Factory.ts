import hre from "hardhat";

async function main() {
  const { viem } = await hre.network.connect();
  
  console.log("Starting Level3Factory deployment to Sepolia...\n");

  // Get deployer account
  const [deployer] = await viem.getWalletClients();
  console.log("Deploying from:", deployer.account.address);

  // Contract addresses from previous deployment
  const P384_VERIFIER = "0xfa328a64803638678fb48c0c81ea29b3df558536";
  
  // ERC-4337 EntryPoint v0.7 on Sepolia
  const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

  console.log("\nUsing addresses:");
  console.log("EntryPoint:    ", ENTRY_POINT);
  console.log("P384Verifier:  ", P384_VERIFIER);

  // Deploy Level3Factory
  console.log("\n1️⃣  Deploying Level3Factory...");
  const level3Factory = await viem.deployContract("Level3Factory", [
    ENTRY_POINT,
    P384_VERIFIER,
  ]);
  console.log("✅ Level3Factory deployed to:", level3Factory.address);

  // Summary
  console.log("\n========================================");
  console.log("🎉 Deployment Complete!");
  console.log("========================================");
  console.log("EntryPoint:      ", ENTRY_POINT);
  console.log("P384Verifier:    ", P384_VERIFIER);
  console.log("Level3Factory:   ", level3Factory.address);
  console.log("========================================");

  // Save addresses
  const addresses = {
    network: "sepolia",
    timestamp: new Date().toISOString(),
    contracts: {
      EntryPoint: ENTRY_POINT,
      P384Verifier: P384_VERIFIER,
      Level3Factory: level3Factory.address,
    },
  };

  const fs = await import("fs");
  fs.writeFileSync(
    "deployed-level3.json",
    JSON.stringify(addresses, null, 2)
  );
  console.log("\n✅ Addresses saved to deployed-level3.json");

  // Important reminder
  console.log("\n⚠️  NEXT STEPS:");
  console.log("1. Update FACTORY_ADDRESS in backend/server.js");
  console.log("2. Update LEVEL3_FACTORY in frontend Level3.tsx");
  console.log("3. Run: npx hardhat run scripts/getBytecode.ts");
  console.log("4. Restart your backend server");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });