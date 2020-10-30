"use strict";

const BN = require("bn.js");
const { time } = require("@openzeppelin/test-helpers");
const {
  increaseTime_MineBlock_Sleep,
  bytes32ToBN,
  uintToBytes32,
  increaseOneHour,
} = require("../test-utils/utils");
const { WAD, RAY, ONE_ETH, ONE_HOUR } = require("../test-utils/constants");

const mcdJSON = require("../config/mcdTestchain.json");
const bpJSON = require("../config/bprotocolTestchain.json");

const ILK_ETH = web3.utils.padRight(web3.utils.asciiToHex("ETH-A"), 64);

// B.Protocol
const BCdpManager = artifacts.require("BCdpManager");
const LiquidatorInfo = artifacts.require("LiquidatorInfo");
const BudConnector = artifacts.require("BudConnector");

// dYdX
const MockDaiToUsdPriceFeed = artifacts.require("MockDaiToUsdPriceFeed");

// MCD
const WETH = artifacts.require("WETH");
const GemJoin = artifacts.require("GemJoin");
const OSM = artifacts.require("OSM");
const DSValue = artifacts.require("DSValue");
const Spotter = artifacts.require("Spotter");
const Cat = artifacts.require("Cat");
const Vat = artifacts.require("Vat");
const Jug = artifacts.require("Jug");

// B.Protocol
let bCdpManager;
let liqInfo;
let bud;

// dYdX
let dai2usd;

// MCD
let weth;
let gemJoin;
let osm;
let spot;
let real;
let cat;
let vat;
let jug;

let USER_1 = "0xda1495ebd7573d8e7f860862baa3abecebfa02e0";
let USER_2 = "0xb76a5a26ba0041eca3edc28a992e4eb65a3b3d05";

let MEMBER_1 = bpJSON.MEMBER_1;

contract("Testchain", (accounts) => {
  before(async () => {
    // B.Protocol
    bCdpManager = await BCdpManager.at(bpJSON.B_CDP_MANAGER);
    liqInfo = await LiquidatorInfo.at(bpJSON.FLATLIQUIDATOR_INFO);
    bud = await BudConnector.at(bpJSON.BUD_CONN_ETH);

    // MCD
    gemJoin = await GemJoin.at(mcdJSON.MCD_JOIN_ETH_A);
    const gem = await gemJoin.gem();
    weth = await WETH.at(gem);
    osm = await OSM.at(mcdJSON.PIP_ETH);
    spot = await Spotter.at(mcdJSON.MCD_SPOT);
    real = await DSValue.at(bpJSON.PRICE_FEED);
    cat = await Cat.at(mcdJSON.MCD_CAT);
    vat = await Vat.at(mcdJSON.MCD_VAT);
    jug = await Jug.at(mcdJSON.MCD_JUG);

    // dYdX
    dai2usd = await MockDaiToUsdPriceFeed.at(bpJSON.DAI2USD);

    await setMCD();
  });

  beforeEach(async () => {
    await resetPrice();
  });

  it("Test Bite", async () => {
    let ci;
    let bi;

    // Mint
    const cdp = await mintDaiForUser(2, 199, { from: USER_1 });
    console.log("New CDP: " + cdp + " opened");

    // setNextPrice
    await setNextPrice(new BN(145).mul(ONE_ETH));
    await dai2usd.setPrice(new BN(145).mul(ONE_ETH));
    await real.poke(uintToBytes32(new BN(145).mul(ONE_ETH)));

    await syncOSMTime();
    await osm.poke();
    await spot.poke(ILK_ETH);
    console.log("## Current price: " + (await getCurrentPrice()).toString());
    console.log("## Next price: " + (await getNextPrice()).toString());

    // nothing should happen
    console.log("10 mins passed. Nothing should happen for cdp.");
    await increaseTime_MineBlock_Sleep(10, 5); // ==> 10 mins passed
    [ci, bi] = await getLiquidatorInfo(cdp);
    expect(false).to.be.equal(ci.isToppedUp);
    expect(false).to.be.equal(bi.canCallBiteNow);

    // member deposit, 10 mins before topup allowed
    console.log(
      "20 mins passed. Member should deposit now (which is 10 mins before topup allowed)."
    );
    await increaseTime_MineBlock_Sleep(10, 5); // ==> 20 mins passed

    // nothing should happen
    console.log("40 mins passed. Nothing should happen for cdp.");
    await increaseTime_MineBlock_Sleep(20, 5); // ==> 40 mins passed

    // member should topup, 10 mins before bite allowed
    console.log("50 mins passed. Member should topup now (which is 10 mins before bite allowed).");
    await increaseTime_MineBlock_Sleep(10, 5); // ==> 50 mins passed
    [ci, bi] = await getLiquidatorInfo(cdp);
    expect(true).to.be.equal(ci.isToppedUp);

    // member should be allowed to bite
    await increaseTime_MineBlock_Sleep(10, 5); // ==> 60 mins passed

    // After 1 hour poke, to update price
    await real.poke(uintToBytes32(new BN(145).mul(ONE_ETH)));
    await osm.poke();
    await spot.poke(ILK_ETH);
    console.log("60 mins passed. Member should bite.");

    console.log("Current price: " + (await getCurrentPrice()).toString());

    await increaseTime_MineBlock_Sleep(1, 10);

    // NOTICE: It should be bitten at Bot
  });

  it("Test untop", async () => {
    let ci;
    let bi;

    const cdp = await mintDaiForUser(2, 199, { from: USER_2 });
    console.log("New CDP: " + cdp + " opened");

    // setNextPrice
    await setNextPrice(new BN(145).mul(ONE_ETH));
    await dai2usd.setPrice(new BN(145).mul(ONE_ETH));
    await real.poke(uintToBytes32(new BN(145).mul(ONE_ETH)));

    await syncOSMTime();
    await osm.poke();
    await spot.poke(ILK_ETH);
    console.log("## Current price: " + (await getCurrentPrice()).toString());
    console.log("## Next price: " + (await getNextPrice()).toString());

    // nothing should happen
    console.log("10 mins passed. Nothing should happen for cdp.");
    await increaseTime_MineBlock_Sleep(10, 5); // ==> 10 mins passed
    [ci, bi] = await getLiquidatorInfo(cdp);
    expect(false).to.be.equal(ci.isToppedUp);
    expect(false).to.be.equal(bi.canCallBiteNow);

    // member deposit, 10 mins before topup allowed
    console.log(
      "20 mins passed. Member should deposit now (which is 10 mins before topup allowed)."
    );
    await increaseTime_MineBlock_Sleep(10, 5); // ==> 20 mins passed

    // nothing should happen
    console.log("40 mins passed. Nothing should happen for cdp.");
    await increaseTime_MineBlock_Sleep(20, 5); // ==> 40 mins passed

    // member should topup, 10 mins before bite allowed
    console.log("50 mins passed. Member should topup now (which is 10 mins before bite allowed).");
    await increaseTime_MineBlock_Sleep(10, 5); // ==> 50 mins passed
    [ci, bi] = await getLiquidatorInfo(cdp);
    expect(true).to.be.equal(ci.isToppedUp);

    // NOTICE: It should be topped up at Bot

    await increaseTime_MineBlock_Sleep(1, 5);

    // Repay 90 DAI
    const repayDAI = new BN(90).mul(ONE_ETH).mul(new BN(-1));
    await bCdpManager.frob(cdp, 0, repayDAI, { from: USER_2 });

    console.log("52 mins passed. User repayed. Member should untop");
    await increaseTime_MineBlock_Sleep(1, 10);

    // NOTICE: It should be untopped at Bot
  });
});

async function setMCD() {
  await jug.drip(ILK_ETH);

  let ilk = await vat.ilks(ILK_ETH);
  console.log("Vat.ilks('ETH-A').rate: " + ilk.rate.toString());

  ilk = await cat.ilks(ILK_ETH);
  console.log("Cat.ilks('ETH-A').chop: " + ilk.chop.toString());

  ilk = await jug.ilks(ILK_ETH);
  console.log("Jug.ilks('ETH-A').duty: " + ilk.duty.toString());
}

async function getLiquidatorInfo(cdp) {
  const cushionInfo = await liqInfo.getCushionInfo(cdp, MEMBER_1, 4);
  const biteInfo = await liqInfo.getBiteInfo(cdp, MEMBER_1);
  return [cushionInfo, biteInfo];
}

async function setPermissions() {
  await osm.kiss(mcdJSON.DEPLOYER);
  // Authorizing DEPLOYER to read price from BudConnector in this test
  await bud.authorize(mcdJSON.DEPLOYER);
}

async function syncOSMTime() {
  const pass = await osm.pass({ from: mcdJSON.DEPLOYER });
  if (pass) await osm.poke();
  const ts = await time.latest();
  const zzz = ts.sub(ts.mod(ONE_HOUR));
  const nextTime = zzz.add(ONE_HOUR);
  await time.increaseTo(nextTime);
}

async function resetPrice() {
  console.log("#### RESETING SNAPSHOT PRICES ####");
  await setPermissions();

  await syncOSMTime();

  // OSM Price
  // set as current price in next poke
  await setNextPrice(new BN(150).mul(ONE_ETH));
  await increaseOneHour();
  await osm.poke();
  await spot.poke(ILK_ETH);

  // set as next price
  await setNextPrice(new BN(150).mul(ONE_ETH));
  await increaseOneHour();
  await osm.poke();
  await spot.poke(ILK_ETH);

  // dYdX price
  await dai2usd.setPrice(new BN(150).mul(ONE_ETH));

  // Real price
  await real.poke(uintToBytes32(new BN(150).mul(ONE_ETH)));

  console.log("OSM Current price: " + (await getCurrentPrice()).toString());
  console.log("OSM Next price: " + (await getNextPrice()).toString());
  console.log("dYdX Price: " + (await dai2usd.getMarketPrice(3)).toString());
  console.log("Real price: " + bytes32ToBN(await real.read()).toString());
  console.log("Bud price: " + bytes32ToBN(await bud.read(ILK_ETH)).toString());

  console.log("#### RESETING DONE ####");
}

async function mintDaiForUser(amtInEth, amtInDai, opt) {
  const cdp = await mintDai(bCdpManager, amtInEth, amtInDai, false, opt);
  console.log("Minted: " + amtInDai + " DAI for USER:" + opt.from);
  return cdp;
}

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

  const val = await DSValue.at(mcdJSON.VAL_ETH);
  const bytes32 = uintToBytes32(price);
  await val.poke(bytes32);

  const pass = await osm.pass({ from: mcdJSON.DEPLOYER });
  if (pass) {
    await osm.poke();
    await spot.poke(ILK_ETH);
  }
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
