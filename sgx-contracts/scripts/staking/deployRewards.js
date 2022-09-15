const { deployContract, contractAt, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

async function main() {
  const wallet = { address: "0x5F799f365Fa8A2B60ac0429C48B153cA5a6f0Cf8" }
  const { AddressZero } = ethers.constants

  const weth = { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" }
  const sgx = await deployContract("SGX", []);
  const esSgx = await deployContract("EsSGX", []);
  const bnSgx = await deployContract("MintableBaseToken", ["Bonus SGX", "bnSGX", 0]);
  const bnAlp = { address: AddressZero }
  const alp = { address: AddressZero }

  const stakedSgxTracker = await deployContract("RewardTracker", ["Staked SGX", "sSGX"])
  const stakedSgxDistributor = await deployContract("RewardDistributor", [esSgx.address, stakedSgxTracker.address])
  await sendTxn(stakedSgxTracker.initialize([sgx.address, esSgx.address], stakedSgxDistributor.address), "stakedSgxTracker.initialize")
  await sendTxn(stakedSgxDistributor.updateLastDistributionTime(), "stakedSgxDistributor.updateLastDistributionTime")

  const bonusSgxTracker = await deployContract("RewardTracker", ["Staked + Bonus SGX", "sbSGX"])
  const bonusSgxDistributor = await deployContract("BonusDistributor", [bnSgx.address, bonusSgxTracker.address])
  await sendTxn(bonusSgxTracker.initialize([stakedSgxTracker.address], bonusSgxDistributor.address), "bonusSgxTracker.initialize")
  await sendTxn(bonusSgxDistributor.updateLastDistributionTime(), "bonusSgxDistributor.updateLastDistributionTime")

  const feeSgxTracker = await deployContract("RewardTracker", ["Staked + Bonus + Fee SGX", "sbfSGX"])
  const feeSgxDistributor = await deployContract("RewardDistributor", [weth.address, feeSgxTracker.address])
  await sendTxn(feeSgxTracker.initialize([bonusSgxTracker.address, bnSgx.address], feeSgxDistributor.address), "feeSgxTracker.initialize")
  await sendTxn(feeSgxDistributor.updateLastDistributionTime(), "feeSgxDistributor.updateLastDistributionTime")

  const feeSgxLpTracker = { address: AddressZero }
  const stakedSgxLpTracker = { address: AddressZero }

  const stakedAlpTracker = { address: AddressZero }
  const bonusAlpTracker = { address: AddressZero }
  const feeAlpTracker = { address: AddressZero }

  const sgxlpManager = { address: AddressZero }
  const sgxlp = { address: AddressZero }

  await sendTxn(stakedSgxTracker.setInPrivateTransferMode(true), "stakedSgxTracker.setInPrivateTransferMode")
  await sendTxn(stakedSgxTracker.setInPrivateStakingMode(true), "stakedSgxTracker.setInPrivateStakingMode")
  await sendTxn(bonusSgxTracker.setInPrivateTransferMode(true), "bonusSgxTracker.setInPrivateTransferMode")
  await sendTxn(bonusSgxTracker.setInPrivateStakingMode(true), "bonusSgxTracker.setInPrivateStakingMode")
  await sendTxn(bonusSgxTracker.setInPrivateClaimingMode(true), "bonusSgxTracker.setInPrivateClaimingMode")
  await sendTxn(feeSgxTracker.setInPrivateTransferMode(true), "feeSgxTracker.setInPrivateTransferMode")
  await sendTxn(feeSgxTracker.setInPrivateStakingMode(true), "feeSgxTracker.setInPrivateStakingMode")

  const rewardRouter = await deployContract("RewardRouter", [])

  await sendTxn(rewardRouter.initialize(
    sgx.address,
    esSgx.address,
    bnSgx.address,
    bnAlp.address,
    sgxlp.address,
    alp.address,
    stakedSgxTracker.address,
    bonusSgxTracker.address,
    feeSgxTracker.address,
    feeSgxLpTracker.address,
    stakedSgxLpTracker.address,
    stakedAlpTracker.address,
    bonusAlpTracker.address,
    feeAlpTracker.address,
    sgxlpManager.address
  ), "rewardRouter.initialize")

  // allow rewardRouter to stake in stakedSgxTracker
  await sendTxn(stakedSgxTracker.setHandler(rewardRouter.address, true), "stakedSgxTracker.setHandler(rewardRouter)")
  // allow bonusSgxTracker to stake stakedSgxTracker
  await sendTxn(stakedSgxTracker.setHandler(bonusSgxTracker.address, true), "stakedSgxTracker.setHandler(bonusSgxTracker)")
  // allow rewardRouter to stake in bonusSgxTracker
  await sendTxn(bonusSgxTracker.setHandler(rewardRouter.address, true), "bonusSgxTracker.setHandler(rewardRouter)")
  // allow bonusSgxTracker to stake feeSgxTracker
  await sendTxn(bonusSgxTracker.setHandler(feeSgxTracker.address, true), "bonusSgxTracker.setHandler(feeSgxTracker)")
  await sendTxn(bonusSgxDistributor.setBonusMultiplier(10000), "bonusSgxDistributor.setBonusMultiplier")
  // allow rewardRouter to stake in feeSgxTracker
  await sendTxn(feeSgxTracker.setHandler(rewardRouter.address, true), "feeSgxTracker.setHandler(rewardRouter)")
  // allow stakedSgxTracker to stake esSgx
  await sendTxn(esSgx.setHandler(stakedSgxTracker.address, true), "esSgx.setHandler(stakedSgxTracker)")
  // allow feeSgxTracker to stake bnSgx
  await sendTxn(bnSgx.setHandler(feeSgxTracker.address, true), "bnSgx.setHandler(feeSgxTracker")
  // allow rewardRouter to burn bnSgx
  await sendTxn(bnSgx.setMinter(rewardRouter.address, true), "bnSgx.setMinter(rewardRouter")

  // mint esSgx for distributors
  await sendTxn(esSgx.setMinter(wallet.address, true), "esSgx.setMinter(wallet)")
  await sendTxn(esSgx.mint(stakedSgxDistributor.address, expandDecimals(50000 * 12, 18)), "esSgx.mint(stakedSgxDistributor") // ~50,000 SGX per month
  await sendTxn(stakedSgxDistributor.setTokensPerInterval("20667989410000000"), "stakedSgxDistributor.setTokensPerInterval") // 0.02066798941 esSgx per second

  // mint bnSgx for distributor
  await sendTxn(bnSgx.setMinter(wallet.address, true), "bnSgx.setMinter")
  await sendTxn(bnSgx.mint(bonusSgxDistributor.address, expandDecimals(15 * 1000 * 1000, 18)), "bnSgx.mint(bonusSgxDistributor)")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
