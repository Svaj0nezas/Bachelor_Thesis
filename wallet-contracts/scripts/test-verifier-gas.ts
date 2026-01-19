import hre from "hardhat";
const { viem, networkHelpers } = await hre.network.connect();

async function main() {
  const VERIFIER = "0xD99D0f622506C2521cceb80B78CAeBE1798C7Ed5" as `0x${string}`;
  
  console.log("🧪 Testing P256 verifier gas usage...\n");
  
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();
  
  // Test signature data (dummy values)
  const hash = "0x0000000000000000000000000000000000000000000000000000000000000001";
  const r = 1n;
  const s = 1n;
  const x = 1n;
  const y = 1n;
  
  // Prepare calldata (160 bytes, no function selector)
  const calldata = Buffer.concat([
    Buffer.from(hash.slice(2), 'hex'),
    Buffer.from(r.toString(16).padStart(64, '0'), 'hex'),
    Buffer.from(s.toString(16).padStart(64, '0'), 'hex'),
    Buffer.from(x.toString(16).padStart(64, '0'), 'hex'),
    Buffer.from(y.toString(16).padStart(64, '0'), 'hex'),
  ]);
  
  console.log("Calldata length:", calldata.length, "bytes");
  console.log("Calldata:", '0x' + calldata.toString('hex'));
  
  try {
    // Estimate gas
    const gasEstimate = await publicClient.estimateGas({
      account: walletClient.account,
      to: VERIFIER,
      data: ('0x' + calldata.toString('hex')) as `0x${string}`,
    });
    
    console.log("\n✅ Gas estimate:", gasEstimate.toString());
    console.log("This is how much gas the P256 verification costs!");
    
    if (gasEstimate > 200000n) {
      console.log("\n⚠️  WARNING: Very high gas cost!");
      console.log("Verification alone costs >200k gas");
      console.log("Deployment + verification might exceed verificationGasLimit");
    }
    
  } catch (err: any) {
    console.log("❌ Failed:", err.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });