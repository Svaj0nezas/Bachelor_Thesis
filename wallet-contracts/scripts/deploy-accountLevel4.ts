import hre from "hardhat";
const { viem } = await hre.network.connect();

async function main() {
  const FACTORY_ADDRESS = "0xe6e340d132b5f46d1e472debcd681b2abc16e57e";
  
  // Public key parts (from proof generation)
  const pkXHigh = 163279717393452279429925498148677527672n; 
  const pkXLow = 31620383642920778582574468381076562773042828855090439183033114545610496773194n;
  const pkYHigh = 233843086900743898808042298356973646026n; 
  const pkYLow = 18880462859791512604330775957946798540863893313174446381407129119580095491564n;
  
  // ZK Proof components (from proof generation)
  const proofA: [bigint, bigint] = [
    10975615619905817060889099003757031995044350371883041081623122444379606081685n, // proof.a[0]
    18149394142072621924055318294928551828543826010050494505444588099346549858240n  // proof.a[1]
  ];
  
  const proofB: [[bigint, bigint], [bigint, bigint]] = [
    [2548815272437585166012546969266519793030111471035838809718693233086940315596n, 21285294661187173665498182329654468692299124608484033387839197717505719293608n], // proof.b[0]
    [17008518368201598494834877882580905910430244834304767395119564422935628049631n, 5627820333052325041802505418518332559504179626022846367559093612000145326936n]  // proof.b[1]
  ];
  
  const proofC: [bigint, bigint] = [
    3376850741808113248218877554515944676021434321452475440576418244934483606479n, // proof.c[0]
    14510668923528514009151529916818772625146732893695689938208425484189170193784n  // proof.c[1]
  ];
  
  const publicSignals: [bigint, bigint] = [
    17065353838851962502416347361337480110196064833243991944404983788868635816260n, // publicSignals[0] - public key hash
    2026n
  ];
  
  const salt = 0n;
  
  // ============================================
  
  console.log("🧪 Testing Level4Account deployment with ZK Age Verification...\n");
  console.log("Public Key Parts:");
  console.log("  xHigh:", pkXHigh.toString());
  console.log("  xLow:", pkXLow.toString());
  console.log("  yHigh:", pkYHigh.toString());
  console.log("  yLow:", pkYLow.toString());
  console.log("\nPublic Signals:");
  console.log("  Public Key Hash:", publicSignals[0].toString());
  console.log();
  
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();
  
  // Calculate expected address
  console.log("Calculating counterfactual address...");
  const expectedAddress = await publicClient.readContract({
    address: FACTORY_ADDRESS,
    abi: [
      {
        inputs: [
          { name: "pkXHigh", type: "uint128" },
          { name: "pkXLow", type: "uint256" },
          { name: "pkYHigh", type: "uint128" },
          { name: "pkYLow", type: "uint256" },
          { name: "salt", type: "uint256" },
        ],
        name: "getAddress",
        outputs: [{ name: "", type: "address" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "getAddress",
    args: [pkXHigh, pkXLow, pkYHigh, pkYLow, salt],
  });
  
  console.log("Expected address:", expectedAddress);
  console.log("\n⚠️ VERIFY: Does this match your frontend address?");
  
  // Check if already deployed
  const bytecode = await publicClient.getBytecode({ address: expectedAddress });
  if (bytecode && bytecode !== "0x") {
    console.log("\n✅ Account already deployed!");
    console.log("You can now try transactions from the frontend.");
    return;
  }
  
  console.log("\nAccount not deployed yet. Deploying with ZK proof...\n");


  console.log("\n🔍 Checking Groth16Verifier...");

// Get the verifier address from factory
const verifierAddress = await publicClient.readContract({
  address: FACTORY_ADDRESS,
  abi: [
    {
      inputs: [],
      name: "ageVerifier",
      outputs: [{ name: "", type: "address" }],
      stateMutability: "view",
      type: "function",
    },
  ],
  functionName: "ageVerifier",
});

console.log("Groth16Verifier address:", verifierAddress);

// Check if it has code
const verifierCode = await publicClient.getBytecode({ address: verifierAddress });
if (!verifierCode || verifierCode === "0x") {
  console.log("❌ Groth16Verifier is NOT deployed!");
  console.log("Run: npx hardhat run scripts/deploy-level4.ts --network localhost");
  return;
}
console.log("✅ Groth16Verifier is deployed");

// Test the verifier directly
console.log("\n🧪 Testing proof verification directly...");
try {
  const isValid = await publicClient.readContract({
    address: verifierAddress,
    abi: [
      {
        inputs: [
          { name: "_pA", type: "uint256[2]" },
          { name: "_pB", type: "uint256[2][2]" },
          { name: "_pC", type: "uint256[2]" },
          { name: "_pubSignals", type: "uint256[2]" },
        ],
        name: "verifyProof",
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "verifyProof",
    args: [proofA, proofB, proofC, publicSignals],
  });
  
  console.log("Direct verification result:", isValid);
  
  if (!isValid) {
    console.log("\n❌ Proof is INVALID!");
    console.log("Possible issues:");
    console.log("1. Proof was generated with different circuit parameters");
    console.log("2. Proof components are corrupted or wrong");
    console.log("3. Public signals don't match");
    console.log("\n💡 Try regenerating the proof from the backend");
    return;
  }
  
  console.log("✅ Proof is valid! Continuing with deployment...\n");
  
} catch (err: any) {
  console.log("❌ Direct verification failed:", err.message);
  return;
}



  
  try {
    // Estimate gas
    console.log("Estimating gas...");
    const gasEstimate = await publicClient.estimateContractGas({
      address: FACTORY_ADDRESS,
      abi: [
        {
          inputs: [
            { name: "pkXHigh", type: "uint128" },
            { name: "pkXLow", type: "uint256" },
            { name: "pkYHigh", type: "uint128" },
            { name: "pkYLow", type: "uint256" },
            { name: "salt", type: "uint256" },
            { name: "a", type: "uint256[2]" },
            { name: "b", type: "uint256[2][2]" },
            { name: "c", type: "uint256[2]" },
            { name: "publicSignals", type: "uint256[2]" },
          ],
          name: "createAccountWithAgeProof",
          outputs: [{ name: "account", type: "address" }],
          stateMutability: "nonpayable",
          type: "function",
        },
      ],
      functionName: "createAccountWithAgeProof",
      args: [pkXHigh, pkXLow, pkYHigh, pkYLow, salt, proofA, proofB, proofC, publicSignals],
      account: walletClient.account,
    });
    
    console.log("✅ Gas estimate:", gasEstimate.toString());
    
    // Deploy
    console.log("\nDeploying age-verified account...");
    const hash = await walletClient.writeContract({
      address: FACTORY_ADDRESS,
      abi: [
        {
          inputs: [
            { name: "pkXHigh", type: "uint128" },
            { name: "pkXLow", type: "uint256" },
            { name: "pkYHigh", type: "uint128" },
            { name: "pkYLow", type: "uint256" },
            { name: "salt", type: "uint256" },
            { name: "a", type: "uint256[2]" },
            { name: "b", type: "uint256[2][2]" },
            { name: "c", type: "uint256[2]" },
            { name: "publicSignals", type: "uint256[2]" },
          ],
          name: "createAccountWithAgeProof",
          outputs: [{ name: "account", type: "address" }],
          stateMutability: "nonpayable",
          type: "function",
        },
      ],
      functionName: "createAccountWithAgeProof",
      args: [pkXHigh, pkXLow, pkYHigh, pkYLow, salt, proofA, proofB, proofC, publicSignals],
    });
    
    console.log("Transaction hash:", hash);
    console.log("Waiting for confirmation...");
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    if (receipt.status === "success") {
      console.log("\n✅ DEPLOYMENT SUCCESSFUL!");
      console.log("Gas used:", receipt.gasUsed.toString());
      console.log("Account address:", expectedAddress);
      console.log("\n🎉 Age-verified account is live!");
      console.log("You can now sign transactions with your eID card!");
    } else {
      console.log("\n❌ Transaction reverted!");
    }
    
  } catch (err: any) {
    console.log("\n❌ DEPLOYMENT FAILED!");
    console.error("\nError message:", err.message);
    
    if (err.message.includes("Age verification failed")) {
      console.log("\n💡 ZK proof verification failed!");
      console.log("Possible issues:");
      console.log("1. Proof was generated for a different public key");
      console.log("2. Proof components are incorrect");
      console.log("3. Public signals don't match");
    } else if (err.message.includes("Proof already used")) {
      console.log("\n💡 This proof has already been used!");
      console.log("Generate a new proof to create another account.");
    } else if (err.message.includes("revert")) {
      console.log("\n💡 The contract reverted during deployment.");
      console.log("Possible issues:");
      console.log("1. Invalid proof format");
      console.log("2. Verifier contract issue");
      console.log("3. Factory configuration problem");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });