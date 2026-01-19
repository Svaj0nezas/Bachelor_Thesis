import hre from "hardhat";
const { viem, networkHelpers } = await hre.network.connect();

async function main() {
  console.log("Starting Level3Factory deployment to Sepolia...\n");

  // Get deployer account
  const [deployer] = await  viem.getWalletClients();
  console.log("Deploying from:", deployer.account.address);

  // Contract addresses from previous deployment
  const P384_VERIFIER = "0x0d87c236431f08104f317eb23b4dcfd972a0e008";
  
  // ERC-4337 EntryPoint v0.7 on Sepolia
  const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

  console.log("\nUsing addresses:");
  console.log("EntryPoint:    ", ENTRY_POINT);
  console.log("P384Verifier:  ", P384_VERIFIER);

  // Deploy Level3Factory
  console.log("\n1️⃣  Deploying Level3Factory...");
  const level3Factory = await  viem.deployContract("Level3Factory", [
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
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });