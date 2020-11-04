const { time, BN } = require("@openzeppelin/test-helpers");
const { ONE_HOUR } = require("./constants");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function increaseHalfHour() {
  await time.increase(ONE_HOUR.div(new BN(2)).add(new BN(1)));
}

async function increaseOneHour() {
  await time.increase(ONE_HOUR.add(new BN(1)));
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

async function increaseTime(inMins) {
  const seconds = new BN(inMins).mul(new BN(60)).add(new BN(1));
  await time.increase(seconds);
}

async function increaseTime_MineBlock_Sleep(inMins, inSecs) {
  await increaseTime(inMins);
  await mineBlock();
  console.log("waiting " + inSecs + " seconds...");
  await sleep(inSecs * 1000);
}

function uintToBytes32(val) {
  return web3.utils.padLeft(web3.utils.numberToHex(val), 64);
}

function bytes32ToBN(val) {
  return new BN(web3.utils.hexToNumberString(val));
}

module.exports = {
  sleep,
  increaseHalfHour,
  increaseOneHour,
  mineBlock,
  increaseTime,
  increaseTime_MineBlock_Sleep,
  uintToBytes32,
  bytes32ToBN,
};
