const { deployContract, contractAt, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

async function main() {
  const wallet = { address: "0x5F799f365Fa8A2B60ac0429C48B153cA5a6f0Cf8" }

  const account = "0x6eA748d14f28778495A3fBa3550a6CdfBbE555f9"
  const unstakeAmount = "79170000000000000000"

  const rewardRouter = await contractAt("RewardRouter", "0x1b8911995ee36F4F95311D1D9C1845fA18c56Ec6")
  const sgx = await contractAt("SGX", "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a");
  const bnSgx = await contractAt("MintableBaseToken", "0x35247165119B69A40edD5304969560D0ef486921");
  const stakedSgxTracker = await contractAt("RewardTracker", "0x908C4D94D34924765f1eDc22A1DD098397c59dD4")
  const bonusSgxTracker = await contractAt("RewardTracker", "0x4d268a7d4C16ceB5a606c173Bd974984343fea13")
  const feeSgxTracker = await contractAt("RewardTracker", "0xd2D1162512F927a7e282Ef43a362659E4F2a728F")

  // const gasLimit = 30000000

  // await sendTxn(feeSgxTracker.setHandler(wallet.address, true, { gasLimit }), "feeSgxTracker.setHandler")
  // await sendTxn(bonusSgxTracker.setHandler(wallet.address, true, { gasLimit }), "bonusSgxTracker.setHandler")
  // await sendTxn(stakedSgxTracker.setHandler(wallet.address, true, { gasLimit }), "stakedSgxTracker.setHandler")

  const stakedAmount = await stakedSgxTracker.stakedAmounts(account)
  console.log(`${account} staked: ${stakedAmount.toString()}`)
  console.log(`unstakeAmount: ${unstakeAmount.toString()}`)

  await sendTxn(feeSgxTracker.unstakeForAccount(account, bonusSgxTracker.address, unstakeAmount, account), "feeSgxTracker.unstakeForAccount")
  await sendTxn(bonusSgxTracker.unstakeForAccount(account, stakedSgxTracker.address, unstakeAmount, account), "bonusSgxTracker.unstakeForAccount")
  await sendTxn(stakedSgxTracker.unstakeForAccount(account, sgx.address, unstakeAmount, account), "stakedSgxTracker.unstakeForAccount")

  await sendTxn(bonusSgxTracker.claimForAccount(account, account), "bonusSgxTracker.claimForAccount")

  const bnSgxAmount = await bnSgx.balanceOf(account)
  console.log(`bnSgxAmount: ${bnSgxAmount.toString()}`)

  await sendTxn(feeSgxTracker.stakeForAccount(account, account, bnSgx.address, bnSgxAmount), "feeSgxTracker.stakeForAccount")

  const stakedBnSgx = await feeSgxTracker.depositBalances(account, bnSgx.address)
  console.log(`stakedBnSgx: ${stakedBnSgx.toString()}`)

  const reductionAmount = stakedBnSgx.mul(unstakeAmount).div(stakedAmount)
  console.log(`reductionAmount: ${reductionAmount.toString()}`)
  await sendTxn(feeSgxTracker.unstakeForAccount(account, bnSgx.address, reductionAmount, account), "feeSgxTracker.unstakeForAccount")
  await sendTxn(bnSgx.burn(account, reductionAmount), "bnSgx.burn")

  const sgxAmount = await sgx.balanceOf(account)
  console.log(`sgxAmount: ${sgxAmount.toString()}`)

  await sendTxn(sgx.burn(account, unstakeAmount), "sgx.burn")
  const nextSgxAmount = await sgx.balanceOf(account)
  console.log(`nextSgxAmount: ${nextSgxAmount.toString()}`)

  const nextStakedAmount = await stakedSgxTracker.stakedAmounts(account)
  console.log(`nextStakedAmount: ${nextStakedAmount.toString()}`)

  const nextStakedBnSgx = await feeSgxTracker.depositBalances(account, bnSgx.address)
  console.log(`nextStakedBnSgx: ${nextStakedBnSgx.toString()}`)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
