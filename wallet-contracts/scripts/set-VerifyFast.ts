import hre from "hardhat";
const { viem, networkHelpers } = await hre.network.connect();
const publicClient = await viem.getPublicClient();
const ACCOUNT_ADDRESS = "0xa0F5c69b10956311eA2A7FaA79415678C78Fee0f" as `0x${string}`;
const [deployer] = await viem.getWalletClients();
// Verify fast verification is enabled
const level3Account = await viem.getContractAt("Level3Account", ACCOUNT_ADDRESS);
const useFastVerification = await publicClient.readContract({
    address: ACCOUNT_ADDRESS,
    abi: level3Account.abi,
    functionName: "useFastVerification",
    args:[]
});
console.log("Current useFastVerification:", useFastVerification);

// const changeVerification = await deployer.writeContract({
//     address: ACCOUNT_ADDRESS,
//     abi: level3Account.abi,
//     functionName: "enableFastVerification",
//     args: [],
//     gas: 100000n,
// })

// console.log("Transaction sent. Fast verify:", changeVerification);