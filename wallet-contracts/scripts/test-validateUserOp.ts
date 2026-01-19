import hre from "hardhat";
import { encodePacked, keccak256, toHex } from "viem";
import { getUserOperationHash } from "viem/account-abstraction";
const { viem, networkHelpers } = await hre.network.connect();


async function main() {
  console.log("🔍 Testing validateUserOp Directly\n");

  const accountAddress = "0x4eE168F6c20A7E0172D9dFc26b7a360D8701FD99";
  const entryPointAddress = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
  
  const account = await viem.getContractAt("Level3Account", accountAddress);
  const publicClient = await viem.getPublicClient();

  // The exact UserOp from frontend
  const userOp = {
    sender: "0x4eE168F6c20A7E0172D9dFc26b7a360D8701FD99" as `0x${string}`,
    nonce: 0n,
    factory: undefined,
    factoryData: undefined,
    callData: "0xb61d27f6000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb922660000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
    callGasLimit: 2000000000n,
    verificationGasLimit: 2000000000n,
    preVerificationGas: 2000000000n,
    maxFeePerGas: 2000000000n,
    maxPriorityFeePerGas: 1000000000n,
    paymaster: undefined,
    paymasterVerificationGasLimit: undefined,
    paymasterPostOpGasLimit: undefined,
    paymasterData: undefined,
    signature: "0x08bcc89ab645befbe2dd11b93ade4b5dcd8fbc3f0045a9246ebca014943af3ca57d3182562d4366413c866e446228232963097d72e1e97abd5adb70e2b36aec6b7821befcc3fd504e5c87851c566c26667daa5898f14a35255ae672514316470" as `0x${string}`,
  };

  // Calculate the UserOpHash the same way EntryPoint does
  const userOpHash = getUserOperationHash({
    userOperation: userOp,
    entryPointAddress: entryPointAddress as `0x${string}`,
    entryPointVersion: '0.7',
    chainId: 31337,
  });

  console.log("📝 UserOpHash calculated:", userOpHash);
  console.log("📝 Expected:", "0x6cb95d9bf7b508329e8aa748ad47cda6ce48aced3f9b735949afaa0d2cd8ed25");
  console.log("📝 Match:", userOpHash === "0x6cb95d9bf7b508329e8aa748ad47cda6ce48aced3f9b735949afaa0d2cd8ed25");
  console.log();

  // Check signature format
  console.log("🔍 Checking signature extraction:");
  const sig = userOp.signature.slice(2); // Remove 0x
  console.log("  Total signature length:", sig.length, "(should be 192 = 4*48)");
  
  const rHigh = "0x" + sig.slice(0, 32);
  const rLow = "0x" + sig.slice(32, 96);
  const sHigh = "0x" + sig.slice(96, 128);
  const sLow = "0x" + sig.slice(128, 192);
  
  console.log("  Extracted rHigh:", rHigh);
  console.log("  Expected rHigh:", "0x08bcc89ab645befbe2dd11b93ade4b5d");
  console.log("  Match:", rHigh === "0x08bcc89ab645befbe2dd11b93ade4b5d");
  console.log();

  // Try calling validateUserOp
  console.log("🧪 Attempting to call validateUserOp...");
  
  try {
    // Pack the UserOp for the call
    const packedUserOp = {
      sender: userOp.sender,
      nonce: userOp.nonce,
      initCode: "0x" as `0x${string}`,
      callData: userOp.callData,
      accountGasLimits: encodePacked(
        ['uint128', 'uint128'],
        [userOp.verificationGasLimit, userOp.callGasLimit]
      ),
      preVerificationGas: userOp.preVerificationGas,
      gasFees: encodePacked(
        ['uint128', 'uint128'],
        [userOp.maxPriorityFeePerGas, userOp.maxFeePerGas]
      ),
      paymasterAndData: "0x" as `0x${string}`,
      signature: userOp.signature,
    };

    const result = await publicClient.simulateContract({
      address: accountAddress as `0x${string}`,
      abi: [{
        inputs: [
          {
            components: [
              { name: 'sender', type: 'address' },
              { name: 'nonce', type: 'uint256' },
              { name: 'initCode', type: 'bytes' },
              { name: 'callData', type: 'bytes' },
              { name: 'accountGasLimits', type: 'bytes32' },
              { name: 'preVerificationGas', type: 'uint256' },
              { name: 'gasFees', type: 'bytes32' },
              { name: 'paymasterAndData', type: 'bytes' },
              { name: 'signature', type: 'bytes' }
            ],
            name: 'userOp',
            type: 'tuple'
          },
          { name: 'userOpHash', type: 'bytes32' },
          { name: 'missingAccountFunds', type: 'uint256' }
        ],
        name: 'validateUserOp',
        outputs: [{ name: 'validationData', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function'
      }],
      functionName: 'validateUserOp',
      args: [packedUserOp, userOpHash as `0x${string}`, 0n],
    });

    console.log("✅ validateUserOp succeeded!");
    console.log("   Validation data:", result.result);
    
  } catch (error: any) {
    console.log("❌ validateUserOp failed:");
    console.log("   Error:", error.message);
    if (error.data) {
      console.log("   Error data:", error.data);
    }
  }
}

main().catch(console.error);