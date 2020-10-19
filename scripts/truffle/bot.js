const BN = require("bn.js");

const abiJSON = require("../../lib/dss-cdp-manager/out/dapp.sol.json");
const mcdJSON = require("../../config/mcd_testchain.json");
const bpJSON = require("../../config/bprotocol_testchain.json");
const { default: Web3 } = require("web3");

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

// B.Protocol Contracts
const BCdpManager = artifacts.require("BCdpManager");
const Pool = artifacts.require("Pool");

let bCdpManager;
let pool;
let dai;
let daiJoin;
let dssCdpManager;
let gemJoin;
let weth;
let vat;

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

  try {
    const vat = await bCdpManager.vat();
    console.log(vat);

    console.log(await dai.name());
    await loadWETH();

    await setupTestchain();

    console.log((await dai.balanceOf(MEMBER_1)).toString());

    await memberDeposit(FIFTY_DAI.mul(RAY), { from: MEMBER_1 });
  } catch (err) {
    console.log(err);
  }
};

async function loadWETH() {
  const gem = await gemJoin.gem();
  weth = await WETH.at(gem);
  console.log("WETH: " + gem);
}

async function setupTestchain() {
  // DssCdpManager.open();
  const cdp = await dssCdpManager.open.call(ILK_ETH, MEMBER_1, {
    from: MEMBER_1,
  });
  await dssCdpManager.open(ILK_ETH, MEMBER_1, { from: MEMBER_1 });

  console.log(1);

  // WETH.deposit()
  await web3.eth.sendTransaction({
    from: MEMBER_1,
    to: weth.address,
    value: ONE_ETH,
  });

  console.log(2);

  // WETH.approve()
  await weth.approve(gemJoin.address, ONE_ETH, { from: MEMBER_1 });

  console.log(3);

  // ethJoin.join()
  const urn = await dssCdpManager.urns(cdp);
  await gemJoin.join(urn, ONE_ETH, { from: MEMBER_1 });

  console.log(4);

  // DssCdpManager.frob()
  await dssCdpManager.frob(cdp, ONE_ETH, HUNDRED_DAI, { from: MEMBER_1 });

  console.log(5);

  // move(manager, cdp, address(this), toRad(wad));
  await dssCdpManager.move(cdp, MEMBER_1, HUNDRED_DAI.mul(RAY), {
    from: MEMBER_1,
  });

  console.log(6);

  // VatLike(vat).hope(daiJoin);
  await vat.hope(daiJoin.address, { from: MEMBER_1 });

  console.log(7);

  // DaiJoinLike(daiJoin).exit(msg.sender, wad);
  await daiJoin.exit(MEMBER_1, HUNDRED_DAI, { from: MEMBER_1 });

  console.log(8);
}

async function memberDeposit(radVal, option) {
  await vat.hope(pool.address, { from: MEMBER_1 });

  // const can = await vat.can(MEMBER_1, pool.address);
  // console.log(can);

  const bal = await vat.dai(MEMBER_1);
  console.log(bal);

  // await pool.deposit(radVal, { from: MEMBER_1 });
  // console.log(await pool.DAI_MARKET_ID());
  // const members = await pool.members(0);
  // console.log(members);
}

async function memberTopup() {}

async function memberUntop() {}

async function memberBite() {}

async function memberWithdraw() {}
