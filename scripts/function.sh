json() {
    # $1 = json key to read from json file
    RESULT=$(jq -r $1 $JSON_FILE)
    test -z $RESULT && echo "$1 not found" && exit 1 # test to ensure that the addresses is not empty string
    test -z $(seth code $RESULT) && echo "$1 contract code not exit" && exit 1 # test to ensure that the contract has code
}

expectAddress() {
    # $1 = contract address
    # $2 = view function call, returns address
    # $3 = expected address
    # $4 = error message
    # Convert full 32 bytes address into 160 bytes address format
    RET=$(seth call $1 $2)
    toAddress $RET
    test $RESULT != $3 && echo "$4 \n expected:$3 \n got:$RESULT" && exit 1
}

expectInt() {
    # $1 = contract address
    # $2 = view function
    # $3 = expected int
    # $4 = error message
    test $(seth call $1 $2 | seth --to-dec) -ne $3 && echo $4 && exit 1
}

toBytes32() {
    # $1 = ascii input
    RESULT=$(seth --from-ascii $1 | seth --to-bytes32)
}

toInt() {
    # $1 = hex input
    RESULT=$(seth --to-dec $1)
}

toAddress() {
    # $1 = full 32 bytes hex input
    RESULT=$(seth --to-dec $1 | seth --to-hex | seth --to-address)
}

reset() {
    export DAI2USD=
    export SCORE=
    export JAR=
    export JAR_CONNECTOR=
    export PRICE_FEED=
    export B_CDP_MANAGER=
    export POOL=
    export BUD_CONN_ETH=
    export BUD_CONN_WBTC=
    export GET_CDPS=
}