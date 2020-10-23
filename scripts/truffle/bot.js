const { BN } = require("@openzeppelin/test-helpers");
const { sleep } = require("../../test-utils/utils");
const { RAY, RAD, ONE_ETH } = require("../../test-utils/constants");

const mcdJSON = require("../../config/mcd_testchain.json");
const bpJSON = require("../../config/bprotocol_testchain.json");
const { default: Web3 } = require("web3");

// MCD Contracts
const DssCdpManager = artifacts.require("DssCdpManager");
const Dai = artifacts.require("Dai");
const DaiJoin = artifacts.require("DaiJoin");
const GemJoin = artifacts.require("GemJoin");
const WETH9 = artifacts.require("WETH9");
const Vat = artifacts.require("Vat");
const Spotter = artifacts.require("Spotter");
const LiquidatorInfo = artifacts.require("LiquidatorInfo");

// B.Protocol Contracts
const BCdpManager = artifacts.require("BCdpManager");
const Pool = artifacts.require("Pool");
const OSM = artifacts.require("OSM");

let bCdpManager;
let pool;
let dssCdpManager;
let gemJoin;
let weth;
let vat;

let spot;
let liqInfo;

let MEMBER_1 = bpJSON.MEMBER_1;

const ILK_ETH = web3.utils.padRight(web3.utils.asciiToHex("ETH-A"), 64);

const topped = new Map();
const bitten = new Map();
const pending = new Map();

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
  const gem = await gemJoin.gem();
  weth = await WETH9.at(gem);
  liqInfo = await LiquidatorInfo.at(bpJSON.FLATLIQUIDATOR_INFO);

  // initialize
  await init();

  // const subscription = web3.eth.subscribe(
  //   "logs",
  //   {
  //     address: spot.address,
  //   },
  //   async (error, result) => {
  //     try {
  //       await processUntop();
  //       await processBite();
  //     } catch (err) {
  //       console.log(err);
  //     }
  //   }
  // );

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

  while (true) {
    await sleep(10);
  }
};

async function processUntop(cdp) {
  try {
    // isToppedUp && !isBitten && isSafe
    const toppedUp = await topped.get(cdp);
    const info = await liqInfo.getCushionInfo(cdp, MEMBER_1, 4);
    const shouldCallUntop = info[8];
    // console.log(info);
    if (toppedUp && shouldCallUntop) {
      // const info = await liqInfo.getBiteInfo(cdp, MEMBER_1);
      // const canCallBiteNow = info[3];
      // if (!canCallBiteNow) {
      // console.log("UNTOP: " + info);
      // untop
      await memberUntop(cdp, { from: MEMBER_1 });
      // }
    }
  } catch (err) {
    console.log(err);
  }
}

async function processCdps() {
  let maxCdp = await getCdpi();
  for (let i = 1; i <= maxCdp; i++) {
    const cdp = i;

    const isPending = pending.get(cdp);
    if (!isPending) {
      await processCdp(cdp);
    } else {
      // console.log("TX PENDING FOR: " + cdp);
    }
  }
}

async function processCdp(cdp) {
  pending.set(cdp, true);

  await processTopup(cdp);
  await processUntop(cdp);
  await processBite(cdp);

  pending.set(cdp, false);
}

async function processBite(cdp) {
  try {
    const toppedUp = await topped.get(cdp);
    const isBitten = bitten.get(cdp);

    if (toppedUp && !isBitten) {
      const info = await liqInfo.getBiteInfo(cdp, MEMBER_1);

      const avail = await pool.availBite.call(cdp, MEMBER_1, { from: MEMBER_1 });
      const canCallBiteNow = info[3];
      // console.log("xx " + canCallBiteNow);
      if (canCallBiteNow) {
        // console.log("BITE " + info);
        // console.log("going to bite");

        const dMemberInk = await pool.bite.call(cdp, avail, 1, { from: MEMBER_1 });
        // console.log("bite.call(): " + dMemberInk);
        const currGem = await vat.gem(ILK_ETH, MEMBER_1);
        // console.log("currGem: " + currGem);

        await memberBite(cdp, avail, 1, { from: MEMBER_1 });

        const afterGem = await vat.gem(ILK_ETH, MEMBER_1);
        // console.log("afterGem: " + afterGem);

        const currWethBal = await await weth.balanceOf(MEMBER_1);
        // console.log("currWethBal: " + currWethBal);

        await gemJoin.exit(MEMBER_1, afterGem, { from: MEMBER_1 });

        const afterWethBal = await await weth.balanceOf(MEMBER_1);
        // console.log("afterWethBal: " + afterWethBal);

        // console.log("ethJoin.exit(): " + afterGem);

        const rad = await pool.rad(MEMBER_1);
        await memberWithdraw(rad, { from: MEMBER_1 });

        // console.log("setting bitten: " + cdp);
        bitten.set(cdp, true);
      }
    }
  } catch (err) {
    console.log(err);
  }
}

async function processTopup(cdp) {
  const allowed = await isTopupAllowed(cdp);
  if (topped.get(cdp)) {
    return;
  }
  const info = await liqInfo.getCushionInfo(cdp, MEMBER_1, 4);
  const canCallTopupNow = info[7];
  // console.log(info);
  if (canCallTopupNow) {
    await memberTopup(cdp, { from: MEMBER_1 });
    topped.set(cdp, true);
  }
}

async function getCdpi() {
  return await bCdpManager.cdpi();
}

async function isCdpExists(cdp) {
  const urn = await bCdpManager.urns(cdp);
  return urn != 0;
}

async function isTopupAllowed(cdp) {
  const info = await pool.topupInfo(cdp);
  const dart = info[0];
  const should = info[3];
  return should && dart != 0;
}

async function init() {
  await mintDaiForMember(20, 1000, { from: MEMBER_1 });
  await memberDeposit(new BN(1000).mul(ONE_ETH).mul(RAY), { from: MEMBER_1 });
}

async function memberDeposit(radVal, opt) {
  const _from = opt.from;
  await vat.hope(pool.address, { from: _from });
  await pool.deposit(radVal, { from: _from });
  console.log("Member:" + _from + " deposited: " + radToDAI(radVal) + " DAI");
}

function radToDAI(radVal) {
  return radVal.div(RAD).toString();
}

function wadToDAI(wad) {
  return radVal.div(ONE_ETH).toString();
}

async function memberTopup(cdp, opt) {
  try {
    const info = await pool.topupInfo(cdp);
    // console.log(info);
    const _from = opt.from;
    await pool.topup(cdp, { from: _from });
    console.log("### TOPPED-UP ###: " + cdp);
  } catch (err) {
    console.log(err);
  }
}

async function memberUntop(cdp, opt) {
  const _from = opt.from;
  await pool.untop(cdp, { from: _from });
  console.log("### UN-TOPPED ###: " + cdp);
}

async function memberBite(cdp, dart, minInk, opt) {
  const _from = opt.from;
  await pool.bite(cdp, dart, minInk, { from: _from });
  console.log("### BITTEN ###: " + cdp);
}

async function memberWithdraw(radVal, opt) {
  const _from = opt.from;
  await pool.withdraw(radVal, { from: _from });
  console.log("### WITHDRAWN ###: " + radToDAI(radVal) + " DAI");
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
