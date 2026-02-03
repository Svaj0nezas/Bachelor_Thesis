import hre from "hardhat";
const { viem } = await hre.network.connect();

async function main() {
  console.log("Starting Level4 ZK Age Verification deployment to Sepolia...\n");

  // Get deployer account
  const [deployer] = await viem.getWalletClients();
  console.log("Deploying from:", deployer.account.address);

  // Contract addresses from previous deployments
  const P384_VERIFIER = "0x0dcd1bf9a1b36ce34237eeafef220932846bcd82";
  
  const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

  console.log("\nUsing addresses:");
  console.log("EntryPoint:    ", ENTRY_POINT);
  console.log("P384Verifier:  ", P384_VERIFIER);

  // Deploy Groth16Verifier (ZK proof verifier)
  console.log("\n1️⃣  Deploying Groth16Verifier...");
  const groth16Verifier = await viem.deployContract("Groth16Verifier", []);
  console.log("✅ Groth16Verifier deployed to:", groth16Verifier.address);

  // Deploy Level4FactoryWithZK
  console.log("\n2️⃣  Deploying Level4FactoryWithZK...");
  const level4Factory = await viem.deployContract("Level4FactoryWithZK", [
    ENTRY_POINT,
    P384_VERIFIER,
    groth16Verifier.address,
  ]);
  console.log("✅ Level4FactoryWithZK deployed to:", level4Factory.address);

  // Summary
  console.log("\n========================================");
  console.log("🎉 Deployment Complete!");
  console.log("========================================");
  console.log("EntryPoint:          ", ENTRY_POINT);
  console.log("P384Verifier:        ", P384_VERIFIER);
  console.log("Groth16Verifier:     ", groth16Verifier.address);
  console.log("Level4FactoryWithZK: ", level4Factory.address);
  console.log("========================================");

  // Save addresses
  const addresses = {
    network: "localhost",
    timestamp: new Date().toISOString(),
    contracts: {
      EntryPoint: ENTRY_POINT,
      P384Verifier: P384_VERIFIER,
      Groth16Verifier: groth16Verifier.address,
      Level4FactoryWithZK: level4Factory.address,
    },
  };

  const fs = await import("fs");
  fs.writeFileSync(
    "deployed-level4.json",
    JSON.stringify(addresses, null, 2)
  );
  console.log("\n✅ Addresses saved to deployed-level4.json");
  
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });