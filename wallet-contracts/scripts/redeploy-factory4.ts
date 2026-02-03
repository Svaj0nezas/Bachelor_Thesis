import hre from "hardhat";
const { viem } = await hre.network.connect();

async function main() {
  console.log("Redeploying Level4FactoryWithZK (factory only)...\n");

  // Get deployer account
  const [deployer] = await viem.getWalletClients();
  console.log("Deploying from:", deployer.account.address);

  const P384_VERIFIER = "0x0dcd1bf9a1b36ce34237eeafef220932846bcd82";
  const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
  
  const GROTH16_VERIFIER = "0xc5a5C42992dECbae36851359345FE25997F5C42d";

  console.log("\nUsing existing contracts:");
  console.log("EntryPoint:       ", ENTRY_POINT);
  console.log("P384Verifier:     ", P384_VERIFIER);
  console.log("Groth16Verifier:  ", GROTH16_VERIFIER);

  // Deploy ONLY Level4FactoryWithZK
  console.log("\n🔄 Deploying Level4FactoryWithZK (updated)...");
  const level4Factory = await viem.deployContract("Level4FactoryWithZK", [
    ENTRY_POINT,
    P384_VERIFIER,
    GROTH16_VERIFIER,
  ]);
  console.log("✅ Level4FactoryWithZK deployed to:", level4Factory.address);

  // Summary
  console.log("\n========================================");
  console.log("🎉 Redeployment Complete!");
  console.log("========================================");
  console.log("EntryPoint:          ", ENTRY_POINT);
  console.log("P384Verifier:        ", P384_VERIFIER);
  console.log("Groth16Verifier:     ", GROTH16_VERIFIER, "(reused)");
  console.log("Level4FactoryWithZK: ", level4Factory.address, "(NEW)");
  console.log("========================================");

  // Save addresses
  const addresses = {
    network: "localhost",
    timestamp: new Date().toISOString(),
    contracts: {
      EntryPoint: ENTRY_POINT,
      P384Verifier: P384_VERIFIER,
      Groth16Verifier: GROTH16_VERIFIER,
      Level4FactoryWithZK: level4Factory.address,
    },
  };

  const fs = await import("fs");
  fs.writeFileSync(
    "deployed-level4.json",
    JSON.stringify(addresses, null, 2)
  );
  console.log("\n✅ Addresses saved to deployed-level4.json");
  
  console.log("\n📋 Next steps:");
  console.log("1. Update LEVEL4_FACTORY in frontend to:", level4Factory.address);
  console.log("2. Update FACTORY_ABI to use uint[2] for publicSignals");
  console.log("3. Regenerate proof with updated circuit (2 public outputs)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });