#!/usr/bin/env bash

DIR=$PWD
DIR_DEPLOY_SCRIPTS=$PWD/lib/testchain/lib/dss-deploy-scripts
DIR_TESTCHAIN=$PWD/lib/testchain

#### Build Snapshot from scratch #####

# Create snapshot from bprotocol.json config
cp ./config/testchain_deploy_config.json $DIR_DEPLOY_SCRIPTS/config/testchain.json
cd $DIR_TESTCHAIN
yarn
yarn deploy-mcd

# Make snapshot
./scripts/create-snapshot mcd_bprotocol

# Launch snapshot
#./scripts/launch -s bprotocol &
#PID=$!
#echo "Process $PID started"

## TODO STILL THERE ARE ISSUES WITH THE SCRIPT

## TODO Add wait to launch
#while ! echo exit | nc 127.0.0.1 2000; do sleep 10; done

# Deploy BProtocol contracts on snapshot
#cd $DIR
#sh deploy.sh testchain
#cd $DIR_TESTCHAIN

# Make snapshot again
#./scripts/create-snapshot bprotocol

# Move snapshot here
#cp snapshots/bprotocol.tgz $DIR/snapshots

#kill $PID

#echo "Snapshot bprotocol created."