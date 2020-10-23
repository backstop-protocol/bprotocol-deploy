#!/bin/sh
export SOLC_FLAGS="--optimize optimize-runs=200"
export DAPP_OUT=../../abi
cd lib/dss-cdp-manager
dapp --use solc:0.5.16 build --extract

cd ../..

cp ./testchain/out/mcd/*.abi ./abi

for f in ./abi/*.abi ; do 
    value=$(cat $f)
    fileName=$(basename $f)
    name=$(echo $fileName | cut -f1 -d'.')
    $(echo "{ \"contractName\" : \"$name\", \"abi\" : $value }" > ./build/contracts/$name.json)
done