import hre from "hardhat";

async function main() {
    const { viem, networkHelpers } = await hre.network.connect();
    const publicClient = await viem.getPublicClient();

    // Your deployed addresses
    const P384_VERIFIER = "0xe0e7e37cd26e98132b3452d9f5ac408f1647304d";
    const LEVEL3_ACCOUNT = "0xa0F5c69b10956311eA2A7FaA79415678C78Fee0f";

    console.log("🔍 Debugging Fast Verification Status\n");
    console.log("=".repeat(80));

    // Get contract instances
    const verifier = await viem.getContractAt("P384Verifier", P384_VERIFIER);
    const account = await viem.getContractAt("Level3Account", LEVEL3_ACCOUNT);

    // Check P384Verifier state
    console.log("\n📋 P384Verifier State:");
    const genPrecomputed = await publicClient.readContract({
        address: P384_VERIFIER,
        abi: verifier.abi,
        functionName: "generatorPrecomputed",
        args: [],
    });
    console.log("  generatorPrecomputed:", genPrecomputed);

    const pubPrecomputed = await publicClient.readContract({
        address: P384_VERIFIER,
        abi: verifier.abi,
        functionName: "pubkeyPrecomputed",
        args: [],
    });
    console.log("  pubkeyPrecomputed:", pubPrecomputed);

    // Get stored public key in verifier
    const storedXHigh = await publicClient.readContract({
        address: P384_VERIFIER,
        abi: verifier.abi,
        functionName: "precomputedPkXHigh",
        args: [],
    });
    const storedXLow = await publicClient.readContract({
        address: P384_VERIFIER,
        abi: verifier.abi,
        functionName: "precomputedPkXLow",
        args: [],
    });
    const storedYHigh = await publicClient.readContract({
        address: P384_VERIFIER,
        abi: verifier.abi,
        functionName: "precomputedPkYHigh",
        args: [],
    });
    const storedYLow = await publicClient.readContract({
        address: P384_VERIFIER,
        abi: verifier.abi,
        functionName: "precomputedPkYLow",
        args: [],
    });

    console.log("\n  Stored Public Key in Verifier:");
    console.log("    XHigh:", "0x" + storedXHigh.toString(16));
    console.log("    XLow: ", "0x" + storedXLow.toString(16));
    console.log("    YHigh:", "0x" + storedYHigh.toString(16));
    console.log("    YLow: ", "0x" + storedYLow.toString(16));

    // Get account's public key
    console.log("\n📋 Level3Account State:");
    const accountXHigh = await publicClient.readContract({
        address: LEVEL3_ACCOUNT,
        abi: account.abi,
        functionName: "pkXHigh",
        args: [],
    });
    const accountXLow = await publicClient.readContract({
        address: LEVEL3_ACCOUNT,
        abi: account.abi,
        functionName: "pkXLow",
        args: [],
    });
    const accountYHigh = await publicClient.readContract({
        address: LEVEL3_ACCOUNT,
        abi: account.abi,
        functionName: "pkYHigh",
        args: [],
    });
    const accountYLow = await publicClient.readContract({
        address: LEVEL3_ACCOUNT,
        abi: account.abi,
        functionName: "pkYLow",
        args: [],
    });

    console.log("  Account Public Key:");
    console.log("    XHigh:", "0x" + accountXHigh.toString(16));
    console.log("    XLow: ", "0x" + accountXLow.toString(16));
    console.log("    YHigh:", "0x" + accountYHigh.toString(16));
    console.log("    YLow: ", "0x" + accountYLow.toString(16));

    const useFast = await publicClient.readContract({
        address: LEVEL3_ACCOUNT,
        abi: account.abi,
        functionName: "useFastVerification",
        args: [],
    });
    console.log("\n  useFastVerification:", useFast);

    // Test isPrecomputedKey
    console.log("\n🔬 Testing isPrecomputedKey:");
    const isPrecomputed = await publicClient.readContract({
        address: P384_VERIFIER,
        abi: verifier.abi,
        functionName: "isPrecomputedKey",
        args: [accountXHigh, accountXLow, accountYHigh, accountYLow],
    });
    console.log("  isPrecomputedKey result:", isPrecomputed);

    // Compare values
    console.log("\n🔍 Comparison:");
    console.log("  XHigh match:", storedXHigh === accountXHigh, storedXHigh, "vs", accountXHigh);
    console.log("  XLow match: ", storedXLow === accountXLow, storedXLow, "vs", accountXLow);
    console.log("  YHigh match:", storedYHigh === accountYHigh, storedYHigh, "vs", accountYHigh);
    console.log("  YLow match: ", storedYLow === accountYLow, storedYLow, "vs", accountYLow);

    console.log("\n" + "=".repeat(80));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });