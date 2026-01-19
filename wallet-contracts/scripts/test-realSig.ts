import hre from "hardhat";
const { viem, networkHelpers } = await hre.network.connect();

async function main() {
  console.log("🔍 Testing Real eID Signature\n");

  const accountAddress = "0x4eE168F6c20A7E0172D9dFc26b7a360D8701FD99";
  const curve384Address = "0xa51c1fc2f0d1a1b8494ed1fe312d7c3a78ed91c0";
  const p384VerifierAddress = "0x0dcd1bf9a1b36ce34237eeafef220932846bcd82";
  
  const account = await viem.getContractAt("Level3Account", accountAddress);
  const curve384 = await viem.getContractAt("Curve384", curve384Address);
  const verifier = await viem.getContractAt("P384Verifier", p384VerifierAddress);

  // Your eID public key (from account)
  const pkXHi = BigInt("0x7ad6879aacf91a8fb6cc1e9a7728a878");
  const pkXLo = BigInt("0x45e880bef444eeeac67a678d25079520baeee625f312471cb0f297f757818c4a");
  const pkYHi = BigInt("0xafec8a5365283858c954953e55df30ca");
  const pkYLo = BigInt("0x29bdf699ac73bc995af1a2a02d37168850128617a22fb0f783531a4cd33fadec");

  // UserOpHash and signature from frontend
  const userOpHash = "0x6cb95d9bf7b508329e8aa748ad47cda6ce48aced3f9b735949afaa0d2cd8ed25";
  const rHigh = BigInt("0x08bcc89ab645befbe2dd11b93ade4b5d");
  const rLow = BigInt("0xcd8fbc3f0045a9246ebca014943af3ca57d3182562d4366413c866e446228232");
  const sHigh = BigInt("0x963097d72e1e97abd5adb70e2b36aec6");
  const sLow = BigInt("0xb7821befcc3fd504e5c87851c566c26667daa5898f14a35255ae672514316470");

  console.log("📝 Data:");
  console.log("  Account:", accountAddress);
  console.log("  UserOpHash:", userOpHash);
  console.log("  Signature r:", "0x" + rHigh.toString(16) + rLow.toString(16).padStart(64, '0'));
  console.log("  Signature s:", "0x" + sHigh.toString(16) + sLow.toString(16).padStart(64, '0'));
  console.log();

  // TEST 1: Verify using verify_external (no precomputation)
  console.log("1️⃣  Testing with verify_external (full verification)...");
  try {
    const result1 = await curve384.read.verify_external([
      pkXHi, pkXLo, pkYHi, pkYLo,
      BigInt(userOpHash),
      rHigh, rLow, sHigh, sLow
    ]);
    console.log(result1 ? "   ✅ VALID" : "   ❌ INVALID");
  } catch (error: any) {
    console.log("   ❌ Error:", error.message);
  }

  // TEST 2: Verify using verify_fast (with precomputation)
  console.log("\n2️⃣  Testing with verify_fast (precomputed tables)...");
  try {
    const result2 = await curve384.read.verify_fast([
      BigInt(userOpHash),
      rHigh, rLow, sHigh, sLow
    ]);
    console.log(result2 ? "   ✅ VALID" : "   ❌ INVALID");
  } catch (error: any) {
    console.log("   ❌ Error:", error.message);
  }

  // TEST 3: Check what the account's validateUserOp would do
  console.log("\n3️⃣  Testing what account would verify...");
  
  // The account calls P384Verifier.verifyFast, let's test that directly
  try {
    const result3 = await verifier.read.verifyFast([
      BigInt(userOpHash),
      rHigh, rLow, sHigh, sLow
    ]);
    console.log(result3 ? "   ✅ VALID (via P384Verifier)" : "   ❌ INVALID (via P384Verifier)");
  } catch (error: any) {
    console.log("   ❌ Error:", error.message);
  }

  // TEST 4: Check if tables are ready
  console.log("\n4️⃣  Checking precomputation status...");
  const genReady = await verifier.read.generatorPrecomputed();
  const pubReady = await verifier.read.pubkeyPrecomputed();
  console.log("   Generator precomputed:", genReady);
  console.log("   Pubkey precomputed:", pubReady);

  // TEST 5: Verify the message hash matches what eID signed
  console.log("\n5️⃣  Checking hash format...");
  console.log("   UserOpHash length:", userOpHash.length, "(should be 66: 0x + 64 hex)");
  console.log("   As BigInt:", BigInt(userOpHash));
  
  // The eID card signs the hash directly - check if it's being passed correctly
  const hashBytes = userOpHash.slice(2); // Remove 0x
  console.log("   Hash bytes (no 0x):", hashBytes);
  console.log("   Hash bytes length:", hashBytes.length, "(should be 64)");
}

main().catch(console.error);