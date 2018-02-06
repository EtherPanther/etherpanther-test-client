'use strict';

const BN = require('bn.js');
const fs = require('fs');
const Web3 = require('web3');
const assert = require('chai').assert;
const HDWalletProvider = require('truffle-hdwallet-provider');

const USERS = ['USER1', 'USER2', 'USER3', 'USER4', 'USER5', 'USER6'];
const USERS_AND_DEPLOYER = ['DEPLOYER', 'USER1', 'USER2', 'USER3', 'USER4', 'USER5', 'USER6'];

const deployerMnemonic = fs.readFileSync('./config/coinbaseMnemonic', 'utf8');

const Networks = {
    'development': 73,
    'ropsten': 3
};

let network='development';
process.argv.forEach(function (val, index, array) {
    if (val.includes('--network=')) {
        network = val.replace('--network=', '');
    }
});

let url;
if (network === 'ropsten') {
    url = fs.readFileSync('./config/ropstenUrl', 'utf8');
} else {
    url = 'http://localhost:8545';
}

let web3 = [];
web3['DEPLOYER'] = new Web3(new HDWalletProvider(deployerMnemonic, url));

const Utils = require('./Utils.js')(url);

let users = [];
let etherPanther = [];
let testToken = [];

let TEST_GAS;
let TEST_GAS_PRICE;
let TEST_TOKEN_AMOUNT;

let etherPantherAddress;
let testTokenAddress;

describe('Configuration', async function() {

    USERS.forEach(function (user) {
        it('should create user account: ' + user, async function () {
            const newAccount = await Utils.createNewAccount();
            web3[user] = new Web3(new HDWalletProvider(newAccount['privateKey']), url);
        });
    });

    USERS_AND_DEPLOYER.forEach(function (user) {
        it('should set users: ' + user, async function () {
            const accounts = await web3[user].eth.getAccounts();
            users[user] = accounts[0];
        });
    });

    USERS_AND_DEPLOYER.forEach(function (user) {
        it('should create smart contracts abstractions: ' + user, async function () {
            // EtherPanther
            etherPanther[user] = require('./EtherPanther.js')(web3[user]);
            // TestToken
            const testTokenCompiled = JSON.parse(fs.readFileSync('../etherpanther-blockchain/build/contracts/TestToken.json', 'utf8'));
            const testTokenAbi = testTokenCompiled['abi'];
            const testTokenTemp =  new web3[user].eth.Contract(testTokenAbi, testTokenCompiled['networks'][Networks[network]]['address']);
            testToken[user] = require('./Token.js')(testTokenTemp, users[user]);
        });
    });

    it('should init common test variables', async function () {
        etherPantherAddress = await etherPanther['DEPLOYER'].getAddress();
        testTokenAddress = await testToken['DEPLOYER'].getAddress();

        TEST_GAS = 1000000;
        TEST_GAS_PRICE = await Utils.toWei("4", "gwei");

        const TOKEN_NUMBER = 7;
        const decimalPlaces = await testToken['DEPLOYER'].getDecimals();

        TEST_TOKEN_AMOUNT = new BN(TOKEN_NUMBER).mul(new BN(10).pow(new BN(decimalPlaces)));
    });

    USERS.forEach(function (user) {
        it('should transfer ether from deployer account to users accounts: ' + user, async function () {
            const amount = await Utils.toWei("0.2", "ether");
            const tx = await Utils.transferEth(web3['DEPLOYER'], users['DEPLOYER'], users[user], amount, TEST_GAS, TEST_GAS_PRICE);
            const balance = await Utils.getBalanceEth(users[user]);
            assert.equal(balance, amount);
        });
    });

    USERS.forEach(function (user) {
        it('should transfer tokens from main account to users accounts: ' + user, async function () {
            const tx = await testToken['DEPLOYER'].transfer(users[user], TEST_TOKEN_AMOUNT, TEST_GAS, TEST_GAS_PRICE);
            const balance = await testToken[user].balanceOf();
            assert.equal(balance.toString(), TEST_TOKEN_AMOUNT.toString());
        });
    });

    USERS.forEach(function (user) {
        it('should deposit ether to EtherPanther smart contract: ' + user, async function () {
            const amount = await Utils.toWei("0.1", "ether");

            const tx = await etherPanther[user].depositEther(amount, TEST_GAS, TEST_GAS_PRICE);
            const balance = await etherPanther[user].getBalanceEth();
            assert.equal(balance, amount.toString());
        });
    });

    USERS.forEach(function (user) {
        it('should deposit tokens to EtherPanther smart contract: ' + user, async function () {
            // users grant approval to EtherPanther smart contract
            const tx1 = await testToken[user].approve(etherPantherAddress, TEST_TOKEN_AMOUNT, TEST_GAS, TEST_GAS_PRICE);

            // users deposit tokens to EtherPanther
            const tx2 = await etherPanther[user].depositTokens(testTokenAddress, TEST_TOKEN_AMOUNT, TEST_GAS, TEST_GAS_PRICE);

            const balance = await etherPanther[user].getBalanceTokens(testTokenAddress);
            assert.equal(balance, TEST_TOKEN_AMOUNT.toString());
        });
    });

    ['USER5', 'USER6'].forEach(function (user) {
        it('should withdraw eth', async function() {
            const startBalance = await etherPanther[user].getBalanceEth();
            assert.notEqual(startBalance.toString(), new BN(0).toString());

            await etherPanther[user].withdrawEther(startBalance, TEST_GAS, TEST_GAS_PRICE);
            const endBalance = await etherPanther[user].getBalanceEth();
            assert.equal(endBalance.toString(), new BN(0).toString());
        });
    });

    ['USER5', 'USER6'].forEach(function (user) {
        it('should withdraw tokens', async function() {
            const startBalance = await etherPanther[user].getBalanceTokens(testTokenAddress);
            assert.notEqual(startBalance.toString(), new BN(0).toString());

            await etherPanther[user].withdrawTokens(testTokenAddress, startBalance, TEST_GAS, TEST_GAS_PRICE);
            const endBalance = await etherPanther[user].getBalanceTokens(testTokenAddress);
            assert.equal(endBalance.toString(), new BN(0).toString());
        });
    });

})

describe('Trading', async function() {

    // common constants
    const OrderType = {
        SELL_TOKENS : 1,
        BUY_TOKENS : 2
    };

    // Transactions data shared across all the test cases
    let TD = [];

    // helper methods
    let balanceEthStart = [];
    let balanceTokensStart = [];

    let balanceEthEnd = [];
    let balanceTokensEnd = [];

    async function getBalanceStart(T) {
        let promisesStart = [];
        T.participants.forEach(async function (user) {
            balanceEthStart[user] = etherPanther[user].getBalanceEth();
            balanceTokensStart[user] = etherPanther[user].getBalanceTokens(testTokenAddress);
            promisesStart.push(balanceEthStart[user], balanceTokensStart[user]);
        });
        await Promise.all(promisesStart);

        // to allow the test to wait for all the promises to be resolved/computations to be done
        return new Promise((resolve, reject) => {resolve(true);});
    };

    async function assertBalanceChange(T) {
        let promisesEnd = [];
        T.participants.forEach(async function (user) {
            balanceEthEnd[user] = etherPanther[user].getBalanceEth();
            balanceTokensEnd[user] = etherPanther[user].getBalanceTokens(testTokenAddress);
            promisesEnd.push(balanceEthEnd[user], balanceTokensEnd[user]);
        });
        await Promise.all(promisesEnd);

        T.participants.forEach(async function (user) {
            assert.equal(new BN(await balanceEthEnd[user]).sub(new BN(await balanceEthStart[user])).toString(),
                         T.expectedBalanceEthChange[user].toString());

            assert.equal(new BN(await balanceTokensEnd[user]).sub(new BN(await balanceTokensStart[user])).toString(),
                         T.expectedBalanceTokensChange[user].toString());
        });

        // to allow the test to wait for all the promises to be resolved/computations to be done
        return new Promise((resolve, reject) => {resolve(true);});
    }

    async function assertReferrer(T) {
        assert.equal(await etherPanther[T.taker].getReferrer(), await T.expectedReferrerAccount);

        // to allow the test to wait for all the promises to be resolved/computations to be done
        return new Promise((resolve, reject) => {resolve(true);});
    }

    async function assertOrderFills(T) {
        assert.equal(await etherPanther[T.maker].getOrderFills(T.orderHash), T.transactionTokenAmount.toString());

        // to allow the test to wait for all the promises to be resolved/computations to be done
        return new Promise((resolve, reject) => {resolve(true);});
    }

    async function trade(T) {
        await getBalanceStart(T);

        await etherPanther[T.taker].trade(T.makerAccount, T.orderType, testTokenAddress, T.makerTokenAmount, T.makerEthAmount, T.expires, T.nonce,
                                        T.packedSigned.v,  T.packedSigned.r,  T.packedSigned.s,
                                        T.takerTokenAmount, T.referrerAccount,
                                        TEST_GAS, TEST_GAS_PRICE);

        await assertBalanceChange(T);
        await assertReferrer(T);
        await assertOrderFills(T);

        // to allow the test to wait for all the promises to be resolved/computations to be done
        return new Promise((resolve, reject) => {resolve(true);});
    }

    it('should allow user2 to sell all the tokens user1 offers to buy', async function() {
        let T1 = [];
        T1.participants = ['DEPLOYER', 'USER1', 'USER2'];

        T1.admin = 'DEPLOYER';

        T1.maker = 'USER1';
        T1.makerAccount = users[T1.maker];
        T1.orderType = OrderType.BUY_TOKENS;
        T1.makerTokenAmount = await TEST_TOKEN_AMOUNT;
        T1.makerEthAmount = await Utils.toWei('0.003', 'ether');
        T1.expires = await Utils.getBlockNumberToExpireIn(10000);
        T1.nonce = Utils.getNextMakerNonce();

        T1.taker = 'USER2';
        T1.takerTokenAmount = T1.makerTokenAmount;
        T1.referrer = 'USER3';
        T1.referrerAccount = users[T1.referrer];

        // expected results
        T1.transactionTokenAmount = T1.takerTokenAmount;

        const fee = T1.makerEthAmount.mul(new BN(3)).div(new BN(1000)); // multiplied by 0.3 %
        T1.expectedBalanceEthChange = [];
        T1.expectedBalanceEthChange[T1.admin] = fee;
        T1.expectedBalanceEthChange[T1.maker] = new BN(0).sub(T1.makerEthAmount);
        T1.expectedBalanceEthChange[T1.taker] = T1.makerEthAmount.sub(fee);

        T1.expectedBalanceTokensChange = [];
        T1.expectedBalanceTokensChange[T1.admin] = new BN(0);
        T1.expectedBalanceTokensChange[T1.maker] = T1.transactionTokenAmount;
        T1.expectedBalanceTokensChange[T1.taker] = new BN(0).sub(T1.transactionTokenAmount);

        T1.expectedReferrerAccount = Utils.addressZero(); // 'USER3' will not become referrer as he has not done any valid transaction as a taker yet

        // trade
        T1.packed = await Utils.packTightly(etherPantherAddress, T1.orderType, testTokenAddress, T1.makerTokenAmount, T1.makerEthAmount, T1.expires, T1.nonce);
        T1.packedSigned = await Utils.signMessage(web3[T1.maker], T1.packed, T1.makerAccount);
        T1.orderHash = await Utils.orderHash(etherPantherAddress, T1.orderType, testTokenAddress, T1.makerTokenAmount, T1.makerEthAmount, T1.expires, T1.nonce);

        TD['T1'] = T1;
        await trade(TD['T1']);
    });

    it('should allow user2 to buy all the tokens user1 offers to sell', async function() {
        let T2 = [];
        T2.participants = ['DEPLOYER', 'USER1', 'USER2'];

        T2.admin = 'DEPLOYER';

        T2.maker = 'USER1';
        T2.makerAccount = users[T2.maker];
        T2.orderType = OrderType.SELL_TOKENS;
        T2.makerTokenAmount = TEST_TOKEN_AMOUNT;
        T2.makerEthAmount = await Utils.toWei('0.003', 'ether');
        T2.expires = await Utils.getBlockNumberToExpireIn(10000);
        T2.nonce = Utils.getNextMakerNonce();

        T2.taker = 'USER2';
        T2.takerTokenAmount = T2.makerTokenAmount;
        T2.referrer = 'USER3';
        T2.referrerAccount = users[T2.referrer];

        // expected results
        T2.transactionTokenAmount = T2.takerTokenAmount;

        const fee = T2.makerEthAmount.mul(new BN(3)).div(new BN(1000)); // multiplied by 0.3 %
        T2.expectedBalanceEthChange = [];
        T2.expectedBalanceEthChange[T2.admin] = fee;
        T2.expectedBalanceEthChange[T2.maker] = T2.makerEthAmount;
        T2.expectedBalanceEthChange[T2.taker] = new BN(0).sub(T2.makerEthAmount).sub(fee);

        T2.expectedBalanceTokensChange = [];
        T2.expectedBalanceTokensChange[T2.admin] = new BN(0);
        T2.expectedBalanceTokensChange[T2.maker] = new BN(0).sub(T2.transactionTokenAmount);
        T2.expectedBalanceTokensChange[T2.taker] = T2.transactionTokenAmount;

        T2.expectedReferrerAccount = Utils.addressZero();

        // trade:
        T2.packed = await Utils.packTightly(etherPantherAddress, T2.orderType, testTokenAddress, T2.makerTokenAmount, T2.makerEthAmount, T2.expires, T2.nonce);
        T2.packedSigned = await Utils.signMessage(web3[T2.maker], T2.packed, T2.makerAccount);
        T2.orderHash = await Utils.orderHash(etherPantherAddress, T2.orderType, testTokenAddress, T2.makerTokenAmount, T2.makerEthAmount, T2.expires, T2.nonce);

        TD['T2'] = T2;
        await trade(TD['T2']);
    });

    it('should allow user2 to sell NO MORE THAN all the tokens user1 offers to buy', async function() {
        let T1 = TD['T1'];
        let T3 = TD['T1'];

        T3.nonce = Utils.getNextMakerNonce();

        T3.takerTokenAmount = new BN(2).mul(T1.takerTokenAmount);

        T3.transactionTokenAmount = T3.makerTokenAmount;

        // trade
        T3.packed = await Utils.packTightly(etherPantherAddress, T1.orderType, testTokenAddress, T1.makerTokenAmount, T1.makerEthAmount, T1.expires, T3.nonce);
        T3.packedSigned = await Utils.signMessage(web3[T1.maker], T3.packed, T1.makerAccount);
        T3.orderHash = await Utils.orderHash(etherPantherAddress, T1.orderType, testTokenAddress, T1.makerTokenAmount, T1.makerEthAmount, T1.expires, T3.nonce);

        TD['T3'] = T3;
        await trade(TD['T3']);
    });

    it('should allow user2 to buy NO MORE THAN all the tokens user1 offers to sell', async function() {
        let T2 = TD['T2'];
        let T4 = TD['T2'];
        T4 = T2;

        T4.nonce = Utils.getNextMakerNonce();

        T4.takerTokenAmount = new BN(2).mul(T2.takerTokenAmount);

        T4.transactionTokenAmount = T4.makerTokenAmount;

        // trade
        T4.packed = await Utils.packTightly(etherPantherAddress, T2.orderType, testTokenAddress, T2.makerTokenAmount, T2.makerEthAmount, T2.expires, T4.nonce);
        T4.packedSigned = await Utils.signMessage(web3[T2.maker], T4.packed, T2.makerAccount);
        T4.orderHash = await Utils.orderHash(etherPantherAddress, T2.orderType, testTokenAddress, T2.makerTokenAmount, T2.makerEthAmount, T2.expires, T4.nonce);

        TD['T4'] = T4;
        await trade(TD['T4']);
    });

    it('should not allow to transact when expired', async function() {
        let T5 = [];

        T5.participants = ['DEPLOYER', 'USER2', 'USER3', 'USER4'];

        T5.admin = 'DEPLOYER';

        T5.maker = 'USER3';
        T5.makerAccount = users[T5.maker];
        T5.orderType = OrderType.BUY_TOKENS;
        T5.makerTokenAmount = await TEST_TOKEN_AMOUNT;
        T5.makerEthAmount = await Utils.toWei('0.003', 'ether');
        T5.expires = (await Utils.getBlockNumberToExpireIn(10000)) - 10001 ;
        T5.nonce = Utils.getNextMakerNonce();

        T5.taker = 'USER4';
        T5.takerTokenAmount = T5.makerTokenAmount.div(new BN(2));
        T5.referrer = 'USER2'; // 'USER2' has already done a valid taker transaction and can be set as the referrer
        T5.referrerAccount = users[T5.referrer];

        // expected results
        T5.transactionTokenAmount = T5.takerTokenAmount;
        const expectedMakerEthAmount = T5.makerEthAmount.div(new BN(2));

        const fee = expectedMakerEthAmount.mul(new BN(3)).div(new BN(1000)); // multiplied by 0.3 %
        const referrerFee = fee.div(new BN(2));
        const adminFee = fee.sub(referrerFee);
        T5.expectedBalanceEthChange = [];
        T5.expectedBalanceEthChange[T5.referrer] = referrerFee;
        T5.expectedBalanceEthChange[T5.admin] = adminFee;
        T5.expectedBalanceEthChange[T5.maker] = new BN(0).sub(expectedMakerEthAmount);
        T5.expectedBalanceEthChange[T5.taker] = expectedMakerEthAmount.sub(fee);

        T5.expectedBalanceTokensChange = [];
        T5.expectedBalanceTokensChange[T5.referrer] = new BN(0);
        T5.expectedBalanceTokensChange[T5.admin] = new BN(0);
        T5.expectedBalanceTokensChange[T5.maker] = T5.transactionTokenAmount;
        T5.expectedBalanceTokensChange[T5.taker] = new BN(0).sub(T5.transactionTokenAmount);

        T5.expectedReferrerAccount = T5.referrerAccount;

        // trade
        T5.packed = await Utils.packTightly(etherPantherAddress, T5.orderType, testTokenAddress, T5.makerTokenAmount, T5.makerEthAmount, T5.expires, T5.nonce);
        T5.packedSigned = await Utils.signMessage(web3[T5.maker], T5.packed, T5.makerAccount);
        T5.orderHash = await Utils.orderHash(etherPantherAddress, T5.orderType, testTokenAddress, T5.makerTokenAmount, T5.makerEthAmount, T5.expires, T5.nonce);

        TD['T5'] = T5;
        try {
            await trade(TD['T5']);
        } catch(error) {
            assert.include(error.message, Utils.FAILED_TRANSACTION_ERROR);
        }
    });

    it('should not allow to transact when signature invalid', async function() {
        let T6 = TD['T5'];

        T6.expires = await Utils.getBlockNumberToExpireIn(10000)
        T6.nonce = Utils.getNextMakerNonce();

        // trade
        T6.packed = await Utils.packTightly(etherPantherAddress, T6.orderType, testTokenAddress, T6.makerTokenAmount, T6.makerEthAmount, T6.expires, T6.nonce);
        T6.packedSigned = await Utils.signMessage(web3[T6.maker], T6.packed, T6.makerAccount);

        // break 'v' part of signature
        if (T6.packedSigned.v === 27) {
            T6.packedSigned.v = 28;
        } else {
            T6.packedSigned.v = 27;
        }

        T6.orderHash = await Utils.orderHash(etherPantherAddress, T6.orderType, testTokenAddress, T6.makerTokenAmount, T6.makerEthAmount, T6.expires, T6.nonce);

        TD['T6'] = T6;
        try {
            await trade(TD['T6']);
        } catch(error) {
            assert.include(error.message, Utils.FAILED_TRANSACTION_ERROR);
        }
    });

    it('should not allow to transact when already cancelled', async function() {
        let T7 = TD['T5'];
        T7.expires = await Utils.getBlockNumberToExpireIn(10000);
        T7.nonce = Utils.getNextMakerNonce();

        T7.packed = await Utils.packTightly(etherPantherAddress, T7.orderType, testTokenAddress, T7.makerTokenAmount, T7.makerEthAmount, T7.expires, T7.nonce);
        T7.packedSigned = await Utils.signMessage(web3[T7.maker], T7.packed, T7.makerAccount);
        T7.orderHash = await Utils.orderHash(etherPantherAddress, T7.orderType, testTokenAddress, T7.makerTokenAmount, T7.makerEthAmount, T7.expires, T7.nonce);

        // cancel
        await etherPanther[T7.maker].cancelOrder(T7.orderHash, TEST_GAS, TEST_GAS_PRICE);

        //trade
        TD['T7'] = T7;
        try {
            await trade(T7);
        } catch(error) {
            assert.include(error.message, Utils.FAILED_TRANSACTION_ERROR);
        }
    });

    it('should allow user2 to sell half of the tokens user1 offers to buy (i.e. partial fill is allowed)', async function() {
        let T8 = TD['T5'];
        T8.expires = await Utils.getBlockNumberToExpireIn(10000);
        T8.nonce = Utils.getNextMakerNonce();

        T8.packed = await Utils.packTightly(etherPantherAddress, T8.orderType, testTokenAddress, T8.makerTokenAmount, T8.makerEthAmount, T8.expires, T8.nonce);
        T8.packedSigned = await Utils.signMessage(web3[T8.maker], T8.packed, T8.makerAccount);
        T8.orderHash = await Utils.orderHash(etherPantherAddress, T8.orderType, testTokenAddress, T8.makerTokenAmount, T8.makerEthAmount, T8.expires, T8.nonce);

        // trade
        TD['T8'] = T8;
        await trade(T8);
    });

    it('should allow user2 to buy half of the tokens user1 offers to sell (i.e. partial fill is allowed)', async function() {
        let T9 = [];
        T9.participants = ['DEPLOYER', 'USER2', 'USER3', 'USER4'];

        T9.admin = 'DEPLOYER';

        T9.maker = 'USER3';
        T9.makerAccount = users[T9.maker];
        T9.orderType = OrderType.SELL_TOKENS;
        T9.makerTokenAmount = await TEST_TOKEN_AMOUNT;
        T9.makerEthAmount = await Utils.toWei('0.003', 'ether');
        T9.expires = await Utils.getBlockNumberToExpireIn(10000);
        T9.nonce = Utils.getNextMakerNonce();

        T9.taker = 'USER4';
        T9.takerTokenAmount = T9.makerTokenAmount.div(new BN(2));
        T9.referrer = 'USER2'; // 'USER2' has already done a valid taker transaction and can be set as the referrer
        T9.referrerAccount = users[T9.referrer];

        // expected results
        T9.transactionTokenAmount = T9.takerTokenAmount;
        const expectedMakerEthAmount = T9.makerEthAmount.div(new BN(2));

        const fee = expectedMakerEthAmount.mul(new BN(3)).div(new BN(1000)); // multiplied by 0.3 %
        const referrerFee = fee.div(new BN(2));
        const adminFee = fee.sub(referrerFee);
        T9.expectedBalanceEthChange = [];
        T9.expectedBalanceEthChange[T9.referrer] = referrerFee;
        T9.expectedBalanceEthChange[T9.admin] = adminFee;
        T9.expectedBalanceEthChange[T9.maker] = expectedMakerEthAmount;
        T9.expectedBalanceEthChange[T9.taker] = new BN(0).sub(expectedMakerEthAmount).sub(fee);

        T9.expectedBalanceTokensChange = [];
        T9.expectedBalanceTokensChange[T9.referrer] = new BN(0);
        T9.expectedBalanceTokensChange[T9.admin] = new BN(0);
        T9.expectedBalanceTokensChange[T9.maker] = new BN(0).sub(T9.transactionTokenAmount);
        T9.expectedBalanceTokensChange[T9.taker] = T9.transactionTokenAmount;

        T9.expectedReferrerAccount = T9.referrerAccount;

        // trade
        T9.packed = await Utils.packTightly(etherPantherAddress, T9.orderType, testTokenAddress, T9.makerTokenAmount, T9.makerEthAmount, T9.expires, T9.nonce);
        T9.packedSigned = await Utils.signMessage(web3[T9.maker], T9.packed, T9.makerAccount);
        T9.orderHash = await Utils.orderHash(etherPantherAddress, T9.orderType, testTokenAddress, T9.makerTokenAmount, T9.makerEthAmount, T9.expires, T9.nonce);

        TD['T9'] = T9
        await trade(TD['T9']);
    });

});


