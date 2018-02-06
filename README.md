# EtherPanther Test Client

It is a standalone test client, i.e. written without the truffle framework.
The idea is it simulates a web client and is ment to run on both development and test
Ethereum network (Ropsten was chosen because of PoW).

## Developers info
**Running functional tests** 
  - prerequisites:
    - (in case of running locally) ganache-cli is up and running: `ganache-cli --networkId=73 --account="<privateKey to coinbase,etherInWei>"`
    - (deploy smart contracts) `truffle migrate --network={development,ropsten}` from within `etherpanther-blockchain` project
  - `npm test test.js -- --network=development --timeout=300000`, where `network={development,ropsten}`
     with `development` being the default one; `timeout` is for mocha framework
