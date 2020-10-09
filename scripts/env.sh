echo # empty line
echo NETWORK=$1
export NETWORK=$1

export SOLC_FLAGS="--optimize optimize-runs=200"
export ETH_RPC_ACCOUNTS=yes
export SETH_ASYNC=no

JSON_FILE=config/$1.json
echo JSON_FILE=$JSON_FILE
export JSON_FILE=$JSON_FILE

##### CONSTANTS #####
ONE_DAY=$(expr 60 \* 60 \* 24)
ONE_MONTH=$(expr 30 \* $ONE_DAY) # assume 30 days in a month
FIVE_MONTHS=$(expr 5 \* $ONE_MONTH)
ONE_ETH=$((10**18))
ONE_MILLION=$((10**6))