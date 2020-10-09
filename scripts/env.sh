# If ETH_FROM not set, use the one for testchain
test -z $ETH_FROM && export ETH_FROM=0x16Fb96a5fa0427Af0C8F7cF1eB4870231c8154B6
# If ETH_RPC_URL not set, use the one for testchain
test -z $ETH_RPC_URL && export ETH_RPC_URL=127.0.0.1:2000
# If ETH_GAS not set, use the one for testchain
test -z $ETH_GAS && export ETH_GAS=7000000

export SOLC_FLAGS="--optimize optimize-runs=200"
export ETH_RPC_ACCOUNTS=yes
export SETH_ASYNC=no


##### CONSTANTS #####

JSON_FILE=config/$1.json
ONE_DAY=$(expr 60 \* 60 \* 24)
ONE_MONTH=$(expr 30 \* $ONE_DAY) # assume 30 days in a month
FIVE_MONTHS=$(expr 5 \* $ONE_MONTH)

##### CONFIGS #####

# addresses from testchain, indexes 10,11,12,13
MEMBER_1="0xa71f462b2a7fbba9daf31050c4a82b2084442038"
MEMBER_2="0x654e7b3327634c78bfb21c6010afa29a22d7a605"
MEMBER_3="0xf0117583019f74e7feef294091af7f137d529f10"
MEMBER_4="0x85efdf75b3fa42457e670b43e77dfa58a77799c7"

# convert addresses to checksum
MEMBER_1=$(seth --to-address $MEMBER_1)
export MEMBER_1=$MEMBER_1
MEMBER_2=$(seth --to-address $MEMBER_2)
export MEMBER_2=$MEMBER_2
MEMBER_3=$(seth --to-address $MEMBER_3)
export MEMBER_3=$MEMBER_3
MEMBER_4=$(seth --to-address $MEMBER_4)
export MEMBER_4=$MEMBER_4

MEMBERS="[$MEMBER_1,$MEMBER_2,$MEMBER_3,$MEMBER_4]"
export MEMBERS=$MEMBERS