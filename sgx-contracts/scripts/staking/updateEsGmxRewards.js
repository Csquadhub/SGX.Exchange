const { deployContract, contractAt, sendTxn, signers } = require("../shared/helpers")
const { expandDecimals, bigNumberify } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'mainnet');

const shouldSendTxn = true

const monthlyEsSgxForSgxLpOnArb = expandDecimals(toInt("0"), 18)
const monthlyEsSgxForSgxLpOnAvax = expandDecimals(toInt("0"), 18)

async function getStakedAmounts() {
  const arbStakedSgxTracker = await contractAt("RewardTracker", "0x908C4D94D34924765f1eDc22A1DD098397c59dD4", signers.arbitrum)
  const arbStakedSgxAndEsSgx =await arbStakedSgxTracker.totalSupply()

  const avaxStakedSgxTracker = await contractAt("RewardTracker", "0x908C4D94D34924765f1eDc22A1DD098397c59dD4", signers.avax)
  const avaxStakedSgxAndEsSgx =await avaxStakedSgxTracker.totalSupply()

  return {
    arbStakedSgxAndEsSgx,
    avaxStakedSgxAndEsSgx
  }
}

async function getArbValues() {
  const sgxRewardTracker = await contractAt("RewardTracker", "0x908C4D94D34924765f1eDc22A1DD098397c59dD4")
  const sgxlpRewardTracker = await contractAt("RewardTracker", "0x1aDDD80E6039594eE970E5872D247bf0414C8903")
  const tokenDecimals = 18
  const monthlyEsSgxForSgxLp = monthlyEsSgxForSgxLpOnArb

  return { tokenDecimals, sgxRewardTracker, sgxlpRewardTracker, monthlyEsSgxForSgxLp }
}

async function getAvaxValues() {
  const sgxRewardTracker = await contractAt("RewardTracker", "0x2bD10f8E93B3669b6d42E74eEedC65dd1B0a1342")
  const sgxlpRewardTracker = await contractAt("RewardTracker", "0x9e295B5B976a184B14aD8cd72413aD846C299660")
  const tokenDecimals = 18
  const monthlyEsSgxForSgxLp = monthlyEsSgxForSgxLpOnAvax

  return { tokenDecimals, sgxRewardTracker, sgxlpRewardTracker, monthlyEsSgxForSgxLp }
}

function getValues() {
  if (network === "arbitrum") {
    return getArbValues()
  }

  if (network === "avax") {
    return getAvaxValues()
  }
}

function toInt(value) {
  return parseInt(value.replaceAll(",", ""))
}

async function main() {
  const { arbStakedSgxAndEsSgx, avaxStakedSgxAndEsSgx } = await getStakedAmounts()
  const { tokenDecimals, sgxRewardTracker, sgxlpRewardTracker, monthlyEsSgxForSgxLp } = await getValues()

  const stakedAmounts = {
    arbitrum: {
      total: arbStakedSgxAndEsSgx
    },
    avax: {
      total: avaxStakedSgxAndEsSgx
    }
  }

  let totalStaked = bigNumberify(0)

  for (const net in stakedAmounts) {
    totalStaked = totalStaked.add(stakedAmounts[net].total)
  }

  const totalEsSgxRewards = expandDecimals(50000, tokenDecimals)
  const secondsPerMonth = 28 * 24 * 60 * 60

  const sgxRewardDistributor = await contractAt("RewardDistributor", await sgxRewardTracker.distributor())

  const sgxCurrentTokensPerInterval = await sgxRewardDistributor.tokensPerInterval()
  const sgxNextTokensPerInterval = totalEsSgxRewards.mul(stakedAmounts[network].total).div(totalStaked).div(secondsPerMonth)
  const sgxDelta = sgxNextTokensPerInterval.sub(sgxCurrentTokensPerInterval).mul(10000).div(sgxCurrentTokensPerInterval)

  console.log("sgxCurrentTokensPerInterval", sgxCurrentTokensPerInterval.toString())
  console.log("sgxNextTokensPerInterval", sgxNextTokensPerInterval.toString(), `${sgxDelta.toNumber() / 100.00}%`)

  const sgxlpRewardDistributor = await contractAt("RewardDistributor", await sgxlpRewardTracker.distributor())

  const sgxlpCurrentTokensPerInterval = await sgxlpRewardDistributor.tokensPerInterval()
  const sgxlpNextTokensPerInterval = monthlyEsSgxForSgxLp.div(secondsPerMonth)

  console.log("sgxlpCurrentTokensPerInterval", sgxlpCurrentTokensPerInterval.toString())
  console.log("sgxlpNextTokensPerInterval", sgxlpNextTokensPerInterval.toString())

  if (shouldSendTxn) {
    await sendTxn(sgxRewardDistributor.setTokensPerInterval(sgxNextTokensPerInterval, { gasLimit: 500000 }), "sgxRewardDistributor.setTokensPerInterval")
    await sendTxn(sgxlpRewardDistributor.setTokensPerInterval(sgxlpNextTokensPerInterval, { gasLimit: 500000 }), "sgxlpRewardDistributor.setTokensPerInterval")
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
