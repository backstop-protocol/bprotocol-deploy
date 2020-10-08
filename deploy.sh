#!/usr/bin/env bash

#########################
##### ENV VARIABLES #####
#########################
# If ETH_FROM not set, use the one for testchain
test -z $ETH_FROM && export ETH_FROM=0x16Fb96a5fa0427Af0C8F7cF1eB4870231c8154B6
# If ETH_RPC_URL not set, use the one for testchain
test -z $ETH_RPC_URL && export ETH_RPC_URL=127.0.0.1:2000
# If ETH_GAS not set, use the one for testchain
test -z $ETH_GAS && export ETH_GAS=7000000
 
export ETH_RPC_ACCOUNTS=yes
export SETH_ASYNC=no

#####################
##### CONSTANTS #####
#####################
JSON_FILE=config/$1.json
ONE_DAY=$(expr 60 \* 60 \* 24)
ONE_MONTH=$(expr 30 \* $ONE_DAY) # assume 30 days in a month
FIVE_MONTHS=$(expr 5 \* $ONE_MONTH)
ZERO_ADDRESS="0x0000000000000000000000000000000000000000"

#####################
##### READ JSON #####
#####################
echo #empty line
echo network=$1
echo JSON_FILE=$JSON_FILE

VAT=$(jq -r ".MCD_VAT" $JSON_FILE)
test -z $VAT && exit 1
END=$(jq -r ".MCD_END" $JSON_FILE)
SPOT=$(jq -r ".MCD_SPOT" $JSON_FILE)
GEM_JOIN_ETH=$(jq -r ".MCD_JOIN_ETH_A" $JSON_FILE)
GEM_JOIN_WBTC=$(jq -r ".MCD_JOIN_WBTC_A" $JSON_FILE)

echo # empty line
echo "###### MCD ADDRESSES ######"
echo VAT = $VAT
echo END = $END
echo SPOT = $SPOT
echo GEM_JOIN_ETH = $GEM_JOIN_ETH
echo GEM_JOIN_WBTC = $GEM_JOIN_WBTC
echo # empty line

#########################
##### BUILD PROJECT #####
#########################
dapp update
cd lib/dss-cdp-manager && dapp --use solc:0.5.16 build

############################
##### DEPLOY CONTRACTS #####
############################

# Deploy ScoringMachine
#SCORING_MACHINE=$(dapp create ScoringMachine)

# Deploy BCdpScoreConnector
#B_CDP_SCORE_CONNECTOR=$(dapp create BCdpScoreConnector $SCORING_MACHINE)

# Deploy JarConnector
#JAR_CONNECTOR=$(dapp create JarConnector )

# Deploy Jar
ILK_ETH=$(seth --from-ascii "ETH-A" | seth --to-bytes32)
NOW=$(date "+%s")
WITHDRAW_TIME_LOCK=$(expr $NOW + $ONE_MONTH) # now + 30 days
# ctor args = _roundId, _withdrawTimelock, _connector, _vat, _ilks[], _gemJoins[]
#JAR=$(dapp create Jar 1 $WITHDRAW_TIME_LOCK $ZERO_ADDRESS $VAT [$ILK_ETH] [$GEM_JOIN_ETH])


GET_CDPS=$(dapp create GetCdps)

#### TODO BCdpManager -> Pool -> Jar -> JarConnector -> BCdpManager

echo
echo "###### B.PROTOCOL ADDRESSES ######"
echo SCORING_MACHINE=$SCORING_MACHINE
echo B_CDP_SCORE_CONNECTOR=$B_CDP_SCORE_CONNECTOR
echo JAR=$JAR
echo GET_CDPS=$GET_CDPS