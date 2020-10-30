#!/usr/bin/env bash

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

. scripts/test.sh

if [ ! -z $2 ] && [ $2 = "reset" ]; then
    reset
fi

#########################
##### BUILD PROJECT #####
#########################
# dapp update
dapp --use solc:0.5.16 build


###############################
##### DEPLOY DAI2USD DyDx ##### 
##### and MockPriceFeed   #####
###############################
# TODO If DAI2USD not set and network is testnet/testchain deploy new
# TODO Otherwise use the provided address for the mainnet

if [ -z "${DAI2USD}" ]; then
    DAI2USD=$(dapp create MockDaiToUsdPriceFeed)
    verifyDeploy $DAI2USD && export DAI2USD=$DAI2USD
fi


# TODO If PRICE_FEED not set and network is testnet/testchain deploy new
if [ -z "${PRICE_FEED}" ]; then
    PRICE_FEED=$(dapp create MockPriceFeed)
    verifyDeploy $PRICE_FEED && export PRICE_FEED=$PRICE_FEED
    price=$(echo "150 * $ONE_ETH" | bc | seth --to-uint256 | seth --to-bytes32)
    tx=$(seth send $PRICE_FEED 'poke(bytes32)' $price)
fi

if [ -z "${CHAINLINK}" ]; then
    CHAINLINK=$(dapp create MockChainLink)
    verifyDeploy $CHAINLINK && export CHAINLINK=$CHAINLINK
fi

################################
##### DEPLOY PROXY_ACTIONS #####
################################
# cd dss-proxy-actions
# dapp update
cd dss-proxy-actions && dapp --use solc:0.5.16 build

if [ -z "${B_PROXY_ACTIONS}" ]; then
    B_PROXY_ACTIONS=$(dapp create BProxyActions)
    verifyDeploy $B_PROXY_ACTIONS && export B_PROXY_ACTIONS=$B_PROXY_ACTIONS
fi

############################
##### DEPLOY CONTRACTS #####
############################
# cd lib/dss-cdp-manager
cd ../lib/dss-cdp-manager && dapp --use solc:0.5.16 build

setupTestchain $NETWORK

if [ -z "${BUD_CONN_ETH}" ]; then
    BUD_CONN_ETH=$(dapp create BudConnector $PIP_ETH)
    verifyDeploy $BUD_CONN_ETH && export BUD_CONN_ETH=$BUD_CONN_ETH
fi

if [ -z "${BUD_CONN_WBTC}" ]; then
    BUD_CONN_WBTC=$(dapp create BudConnector $PIP_WBTC)
    verifyDeploy $BUD_CONN_WBTC && export BUD_CONN_WBTC=$BUD_CONN_WBTC
fi


# Deploy BCdpFullScore
if [ -z "${SCORE}" ]; then
    SCORE=$(dapp create BCdpFullScore)
    verifyDeploy $SCORE && export SCORE=$SCORE
fi

# Deploy JarConnector
toBytes32 "ETH-A" && ILK_ETH=$RESULT
toBytes32 "WBTC-A" && ILK_WBTC=$RESULT
# ctor args = _gemJoins, _ilks, _duration[2]
if [ -z "${JAR_CONNECTOR}" ]; then
    JAR_CONNECTOR=$(dapp create JarConnector [$ILK_ETH,$ILK_WBTC] [$ONE_MONTH,$FIVE_MONTHS])
    verifyDeploy $JAR_CONNECTOR && export JAR_CONNECTOR=$JAR_CONNECTOR
fi


# Deploy Jar
NOW=$(date "+%s")
WITHDRAW_TIME_LOCK=$(expr $NOW + $SIX_MONTHS) # now + (6 * 30 days)
# ctor args = _roundId, _withdrawTimelock, _connector, _vat, _ilks[], _gemJoins[]
if [ -z "${JAR}" ]; then
    JAR=$(dapp create Jar 1 $WITHDRAW_TIME_LOCK $JAR_CONNECTOR $VAT [$ILK_ETH,$ILK_WBTC] [$GEM_JOIN_ETH,$GEM_JOIN_WBTC])
    verifyDeploy $JAR && export JAR=$JAR
fi

# Deploy Pool
# ctor args = vat_, jar_, spot_, jug_, dai2usd_
if [ -z "${POOL}" ]; then
    POOL=$(dapp create Pool $VAT $JAR $SPOT $JUG $DAI2USD)
    verifyDeploy $POOL && export POOL=$POOL
fi

# Deploy  BCdpManager
# ctor args = vat_, end_, pool_, real_, score_
if [ -z "${B_CDP_MANAGER}" ]; then
    B_CDP_MANAGER=$(dapp create BCdpManager $VAT $END $POOL $PRICE_FEED $SCORE)
    verifyDeploy $B_CDP_MANAGER && export B_CDP_MANAGER=$B_CDP_MANAGER
fi

# Deploy GetCdps
if [ -z "${GET_CDPS}" ]; then
    GET_CDPS=$(dapp create GetCdps)
    verifyDeploy $GET_CDPS && export GET_CDPS=$GET_CDPS
fi

# Deploy UserInfo
if [ -z "${USER_INFO}" ]; then
    gem=$(seth call $GEM_JOIN_ETH 'gem()(address)')
    USER_INFO=$(dapp create UserInfo $DAI $gem)
    verifyDeploy $USER_INFO && export USER_INFO=$USER_INFO
fi

# Deploy GovernanceExecutor
# ctor args = man_, uint delay_
TWO_DAYS=$(expr 2 \* $ONE_DAY)
if [ -z "${GOV_EXECUTOR}" ]; then
    GOV_EXECUTOR=$(dapp create GovernanceExecutor $B_CDP_MANAGER $TWO_DAYS)
    verifyDeploy $GOV_EXECUTOR && export GOV_EXECUTOR=$GOV_EXECUTOR
fi

# Deploy Migrate
# ctor args = jarConnector_, man_, executor_
if [ -z "${MIGRATE}" ]; then
    MIGRATE=$(dapp create Migrate $JAR_CONNECTOR $B_CDP_MANAGER $GOV_EXECUTOR)
    verifyDeploy $MIGRATE && export MIGRATE=$MIGRATE
fi

# Deploy FlatLiquidatorInfo
# ctor args = manager_
if [ -z "${FLATLIQUIDATOR_INFO}" ]; then
    FLATLIQUIDATOR_INFO=$(dapp create FlatLiquidatorInfo $B_CDP_MANAGER $CHAINLINK)
    verifyDeploy $FLATLIQUIDATOR_INFO && export FLATLIQUIDATOR_INFO=$FLATLIQUIDATOR_INFO
fi


### DEPLOYMENT DONE ####

##################################################
##### CONTRACT LINKING AND SETTING UP PARAMS #####
##################################################
if [ -z "${MISC_SETUP_DONE}" ]; then
    # Jar, JarConnector, Score
    seth send $JAR_CONNECTOR 'setManager(address)' $B_CDP_MANAGER
    seth send $SCORE 'setManager(address)' $B_CDP_MANAGER
    seth send $SCORE 'transferOwnership(address)' $JAR_CONNECTOR
    seth send $JAR_CONNECTOR 'spin()'

    # Governance
    seth send $GOV_EXECUTOR 'setGovernance(address)' $MIGRATE

    export MISC_SETUP_DONE=1
fi

# BudConnector Setup
if [ -z "${BUD_SETUP_DONE}" ]; then
    # BudConnector
    seth send $BUD_CONN_ETH 'authorize(address)' $POOL
    seth send $BUD_CONN_ETH 'authorize(address)' $B_CDP_MANAGER
    seth send $BUD_CONN_WBTC 'authorize(address)' $POOL
    seth send $BUD_CONN_WBTC 'authorize(address)' $B_CDP_MANAGER

    # BudConnector `setPip`
    seth send $BUD_CONN_ETH 'setPip(address,bytes32)' $PIP_ETH $ILK_ETH
    seth send $BUD_CONN_WBTC 'setPip(address,bytes32)' $PIP_WBTC $ILK_WBTC

    # OSM.kiss
    seth send $PIP_ETH 'kiss(address)' $BUD_CONN_ETH
    seth send $PIP_WBTC 'kiss(address)' $BUD_CONN_WBTC
    export BUD_SETUP_DONE=1
fi

# Set Pool Params
if [ -z "${POOL_SETUP_DONE}" ]; then
    seth send $POOL 'setCdpManager(address)' $B_CDP_MANAGER
    seth send $POOL 'setProfitParams(uint256,uint256)' 1065 1130 # Liquidator profit 106.5/113
    seth send $POOL 'setIlk(bytes32,bool)' $ILK_ETH 1
    seth send $POOL 'setIlk(bytes32,bool)' $ILK_WBTC 1
    seth send $POOL 'setOsm(bytes32,address)' $ILK_ETH $BUD_CONN_ETH
    seth send $POOL 'setOsm(bytes32,address)' $ILK_WBTC $BUD_CONN_WBTC
    seth send $POOL 'setMinArt(uint256)' $(($ONE_MILLION * $ONE_ETH))
    seth send $POOL 'setMembers(address[])' $MEMBERS
    export POOL_SETUP_DONE=1
fi

# TODO Transfer ownership to MULTISIG

echo -e "\e[1;32mDEPLOYMENT DONE.\e[0m"

# Testchain specific setup
#setupTestchain $NETWORK

logMCD

echo # empty line
echo "##################################"
echo "###### B.PROTOCOL ADDRESSES ######"
echo "##################################"
echo DAI2USD=$DAI2USD
echo SCORE=$SCORE
echo JAR=$JAR
echo JAR_CONNECTOR=$JAR_CONNECTOR
echo PRICE_FEED=$PRICE_FEED
echo CHAINLINK=$CHAINLINK
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
echo GOV_EXECUTOR=$GOV_EXECUTOR
echo MIGRATE=$MIGRATE
echo B_PROXY_ACTIONS=$B_PROXY_ACTIONS
echo FLATLIQUIDATOR_INFO=$FLATLIQUIDATOR_INFO
echo "##################################"

# VALIDATE DEPLOYMENT
validateAll

# back to original folder
cd ..
cd ..
