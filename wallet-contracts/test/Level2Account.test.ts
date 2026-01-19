import { expect } from "chai";
import hre from "hardhat";
import { getAddress, parseEther, formatEther } from "viem";
import { describe, it, before } from "node:test";

const { viem, networkHelpers } = await hre.network.connect();

describe("Level2Account", function () {
    const ENTRYPOINT_ADDRESS = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";


    let factory: any;
    let publicClient: any;

    const PUBKEY_X = BigInt("0x71d030cab7237085fc6d35056f7b38ef5adfbe491c96d1fa8376a613fb8128bf")
    const PUBKEY_Y = BigInt("0x71d030cab7237085fc6d35056f7b38ef5adfbe491c96d1fa8376a613fb8128bf")

    before(async function () {
        publicClient = await viem.getPublicClient();
    
        // TODO: Deploy Level2Factory
        factory = await viem.deployContract("Level2Factory", [
          ENTRYPOINT_ADDRESS,
        ]);
      });

      it("Should calculate counterfactual address", async function () {
        const address = await factory.read.getAddress([
          PUBKEY_X,  // ← Passed as BigInt
          PUBKEY_Y,  // ← Passed as BigInt
          0n             // ← salt as BigInt
        ]);
        
        console.log("Counterfactual address:", address);
        expect(address).to.match(/^0x[a-fA-F0-9]{40}$/);
      });

      it("Should deploy account", async function () {
        const [deployer] = await viem.getWalletClients();
        
        const hash = await factory.write.createAccount([
          PUBKEY_X,
          PUBKEY_Y,
          0n
        ]);
        
        await publicClient.waitForTransactionReceipt({ hash });
        
        const accountAddress = await factory.read.getAddress([
          PUBKEY_X,
          PUBKEY_Y,
          0n
        ]);
        
        // Check it's deployed
        const bytecode = await publicClient.getBytecode({ address: accountAddress });
        expect(bytecode).to.not.equal('0x');
        
        console.log("Account deployed at:", accountAddress);
      });
})