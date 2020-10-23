const { time, BN } = require("@openzeppelin/test-helpers");
const { ONE_HOUR } = require("./constants");

// require("@openzeppelin/test-helpers/configure")({
//   provider: "http://localhost:2000",
// });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function increaseHalfHour() {
  await time.increase(ONE_HOUR.div(new BN(2)).add(new BN(1)));
}

async function increaseOneHour() {
  await time.increase(ONE_HOUR.add(new BN(1)));
}

module.exports = {
  sleep,
  increaseHalfHour,
  increaseOneHour,
};
