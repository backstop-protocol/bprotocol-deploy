"use strict";

const { BN } = require("@openzeppelin/test-helpers");
const { RAY, RAD, ONE_ETH, TEN_MINUTES } = require("../../test-utils/constants");

const mcdJSON = require("../../config/mcdTestchain.json");
const bpJSON = require("../../config/bprotocolTestchain.json");

// MCD Contracts
const DssCdpManager = artifacts.require("DssCdpManager");
const Dai = artifacts.require("Dai");
const DaiJoin = artifacts.require("DaiJoin");
const GemJoin = artifacts.require("GemJoin");
const WETH9 = artifacts.require("WETH9");
const Vat = artifacts.require("Vat");
const OSM = artifacts.require("OSM");

// B.Protocol Contracts
const BCdpManager = artifacts.require("BCdpManager");
const Pool = artifacts.require("Pool");
const LiquidatorInfo = artifacts.require("LiquidatorInfo");

// B.Protocol
let bCdpManager;
let pool;
let liqInfo;

// MCD
let dssCdpManager;
let gemJoin;
let weth;
let vat;
let dai;
let daiJoin;
let osm;

let MEMBER_1 = bpJSON.MEMBER_1;

const ILK_ETH = web3.utils.padRight(web3.utils.asciiToHex("ETH-A"), 64);

// cdp => pending (bool)
const pending = new Map();

module.exports = async function (callback) {
  try {
    bCdpManager = await BCdpManager.at(bpJSON.B_CDP_MANAGER);
    pool = await Pool.at(bpJSON.POOL);
    dai = await Dai.at(mcdJSON.MCD_DAI);
    daiJoin = await DaiJoin.at(mcdJSON.MCD_JOIN_DAI);
    dssCdpManager = await DssCdpManager.at(mcdJSON.CDP_MANAGER);
    gemJoin = await GemJoin.at(mcdJSON.MCD_JOIN_ETH_A);
    vat = await Vat.at(mcdJSON.MCD_VAT);
    osm = await OSM.at(mcdJSON.PIP_ETH);
    weth = await WETH9.at(await gemJoin.gem());
    liqInfo = await LiquidatorInfo.at(bpJSON.LIQUIDATOR_INFO);

    // initialize
    await init();

    web3.eth.subscribe("newBlockHeaders", async (error, event) => {
      try {
        if (!error) {
          console.log(
            "Block: " +
              event.number +
              " Timestamp: " +
              (await web3.eth.getBlock("latest")).timestamp
          );
          await processCdps();
        } else {
          console.log(error);
        }
      } catch (err) {
        console.log(err);
      }
    });
  } catch (err) {
    console.log(err);
  }
};

async function processCdps() {
  let maxCdp = await bCdpManager.cdpi();
  for (let cdp = 1; cdp <= maxCdp; cdp++) {
    if (!pending.get(cdp)) {
      pending.set(cdp, true);
      try {
        await processCdp(cdp);
      } catch (err) {
        console.log(err);
      }
      pending.set(cdp, false);
    }
  }
}

async function processCdp(cdp) {
  try {
    const cdpInfo = await liqInfo.getCdpData.call(
      cdp,
      cdp,
      MEMBER_1,
      await getEth2DaiMarketPrice(),
      { gas: 100e6 } // Higher gas limit needed to execute
    );

    const cushionInfo = cdpInfo[0].cushion;
    const biteInfo = cdpInfo[0].bite;

    if (cushionInfo.shouldProvideCushion) {
      await depositBeforeTopup(cdp, cushionInfo);
    }

    if (cushionInfo.canCallTopupNow) {
      await processTopup(cdp, biteInfo);
    } else if (cushionInfo.shouldCallUntop) {
      await processUntop(cdp);
    }

    if (biteInfo.canCallBiteNow) {
      await processBite(cdp, biteInfo);
    }
  } catch (err) {
    console.log(err);
  }
}

async function depositBeforeTopup(cdp, ci) {
  const timeToReachTopup = new BN(ci.minimumTimeBeforeCallingTopup);
  // console.log("TimeToReachTopup: " + timeToReachTopup.toString());
  if (timeToReachTopup.lt(TEN_MINUTES)) {
    await ensureDAIBalance(cdp, new BN(ci.cushionSizeInWei).mul(RAY), MEMBER_1);
  }
}

async function processTopup(cdp, bi) {
  const timeToReachBite = new BN(bi.minimumTimeBeforeCallingBite);
  if (timeToReachBite.lt(TEN_MINUTES)) {
    await pool.topup(cdp, { from: MEMBER_1 });
    console.log("### TOPPED-UP ###: " + cdp);
  }
}

async function processUntop(cdp) {
  await pool.untop(cdp, { from: MEMBER_1 });
  console.log("### UN-TOPPED ###: " + cdp);
}

async function processBite(cdp, bi) {
  const avail = await pool.availBite.call(cdp, MEMBER_1, { from: MEMBER_1 });

  await ensureDAIBalance(cdp, new BN(bi.availableBiteInDaiWei).mul(RAY), MEMBER_1);

  const eth2daiPrice = await getEth2DaiMarketPrice();
  const minEthReturn = new BN(bi.availableBiteInDaiWei).div(eth2daiPrice);

  // bite
  await pool.bite(cdp, avail, minEthReturn, { from: MEMBER_1 });
  console.log("### BITTEN ###: " + cdp);

  // exit
  const afterGem = await vat.gem(ILK_ETH, MEMBER_1);
  await gemJoin.exit(MEMBER_1, afterGem, { from: MEMBER_1 });

  // withdraw
  const rad = await pool.rad(MEMBER_1);
  await pool.withdraw(rad, { from: MEMBER_1 });
  console.log("### WITHDRAWN ###: " + radToDAI(rad) + " DAI");
}

async function getEth2DaiMarketPrice() {
  // NOTICE: This ETH to DAI rate should be taken from real market. eg. Binance order-book etc.
  const eth2daiMarketPrice = new BN(145);
  // NOTICE: You can get the real market rate here and return from this function.
  return eth2daiMarketPrice;
}

// Ensure that the MEMBER has expected DAI balance before topup
async function ensureDAIBalance(cdp, neededRadBal, _from) {
  try {
    if (neededRadBal.eq(new BN(0))) return;

    // Add 1 DAI to avoid rounding errors
    neededRadBal = neededRadBal.add(RAD);
    const radInVat = await vat.dai(_from);
    const radInPool = await pool.rad(_from);
    const radMemberHave = radInPool.add(radInVat);
    if (radMemberHave.lt(neededRadBal)) {
      // mint more DAI
      const radNeedsMore = neededRadBal.sub(radMemberHave);
      await dssCdpManager.frob(cdp, 0, radNeedsMore, { from: _from });
      console.log("MINTED " + radToDAI(radNeedsMore) + " DAI");
    }

    if (radInPool.lt(neededRadBal)) {
      // radNeedsMore = neededRadBal - radInPool + 1e18
      const radNeedsMore = neededRadBal.sub(radInPool);
      await pool.deposit(radNeedsMore, { from: _from });
      console.log("Member:" + _from + " deposited: " + radToDAI(radNeedsMore) + " DAI");
    }
  } catch (err) {
    console.log(err);
  }
}

async function init() {
  await mintDaiForMember(20, 1000, MEMBER_1);

  await vat.hope(pool.address, { from: MEMBER_1 });
  // deposit 1 DAI
  const depositRad = ONE_ETH.mul(RAY);
  await pool.deposit(depositRad, { from: MEMBER_1 });
  console.log("Member:" + MEMBER_1 + " deposited: " + radToDAI(depositRad) + " DAI");
}

function radToDAI(radVal) {
  return radVal.div(RAD).toString();
}

async function mintDai(manager, amtInEth, amtInDai, isMove, _from) {
  const ink = new BN(amtInEth).mul(new BN(ONE_ETH));
  const art = new BN(amtInDai).mul(new BN(ONE_ETH));

  // manager.open();
  const cdp = await manager.open.call(ILK_ETH, _from, {
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
}

async function mintDaiForMember(amtInEth, amtInDai, _from) {
  await mintDai(dssCdpManager, amtInEth, amtInDai, true, _from);
  console.log("Minted: " + amtInDai + " DAI for MEMBER:" + _from);
}
