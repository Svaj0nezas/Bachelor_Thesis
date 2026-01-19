import hre from "hardhat";
const { viem, networkHelpers } = await hre.network.connect();

async function main() {
  const VERIFIER = "0xD99D0f622506C2521cceb80B78CAeBE1798C7Ed5" as `0x${string}`;
  
  // From your console output
  const hash = "0x1f22d1efc5b497cf016877bfb7b8a4ce44c7daedb34ac65028799fd5983cecb2" as `0x${string}`;
  const r = 0x7246a1c4227147b4232d0708f961cd6f0141567fb9e24256325855a6ad868663n;
  const s = 0xb8f54b69aff8613ad09228c95bfbf488de5bb0e0023606b7284bc83fb25dd71cn;
  const x = 0x98c3626087a98586c9032d56003825c93e01578b4bf5c16999b2ce52eb6e61een;
  const y = 0x559a1213bb521f0b382e30f942c51262049e17fb2ef9c199d3643baf4ddece9dn;
  
  console.log("🧪 Testing P-256 verifier with actual signature...\n");
  console.log("Hash:", hash);
  console.log("R:", "0x" + r.toString(16));
  console.log("S:", "0x" + s.toString(16));
  console.log("X:", "0x" + x.toString(16));
  console.log("Y:", "0x" + y.toString(16));
  console.log();
  
  const publicClient = await viem.getPublicClient();
  
  // Prepare calldata: 160 bytes (hash + r + s + x + y), no function selector
  const pad32 = (value: bigint) => {
    const hex = value.toString(16).padStart(64, '0');
    return hex;
  };
  
  const calldata = (
    hash.slice(2) +
    pad32(r) +
    pad32(s) +
    pad32(x) +
    pad32(y)
  );
  
  console.log("Calldata length:", calldata.length / 2, "bytes");
  console.log("Calldata:", "0x" + calldata);
  console.log();
  
  try {
    const result = await publicClient.call({
      to: VERIFIER,
      data: ("0x" + calldata) as `0x${string}`,
    });
    
    console.log("Verifier raw result:", result);
    
    if (result && result.data) {
      const resultValue = BigInt(result.data);
      console.log("Result as number:", resultValue.toString());
      
      if (resultValue === 1n) {
        console.log("\n✅ SIGNATURE IS VALID!");
        console.log("The P-256 verifier says this signature is correct!");
        console.log("\n🤔 But AA24 error means contract verification failed...");
        console.log("This suggests the contract might not be calling the verifier correctly.");
      } else if (resultValue === 0n) {
        console.log("\n❌ SIGNATURE IS INVALID!");
        console.log("The P-256 verifier says this signature is wrong.");
        console.log("\n💡 This is the problem! WebAuthn is NOT signing the raw userOpHash.");
        console.log("WebAuthn signs: SHA-256(authenticatorData || SHA-256(clientDataJSON))");
      } else {
        console.log("\n⚠️ Unexpected result:", resultValue);
      }
    } else {
      console.log("\n❌ No result returned from verifier");
    }
    
  } catch (err: any) {
    console.log("❌ Verifier call failed:", err.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });