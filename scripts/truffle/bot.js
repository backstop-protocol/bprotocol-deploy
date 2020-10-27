const { BN } = require("@openzeppelin/test-helpers");
const { RAY, RAD, ONE_ETH } = require("../../test-utils/constants");

const mcdJSON = require("../../config/mcd_testchain.json");
const bpJSON = require("../../config/bprotocol_testchain.json");

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

let MEMBER_1 = bpJSON.MEMBER_1;

const ILK_ETH = web3.utils.padRight(web3.utils.asciiToHex("ETH-A"), 64);

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
    liqInfo = await LiquidatorInfo.at(bpJSON.FLATLIQUIDATOR_INFO);

    // initialize
    await init();

    web3.eth.subscribe("newBlockHeaders", async (error, event) => {
      try {
        if (!error) {
          console.log("Block: " + event.number);
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
  for (let i = 1; i <= maxCdp; i++) {
    const isPending = pending.get(i);
    if (!isPending) {
      await processCdp(i);
    }
  }
}

async function processCdp(cdp) {
  pending.set(cdp, true);

  let cushionInfo = await liqInfo.getCushionInfo(cdp, MEMBER_1, 4);

  const cushion = await bCdpManager.cushion(cdp);
  // console.log(cushion.toString());
  if (!cushionInfo.isToppedUp && cushionInfo.canCallTopupNow) {
    // console.log(cushionInfo);
    await processTopup(cdp);
    // const cushion = await bCdpManager.cushion(cdp);
    // console.log("x" + cushion.toString());
  } else if (cushionInfo.isToppedUp && cushionInfo.shouldCallUntop) {
    await processUntop(cdp);
  }

  // Read latest biteInfo just before bite call
  const biteInfo = await liqInfo.getBiteInfo(cdp, MEMBER_1);
  if (biteInfo.canCallBiteNow) await processBite(cdp);

  pending.set(cdp, false);
}

async function processTopup(cdp) {
  await pool.topup(cdp, { from: MEMBER_1 });
  console.log("### TOPPED-UP ###: " + cdp);
}

async function processUntop(cdp) {
  await pool.untop(cdp, { from: MEMBER_1 });
  console.log("### UN-TOPPED ###: " + cdp);
}

async function processBite(cdp) {
  const avail = await pool.availBite.call(cdp, MEMBER_1, { from: MEMBER_1 });

  // const dMemberInk = await pool.bite.call(cdp, avail, 1, { from: MEMBER_1 });
  // console.log("bite.call(): " + dMemberInk);
  // const currGem = await vat.gem(ILK_ETH, MEMBER_1);
  // console.log("currGem: " + currGem);

  await pool.bite(cdp, avail, 1, { from: MEMBER_1 });
  console.log("### BITTEN ###: " + cdp);

  const afterGem = await vat.gem(ILK_ETH, MEMBER_1);
  // console.log("afterGem: " + afterGem);
  // const currWethBal = await await weth.balanceOf(MEMBER_1);
  // console.log("currWethBal: " + currWethBal);

  await gemJoin.exit(MEMBER_1, afterGem, { from: MEMBER_1 });

  // const afterWethBal = await await weth.balanceOf(MEMBER_1);
  // console.log("afterWethBal: " + afterWethBal);
  // console.log("ethJoin.exit(): " + afterGem);

  const rad = await pool.rad(MEMBER_1);
  await pool.withdraw(rad, { from: MEMBER_1 });
  console.log("### WITHDRAWN ###: " + radToDAI(rad) + " DAI");
}

async function init() {
  await mintDaiForMember(20, 1000, { from: MEMBER_1 });

  await vat.hope(pool.address, { from: MEMBER_1 });
  const radVal = new BN(1000).mul(ONE_ETH).mul(RAY);
  await pool.deposit(radVal, { from: MEMBER_1 });
  console.log("Member:" + MEMBER_1 + " deposited: " + radToDAI(radVal) + " DAI");
}

function radToDAI(radVal) {
  return radVal.div(RAD).toString();
}

async function mintDai(manager, amtInEth, amtInDai, isMove, opt) {
  const _from = opt.from;
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

async function mintDaiForMember(amtInEth, amtInDai, opt) {
  const _from = opt.from;
  await mintDai(dssCdpManager, amtInEth, amtInDai, true, opt);
  console.log("Minted: " + amtInDai + " DAI for MEMBER:" + opt.from);
}
