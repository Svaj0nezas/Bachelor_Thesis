import hre from "hardhat";

const { viem, networkHelpers } = await hre.network.connect();

async function main() {
  const publicClient = await viem.getPublicClient();
  
  const accountAddress = '0xD2Cd1AAD451AB0A9Ce3eBa49Effdf4041B363C3d';
  
  // The UserOpHash that was signed
  const userOpHash = '0xe23e2b01116eaf401ddfaab907d55adf1013772108d21502d9d4cb1315ca7b08';
  
  // The signature parts (from your logs)
  const rHigh = '0x59719bdb3426913f4f3f593a85352fba';
  const rLow = '0xc1ff6b0ca8568e77fb432c93ef99ddda6d0459fa228b109d504d9a61cd34169c';
  const sHigh = '0xddf9dffe6fabe969624fc157252e2ba0';
  const sLow = '0xedecb6d874c9f02d4b1d0db5e4106294975a663f033da905c5072e1327397f93';
  
  // Call validateUserOp directly
  try {
    await publicClient.simulateContract({
      address: accountAddress,
      abi: [{
        name: 'validateUserOp',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          {
            name: 'userOp',
            type: 'tuple',
            components: [
              { name: 'sender', type: 'address' },
              { name: 'nonce', type: 'uint256' },
              { name: 'initCode', type: 'bytes' },
              { name: 'callData', type: 'bytes' },
              { name: 'callGasLimit', type: 'uint256' },
              { name: 'verificationGasLimit', type: 'uint256' },
              { name: 'preVerificationGas', type: 'uint256' },
              { name: 'maxFeePerGas', type: 'uint256' },
              { name: 'maxPriorityFeePerGas', type: 'uint256' },
              { name: 'paymasterAndData', type: 'bytes' },
              { name: 'signature', type: 'bytes' },
            ],
          },
          { name: 'userOpHash', type: 'bytes32' },
          { name: 'missingAccountFunds', type: 'uint256' },
        ],
        outputs: [{ name: 'validationData', type: 'uint256' }],
      }],
      functionName: 'validateUserOp',
      args: [
        {
          sender: accountAddress,
          nonce: 0n,
          initCode: '0x',
          callData: '0xb61d27f6000000000000000000000000a32d58e013e98c9ab9aea50e5b83f8b92e478efb00000000000000000000000000000000000000000000000000005af3107a400000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000',
          callGasLimit: 100000n,
          verificationGasLimit: 5000000n,
          preVerificationGas: 100000n,
          maxFeePerGas: 1077273792n,
          maxPriorityFeePerGas: 1077273792n,
          paymasterAndData: '0x',
          signature: '0x59719bdb3426913f4f3f593a85352fbac1ff6b0ca8568e77fb432c93ef99ddda6d0459fa228b109d504d9a61cd34169cddf9dffe6fabe969624fc157252e2ba0edecb6d874c9f02d4b1d0db5e4106294975a663f033da905c5072e1327397f93',
        },
        userOpHash,
        0n, // missingAccountFunds
      ],
    });
    
    console.log('✅ Signature verification passed!');
  } catch (error) {
    console.error('❌ Signature verification failed:', error);
  }
}

main().catch(console.error);