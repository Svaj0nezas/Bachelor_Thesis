import hre from "hardhat";
const { viem, networkHelpers } = await hre.network.connect();

async function main() {
  const publicClient = await viem.getPublicClient();
  
  // Your deployed verifier
  const VERIFIER = '0xfa328a64803638678fb48c0c81ea29b3df558536';
  
  // From your last transaction attempt - copy these from console logs
  const userOpHash = '0x95e3725b8090622912a4bd4592e90c15555be648f12427b71a93912399ba8f8b'; // The hash that was signed
  const pkXHigh = '0x7ad6879aacf91a8fb6cc1e9a7728a878';    // From your eID
  const pkXLow = '0x45e880bef444eeeac67a678d25079520baeee625f312471cb0f297f757818c4a';
  const pkYHigh = '0xafec8a5365283858c954953e55df30ca';
  const pkYLow = '0x29bdf699ac73bc995af1a2a02d37168850128617a22fb0f783531a4cd33fadec';
  const rHigh = '0x8b357b578263f5ebe83a54af6a50494a';      // From signature
  const rLow = '0xcb7c9d821e55320e1c37b8cc44ee2fdc08cc6f4d1dd11692e87b0906649d7ae8';
  const sHigh = '0x930046a6ae5e1601e459e8a68e9f87ae';
  const sLow = '0x1852dd80edba9ece065f14fd6e5c78dc87dee44ec510d023f5600cf2e5911505';
  
  console.log('Testing P-384 signature verification...');
  console.log('UserOpHash:', userOpHash);
  
  try {
    // Call verifier directly
    const result = await publicClient.readContract({
      address: VERIFIER,
      abi: [{
        name: 'verify',
        type: 'function',
        stateMutability: 'view',
        inputs: [
          { name: 'pkXHigh', type: 'uint128' },
          { name: 'pkXLow', type: 'uint256' },
          { name: 'pkYHigh', type: 'uint128' },
          { name: 'pkYLow', type: 'uint256' },
          { name: 'message', type: 'bytes32' },
          { name: 'rHigh', type: 'uint128' },
          { name: 'rLow', type: 'uint256' },
          { name: 'sHigh', type: 'uint128' },
          { name: 'sLow', type: 'uint256' },
        ],
        outputs: [{ type: 'bool' }],
      }],
      functionName: 'verify',
      args: [
        BigInt(pkXHigh),
        BigInt(pkXLow),
        BigInt(pkYHigh),
        BigInt(pkYLow),
        userOpHash,
        BigInt(rHigh),
        BigInt(rLow),
        BigInt(sHigh),
        BigInt(sLow),
      ],
    });
    
    console.log('✅ Verification result:', result);
    
    if (!result) {
      console.error('❌ SIGNATURE IS INVALID!');
      console.error('This is why AA23 is happening - not out of gas, but verification failed!');
    } else {
      console.log('✅ Signature is valid - the issue is truly gas limits');
    }
    
  } catch (error: any) {
    console.error('❌ Verification reverted:', error.message);
    if (error.message.includes('gas')) {
      console.log('Out of gas during verification - need precomputed verifier');
    } else {
      console.log('Signature verification logic error');
    }
  }
}

main().catch(console.error);