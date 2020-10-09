echo # empty line
echo network=$1
echo JSON_FILE=$JSON_FILE

json ".MCD_VAT" || VAT=$RESULT
json ".MCD_END" || END=$RESULT
json ".MCD_SPOT" || SPOT=$RESULT
json ".MCD_JOIN_ETH_A" || GEM_JOIN_ETH=$RESULT
json ".MCD_JOIN_WBTC_A" || GEM_JOIN_WBTC=$RESULT
json ".MCD_JUG" || JUG=$RESULT
json ".PIP_ETH" || OSM_ETH=$RESULT
json ".PIP_WBTC" || OSM_WBTC=$RESULT

echo # empty line
echo "###### MCD ADDRESSES ######"
echo VAT = $VAT
echo END = $END
echo SPOT = $SPOT
echo GEM_JOIN_ETH = $GEM_JOIN_ETH
echo GEM_JOIN_WBTC = $GEM_JOIN_WBTC
echo JUG = $JUG
echo OSM_ETH = $OSM_ETH
echo OSM_WBTC = $OSM_WBTC
echo # empty line
