import hre from "hardhat";
const { viem, networkHelpers } = await hre.network.connect();

async function main() {
  const ACCOUNT_ADDRESS = "0x2706F7DB648B896Ff72aB2C73762807348cd6991" as `0x${string}`;
  const PUBLIC_KEY_X = BigInt("0x98c3626087a98586c9032d56003825c93e01578b4bf5c16999b2ce52eb6e61ee");
  const PUBLIC_KEY_Y = BigInt("0x559a1213bb521f0b382e30f942c51262049e17fb2ef9c199d3643baf4ddece9d");
  
  // From the error log
  const USER_OP_HASH = "0xf0eac0fc16ff547a6f91f0ca74ffd0b8a8825d35e546a3b69833c5022e068408" as `0x${string}`; // ← Get from console.log
  const SIGNATURE_R = 0x2e54b5a4c3132b97a4cd71b7dc7577a2f49dcf85b744fad87c399dcd43e76a46n;
  const SIGNATURE_S = 0x6a223c3a6983f77195c145f43ca717035b8e72025dc4b2d39bc6ffc0d4f4b5a5n;
  
  console.log("🔍 Testing signature verification...\n");
  
  const publicClient = await viem.getPublicClient();
  
  // Call verifyP256SignatureView on the deployed account
  try {
    const isValid = await publicClient.readContract({
      address: ACCOUNT_ADDRESS,
      abi: [
        {
          inputs: [
            { name: "hash", type: "bytes32" },
            { name: "r", type: "uint256" },
            { name: "s", type: "uint256" },
            { name: "qx", type: "uint256" },
            { name: "qy", type: "uint256" },
          ],
          name: "verifyP256SignatureView",
          outputs: [{ name: "", type: "bool" }],
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "verifyP256SignatureView",
      args: [USER_OP_HASH, SIGNATURE_R, SIGNATURE_S, PUBLIC_KEY_X, PUBLIC_KEY_Y],
    });
    
    console.log("Signature valid:", isValid);
    
    if (!isValid) {
      console.log("\n❌ Signature verification FAILED!");
      console.log("\nPossible issues:");
      console.log("1. Wrong userOpHash being signed");
      console.log("2. Signature r,s parsed incorrectly");
      console.log("3. P-256 verifier not working");
    } else {
      console.log("\n✅ Signature is valid!");
      console.log("The issue must be elsewhere in the UserOp flow.");
    }
    
  } catch (err: any) {
    console.log("❌ Call failed:", err.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });