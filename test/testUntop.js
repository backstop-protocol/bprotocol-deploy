const BN = require("bn.js");
const { time } = require("@openzeppelin/test-helpers");

const abiJSON = require("../lib/dss-cdp-manager/out/dapp.sol.json");
const mcdJSON = require("../config/mcd_testchain.json");
const bpJSON = require("../config/bprotocol_testchain.json");

const RAY = new BN(10).pow(new BN(27));
const ONE_ETH = new BN(10).pow(new BN(18));
const ILK_ETH = web3.utils.padRight(web3.utils.asciiToHex("ETH-A"), 64);

const BCdpManager = artifacts.require("BCdpManager");
const DssCdpManager = artifacts.require("DssCdpManager");
const WETH = artifacts.require("WETH");
const GemJoin = artifacts.require("GemJoin");
const OSM = artifacts.require("OSM");
const DSValue = artifacts.require("DSValue");
const MockDaiToUsdPriceFeed = artifacts.require("MockDaiToUsdPriceFeed");
const Spotter = artifacts.require("Spotter");

let bCdpManager;
let dssCdpManager;
let weth;
let gemJoin;
let osm;
let dai2usd;
let spot;
let real;

let USER_1 = "0xda1495ebd7573d8e7f860862baa3abecebfa02e0";
let USER_2 = "0xb76a5a26ba0041eca3edc28a992e4eb65a3b3d05";

let MEMBER_1 = bpJSON.MEMBER_1;

contract("Testchain", (accounts) => {
  before(async () => {
    bCdpManager = await BCdpManager.at(bpJSON.B_CDP_MANAGER);
    dssCdpManager = await DssCdpManager.at(mcdJSON.CDP_MANAGER);
    gemJoin = await GemJoin.at(mcdJSON.MCD_JOIN_ETH_A);
    const gem = await gemJoin.gem();
    weth = await WETH.at(gem);
    osm = await OSM.at(mcdJSON.PIP_ETH);
    dai2usd = await MockDaiToUsdPriceFeed.at(bpJSON.DAI2USD);
    spot = await Spotter.at(mcdJSON.MCD_SPOT);
    real = await DSValue.at(bpJSON.PRICE_FEED);

    // await init();
  });

  it("Test untop", async () => {
    // 1.
    const cdp = await mintDaiForUser(2, 190, { from: USER_2 });

    // 2. setNextPrice
    nextTime = Number(await osm.zzz()) + parseInt(Number(await osm.hop()) / 2) + 1;
    await time.increase(nextTime);
    await setNextPrice(new BN(140).mul(ONE_ETH));
    await dai2usd.setPrice(new BN(140).mul(ONE_ETH));
    await real.poke(uintToBytes32(new BN(140).mul(ONE_ETH)));
    console.log("Current price: " + (await getCurrentPrice()).toString());
    await increaseHalfHour();

    // 3. It should be topped up at Bot

    console.log("waiting.....");
    await sleep(10000);

    // 4. Set 150 next price again
    await bCdpManager.frob(cdp, -1, 0, { from: USER_2 });
    nextTime = Number(await osm.zzz()) + parseInt(Number(await osm.hop()) / 2) + 1;
    await time.increase(nextTime);
    await setNextPrice(new BN(150).mul(ONE_ETH));
    await dai2usd.setPrice(new BN(150).mul(ONE_ETH));
    await real.poke(uintToBytes32(new BN(150).mul(ONE_ETH)));
    console.log("Current price: " + (await getCurrentPrice()).toString());
    await increaseHalfHour();

    // 5. poke
    await increaseHalfHour();
    await real.poke(uintToBytes32(new BN(150).mul(ONE_ETH)));
    await osm.poke();
    await spot.poke(ILK_ETH);

    // 5. It should be untopped at Bot
  });
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/*
async function init() {
  const nextTime = Number(await osm.zzz()) + parseInt(Number(await osm.hop()) / 2) + 1;
  await time.increase(nextTime);

  await osm.kiss(mcdJSON.DEPLOYER);
  const val = await DSValue.at(mcdJSON.VAL_ETH);
  const bytes32 = uintToBytes32(new BN(150).mul(ONE_ETH));
  await val.poke(bytes32);
  await osm.poke();

  await time.increase(3600);
  await osm.poke();

  console.log("Current price: " + (await getCurrentPrice()).toString());
}
*/

async function increaseHalfHour() {
  const hop = await osm.hop();
  await time.increase(hop / 2 + 1);
}

/*
async function setupTestchain() {
  await mintDaiForMember(20, 1000, { from: MEMBER_1 });
  // await mintDaiForMember(20, 1000, { from: MEMBER_2 });
  // await mintDaiForMember(20, 1000, { from: MEMBER_3 });
  // await mintDaiForMember(20, 1000, { from: MEMBER_4 });
}
*/

async function mintDaiForUser(amtInEth, amtInDai, opt) {
  const cdp = await mintDai(bCdpManager, amtInEth, amtInDai, false, opt);
  console.log("Minted: " + amtInDai + " DAI for USER:" + opt.from);
  return cdp;
}

/*
async function mintDaiForMember(amtInEth, amtInDai, opt) {
  const _from = opt.from;
  const cdp = await mintDai(dssCdpManager, amtInEth, amtInDai, true, opt);
  console.log("Minted: " + amtInDai + " DAI for MEMBER:" + opt.from);
  return cdp;
}
*/

async function mintDai(manager, amtInEth, amtInDai, isMove, opt) {
  const _from = opt.from;
  const ink = new BN(amtInEth).mul(new BN(ONE_ETH));
  const art = new BN(amtInDai).mul(new BN(ONE_ETH));
  let cdp;
  try {
    // manager.open();
    cdp = await manager.open.call(ILK_ETH, _from, {
      from: _from,
    });
    await manager.open(ILK_ETH, _from, { from: _from });

    // WETH.deposit()
    await web3.eth.sendTransaction({
      from: _from,
      to: weth.address,
      value: ink,
    });

    // WETH.approve()
    await weth.approve(gemJoin.address, ink, { from: _from });

    // ethJoin.join()
    const urn = await manager.urns(cdp);
    await gemJoin.join(urn, ink, { from: _from });

    // manager.frob()
    await manager.frob(cdp, ink, art, { from: _from });

    if (isMove) {
      // manager.move();
      await manager.move(cdp, _from, art.mul(RAY), {
        from: _from,
      });
    }
  } catch (err) {
    console.log(err);
  }
  return cdp;
}

async function setNextPrice(price) {
  console.log("Current price: " + (await getCurrentPrice()).toString());

  await osm.kiss(mcdJSON.DEPLOYER);
  const val = await DSValue.at(mcdJSON.VAL_ETH);
  const bytes32 = uintToBytes32(price);
  await val.poke(bytes32);

  const pass = await osm.pass({ from: mcdJSON.DEPLOYER });
  if (pass) await osm.poke();
  console.log("Next price: " + (await getNextPrice()).toString());
}

async function getCurrentPrice() {
  const read = await osm.read({ from: mcdJSON.DEPLOYER });
  return bytes32ToBN(read);
}

async function getNextPrice() {
  const peep = await osm.peep({ from: mcdJSON.DEPLOYER });
  return bytes32ToBN(peep[0]);
}

function uintToBytes32(val) {
  return web3.utils.padLeft(web3.utils.numberToHex(val), 64);
}

function bytes32ToBN(val) {
  return new BN(web3.utils.hexToNumberString(val));
}
