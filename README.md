# bprotocol-deploy

## Requirements

For `testchain`, launch the testchain before.

For `testnet`, set the following environment variables

    export ETH_FROM=0x16Fb96a5fa0427Af0C8F7cF1eB4870231c8154B6

    export ETH_RPC_URL=127.0.0.1:2000

### Start deployment

    . ./deploy.sh <network> <reset>

#### Example

To deploy contracts on `testchain` network. Script automatically skip if BProtocol contracts are already deployed. However, this is possible only in the same shell environment, as its using environment variables to find the deployment status of the contracts.

    . ./deploy.sh testchain

To reset the deployment. Re-deploy all contracts again.

    . ./deploy.sh testchain reset

Supported network

    testchain
