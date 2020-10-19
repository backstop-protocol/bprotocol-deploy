#!/bin/sh

export DAPP_OUT=../../abi
cd lib/dss-cdp-manager
dapp --use solc:0.5.16 build --extract

cd ../..

for f in ./abi/*.abi ; do 
    value=$(cat $f)
    fileName=$(basename $f)
    name=$(echo $fileName | cut -f1 -d'.')
    $(echo "{ \"contractName\" : \"$name\", \"abi\" : $value }" > ./build/contracts/$name.json)
done