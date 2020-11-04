##### SETUP TESTCHAIN ENVIRONMENT AFTER DEPLOYMENT #####

setupTestchain() {
    if [ ! $1 = "testchain" ]; then
        return 0
    fi

    echo "TESTCHAIN SPECIFIC SETUP ..."

    # Deploy WETH
    # WETH=$(dapp create WETH)
    # verifyDeploy $WETH && export WETH=$WETH

    # MINT WBTC FOR MEMBERS

}