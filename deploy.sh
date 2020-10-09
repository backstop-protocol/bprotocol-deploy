#!/usr/bin/env bash

if [ -z $1 ]; then
    echo "NETWORK NOT FOUND"
    return 1
fi

# SETUP ENV VARIABLES
. scripts/env.sh

# CONFIGURATION
. scripts/config.sh

# LOAD FUNCTIONS
. scripts/function.sh

# LOAD VALIDATION FUNCTIONS
. scripts/validate.sh

# READ MCD JSON
. scripts/mcd.sh

# TESTCHAIN SPECIFIC SETUP
. scripts/testchain.sh

if [ ! -z $2 ] && [ $2 = "reset" ]; then
    reset
fi

#########################
##### BUILD PROJECT #####
#########################
#dapp update
#dapp --use solc:0.5.16 build


###############################
##### DEPLOY DAI2USD DyDx ##### 
##### and MockPriceFeed   #####
###############################
# TODO If DAI2USD not set and network is testnet/testchain deploy new
# TODO Otherwise use the provided address for the mainnet

if [ -z "${DAI2USD}" ]; then
    DAI2USD=$(dapp create MockDaiToUsdPriceFeed)
    export DAI2USD=$DAI2USD
fi


# TODO If PRICE_FEED not set and network is testnet/testchain deploy new
if [ -z "${PRICE_FEED}" ]; then
    PRICE_FEED=$(dapp create MockPriceFeed)
    export PRICE_FEED=$PRICE_FEED
fi


###############################
##### DEPLOY BudConnector #####
###############################
# Build project
# cd lib/dss-cdp-manager
cd lib/dss-cdp-manager && dapp --use solc:0.5.16 build

# TODO approve for BudConnector needed
if [ -z "${BUD_CONN_ETH}" ]; then
    BUD_CONN_ETH=$(dapp create BudConnector $OSM_ETH $END)
    export BUD_CONN_ETH=$BUD_CONN_ETH
fi

if [ -z "${BUD_CONN_WBTC}" ]; then
    BUD_CONN_WBTC=$(dapp create BudConnector $OSM_WBTC $END)
    export BUD_CONN_WBTC=$BUD_CONN_WBTC
fi


############################
##### DEPLOY CONTRACTS #####
############################

# Deploy BCdpFullScore
if [ -z "${SCORE}" ]; then
    SCORE=$(dapp create BCdpFullScore)
    export SCORE=$SCORE
fi

# Deploy JarConnector
toBytes32 "ETH-A" && ILK_ETH=$RESULT
toBytes32 "WBTC-A" && ILK_WBTC=$RESULT
# ctor args = _gemJoins, _ilks, _duration[2]
if [ -z "${JAR_CONNECTOR}" ]; then
    JAR_CONNECTOR=$(dapp create JarConnector [$ILK_ETH,$ILK_WBTC] [$ONE_MONTH,$FIVE_MONTHS])
    export JAR_CONNECTOR=$JAR_CONNECTOR
fi


# Deploy Jar
NOW=$(date "+%s")
WITHDRAW_TIME_LOCK=$(expr $NOW + $ONE_MONTH) # now + 30 days
# ctor args = _roundId, _withdrawTimelock, _connector, _vat, _ilks[], _gemJoins[]
if [ -z "${JAR}" ]; then
    JAR=$(dapp create Jar 1 $WITHDRAW_TIME_LOCK $JAR_CONNECTOR $VAT [$ILK_ETH,$ILK_WBTC] [$GEM_JOIN_ETH,$GEM_JOIN_WBTC])
    export JAR=$JAR
fi

# Deploy Pool
# ctor args = vat_, jar_, spot_, jug_, dai2usd_
if [ -z "${POOL}" ]; then
    POOL=$(dapp create Pool $VAT $JAR $SPOT $JUG $DAI2USD)
    export POOL=$POOL
fi

# Deploy  BCdpManager
# ctor args = vat_, end_, pool_, real_, score_
if [ -z "${B_CDP_MANAGER}" ]; then
    B_CDP_MANAGER=$(dapp create BCdpManager $VAT $END $POOL $PRICE_FEED $SCORE)
    export B_CDP_MANAGER=$B_CDP_MANAGER
fi

# Deploy GetCdps
if [ -z "${GET_CDPS}" ]; then
    GET_CDPS=$(dapp create GetCdps)
    export GET_CDPS=$GET_CDPS
fi

# Deploy UserInfo
if [ -z "${USER_INFO}" ]; then
    USER_INFO=$(dapp create UserInfo)
    export USER_INFO=$USER_INFO
fi

### DEPLOYMENT DONE ####

# SET CONTRACTS
if [ -z "${MISC_SETUP_DONE}" ]; then
    seth send $JAR_CONNECTOR 'setManager(address)' $B_CDP_MANAGER
    seth send $SCORE 'setManager(address)' $B_CDP_MANAGER
    seth send $SCORE 'transferOwnership(address)' $JAR_CONNECTOR
    seth send $JAR_CONNECTOR 'spin()'
    export MISC_SETUP_DONE=1
fi

# Set Pool Params
if [ -z "${POOL_SETUP_DONE}" ]; then
    seth send $POOL 'setCdpManager(address)' $B_CDP_MANAGER
    seth send $POOL 'setProfitParams(uint256,uint256)' 99 100
    seth send $POOL 'setIlk(bytes32,bool)' $ILK_ETH 1
    seth send $POOL 'setIlk(bytes32,bool)' $ILK_WBTC 1
    seth send $POOL 'setOsm(bytes32,address)' $ILK_ETH $BUD_CONN_ETH
    seth send $POOL 'setOsm(bytes32,address)' $ILK_WBTC $BUD_CONN_WBTC
    seth send $POOL 'setMinArt(uint256)' $(($ONE_MILLION * $ONE_ETH))
    seth send $POOL 'setMembers(address[])' $MEMBERS
    export POOL_SETUP_DONE=1
fi

# TODO set BudConnector permissions
# TODO Transfer ownership to MULTISIG

echo -e "\e[1;32mDEPLOYMENT DONE.\e[0m"

# Testchain specific setup
setupTestchain $NETWORK


echo # empty line
echo "##################################"
echo "###### B.PROTOCOL ADDRESSES ######"
echo "##################################"
echo DAI2USD=$DAI2USD
echo SCORE=$SCORE
echo JAR=$JAR
echo JAR_CONNECTOR=$JAR_CONNECTOR
echo PRICE_FEED=$PRICE_FEED
echo B_CDP_MANAGER=$B_CDP_MANAGER
echo POOL=$POOL
echo BUD_CONN_ETH=$BUD_CONN_ETH 
echo BUD_CONN_WBTC=$BUD_CONN_WBTC 
echo USER_INFO=$USER_INFO
echo GET_CDPS=$GET_CDPS
echo MEMBER_1=$MEMBER_1
echo MEMBER_2=$MEMBER_2
echo MEMBER_3=$MEMBER_3
echo MEMBER_4=$MEMBER_4
echo MEMBERS=$MEMBERS
echo "##################################"

# VALIDATE DEPLOYMENT
validateAll

# back to original folder
cd ..
cd ..
