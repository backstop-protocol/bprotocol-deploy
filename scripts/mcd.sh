json ".MCD_DAI" || DAI=$RESULT
json ".MCD_VAT" || VAT=$RESULT
json ".MCD_END" || END=$RESULT
json ".MCD_SPOT" || SPOT=$RESULT
json ".MCD_JOIN_ETH_A" || GEM_JOIN_ETH=$RESULT
json ".MCD_JOIN_WBTC_A" || GEM_JOIN_WBTC=$RESULT
json ".MCD_JUG" || JUG=$RESULT
json ".PIP_ETH" || PIP_ETH=$RESULT
json ".PIP_WBTC" || PIP_WBTC=$RESULT

logMCD() {
    echo # empty line
    echo "###### MCD ADDRESSES ######"
    echo DAI = $DAI
    echo VAT = $VAT
    echo END = $END
    echo SPOT = $SPOT
    echo GEM_JOIN_ETH = $GEM_JOIN_ETH
    echo GEM_JOIN_WBTC = $GEM_JOIN_WBTC
    echo JUG = $JUG
    echo PIP_ETH = $PIP_ETH
    echo PIP_WBTC = $PIP_WBTC
    echo # empty line
    echo "###########################"
}