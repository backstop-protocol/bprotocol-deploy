#!/usr/bin/env bash

##### Launch BProtocol snapshot #####
export ETH_GAS=10000000

# Read bprotocol snapshot from folder, error if not present
cp snapshots/$1.tgz ./testchain/snapshots

# Launch snapshot
cd ./testchain
./scripts/launch -s $1

