'use strict';

const HDWalletProvider = require("truffle-hdwallet-provider");


module.exports = (token, user) => {
    const Token = {};

    Token.approve = async function approve(contract, amount, gas, gasPrice) {
        return token.methods.approve(contract, amount)
                            .send({from:user, gas:gas, gasPrice:gasPrice});
    }

    Token.transfer = async function transfer(to, amount, gas, gasPrice) {
        return token.methods.transfer(to, amount)
                            .send({from:user, gas:gas, gasPrice:gasPrice});
    }

    Token.balanceOf = async function balanceOf() {
        return token.methods.balanceOf(user).call();
    }

    Token.getDecimals = async function getDecimals() {
        return token.methods.decimals().call();
    }

    Token.getAddress = async function getAddress() {
        return token.options.address;
    }

    return Token;
}
