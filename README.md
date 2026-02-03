# Thesis 

# To run (Level 3): 
 # Frontend: 
    1) cd wallet-frontend
    2) pnpm i
    3) pnpm dev
#  eID server:
    1) connect card reader and put eID in
    2) cd server_eID
    3) node server.js
  # Anvil node:
    1) cd wallet-contracts
    2) curl -L https://foundry.paradigm.xyz | bash
    3) foundryup
    4) anvil --gas-price 0 --block-base-fee-per-gas 0 --disable-block-gas-limit --disable-code-size-limit --hardfork cancun
  # Deploy contracts:
    1) cd wallet-contracts
    2) pnpm dlx hardhat --init
    3) Deploy entry point:
      1) cd account-abstraction
      2) yarn install
      3) yarn deploy --network localhost
    4) Deploy necessary contracts:
      1) cd wallet-contracts
      2) npx hardhat run scripts/deploy-CurveP384.ts --network localhost
      3) Addresses should be the same, but assert that:
        LibMath:         0x8a791620dd6260079bf849dc5567adc3f2fdc318
        FieldP384:       0x610178da211fef7d417bc0e6fed39f05609ad788
        FieldO384:       0xb7f8bc63bbcad18155201308c8f3540b07f84f5e
        Curve384:        0xa51c1fc2f0d1a1b8494ed1fe312d7c3a78ed91c0
        P384Verifier:    0x0dcd1bf9a1b36ce34237eeafef220932846bcd82
        Level3Factory:   0x68b1d87f95878fe05b998f19b66f4baba5de1aed
        Level3Account:   0x4eE168F6c20A7E0172D9dFc26b7a360D8701FD99
        EntryPoint:      0x0000000071727De22E5E9d8BAf0edAc6f37da032
        If not, have fun. 
