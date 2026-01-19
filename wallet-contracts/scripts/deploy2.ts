import hre from "hardhat";

const { viem, networkHelpers } = await hre.network.connect();

async function main() {
  const ENTRYPOINT_ADDRESS = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

  console.log("Deploying Level2Factory...");
  console.log("EntryPoint:", ENTRYPOINT_ADDRESS);

  const factory = await viem.deployContract("Level2Factory", [
    ENTRYPOINT_ADDRESS,
  ]);

  console.log("\n✅ Deployment Complete!");
  console.log("=".repeat(50));
  console.log("Factory Address:", factory.address);
  console.log("EntryPoint Address:", ENTRYPOINT_ADDRESS);
  console.log("=".repeat(50));
  
  console.log("\n📝 Save these addresses to your frontend!");
  console.log("Network: Sepolia");
  console.log("Block Explorer:", `https://sepolia.etherscan.io/address/${factory.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });