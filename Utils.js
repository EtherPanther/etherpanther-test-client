'use strict';

const Web3 = require('web3');
const HDWalletProvider = require("truffle-hdwallet-provider");

module.exports = (url) => {

    const Utils = {};

    const web3 = new Web3(new Web3.providers.HttpProvider(url));

    let makerNonce = 1;

    Utils.FAILED_TRANSACTION_ERROR = 'VM Exception while processing transaction: revert';

    Utils.toWei = async function toWei(value, unit) {
        const result = await web3.utils.toWei(value, unit);
        return web3.utils.toBN(result);
    }

    Utils.addressZero = async function addressZero() {
        return web3.utils.padLeft('0x00', 40);
    }

    Utils.getBalanceEth = async function getBalanceEth(user) {
        return web3.eth.getBalance(user);
    }

    Utils.createNewAccount = async function createNewAccount() {
        return web3.eth.accounts.create();
    }

    Utils.packTightly = async function packTightly(address, orderType, token, tokenAmount, ethAmount, expires, nonce) {
        const addressPart = address.substr(2);
        const orderTypePart = web3.utils.padLeft(web3.utils.toHex(orderType), 64).substr(2);
        const tokenPart = token.substr(2);
        const tokenAmountPart = web3.utils.padLeft(web3.utils.toHex(tokenAmount), 64).substr(2);
        const ethAmountPart = web3.utils.padLeft(web3.utils.toHex(ethAmount), 64).substr(2);
        const expiresPart = web3.utils.padLeft(web3.utils.toHex(expires), 64).substr(2);
        const noncePart = web3.utils.padLeft(web3.utils.toHex(nonce), 64).substr(2);
        const packedTightly = "0x" + addressPart + orderTypePart + tokenPart + tokenAmountPart + ethAmountPart + expiresPart + noncePart;
        return packedTightly;
    }

    Utils.orderHash = async function orderHash(etherPanther, orderType, token, tokenAmount, ethAmount, expires, nonce) {
        return web3.utils.soliditySha3({t: 'address', v: etherPanther},
                                       {t: 'uint', v: orderType},
                                       {t: 'address', v: token},
                                       {t: 'uint', v: tokenAmount},
                                       {t: 'uint', v: ethAmount},
                                       {t: 'uint', v: expires},
                                       {t: 'uint', v: nonce});
    }

    Utils.getBlockNumberToExpireIn = async function getBlockNumberToExpireIn(noOfBlocks) {
        const result = await web3.eth.getBlockNumber();
        return result + noOfBlocks;
    }

    Utils.getNextMakerNonce = function getNextMakerNonce() {
        return makerNonce++;
    }

    // -----------------------------------------------------------------------------------------------------------------
    // methods requiring private key (will be taken from web3 object)
    // -----------------------------------------------------------------------------------------------------------------

    Utils.transferEth = async function transferEth(web3, from, to, amount, gas, gasPrice) {
        return web3.eth.sendTransaction({from: from, to: to, value: amount, gas: gas, gasPrice: gasPrice});
    }

    Utils.signMessage = async function signMessage(web3, msg, user) {

        // web3.eth.sign(user, msgHex) from web3js 0.20.4 adds prefix. sign() from 1.0.0 not - has to be added manually
        let signature = await web3.eth.sign(msg, user);

        signature = signature.substr(2);
        const r = '0x' + signature.slice(0, 64);
        const s = '0x' + signature.slice(64, 128);
        const v = '0x' + signature.slice(128, 130);
        let v_decimal = web3.utils.toDecimal(v);
        if (v_decimal < 27) {
            v_decimal += 27;
        }

        return {
            v: v_decimal,
            r: r,
            s
        };
    }

    return Utils;
}
