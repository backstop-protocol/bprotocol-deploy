# bprotocol-deploy

## Update

    dapp update

### Launch existing BProtocol snapshot

Command launch BProtocol snapshot which is already created and present in the folder `snapshots/bprotocol.tgz`

    sh launch.sh

### Build BProtocol Snapshot from scratch

Command deploy MCD from scratch and then deploys BProtocol contracts. This should be used when you want to modify the snapshot. Otherwise, use the `launch.sh` script to launch the already created snapshot.

    sh build.sh

#### Supported network

    testchain
