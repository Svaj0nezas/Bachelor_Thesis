export const CONTRACTS = {
    sepolia: {
      entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as `0x${string}`,
      level1Factory: "0x09f43d45454bfd046e263a1b3b4569d64303318e" as `0x${string}`, 
      rpcUrl: "https://eth-sepolia.g.alchemy.com/v2/9X3OoFUrhW-JOTEZ3znBa",
      bundlerUrl: "https://api.pimlico.io/v2/11155111/rpc?apikey=pim_JTWcFDaTiEuY6GK6KV89Py",
      level2Factory: "0x5c15d9adf23df08046a056ec430dcc908d1b48ef" as `0x${string}`,
      // HH local net
      LibMath:         "0x5fbdb2315678afecb367f032d93f642f64180aa3" as `0x${string}`,
      FieldP384:       "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512" as `0x${string}`,
      FieldO384:       "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0" as `0x${string}`,
      Curve384:        "0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9" as `0x${string}`,
      P384Verifier:    "0xdc64a140aa3e981100a9beca4e685f962f0cf6c9" as `0x${string}`,
      Level3Factory:   "0x8a791620dd6260079bf849dc5567adc3f2fdc318" as `0x${string}`,
      Level3Account:   "0xc26ee80f3A68F1C0BDeC126E7e83197Ee337D06C" as `0x${string}`,

      // ANVIL local net
      
    },
    anvil: {
      entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as `0x${string}`,
      LibMath:         "0x8a791620dd6260079bf849dc5567adc3f2fdc318" as `0x${string}`,
      FieldP384:       "0x610178da211fef7d417bc0e6fed39f05609ad788" as `0x${string}`,
      FieldO384:       "0xb7f8bc63bbcad18155201308c8f3540b07f84f5e" as `0x${string}`,
      Curve384:        "0xa51c1fc2f0d1a1b8494ed1fe312d7c3a78ed91c0" as `0x${string}`,
      P384Verifier:    "0x0dcd1bf9a1b36ce34237eeafef220932846bcd82" as `0x${string}`,
      Level3Factory:   "0x68b1d87f95878fe05b998f19b66f4baba5de1aed" as `0x${string}`,
      Level3Account:   "0x4eE168F6c20A7E0172D9dFc26b7a360D8701FD99" as `0x${string}`,
    }

  } as const;
  
  export const CHAIN_ID = 11155111; // Sepolia