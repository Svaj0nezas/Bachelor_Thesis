#!/bin/bash

ganache \
  --database.dbPath ./ganache-db \
  --chain.chainId 31337 \
  --miner.blockGasLimit 50000000000000 \
  --miner.callGasLimit 50000000000000 \
  --miner.defaultGasPrice 0 \
  --chain.allowUnlimitedContractSize true \
  --wallet.mnemonic "test test test test test test test test test test test junk" \
  --wallet.defaultBalance 10000