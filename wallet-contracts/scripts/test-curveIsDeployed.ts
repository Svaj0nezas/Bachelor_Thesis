import hre from "hardhat";
const { viem, networkHelpers } = await hre.network.connect();
const publicClient = await viem.getPublicClient();

const VERIFIER = '0xfa328a64803638678fb48c0c81ea29b3df558536';

// Get the Curve384 address from verifier
const curve384Address = await publicClient.readContract({
  address: VERIFIER,
  abi: [{
    name: 'curve384',
    type: 'function',
    stateMutability: 'view',
    outputs: [{ type: 'address' }],
  }],
  functionName: 'curve384',
});

console.log('Curve384 address:', curve384Address);

// Check if it has code
const code = await publicClient.getBytecode({ address: curve384Address as `0x${string}` });
console.log('Curve384 has code:', code && code !== '0x');
console.log('Code length:', code?.length);

const CURVE384 = curve384Address; // From step 1

try {
  const result = await publicClient.readContract({
    address: CURVE384 as `0x${string}`,
    abi: [{
      name: 'verify',
      type: 'function',
      stateMutability: 'view',
      inputs: [
        { name: 'pkXHigh', type: 'uint256' },
        { name: 'pkXLow', type: 'uint256' },
        { name: 'pkYHigh', type: 'uint256' },
        { name: 'pkYLow', type: 'uint256' },
        { name: 'm', type: 'uint256' },
        { name: 'rhi', type: 'uint256' },
        { name: 'rlo', type: 'uint256' },
        { name: 'shi', type: 'uint256' },
        { name: 'slo', type: 'uint256' },
      ],
      outputs: [{ type: 'bool' }],
    }],
    functionName: 'verify',
    args: [
      BigInt('0xc84a6e6ec1e7f30f5c812eeba420f769'),
      BigInt('0xb78d377301367565d6c4579d1bd222dbf64ea76464731482fd32a61ebde26432'),
      BigInt('0xd0d9d4f899b00456516b647c5e9b7ed'),
      BigInt('0x2c538d7878e63e8da0603396b4cbd9494d42f691141f9e2e5927cf88aac0c63'),
      BigInt('0x413140d54372f9baf481d4c54e2d5c7bcf28fd6087000280e07976121dd54af2'),
      BigInt('0xeeb9131427fd0f0b7195733c60dd8a99'),
      BigInt('0x822e6250b731e570244afe1053226cc83bcfb2a4280b6f2a81f2a723f62a457e'),
      BigInt('0xee281a7e5d0ea6a14e00c1759f79fddb'),
      BigInt('0xd91f3994cae97f886b1f2615c6a51839f13e1b21becd3d21accaccaceed2725f'),
    ],
  });
  
  console.log('Direct Curve384 result:', result);
} catch (error) {
  console.error('Direct Curve384 call failed:', error);
}

try {
    const result = await publicClient.readContract({
      address: CURVE384 as `0x${string}`,
      abi: [{
        name: 'test_verify',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [],
      }],
      functionName: 'test_verify',
    });
    
    console.log('✅ test_verify() result:', result);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
  try {
    const result = await publicClient.readContract({
      address: CURVE384 as `0x${string}`,
      abi: [{
        name: 'verify',
        type: 'function',
        stateMutability: 'view',
        inputs: [
          { name: 'pkXHigh', type: 'uint256' },
          { name: 'pkXLow', type: 'uint256' },
          { name: 'pkYHigh', type: 'uint256' },
          { name: 'pkYLow', type: 'uint256' },
          { name: 'm', type: 'uint256' },
          { name: 'rhi', type: 'uint256' },
          { name: 'rlo', type: 'uint256' },
          { name: 'shi', type: 'uint256' },
          { name: 'slo', type: 'uint256' },
        ],
        outputs: [{ type: 'bool' }],
      }],
      functionName: 'verify',
      args: [
        // Public key (a.xhi, a.xlo, a.yhi, a.ylo)
        BigInt('0xc84a6e6ec1e7f30f5c812eeba420f769'),
        BigInt('0xb78d377301367565d6c4579d1bd222dbf64ea76464731482fd32a61ebde26432'),
        BigInt('0xd0d9d4f899b00456516b647c5e9b7ed'),
        BigInt('0x2c538d7878e63e8da0603396b4cbd9494d42f691141f9e2e5927cf88aac0c63'),
        // Message hash (m)
        BigInt('0x413140d54372f9baf481d4c54e2d5c7bcf28fd6087000280e07976121dd54af2'),
        // Signature (rhi, rlo, shi, slo)
        BigInt('0xeeb9131427fd0f0b7195733c60dd8a99'),
        BigInt('0x822e6250b731e570244afe1053226cc83bcfb2a4280b6f2a81f2a723f62a457e'),
        BigInt('0xee281a7e5d0ea6a14e00c1759f79fddb'),
        BigInt('0xd91f3994cae97f886b1f2615c6a51839f13e1b21becd3d21accaccaceed2725f'),
      ],
    });
    
    console.log('✅ Verification result:', result);
    
    if (result) {
      console.log('🎉 CURVE384 IS WORKING! The library is correctly deployed!');
    } else {
      console.log('❌ Verification returned false - cryptographic issue');
    }
    
  } catch (error: any) {
    console.error('❌ Verification reverted:', error.message);
    
    if (error.message.includes('gas')) {
      console.log('⚠️  Out of gas - this is expected on public RPCs');
      console.log('Try with Alchemy RPC or increase gas limit');
    } else {
      console.log('⚠️  Curve384 may not be deployed or libraries not linked');
    }
  }