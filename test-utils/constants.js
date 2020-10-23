const { BN } = require("@openzeppelin/test-helpers");

// UNITS
const WAD = new BN(10).pow(new BN(18));
const RAY = new BN(10).pow(new BN(27));
const RAD = WAD.mul(RAY);

// ETH
const ONE_ETH = WAD;

// DAI
const HUNDRED_DAI = new BN(100).mul(ONE_ETH);
const FIFTY_DAI = new BN(50).mul(ONE_ETH);

// TIME
const ONE_MINUTE = new BN(60);
const ONE_HOUR = new BN(60).mul(ONE_MINUTE);

module.exports = {
  WAD,
  RAY,
  RAD,
  ONE_ETH,
  HUNDRED_DAI,
  FIFTY_DAI,
  ONE_MINUTE,
  ONE_HOUR,
};
