import hre from "hardhat";
const { viem, networkHelpers } = await hre.network.connect();

async function main() {
  const publicClient = await viem.getPublicClient();
  
  // Your deployed verifier
  const VERIFIER = '0xfa328a64803638678fb48c0c81ea29b3df558536';
  
  // From your last transaction attempt - copy these from console logs
  const userOpHash = '0x413140d54372f9baf481d4c54e2d5c7bcf28fd6087000280e07976121dd54af2'; // The hash that was signed
  const pkXHigh = '0xc84a6e6ec1e7f30f5c812eeba420f769';    // From your eID
  const pkXLow = '0xb78d377301367565d6c4579d1bd222dbf64ea76464731482fd32a61ebde26432';
  const pkYHigh = '0xd0d9d4f899b00456516b647c5e9b7ed';
  const pkYLow = '0x2c538d7878e63e8da0603396b4cbd9494d42f691141f9e2e5927cf88aac0c63';
  const rHigh = '0xeeb9131427fd0f0b7195733c60dd8a99';      // From signature
  const rLow = '0x822e6250b731e570244afe1053226cc83bcfb2a4280b6f2a81f2a723f62a457e';
  const sHigh = '0xee281a7e5d0ea6a14e00c1759f79fddb';
  const sLow = '0xd91f3994cae97f886b1f2615c6a51839f13e1b21becd3d21accaccaceed2725f';
  
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