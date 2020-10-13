#!/usr/bin/env bash

##### Launch BProtocol snapshot #####

# Read bprotocol snapshot from folder, error if not present
cp snapshots/$1.tgz ./lib/testchain/snapshots

# Launch snapshot
cd ./lib/testchain
./scripts/launch -s $1

