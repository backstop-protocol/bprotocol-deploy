#!/usr/bin/env bash

#####################
##### FUNCTIONS #####
#####################
# json() {
#     #
# }

#########################
##### ENV VARIABLES #####
#########################
# If ETH_FROM not set, use the one for testchain
test -z $ETH_FROM && export ETH_FROM=0x16Fb96a5fa0427Af0C8F7cF1eB4870231c8154B6
# If ETH_RPC_URL not set, use the one for testchain
test -z $ETH_RPC_URL && export ETH_RPC_URL=127.0.0.1:2000
# If ETH_GAS not set, use the one for testchain
test -z $ETH_GAS && export ETH_GAS=7000000

export SOLC_FLAGS="--optimize optimize-runs=200"
export ETH_RPC_ACCOUNTS=yes
export SETH_ASYNC=no

#####################
##### CONSTANTS #####
#####################
JSON_FILE=config/$1.json
ONE_DAY=$(expr 60 \* 60 \* 24)
ONE_MONTH=$(expr 30 \* $ONE_DAY) # assume 30 days in a month
FIVE_MONTHS=$(expr 5 \* $ONE_MONTH)

#####################
##### READ JSON #####
#####################
echo # empty line
echo network=$1
echo JSON_FILE=$JSON_FILE

VAT=$(jq -r ".MCD_VAT" $JSON_FILE)
test -z $VAT && exit 1 # test to ensure that the addresses is not empty string
test -z $(seth code $VAT) && exit 1 # test to ensure that the VAT contract has code
END=$(jq -r ".MCD_END" $JSON_FILE)
SPOT=$(jq -r ".MCD_SPOT" $JSON_FILE)
GEM_JOIN_ETH=$(jq -r ".MCD_JOIN_ETH_A" $JSON_FILE)
GEM_JOIN_WBTC=$(jq -r ".MCD_JOIN_WBTC_A" $JSON_FILE)
JUG=$(jq -r ".MCD_JUG" $JSON_FILE)
OSM_ETH=$(jq -r ".PIP_ETH" $JSON_FILE)
OSM_WBTC=$(jq -r ".PIP_WBTC" $JSON_FILE)

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

#########################
##### BUILD PROJECT #####
#########################
#dapp update
#dapp --use solc:0.5.16 build


###############################
##### DEPLOY DAI2USD DyDx ##### 
##### and MockPriceFeed   #####
###############################
#TODO Below command
# test -z $DAI2USD && echo "ERR: DAI2USD contract not set" && exit 1
# TODO If DAI2USD not set and network is testnet/testchain deploy new
# TODO Otherwise use the provided address for the mainnet
DAI2USD=$(dapp create MockDaiToUsdPriceFeed)

# TODO If PRICE_FEED not set and network is testnet/testchain deploy new
PRICE_FEED=$(dapp create MockPriceFeed)

###############################
##### DEPLOY BudConnector #####
###############################
# Build project
# cd lib/dss-cdp-manager
cd lib/dss-cdp-manager && dapp --use solc:0.5.16 build

# TODO approve for BudConnector needed
BUD_CONN_ETH=$(dapp create BudConnector $OSM_ETH $END)
BUD_CONN_WBTC=$(dapp create BudConnector $OSM_WBTC $END)


############################
##### DEPLOY CONTRACTS #####
############################

# Deploy BCdpFullScore
SCORE=$(dapp create BCdpFullScore)

# Deploy JarConnector
ILK_ETH=$(seth --from-ascii "ETH-A" | seth --to-bytes32)
ILK_WBTC=$(seth --from-ascii "WBTC-A" | seth --to-bytes32)
# ctor args = _gemJoins, _ilks, _duration[2]
JAR_CONNECTOR=$(dapp create JarConnector [$GEM_JOIN_ETH,$GEM_JOIN_WBTC] [$ILK_ETH,$ILK_WBTC] [$ONE_MONTH,$FIVE_MONTHS])

# Deploy Jar
NOW=$(date "+%s")
WITHDRAW_TIME_LOCK=$(expr $NOW + $ONE_MONTH) # now + 30 days
# ctor args = _roundId, _withdrawTimelock, _connector, _vat, _ilks[], _gemJoins[]
JAR=$(dapp create Jar 1 $WITHDRAW_TIME_LOCK $JAR_CONNECTOR $VAT [$ILK_ETH,$ILK_WBTC] [$GEM_JOIN_ETH,$GEM_JOIN_WBTC])

# Deploy Pool
# ctor args = vat_, jar_, spot_, jug_, dai2usd_
POOL=$(dapp create Pool $VAT $JAR $SPOT $JUG $DAI2USD)

# Deploy  BCdpManager
# ctor args = vat_, end_, pool_, real_, score_
B_CDP_MANAGER=$(dapp create BCdpManager $VAT $END $POOL $PRICE_FEED $SCORE)

# Deploy GetCdps
GET_CDPS=$(dapp create GetCdps)

# SET CONTRACTS
seth send $JAR_CONNECTOR 'setManager(address)' $B_CDP_MANAGER
test $(seth call $JAR_CONNECTOR 'man()') = $B_CDP_MANAGER
seth send $SCORE 'setManager(address)' $B_CDP_MANAGER
test $(seth call $SCORE 'manager()') = $B_CDP_MANAGER

# Set Pool Params
seth send $POOL 'setCdpManager(address)' $B_CDP_MANAGER
seth send $POOL 'setProfitParams(uint256,uint256)' 99 100
seth send $POOL 'setIlk(bytes32,bool)' $ILK_ETH 1
seth send $POOL 'setIlk(bytes32,bool)' $ILK_WBTC 1
seth send $POOL 'setOsm(bytes32,address)' $ILK_ETH $BUD_CONN_ETH
seth send $POOL 'setOsm(bytes32,address)' $ILK_WBTC $BUD_CONN_WBTC

# addresses from testchain, indexes 10,11,12,13
MEMBERS="[0xa71f462b2a7fbba9daf31050c4a82b2084442038,0x654e7b3327634c78bfb21c6010afa29a22d7a605,0xf0117583019f74e7feef294091af7f137d529f10,0x85efdf75b3fa42457e670b43e77dfa58a77799c7]"
seth send $POOL 'setMembers(address[])' $MEMBERS

#### TODO BCdpManager -> Pool -> Jar -> JarConnector -> BCdpManager

echo # empty line
echo "###### B.PROTOCOL ADDRESSES ######"
echo DAI2USD=$DAI2USD
echo SCORE=$SCORE
echo JAR=$JAR
echo PRICE_FEED=$PRICE_FEED
echo B_CDP_MANAGER=$B_CDP_MANAGER
echo POOL=$POOL
echo BUD_CONN_ETH=$BUD_CONN_ETH
echo BUD_CONN_WBTC=$BUD_CONN_WBTC
echo GET_CDPS=$GET_CDPS
echo MEMBERS=$MEMBERS

# seth call  0x4C46A0Bc85800DFcB5Ae5655D7C35F457EE1AeBE 'manager()' | seth --to-dec | seth --to-hex | seth --to-address

# back to original folder
cd ..
cd ..
