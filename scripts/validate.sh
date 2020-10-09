
validateVat() {
    echo "VALIDATING Vat params ..."
}

validatePool() {
    echo "VALIDATING Pool.sol ..."
    expectAddress $POOL 'owner()' $ETH_FROM "ERR:POOL-OWNER"
    expectInt $POOL 'DAI_MARKET_ID()' 3 "ERR:DAI_MARKET_ID"
    # validate members    
    toAddress $(seth call $POOL 'members(uint256)' 0) && test $RESULT != $MEMBER_1 && echo "ERR:MEMBER_1" && exit 1
    toAddress $(seth call $POOL 'members(uint256)' 1) && test $RESULT != $MEMBER_2 && echo "ERR:MEMBER_2" && exit 1
    toAddress $(seth call $POOL 'members(uint256)' 2) && test $RESULT != $MEMBER_3 && echo "ERR:MEMBER_3" && exit 1
    toAddress $(seth call $POOL 'members(uint256)' 3) && test $RESULT != $MEMBER_4 && echo "ERR:MEMBER_4" && exit 1
    expectInt $POOL 'minArt()' 0 "ERR:minArt" # TODO confirm
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
    test $(seth call $POOL 'ilks(bytes32)' $WBTCA | seth --to-dec) -ne 1 && echo "ERR:ilks(ETH-A)" && exit 1

    # validate osm
    toAddress $(seth call $POOL 'osm(bytes32)' $ETHA) && test $RESULT != $BUD_CONN_ETH && echo "ERR:ETH OSM" && exit 1
    toAddress $(seth call $POOL 'osm(bytes32)' $WBTCA) && test $RESULT != $BUD_CONN_WBTC && echo "ERR:WBTC OSM" && exit 1
    
}

validateScore() {
    echo "VALIDATING BCdpFullScore.sol ..."
    expectAddress $SCORE 'manager()' $B_CDP_MANAGER "ERR:SCORE manager not equal"
}

validateJarConnector() {
    echo "VALIDATING JarConnector.sol ..."
    expectAddress $JAR_CONNECTOR 'man()' $B_CDP_MANAGER "ERR:JarConnector manager not equal"
}

validateAll() {
    echo # empty line
    echo "VALIDATING SETUP..."
    echo # empty line

    validateVat
    validatePool
    validateScore
    validateJarConnector

    echo # empty line
    echo "VERIFICATION SUCCESSFUL"
}



