import hre from "hardhat";
const { viem, networkHelpers } = await hre.network.connect();

async function main() {
  console.log("🔍 Debugging Signature Validation\n");

  const accountAddress = "0x4eE168F6c20A7E0172D9dFc26b7a360D8701FD99"; // Your Level3Account address
  const p384VerifierAddress = "0x0dcd1bf9a1b36ce34237eeafef220932846bcd82";
  
  const account = await viem.getContractAt("Level3Account", accountAddress);
  const verifier = await viem.getContractAt("P384Verifier", p384VerifierAddress);

  // 1. Check if fast verification is enabled
  console.log("1️⃣  Checking fast verification status...");
  const useFast = await account.read.useFastVerification();
  console.log("   Use fast verification:", useFast);

  // 2. Check stored public key
  console.log("\n2️⃣  Checking stored public key...");
  const pkXHi = await account.read.pkXHigh();
  const pkXLo = await account.read.pkXLow();
  const pkYHi = await account.read.pkYHigh();
  const pkYLo = await account.read.pkYLow();
  
  console.log("   Stored in account:");
  console.log("   pkXHigh:", "0x" + pkXHi.toString(16));
  console.log("   pkXLow: ", "0x" + pkXLo.toString(16));
  console.log("   pkYHigh:", "0x" + pkYHi.toString(16));
  console.log("   pkYLow: ", "0x" + pkYLo.toString(16));

  // 3. Check if this matches precomputed key
  console.log("\n3️⃣  Checking if key matches precomputed...");
  const isPrecomputed = await verifier.read.isPrecomputedKey([
    pkXHi, pkXLo, pkYHi, pkYLo
  ]);
  console.log("   Matches precomputed:", isPrecomputed);

  // 4. Get your actual eID public key from server
  console.log("\n4️⃣  Fetching your eID public key from server...");
  const response = await fetch('http://localhost:9000/get-public-key');
  const data = await response.json();
  
  if (data) {
    console.log("   Your eID public key:", data);
    console.log("\n⚠️  Compare this with the stored public key above!");
  }

  // 5. Now let's test signature verification with actual data from your frontend
  console.log("\n5️⃣  Paste your signature data from frontend console:");
  console.log("   (The script logged it with '========== COPY THIS FOR TEST SCRIPT ==========')\n");
}

main().catch(console.error);