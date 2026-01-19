import hre from "hardhat";
const { viem, networkHelpers } = await hre.network.connect();

async function main() {
  console.log("🧪 Testing verify_external (no precomputation needed)\n");

  const curve384Address = "0x0165878a594ca255338adfa4d48449f69242eb8f";
  
  const curve384 = await viem.getContractAt("Curve384", curve384Address);

//   C384Elm memory a = C384Elm({
//     xhi:0xc84a6e6ec1e7f30f5c812eeba420f769,
//     xlo:0xb78d377301367565d6c4579d1bd222dbf64ea76464731482fd32a61ebde26432,
//     yhi:0xd0d9d4f899b00456516b647c5e9b7ed,
//     ylo:0x2c538d7878e63e8da0603396b4cbd9494d42f691141f9e2e5927cf88aac0c63
// });
// uint256 m = 0x413140d54372f9baf481d4c54e2d5c7bcf28fd6087000280e07976121dd54af2;
// uint256 rhi = 0xeeb9131427fd0f0b7195733c60dd8a99;
// uint256 rlo = 0x822e6250b731e570244afe1053226cc83bcfb2a4280b6f2a81f2a723f62a457e;
// uint256 shi = 0xee281a7e5d0ea6a14e00c1759f79fddb;
// uint256 slo = 0xd91f3994cae97f886b1f2615c6a51839f13e1b21becd3d21accaccaceed2725f;
  // Estonian test data
  const pkXHi = BigInt("0xc84a6e6ec1e7f30f5c812eeba420f769");
  const pkXLo = BigInt("0xb78d377301367565d6c4579d1bd222dbf64ea76464731482fd32a61ebde26432");
  const pkYHi = BigInt("0xd0d9d4f899b00456516b647c5e9b7ed");
  const pkYLo = BigInt("0x2c538d7878e63e8da0603396b4cbd9494d42f691141f9e2e5927cf88aac0c63");

  const m = BigInt("0x413140d54372f9baf481d4c54e2d5c7bcf28fd6087000280e07976121dd54af2");
  const rhi = BigInt("0xeeb9131427fd0f0b7195733c60dd8a99");
  const rlo = BigInt("0x822e6250b731e570244afe1053226cc83bcfb2a4280b6f2a81f2a723f62a457e");
  const shi = BigInt("0xee281a7e5d0ea6a14e00c1759f79fddb");
  const slo = BigInt("0xd91f3994cae97f886b1f2615c6a51839f13e1b21becd3d21accaccaceed2725f");

  console.log("📝 Public Key:");
  console.log("  X: 0x" + pkXHi.toString(16) + pkXLo.toString(16));
  console.log("  Y: 0x" + pkYHi.toString(16) + pkYLo.toString(16));
  console.log("\n📝 Message hash:", "0x" + m.toString(16));
  console.log("📝 Signature r:  0x" + rhi.toString(16) + rlo.toString(16));
  console.log("📝 Signature s:  0x" + shi.toString(16) + slo.toString(16));
  console.log();

  console.log("⏳ Calling verify_external (full ECDSA verification)...");
  
  const result = await curve384.read.verify_external([
    pkXHi, pkXLo,
    pkYHi, pkYLo,
    m,
    rhi, rlo,
    shi, slo
  ]);

  console.log();
  if (result) {
    console.log("✅✅✅ SIGNATURE VERIFIED! ✅✅✅");
    console.log("🎉 P-384 stack is working correctly!");
    console.log("🎉 Full ECDSA verification without precomputation works!");
  } else {
    console.log("❌ Signature verification FAILED");
  }
}

main().catch(console.error);