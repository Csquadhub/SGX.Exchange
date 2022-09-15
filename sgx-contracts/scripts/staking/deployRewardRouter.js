const { deployContract, contractAt, sendTxn, readTmpAddresses } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'mainnet');
const tokens = require('../core/tokens')[network];

async function main() {
  const {
    nativeToken
  } = tokens

  const weth = await contractAt("Token", nativeToken.address)
  const sgx = await contractAt("SGX", "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a")
  const esSgx = await contractAt("EsSGX", "0xf42Ae1D54fd613C9bb14810b0588FaAa09a426cA")
  const bnSgx = await contractAt("MintableBaseToken", "0x35247165119B69A40edD5304969560D0ef486921")

  const stakedSgxTracker = await contractAt("RewardTracker", "0x908C4D94D34924765f1eDc22A1DD098397c59dD4")
  const bonusSgxTracker = await contractAt("RewardTracker", "0x4d268a7d4C16ceB5a606c173Bd974984343fea13")
  const feeSgxTracker = await contractAt("RewardTracker", "0xd2D1162512F927a7e282Ef43a362659E4F2a728F")

  const feeSgxLpTracker = await contractAt("RewardTracker", "0x4e971a87900b931fF39d1Aad67697F49835400b6")
  const stakedSgxLpTracker = await contractAt("RewardTracker", "0x1aDDD80E6039594eE970E5872D247bf0414C8903")

  const sgxlp = await contractAt("SGXLP", "0x4277f8F2c384827B5273592FF7CeBd9f2C1ac258")
  const sgxlpManager = await contractAt("SgxLpManager", "0x321F653eED006AD1C29D174e17d96351BDe22649")

  console.log("sgxlpManager", sgxlpManager.address)

  const rewardRouter = await deployContract("RewardRouter", [])

  await sendTxn(rewardRouter.initialize(
    weth.address,
    sgx.address,
    esSgx.address,
    bnSgx.address,
    sgxlp.address,
    stakedSgxTracker.address,
    bonusSgxTracker.address,
    feeSgxTracker.address,
    feeSgxLpTracker.address,
    stakedSgxLpTracker.address,
    sgxlpManager.address
  ), "rewardRouter.initialize")

  // allow rewardRouter to stake in stakedSgxTracker
  await sendTxn(stakedSgxTracker.setHandler(rewardRouter.address, true), "stakedSgxTracker.setHandler(rewardRouter)")
  // allow rewardRouter to stake in bonusSgxTracker
  await sendTxn(bonusSgxTracker.setHandler(rewardRouter.address, true), "bonusSgxTracker.setHandler(rewardRouter)")
  // allow rewardRouter to stake in feeSgxTracker
  await sendTxn(feeSgxTracker.setHandler(rewardRouter.address, true), "feeSgxTracker.setHandler(rewardRouter)")
  // allow rewardRouter to burn bnSgx
  await sendTxn(bnSgx.setMinter(rewardRouter.address, true), "bnSgx.setMinter(rewardRouter)")

  // allow rewardRouter to mint in sgxlpManager
  await sendTxn(sgxlpManager.setHandler(rewardRouter.address, true), "sgxlpManager.setHandler(rewardRouter)")
  // allow rewardRouter to stake in feeSgxLpTracker
  await sendTxn(feeSgxLpTracker.setHandler(rewardRouter.address, true), "feeSgxLpTracker.setHandler(rewardRouter)")
  // allow rewardRouter to stake in stakedSgxLpTracker
  await sendTxn(stakedSgxLpTracker.setHandler(rewardRouter.address, true), "stakedSgxLpTracker.setHandler(rewardRouter)")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
