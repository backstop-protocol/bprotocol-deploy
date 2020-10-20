const BN = require("bn.js");
const { time } = require("@openzeppelin/test-helpers");

require("@openzeppelin/test-helpers/configure")({
    provider: "http://localhost:2000",
});

const abiJSON = require("../../lib/dss-cdp-manager/out/dapp.sol.json");
const mcdJSON = require("../../config/mcd_testchain.json");
const bpJSON = require("../../config/bprotocol_testchain.json");
const { default: Web3 } = require("web3");
const { min } = require("bn.js");

// Constants
const RAY = new BN(10).pow(new BN(27));
const ONE_ETH = new BN(10).pow(new BN(18));
const HUNDRED_DAI = new BN(100).mul(ONE_ETH);
const FIFTY_DAI = new BN(50).mul(ONE_ETH);

// MCD Contracts
const DssCdpManager = artifacts.require("DssCdpManager");
const Dai = artifacts.require("Dai");
const DaiJoin = artifacts.require("DaiJoin");
const GemJoin = artifacts.require("GemJoin");
const WETH = artifacts.require("WETH");
const Vat = artifacts.require("Vat");
const Spotter = artifacts.require("Spotter");

// B.Protocol Contracts
const BCdpManager = artifacts.require("BCdpManager");
const Pool = artifacts.require("Pool");
const BudConnector = artifacts.require("BudConnector");
const DSValue = artifacts.require("DSValue");
const OSM = artifacts.require("OSM");

let bCdpManager;
let pool;
let dai;
let daiJoin;
let dssCdpManager;
let gemJoin;
let weth;
let vat;
let osm;
let spot;

let MEMBER_1 = bpJSON.MEMBER_1;
let MEMBER_2 = bpJSON.MEMBER_2;
let MEMBER_3 = bpJSON.MEMBER_3;
let MEMBER_4 = bpJSON.MEMBER_4;

const ILK_ETH = web3.utils.padRight(web3.utils.asciiToHex("ETH-A"), 64);

module.exports = async function (callback) {
    bCdpManager = await BCdpManager.at(bpJSON.B_CDP_MANAGER);
    pool = await Pool.at(bpJSON.POOL);
    dai = await Dai.at(mcdJSON.MCD_DAI);
    daiJoin = await DaiJoin.at(mcdJSON.MCD_JOIN_DAI);
    dssCdpManager = await DssCdpManager.at(mcdJSON.CDP_MANAGER);
    gemJoin = await GemJoin.at(mcdJSON.MCD_JOIN_ETH_A);
    vat = await Vat.at(mcdJSON.MCD_VAT);
    osm = await OSM.at(mcdJSON.PIP_ETH);
    spot = await Spotter.at(mcdJSON.MCD_SPOT);

    try {
        await loadWETH();

        // await setupTestchain();

        /*
    const daiInRad = HUNDRED_DAI.mul(RAY);
    await memberDeposit(daiInRad, { from: MEMBER_1 });
    await memberDeposit(daiInRad, { from: MEMBER_2 });
    await memberDeposit(daiInRad, { from: MEMBER_3 });
    await memberDeposit(daiInRad, { from: MEMBER_4 });
    
    await memberWithdraw(daiInRad, { from: MEMBER_1 });
    await memberWithdraw(daiInRad, { from: MEMBER_2 });
    await memberWithdraw(daiInRad, { from: MEMBER_3 });
    await memberWithdraw(daiInRad, { from: MEMBER_4 });
    */

        // await getTopAmount(1);

        await setPrice(new BN(150).mul(ONE_ETH));
        // await getTopAmount(1);
    } catch (err) {
        console.log(err);
    }
};

async function getTopAmount(cdp) {
    // cdp = openCdp(1 ether, 110 ether);
    const amt = await pool.topAmount(cdp);
    console.log(amt);
    // const bud = await pool.osm(ILK_ETH);
    // console.log("bud " + bud);
    // const budConnector = await BudConnector.at(bud);
    // const osm = await budConnector.osm();
    // console.log(osm);
}

async function setPrice(price) {
    console.log("Current price: " + (await getCurrentPrice()).toString());

    await osm.kiss(mcdJSON.DEPLOYER);
    const val = await DSValue.at(mcdJSON.VAL_ETH);
    const bytes32 = uintToBytes32(price);
    await val.poke(bytes32);

    const pass = await osm.pass({ from: mcdJSON.DEPLOYER });
    if (pass) {
        // to poke empty next, only for the first time
        await osm.poke();
    }

    const hop = await osm.hop();
    await time.increase(hop);

    await osm.poke();
    await spot.poke(ILK_ETH);

    console.log("New price: " + (await getCurrentPrice()).toString());
}

async function getCurrentPrice() {
    const read = await osm.read({ from: mcdJSON.DEPLOYER });
    return bytes32ToBN(read);
}

function uintToBytes32(val) {
    return web3.utils.padLeft(web3.utils.numberToHex(val), 64);
}

function bytes32ToBN(val) {
    return new BN(web3.utils.hexToNumberString(val));
}

async function loadWETH() {
    const gem = await gemJoin.gem();
    weth = await WETH.at(gem);
}

async function setupTestchain() {
    await mintDaiForMember(1, 100, { from: MEMBER_1 }); // 1 eth, 100 DAI
    await mintDaiForMember(1, 100, { from: MEMBER_2 });
    await mintDaiForMember(1, 100, { from: MEMBER_3 });
    await mintDaiForMember(1, 100, { from: MEMBER_4 });
}

async function mintDaiForMember(amtInEth, amtInDai, opt) {
    const _from = opt.from;
    ink = new BN(amtInEth).mul(new BN(ONE_ETH));
    art = new BN(amtInDai).mul(new BN(ONE_ETH));

    // DssCdpManager.open();
    const cdp = await dssCdpManager.open.call(ILK_ETH, _from, {
        from: _from,
    });
    await dssCdpManager.open(ILK_ETH, _from, { from: _from });

    // WETH.deposit()
    await web3.eth.sendTransaction({
        from: _from,
        to: weth.address,
        value: ink,
    });

    // WETH.approve()
    await weth.approve(gemJoin.address, ink, { from: _from });

    // ethJoin.join()
    const urn = await dssCdpManager.urns(cdp);
    await gemJoin.join(urn, ink, { from: _from });

    // DssCdpManager.frob()
    await dssCdpManager.frob(cdp, ink, art, { from: _from });

    // DssCdpManager.move();
    await dssCdpManager.move(cdp, _from, art.mul(RAY), {
        from: _from,
    });

    console.log("Minted: " + amtInDai + " DAI for user:" + _from);
}

async function memberDeposit(radVal, opt) {
    const _from = opt.from;
    await vat.hope(pool.address, { from: _from });

    await pool.deposit(radVal, { from: _from });

    console.log("Member:" + _from + " deposited: " + radToDAI(radVal) + " DAI");
}

function radToDAI(radVal) {
    return radVal.div(RAY).div(ONE_ETH).toString();
}

function wadToDAI(wad) {
    return radVal.div(ONE_ETH).toString();
}

async function memberTopup() {}

async function memberUntop() {}

async function memberBite() {}

async function memberWithdraw(radVal, opt) {
    const _from = opt.from;
    await pool.withdraw(radVal, { from: _from });
    console.log("Member:" + _from + " withdrew: " + radToDAI(radVal) + " DAI");
}
