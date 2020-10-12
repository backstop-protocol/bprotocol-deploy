
validateVat() {
    echo "VALIDATING Vat params ..."
}

validatePool() {
    echo "VALIDATING Pool.sol ..."
    expectAddress $POOL 'owner()' $ETH_FROM "ERR:POOL-OWNER"
    expectInt $POOL 'DAI_MARKET_ID()' 3 "ERR:DAI_MARKET_ID"
    # validate members    
    test $(seth call $POOL 'members(uint256)(address)' 0) != $MEMBER_1 && echo "ERR:MEMBER_1" && exit 1
    test $(seth call $POOL 'members(uint256)(address)' 1) != $MEMBER_2 && echo "ERR:MEMBER_2" && exit 1
    test $(seth call $POOL 'members(uint256)(address)' 2) != $MEMBER_3 && echo "ERR:MEMBER_3" && exit 1
    test $(seth call $POOL 'members(uint256)(address)' 3) != $MEMBER_4 && echo "ERR:MEMBER_4" && exit 1
    expectInt $POOL 'minArt()' $(($ONE_MILLION * $ONE_ETH)) "ERR:minArt"
    expectInt $POOL 'shrn()' 99 "ERR:shrn"
    expectInt $POOL 'shrd()' 100 "ERR:shrd"
    expectAddress $POOL 'vat()' $VAT "ERR:POOL-VAT"
    expectAddress $POOL 'man()' $B_CDP_MANAGER "ERR:POOL manager not equal"
    expectAddress $POOL 'spot()' $SPOT "ERR:POOL-SPOT"
    expectAddress $POOL 'jug()' $JUG "ERR:POOL-JUG"
    expectAddress $POOL 'jar()' $JAR "ERR:POOL-JAR"
    expectAddress $POOL 'dai2usd()' $DAI2USD "ERR:POOL-DAI2USD"
    
    toBytes32 "ETH-A" && ETHA=$RESULT
    toBytes32 "WBTC-A" && WBTCA=$RESULT
    # validate ilks
    test $(seth call $POOL 'ilks(bytes32)' $ETHA | seth --to-dec) -ne 1 && echo "ERR:ilks(ETH-A)" && exit 1
    test $(seth call $POOL 'ilks(bytes32)' $WBTCA | seth --to-dec) -ne 1 && echo "ERR:ilks(WBTC-A)" && exit 1

    # validate osm
    test $(seth call $POOL 'osm(bytes32)(address)' $ETHA) != $BUD_CONN_ETH && echo "ERR:ETH OSM" && exit 1
    #test $(seth call $POOL 'osm(bytes32)(address)' $WBTCA) != $BUD_CONN_WBTC && echo "ERR:WBTC OSM" && exit 1
    
}

validateBCdpManager() {
    echo "VALIDATING BCdpManager.sol ..."
    expectAddress $B_CDP_MANAGER 'owner()' $ETH_FROM "ERR:BCDP-OWNER"
    expectAddress $B_CDP_MANAGER 'vat()' $VAT "ERR:BCDP-VAT"
    expectAddress $B_CDP_MANAGER 'end()' $END "ERR:BCDP-END"
    expectAddress $B_CDP_MANAGER 'pool()' $POOL "ERR:BCDP-POOL"
    expectAddress $B_CDP_MANAGER 'real()' $PRICE_FEED "ERR:BCDP-REAL"
    expectAddress $B_CDP_MANAGER 'score()' $SCORE "ERR:BCDP-SCORE"
}

validateScore() {
    echo "VALIDATING BCdpFullScore.sol ..."
    expectAddress $SCORE 'manager()' $B_CDP_MANAGER "ERR:SCORE manager not equal"
}

validateJarConnector() {
    echo "VALIDATING JarConnector.sol ..."
    # TODO
    #gemJoins
    expectAddress $JAR_CONNECTOR 'score()' $SCORE "ERR:JarConnector-SCORE"
    expectAddress $JAR_CONNECTOR 'man()' $B_CDP_MANAGER "ERR:JarConnector-manager"
    test $(seth call $JAR_CONNECTOR 'ilks(uint256)' 0) != $ETHA && echo "ERR:JarConnector-ilks(ETH-A)" && exit 1
    test $(seth call $JAR_CONNECTOR 'ilks(uint256)' 1) != $WBTCA && echo "ERR:JarConnector-ilks(WBTC-A)" && exit 1
    
    test $(seth call $JAR_CONNECTOR 'milks(bytes32)' $ETHA | seth --to-dec) -ne 1 && echo "ERR:JarConnector-ilks(ETH-A)" && exit 1
    test $(seth call $JAR_CONNECTOR 'milks(bytes32)' $WBTCA | seth --to-dec) -ne 1 && echo "ERR:JarConnector-ilks(WBTC-A)" && exit 1
    #expectAddress $JAR_CONNECTOR 'end(uint256)' 0 $SCORE "ERR:JarConnector-SCORE"
    #start
    expectInt $JAR_CONNECTOR 'round()' 1 "ERR:JarConnector-round"
}

validateJar() {
    echo "VALIDATING Jar.sol ..."
    # TODO
}

validateAll() {
    echo # empty line
    echo "VALIDATING SETUP..."
    echo # empty line

    validateVat
    validateBCdpManager
    validatePool
    validateScore
    validateJar
    validateJarConnector

    echo # empty line
    echo -e "\e[1;32mVERIFICATION SUCCESSFUL \e[0m"
}



