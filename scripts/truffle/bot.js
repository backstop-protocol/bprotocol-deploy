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
  let cushionInfo = await liqInfo.getCushionInfo(cdp, MEMBER_1, 4);

  if (!cushionInfo.isToppedUp && cushionInfo.canCallTopupNow) {
    await processTopup(cdp, cushionInfo.cushionSizeInWei);
  } else if (cushionInfo.isToppedUp && cushionInfo.shouldCallUntop) {
    await processUntop(cdp);
  }

  // Read latest biteInfo just before bite call
  const biteInfo = await liqInfo.getBiteInfo(cdp, MEMBER_1);
  if (biteInfo.canCallBiteNow) {
    await processBite(cdp, biteInfo.availableBiteInDaiWei);
  }
}

async function processTopup(cdp, cushionSizeInWei) {
  await ensureDAIBalance(cdp, new BN(cushionSizeInWei).mul(RAY), { from: MEMBER_1 });
  await pool.topup(cdp, { from: MEMBER_1 });
  console.log("### TOPPED-UP ###: " + cdp);
}

async function processUntop(cdp) {
  await pool.untop(cdp, { from: MEMBER_1 });
  console.log("### UN-TOPPED ###: " + cdp);
}

async function processBite(cdp, availableBiteInDaiWei) {
  const avail = await pool.availBite.call(cdp, MEMBER_1, { from: MEMBER_1 });

  await ensureDAIBalance(cdp, new BN(availableBiteInDaiWei).mul(RAY), { from: MEMBER_1 });
  // bite
  await pool.bite(cdp, avail, 1, { from: MEMBER_1 });
  console.log("### BITTEN ###: " + cdp);

  // exit
  const afterGem = await vat.gem(ILK_ETH, MEMBER_1);
  await gemJoin.exit(MEMBER_1, afterGem, { from: MEMBER_1 });

  // withdraw
  const rad = await pool.rad(MEMBER_1);
  await pool.withdraw(rad, { from: MEMBER_1 });
  console.log("### WITHDRAWN ###: " + radToDAI(rad) + " DAI");
}

// Ensure that the MEMBER has expected DAI balance before topup
async function ensureDAIBalance(cdp, neededRadBal, opt) {
  try {
    const _from = opt.from;
    const radInVat = await vat.dai(_from);
    const radInPool = await pool.rad(_from);
    const radMemberHave = radInPool.add(radInVat);
    if (radMemberHave.lt(neededRadBal)) {
      // mint more DAI
      const radNeedsMore = neededRadBal.sub(radMemberHave);
      await manager.frob(cdp, 0, radNeedsMore, { from: _from });
      console.log("MINTED " + radNeedsMore + " DAI");
    }

    if (radInPool.lt(neededRadBal)) {
      // radNeedsMore = neededRadBal - radInPool + 1e18
      const radNeedsMore = neededRadBal.sub(radInPool).add(ONE_ETH);
      await pool.deposit(radNeedsMore, { from: _from });
      console.log("Member:" + _from + " deposited: " + radToDAI(radNeedsMore) + " DAI");
    }
  } catch (err) {
    console.log(err);
  }
}

async function init() {
  await mintDaiForMember(20, 1000, { from: MEMBER_1 });

  await vat.hope(pool.address, { from: MEMBER_1 });
  // deposit 1 DAI
  const depositRad = ONE_ETH.mul(RAY);
  await pool.deposit(depositRad, { from: MEMBER_1 });
  console.log("Member:" + MEMBER_1 + " deposited: " + radToDAI(depositRad) + " DAI");
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

const Web3 = require("web3");
function getTestProvider() {
  return new Web3.providers.WebsocketProvider("ws://localhost:2000");
}

async function mineBlock() {
  const util = require("util");
  const providerSendAsync = util.promisify(getTestProvider().send).bind(getTestProvider());
  await providerSendAsync({
    jsonrpc: "2.0",
    method: "evm_mine",
    params: [],
    id: 1,
  });
}
