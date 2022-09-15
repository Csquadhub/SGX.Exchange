const { deployContract, contractAt, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

async function main() {
  const rewardRouter = await contractAt("RewardRouter", "0xEa7fCb85802713Cb03291311C66d6012b23402ea")
  const bnSgx = await contractAt("MintableBaseToken", "0x35247165119B69A40edD5304969560D0ef486921")
  const sgxlpManager = await contractAt("SgxLpManager", "0x91425Ac4431d068980d497924DD540Ae274f3270")

  const stakedSgxTracker = await contractAt("RewardTracker", "0x908C4D94D34924765f1eDc22A1DD098397c59dD4")
  const bonusSgxTracker = await contractAt("RewardTracker", "0x4d268a7d4C16ceB5a606c173Bd974984343fea13")
  const feeSgxTracker = await contractAt("RewardTracker", "0xd2D1162512F927a7e282Ef43a362659E4F2a728F")

  const feeSgxLpTracker = await contractAt("RewardTracker", "0x4e971a87900b931fF39d1Aad67697F49835400b6")
  const stakedSgxLpTracker = await contractAt("RewardTracker", "0x1aDDD80E6039594eE970E5872D247bf0414C8903")

  // allow rewardRouter to stake in stakedSgxTracker
  await sendTxn(stakedSgxTracker.setHandler(rewardRouter.address, false), "stakedSgxTracker.setHandler(rewardRouter)")
  // allow rewardRouter to stake in bonusSgxTracker
  await sendTxn(bonusSgxTracker.setHandler(rewardRouter.address, false), "bonusSgxTracker.setHandler(rewardRouter)")
  // allow rewardRouter to stake in feeSgxTracker
  await sendTxn(feeSgxTracker.setHandler(rewardRouter.address, false), "feeSgxTracker.setHandler(rewardRouter)")
  // allow rewardRouter to burn bnSgx
  await sendTxn(bnSgx.setMinter(rewardRouter.address, false), "bnSgx.setMinter(rewardRouter)")

  // allow rewardRouter to mint in sgxlpManager
  await sendTxn(sgxlpManager.setHandler(rewardRouter.address, false), "sgxlpManager.setHandler(rewardRouter)")
  // allow rewardRouter to stake in feeSgxLpTracker
  await sendTxn(feeSgxLpTracker.setHandler(rewardRouter.address, false), "feeSgxLpTracker.setHandler(rewardRouter)")
  // allow rewardRouter to stake in stakedSgxLpTracker
  await sendTxn(stakedSgxLpTracker.setHandler(rewardRouter.address, false), "stakedSgxLpTracker.setHandler(rewardRouter)")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
