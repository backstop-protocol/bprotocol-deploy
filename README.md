# bprotocol-deploy

## Update

    dapp update

### Launch existing BProtocol snapshot

Command launch BProtocol snapshot which is already created and present in the folder `snapshots/bprotocol.tgz`

    sh launch.sh <snapshot>

    example: sh launch.sh bprotocol

### Build BProtocol Snapshot from scratch

Command deploy MCD from scratch and then deploys BProtocol contracts. This should be used when you want to modify the snapshot. Otherwise, use the `launch.sh` script to launch the already created snapshot.

    sh build.sh

### Deploys BProtocol contracts on network

Deploys BProtocol contracts on the given network. It is expected that all the environment variables for `dapp` and `seth` commands are set.

    sh deploy.sh <network>

    example: sh deploy.sh testchain

#### Supported network

    testchain

### Files

config/testchain_deploy_config.json: This config file is used by the `testchain` to deploy MCD contracts.

config/mcd_testchain.json: MCD snapshot has these contracts deployed.

config/bprotocol_testchain.json: BProtocol snapshot has these contracts deployed.
