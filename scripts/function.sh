json() {
    # $1 = json key to read from json file
    RESULT=$(jq -r $1 $JSON_FILE)
    test -z $RESULT && echo "$1 not found" && exit 1 # test to ensure that the addresses is not empty string
    test -z $(seth code $RESULT) && echo "$1 contract code not exist" && exit 1 # test to ensure that the contract has code
}

expectAddress() {
    # $1 = contract address
    # $2 = view function call, returns address
    # $3 = expected address
    # $4 = error message
    # Convert full 32 bytes address into 160 bytes address format
    RET=$(seth call $1 "$2(address)")
    test $RET != $3 && echo "$4 \n expected:$3 \n got:$RET" && exit 1
}

expectInt() {
    # $1 = contract address
    # $2 = view function
    # $3 = expected int
    # $4 = error message
    test $(seth call $1 "$2(uint256)") -ne $3 && echo $4 && exit 1
}

toBytes32() {
    # $1 = ascii input
    RESULT=$(seth --from-ascii $1 | seth --to-bytes32)
}

verifyDeploy() {
    test $1 = "0x" || test -z $1 && exit 1
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
    export WBTC=

    export POOL_SETUP_DONE=
    export MISC_SETUP_DONE=
}