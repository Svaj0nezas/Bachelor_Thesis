import hre from "hardhat";
const { viem, networkHelpers } = await hre.network.connect();

const MAX_FEE = 2_000_000_000n;
const PRIORITY_FEE = 0n;
const FEE = 2n;


async function main() {
    console.log("🚀 Starting COMPLETE Level 3 (eID) deployment to Local Hardhat...\n");
    
    const [deployer] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();
    const EP = "0x0000000071727De22E5E9d8BAf0edAc6f37da032" // Your deployed EntryPoint
    
    console.log("Deploying from:", deployer.account.address);
    
    // ============================================================================
    // STEP 1: Deploy Cryptographic Libraries
    // ============================================================================
    console.log("\n" + "=".repeat(80));
    console.log("PART 1: DEPLOYING CRYPTOGRAPHIC LIBRARIES");
    console.log("=".repeat(80));
    
    console.log("\n1️⃣  Deploying LibMath...");
    const libMath = await viem.deployContract("LibMath");
    console.log("✅ LibMath deployed to:", libMath.address);
    
    console.log("\n2️⃣  Deploying FieldP384...");
    const fieldP384 = await viem.deployContract("FieldP384");
    console.log("✅ FieldP384 deployed to:", fieldP384.address);
    
    console.log("\n3️⃣  Deploying FieldO384...");
    const fieldO384 = await viem.deployContract("FieldO384");
    console.log("✅ FieldO384 deployed to:", fieldO384.address);
    
    console.log("\n4️⃣  Deploying Curve384...");
    const curve384Deployed = await viem.deployContract("Curve384");
    console.log("✅ Curve384 deployed to:", curve384Deployed.address);
    
    const curve384 = await viem.getContractAt("Curve384", curve384Deployed.address);
    
    // ============================================================================
    // STEP 2: Deploy P384Verifier
    // ============================================================================
    console.log("\n" + "=".repeat(80));
    console.log("PART 2: DEPLOYING P384 VERIFIER");
    console.log("=".repeat(80));
    
    console.log("\n5️⃣  Deploying P384Verifier...");
    const p384VerifierDeployed = await viem.deployContract("P384Verifier", [
        curve384.address,
    ]);
    console.log("✅ P384Verifier deployed to:", p384VerifierDeployed.address);
    
    const p384Verifier = await viem.getContractAt(
        "P384Verifier",
        p384VerifierDeployed.address
    );
    
    // ============================================================================
    // STEP 3: Precompute Generator DIRECTLY on Curve384
    // ============================================================================
    console.log("\n" + "=".repeat(80));
    console.log("PART 3: PRECOMPUTING GENERATOR TABLE (DIRECTLY ON CURVE384)");
    console.log("=".repeat(80));
    console.log("\n⚠️  This is expensive but local network can handle it!");
    console.log("⏳ Precomputing generator table...");
    
    try {
        const genHash = await deployer.writeContract({
            address: curve384.address,
            abi: curve384.abi,
            functionName: "precomputeGen",
            args: [],
            gas: 50000000000n,
            
        });
        console.log("📝 Transaction hash:", genHash);
        
        const genReceipt = await publicClient.waitForTransactionReceipt({ 
            hash: genHash 
        });
        
        if (genReceipt.status === "reverted") {
            throw new Error("❌ Generator precomputation REVERTED!");
        }
        
        console.log("✅ Generator precomputed on Curve384!");
        console.log("⛽ Gas used:", genReceipt.gasUsed.toString());
        
        var genGasUsed = genReceipt.gasUsed;
        var genTxHash = genHash;
    } catch (error: any) {
        console.error("❌ Failed:", error.message);
        throw error;
    }
    
    // ============================================================================
    // STEP 4: Precompute Public Key DIRECTLY on Curve384
    // ============================================================================
    console.log("\n" + "=".repeat(80));
    console.log("PART 4: PRECOMPUTING PUBLIC KEY TABLE (DIRECTLY ON CURVE384)");
    console.log("=".repeat(80));
    
    const EID_PUBLIC_KEY = {
        pkXHigh: BigInt("0x7ad6879aacf91a8fb6cc1e9a7728a878"),
        pkXLow:  BigInt("0x45e880bef444eeeac67a678d25079520baeee625f312471cb0f297f757818c4a"),
        pkYHigh: BigInt("0xafec8a5365283858c954953e55df30ca"),
        pkYLow:  BigInt("0x29bdf699ac73bc995af1a2a02d37168850128617a22fb0f783531a4cd33fadec"),
    };
    
    console.log("\n📋 eID Public Key:");
    console.log("  pkXHigh:", "0x" + EID_PUBLIC_KEY.pkXHigh.toString(16));
    console.log("  pkXLow: ", "0x" + EID_PUBLIC_KEY.pkXLow.toString(16));
    console.log("  pkYHigh:", "0x" + EID_PUBLIC_KEY.pkYHigh.toString(16));
    console.log("  pkYLow: ", "0x" + EID_PUBLIC_KEY.pkYLow.toString(16));
    
    console.log("\n⏳ Precomputing public key table...");
    
    try {
        const pubHash = await deployer.writeContract({
            address: curve384.address,
            abi: curve384.abi,
            functionName: "precomputePub",
            args: [
                EID_PUBLIC_KEY.pkXHigh,
                EID_PUBLIC_KEY.pkXLow,
                EID_PUBLIC_KEY.pkYHigh,
                EID_PUBLIC_KEY.pkYLow
            ],
            gas: 50000000000n,
           
        });
        console.log("📝 Transaction hash:", pubHash);
        
        const pubReceipt = await publicClient.waitForTransactionReceipt({ 
            hash: pubHash 
        });
        
        if (pubReceipt.status === "reverted") {
            throw new Error("❌ Public key precomputation REVERTED!");
        }
        
        console.log("✅ Public key precomputed on Curve384!");
        console.log("⛽ Gas used:", pubReceipt.gasUsed.toString());
        
        var pubGasUsed = pubReceipt.gasUsed;
        var pubTxHash = pubHash;
    } catch (error: any) {
        console.error("❌ Failed:", error.message);
        throw error;
    }
    
    // ============================================================================
    // STEP 5: Update P384Verifier Flags
    // ============================================================================
    console.log("\n" + "=".repeat(80));
    console.log("PART 5: UPDATING P384VERIFIER FLAGS");
    console.log("=".repeat(80));
    
    console.log("\n⏳ Marking generator as precomputed in P384Verifier...");
    try {
        const markGenHash = await deployer.writeContract({
            address: p384Verifier.address,
            abi: p384Verifier.abi,
            functionName: "precomputeGenerator",
            args: [],
        });
        const markGenReceipt = await publicClient.waitForTransactionReceipt({ 
            hash: markGenHash 
        });
        
        if (markGenReceipt.status === "success") {
            console.log("✅ Generator flag updated in P384Verifier");
        }
    } catch (error: any) {
        console.log("⚠️  Flag update failed:", error.message);
    }
    
    console.log("\n⏳ Marking public key as precomputed in P384Verifier...");
    try {
        const markPubHash = await deployer.writeContract({
            address: p384Verifier.address,
            abi: p384Verifier.abi,
            functionName: "precomputePublicKey",
            args: [
                EID_PUBLIC_KEY.pkXHigh,
                EID_PUBLIC_KEY.pkXLow,
                EID_PUBLIC_KEY.pkYHigh,
                EID_PUBLIC_KEY.pkYLow
            ],
        });
        const markPubReceipt = await publicClient.waitForTransactionReceipt({ 
            hash: markPubHash 
        });
        
        if (markPubReceipt.status === "success") {
            console.log("✅ Public key flag updated in P384Verifier");
        }
    } catch (error: any) {
        console.log("⚠️  Flag update failed:", error.message);
    }
    
    // ============================================================================
    // STEP 6: Deploy Level3Factory
    // ============================================================================
    console.log("\n" + "=".repeat(80));
    console.log("PART 6: DEPLOYING LEVEL3 FACTORY");
    console.log("=".repeat(80));
    
    console.log("\n6️⃣  Deploying Level3Factory...");
    const level3FactoryDeployed = await viem.deployContract("Level3Factory", [
        EP,
        p384Verifier.address,
    ]);
    console.log("✅ Level3Factory deployed to:", level3FactoryDeployed.address);
    
    const level3Factory = await viem.getContractAt(
        "Level3Factory",
        level3FactoryDeployed.address
    );
    
    // ============================================================================
    // STEP 7: Create Level3Account
    // ============================================================================
    console.log("\n" + "=".repeat(80));
    console.log("PART 7: CREATING LEVEL3 ACCOUNT");
    console.log("=".repeat(80));
    
    const salt = BigInt(0);
    
    console.log("\n7️⃣  Creating Level3Account via factory...");
    const createHash = await deployer.writeContract({
        address: level3Factory.address,
        abi: level3Factory.abi,
        functionName: "createAccount",
        args: [
            EID_PUBLIC_KEY.pkXHigh,
            EID_PUBLIC_KEY.pkXLow,
            EID_PUBLIC_KEY.pkYHigh,
            EID_PUBLIC_KEY.pkYLow,
            salt
        ],
    });
    console.log("📝 Transaction hash:", createHash);
    
    const createReceipt = await publicClient.waitForTransactionReceipt({ 
        hash: createHash 
    });
    
    if (createReceipt.status === "reverted") {
        throw new Error("❌ Account creation REVERTED!");
    }
    
    console.log("✅ Account created!");
    console.log("⛽ Gas used:", createReceipt.gasUsed.toString());
    
    // Get the account address
    const accountAddress = await publicClient.readContract({
        address: level3Factory.address,
        abi: level3Factory.abi,
        functionName: "getAddress",
        args: [
            EID_PUBLIC_KEY.pkXHigh,
            EID_PUBLIC_KEY.pkXLow,
            EID_PUBLIC_KEY.pkYHigh,
            EID_PUBLIC_KEY.pkYLow,
            salt
        ],
    });
    console.log("📍 Level3Account address:", accountAddress);
    
    // Verify fast verification is enabled
    const level3Account = await viem.getContractAt("Level3Account", accountAddress);
    const useFastVerification = await publicClient.readContract({
        address: accountAddress,
        abi: level3Account.abi,
        functionName: "useFastVerification",
        args: []
    });
    console.log("⚡ Fast verification enabled:", useFastVerification);
    
    // ============================================================================
    // STEP 8: Fund Level3Account with ETH
    // ============================================================================
    console.log("\n" + "=".repeat(80));
    console.log("PART 8: FUNDING LEVEL3 ACCOUNT");
    console.log("=".repeat(80));
    
    const fundingAmount = 30n * 10n ** 18n; // 30 ETH in wei
    
    console.log("\n💰 Funding account with 30 ETH...");
    console.log("  From:", deployer.account.address);
    console.log("  To:  ", accountAddress);
    console.log("  Amount: 30 ETH");
    
    try {
        const fundHash = await deployer.sendTransaction({
            to: accountAddress as `0x${string}`,
            value: fundingAmount,
        });
        console.log("📝 Transaction hash:", fundHash);
        
        const fundReceipt = await publicClient.waitForTransactionReceipt({
            hash: fundHash
        });
        
        if (fundReceipt.status === "reverted") {
            throw new Error("❌ Funding transaction REVERTED!");
        }
        
        console.log("✅ Funding successful!");
        console.log("⛽ Gas used:", fundReceipt.gasUsed.toString());
        
        // Check final balance
        const balance = await publicClient.getBalance({
            address: accountAddress as `0x${string}`
        });
        console.log("💵 Account balance:", (Number(balance) / 1e18).toFixed(4), "ETH");
        
        var fundingTxHash = fundHash;
        var fundingGasUsed = fundReceipt.gasUsed;
        var finalBalance = balance;
        
    } catch (error: any) {
        console.error("❌ Funding failed:", error.message);
        throw error;
    }
    
    // ============================================================================
    // FINAL SUMMARY
    // ============================================================================
    console.log("\n" + "=".repeat(80));
    console.log("🎉 DEPLOYMENT COMPLETE!");
    console.log("=".repeat(80));
    console.log("\n📦 Contract Addresses:");
    console.log("  LibMath:        ", libMath.address);
    console.log("  FieldP384:      ", fieldP384.address);
    console.log("  FieldO384:      ", fieldO384.address);
    console.log("  Curve384:       ", curve384.address);
    console.log("  P384Verifier:   ", p384Verifier.address);
    console.log("  Level3Factory:  ", level3Factory.address);
    console.log("  Level3Account:  ", accountAddress);
    console.log("\n📊 Precomputation Status:");
    console.log("  Generator:      ✅ Precomputed");
    console.log("  Public Key:     ✅ Precomputed");
    console.log("  Fast Verify:   ", useFastVerification ? "✅ ENABLED" : "⚠️  Not enabled");
    console.log("\n💰 Account Funding:");
    console.log("  Balance:        ", (Number(finalBalance) / 1e18).toFixed(4), "ETH");
    console.log("  Status:         ✅ Ready for transactions");
    console.log("\n💰 Total Gas Costs:");
    const totalGas = genGasUsed + pubGasUsed + createReceipt.gasUsed + fundingGasUsed;
    console.log("  Precomputation: ", (genGasUsed + pubGasUsed).toString());
    console.log("  Account Deploy: ", createReceipt.gasUsed.toString());
    console.log("  Account Funding:", fundingGasUsed.toString());
    console.log("  Total:          ", totalGas.toString());
    console.log("=".repeat(80));
    
    // ============================================================================
    // Save Configuration
    // ============================================================================
    const deployment = {
        network: "HH_LOCAL",
        timestamp: new Date().toISOString(),
        deployer: deployer.account.address,
        entryPoint: EP,
        contracts: {
            LibMath: libMath.address,
            FieldP384: fieldP384.address,
            FieldO384: fieldO384.address,
            Curve384: curve384.address,
            P384Verifier: p384Verifier.address,
            Level3Factory: level3Factory.address,
            Level3Account: accountAddress,
        },
        eidPublicKey: {
            pkXHigh: "0x" + EID_PUBLIC_KEY.pkXHigh.toString(16),
            pkXLow: "0x" + EID_PUBLIC_KEY.pkXLow.toString(16),
            pkYHigh: "0x" + EID_PUBLIC_KEY.pkYHigh.toString(16),
            pkYLow: "0x" + EID_PUBLIC_KEY.pkYLow.toString(16),
        },
        precomputation: {
            generator: {
                enabled: true,
                txHash: genTxHash,
                gasUsed: genGasUsed.toString(),
            },
            publicKey: {
                enabled: true,
                txHash: pubTxHash,
                gasUsed: pubGasUsed.toString(),
            },
        },
        accountCreation: {
            salt: salt.toString(),
            txHash: createHash,
            gasUsed: createReceipt.gasUsed.toString(),
            useFastVerification: useFastVerification,
        },
        accountFunding: {
            txHash: fundingTxHash,
            gasUsed: fundingGasUsed.toString(),
            amount: "30 ETH",
            finalBalance: (Number(finalBalance) / 1e18).toString() + " ETH",
        },
        gasAnalysis: {
            totalPrecomputationGas: (genGasUsed + pubGasUsed).toString(),
            accountCreationGas: createReceipt.gasUsed.toString(),
            accountFundingGas: fundingGasUsed.toString(),
            totalGas: totalGas.toString(),
        }
    };
    
    const fs = await import("fs");
    fs.writeFileSync(
        "deployed-level3-HH_LOCAL.json",
        JSON.stringify(deployment, null, 2)
    );
    console.log("\n✅ Deployment info saved to deployed-level3-HH_LOCAL.json");
    
    // ============================================================================
    // Next Steps
    // ============================================================================
    console.log("\n" + "=".repeat(80));
    console.log("📝 NEXT STEPS:");
    console.log("=".repeat(80));
    console.log("\n1. ✅ Account is funded with 30 ETH");
    console.log(`   Address: ${accountAddress}`);
    console.log("\n2. Update your frontend config:");
    console.log("   - EntryPoint:", EP);
    console.log("   - Verifier:", p384Verifier.address);
    console.log("   - Factory:", level3Factory.address);
    console.log("   - Account:", accountAddress);
    console.log("\n3. Create a UserOperation signed with your eID card");
    console.log("\n4. Submit via local EntryPoint (no bundler needed)");
    console.log("\n5. The account will use FAST verification with precomputed tables!");
    console.log("=".repeat(80) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed:");
        console.error(error);
        process.exit(1);
    });