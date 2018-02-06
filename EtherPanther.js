const fs = require('fs');
const HDWalletProvider = require('truffle-hdwallet-provider');

module.exports = (web3) => {
    const EtherPanther = {};

    const etherPantherCompiled = JSON.parse(fs.readFileSync('../etherpanther-blockchain/build/contracts/EtherPanther.json', 'utf8'));

    const etherPantherAbi = etherPantherCompiled['abi'];

    let etherPanther;
    web3.eth.net.getId().then(function(networkId) {
        etherPanther = new web3.eth.Contract(etherPantherAbi, etherPantherCompiled['networks'][networkId]['address']);
    });

    let user;
    web3.eth.getAccounts().then(function(accounts) {
        user = accounts[0];
    });

    EtherPanther.getUser = async function getUser() {
        return user;
    }

    EtherPanther.getAddress = async function getAddress() {
        return etherPanther.options.address;
    }

    EtherPanther.depositEther = async function depositEther(amount, gas, gasPrice) {
        return etherPanther.methods.depositEther()
                                   .send({from: user, value: amount, gas: gas, gasPrice: gasPrice});
    }

    EtherPanther.depositTokens = async function depositTokens(token, amount, gas, gasPrice) {
        return etherPanther.methods.depositTokens(token, amount)
                                   .send({from: user, gas: gas, gasPrice: gasPrice});
    }

    EtherPanther.withdrawEther = async function withdrawEther(amount, gas, gasPrice) {
        return etherPanther.methods.withdrawEther(amount)
                                   .send({from: user, gas: gas, gasPrice: gasPrice});
    }

    EtherPanther.withdrawTokens = async function withdrawTokens(token, amount, gas, gasPrice) {
        return etherPanther.methods.withdrawTokens(token, amount)
                                   .send({from: user, gas: gas, gasPrice: gasPrice});
    }

    EtherPanther.getBalanceEth = async function getBalanceEth() {
        return etherPanther.methods.eth(user).call();
    }

    EtherPanther.getBalanceTokens = async function getBalanceTokens(token) {
        return etherPanther.methods.tokens(token, user).call();
    }

    EtherPanther.trade = async function trade(maker, orderType, token, makerTokenAmount, makerEthAmount, expires, nonce,
                                              v,  r,  s,
                                              takerTokenAmount, referrer,
                                              gas, gasPrice) {

        return etherPanther.methods.trade(maker, orderType, token, makerTokenAmount, makerEthAmount, expires, nonce,
                                          v, r, s,
                                          takerTokenAmount, referrer)
                                   .send({from:user, gas:gas, gasPrice:gasPrice});
    }

    EtherPanther.cancelOrder = async function cancelOrder(hash, gas, gasPrice) {
        return etherPanther.methods.cancelOrder(hash).send({from:user, gas:gas, gasPrice:gasPrice});
    }

    EtherPanther.getOrderFills = async function getOrderFills(hash) {
        return etherPanther.methods.orderFills(user, hash).call();
    }

    EtherPanther.getReferrer = async function getReferrer() {
        return etherPanther.methods.referrers(user).call();
    }

    return EtherPanther;
}
