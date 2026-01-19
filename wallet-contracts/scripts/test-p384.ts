import hre from "hardhat";
const { viem, networkHelpers } = await hre.network.connect();

async function main() {
  console.log("🧪 Testing P-384 Signature Verification with Known Good Values\n");

  // Your deployed P384Verifier address (from deployment output)
  const verifierAddress = "0x0dcd1bf9a1b36ce34237eeafef220932846bcd82"; // Update if different
  
  const verifier = await viem.getContractAt(
    "P384Verifier",
    verifierAddress
  );

  // Known good test values from Estonian eID research
  const m = "0x413140d54372f9baf481d4c54e2d5c7bcf28fd6087000280e07976121dd54af2";
  const rhi = "0xeeb9131427fd0f0b7195733c60dd8a99";
  const rlo = "0x822e6250b731e570244afe1053226cc83bcfb2a4280b6f2a81f2a723f62a457e";
  const shi = "0xee281a7e5d0ea6a14e00c1759f79fddb";
  const slo = "0xd91f3994cae97f886b1f2615c6a51839f13e1b21becd3d21accaccaceed2725f";

  console.log("📝 Message hash:", m);
  console.log("📝 Signature r:  ", rhi, rlo);
  console.log("📝 Signature s:  ", shi, slo);
  console.log();

  try {
    console.log("⏳ Calling verify_fast (uses precomputed generator table)...");
    
    const result = await verifier.read.verifyFast([
      BigInt(m),
      BigInt(rhi),
      BigInt(rlo),
      BigInt(shi),
      BigInt(slo)
    ]);

    console.log(result);
    if (result) {
      console.log("✅✅✅ SIGNATURE VERIFICATION PASSED! ✅✅✅");
      console.log("🎉 Your P-384 stack is working correctly!");
      console.log("🎉 Precomputed tables are loaded!");
      console.log("🎉 Ready for eID signatures!");
    } else {
      console.log("❌ Signature verification FAILED (unexpected)");
    }
  } catch (error: any) {
    console.log("❌ Test failed with error:");
    console.error(error.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});