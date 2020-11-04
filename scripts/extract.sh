#!/bin/sh
export SOLC_FLAGS="--optimize optimize-runs=200"

rm -rf ./abi
mkdir -p abi

# build bprotocol-deploy
export DAPP_OUT=./temp_out
dapp --use solc:0.5.16 build --extract
cp $DAPP_OUT/*.abi ./abi

# build dss-proxy-actions
export DAPP_OUT=../temp_out
cd dss-proxy-actions
dapp --use solc:0.5.16 build --extract
cp $DAPP_OUT/*.abi ../abi
cd ..

# build dss-cdp-manager
export DAPP_OUT=../../temp_out
cd lib/dss-cdp-manager
dapp --use solc:0.5.16 build --extract
cp $DAPP_OUT/*.abi ../../abi
cd ../..

cp ./testchain/out/mcd/*.abi ./abi

for f in ./abi/*.abi ; do 
    value=$(cat $f)
    fileName=$(basename $f)
    name=$(echo $fileName | cut -f1 -d'.')
    $(echo "{ \"contractName\" : \"$name\", \"abi\" : $value }" > ./build/contracts/$name.json)
done