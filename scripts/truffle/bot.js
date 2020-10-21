const { time } = require("@openzeppelin/test-helpers");

require("@openzeppelin/test-helpers/configure")({
  provider: "http://localhost:2000",
});

const BN = require("bn.js");

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

const topped = new Map();
const bitten = new Map();

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
  weth = await WETH.at(gem);

  try {
    // initialize
    await init();

    web3.eth.subscribe("newBlockHeaders", async (error, event) => {
      try {
        if (!error) {
          console.log("Block: " + event.number);
          await processCdps();
          await processBite();
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

  while (true) {
    await sleep(100);
  }
};

async function processCdps() {
  let cdp = 1;
  while (true) {
    const exist = await isCdpExists(cdp);
    if (exist) {
      // console.log("Checking cdp: " + cdp);
      await processTopup(cdp);
    } else {
      // console.log("Cdp not exists: " + cdp);
      break;
    }
    cdp++;
  }
}

async function processBite() {
  let cdp = 1;
  while (true) {
    const toppedUp = await topped.get(cdp);
    const isBitten = bitten.get(cdp);
    if(toppedUp && !isBitten) {
      const avail = await pool.availBite.call(cdp, MEMBER_1, {from: MEMBER_1});
      console.log("cdp: " + cdp + " avail: "+ avail);
      const dMemberInk = await pool.bite.call(cdp, avail, 0, {from: MEMBER_1});
      console.log("memberInk: " +dMemberInk);

      // await increaseHalfHour();
      // await increaseHalfHour();
      // await osm.poke();
      // await spot.poke(ILK_ETH);

      try{
        // try block to catch failed tx
        await pool.bite(cdp, avail, 0, {from: MEMBER_1});
      }catch(err) {
        console.log(err);
      }
      bitten.set(cdp, true);
    } else {
      break;
    }
    cdp++;
  }
}

async function increaseHalfHour() {
  // const hop = await osm.hop();
  await time.increase((3600 / 2) + 1);
}

async function processTopup(cdp) {
  const allowed = await isTopupAllowed(cdp);
  if (allowed) {
    if (topped.get(cdp)) {
      return;
    }
    console.log("topup allowed: " + cdp);
    await memberTopup(cdp, { from: MEMBER_1 });
    topped.set(cdp, true);
  } else {
    
    //console.log("topup not allowed: " + cdp);
  }
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
  await memberDeposit(HUNDRED_DAI.mul(RAY), { from: MEMBER_1 });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function memberTopup(cdp, opt) {
  try {
    const info = await pool.topupInfo(cdp);
    console.log(info);

    const _from = opt.from;
    await pool.topup(cdp, { from: _from });
    console.log("Member topped up: " + cdp);
  } catch (err) {
    console.log(err);
  }
}

async function memberUntop(cdp, opt) {
  const _from = opt.from;
  await pool.untop(cdp, { from: _from });
  console.log("Member untop: " + cdp);
}

async function memberBite(cdp, dart, minInk, opt) {
  const _from = opt.from;
  await pool.bite(cdp, dart, minInk, { from: _from });
  console.log("Member bite: " + cdp);
}

async function memberWithdraw(radVal, opt) {
  const _from = opt.from;
  await pool.withdraw(radVal, { from: _from });
  console.log("Member:" + _from + " withdrew: " + radToDAI(radVal) + " DAI");
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
