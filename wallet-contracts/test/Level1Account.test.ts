import { expect } from "chai";
import hre from "hardhat";
import { getAddress, parseEther, formatEther } from "viem";
import { describe, it, before } from "node:test";

const { viem, networkHelpers } = await hre.network.connect();

describe("Level1Account", function () {
    const ENTRYPOINT_ADDRESS = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

    let factory: any;
    let owner: any;
    let user: any;
    let publicClient: any;

    before(async function () {
        [owner, user] = await viem.getWalletClients();
        publicClient = await viem.getPublicClient();
    
        // Deploy factory once
        factory = await viem.deployContract("Level1Factory", [
          ENTRYPOINT_ADDRESS,
        ]);
    
        console.log("Factory deployed at:", factory.address);
      });


    describe("Factory", function () {
        it("Should calculate counterfactual address", async function () {
    
          const salt = 0n;
          const predictedAddress = await factory.read.getAddress([
            owner.account.address,
            salt,
          ]);
    
          expect(predictedAddress).to.match(/^0x[a-fA-F0-9]{40}$/);
          console.log("Predicted address:", predictedAddress);
        }); 

        it("Should deploy the account at the predicted address", async function () {

            const salt = 0n;
            const predictedAddress = await factory.read.getAddress([
            owner.account.address,
            salt,
          ]);

          const hash = await factory.write.createAccount([owner.account.address, salt])

          // Wait for transaction to be mined
          await publicClient.waitForTransactionReceipt({ hash })

          const account = await viem.getContractAt("Level1Account", predictedAddress)

          const accOwner = await account.read.owner() as `0x${string}`;
          expect(getAddress(accOwner)).to.equal(getAddress(owner.account.address))
          console.log("Account deployed at:", predictedAddress)
          console.log("Account owner:", accOwner)
        })

        it("Should create different accounts with different salts", async function() {

            const salt = 0n;
            const salt1 = 1n;
            const predictedAddress = await factory.read.getAddress([
                owner.account.address,
                salt,
              ]);
            const predictedAddress1 = await factory.read.getAddress([
            owner.account.address,
            salt1,
            ]);
            expect(predictedAddress.toLowerCase()).to.not.equal(predictedAddress1.toLowerCase());
        })
        it("Should return an existing account if called twice", async function () {
            const salt = 2n; // others used already


              const hash1 = await factory.write.createAccount([
                owner.account.address,
                salt,
              ]);
              const receipt1 = await publicClient.waitForTransactionReceipt({ hash: hash1 });
              console.log("First call - events emitted:", receipt1.logs.length);

              const hasEvent1 = receipt1.logs.length > 0;
            expect(hasEvent1).to.be.true;
            console.log("First call emitted events: YES");

              

              const hash2 = await factory.write.createAccount([
                owner.account.address,
                salt,
              ]);


              const receipt2 = await publicClient.waitForTransactionReceipt({ hash: hash2 });
              console.log("Second call - total logs:", receipt2.logs.length);
  
                // Second call should have NO events
                expect(receipt2.logs.length).to.equal(0);
                console.log("Second call emitted events: NO");

            const predictedAddress = await factory.read.getAddress([
                owner.account.address,
                salt,
              ]);
              const account = await viem.getContractAt(
                "Level1Account",
                predictedAddress
              );
              const accOwner = await account.read.owner();
              expect(accOwner.toLowerCase).to.equal(owner.account.address.toLowerCase);
            
        })
    })
   

})