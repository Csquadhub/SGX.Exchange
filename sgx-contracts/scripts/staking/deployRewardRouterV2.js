const { deployContract, contractAt, sendTxn, writeTmpAddresses } = require("../shared/helpers")

const network = (process.env.HARDHAT_NETWORK || 'mainnet');
const tokens = require('../core/tokens')[network];

async function main() {
  const { nativeToken } = tokens

  const vestingDuration = 365 * 24 * 60 * 60

  const sgxlpManager = await contractAt("SgxLpManager", "0xe1ae4d4b06A5Fe1fc288f6B4CD72f9F8323B107F")
  const sgxlp = await contractAt("SGXLP", "0x01234181085565ed162a948b6a5e88758CD7c7b8")

  const sgx = await contractAt("SGX", "0x62edc0692BD897D2295872a9FFCac5425011c661");
  const esSgx = await contractAt("EsSGX", "0xFf1489227BbAAC61a9209A08929E4c2a526DdD17");
  const bnSgx = await deployContract("MintableBaseToken", ["Bonus SGX", "bnSGX", 0]);

  await sendTxn(esSgx.setInPrivateTransferMode(true), "esSgx.setInPrivateTransferMode")
  await sendTxn(sgxlp.setInPrivateTransferMode(true), "sgxlp.setInPrivateTransferMode")

  const stakedSgxTracker = await deployContract("RewardTracker", ["Staked SGX", "sSGX"])
  const stakedSgxDistributor = await deployContract("RewardDistributor", [esSgx.address, stakedSgxTracker.address])
  await sendTxn(stakedSgxTracker.initialize([sgx.address, esSgx.address], stakedSgxDistributor.address), "stakedSgxTracker.initialize")
  await sendTxn(stakedSgxDistributor.updateLastDistributionTime(), "stakedSgxDistributor.updateLastDistributionTime")

  const bonusSgxTracker = await deployContract("RewardTracker", ["Staked + Bonus SGX", "sbSGX"])
  const bonusSgxDistributor = await deployContract("BonusDistributor", [bnSgx.address, bonusSgxTracker.address])
  await sendTxn(bonusSgxTracker.initialize([stakedSgxTracker.address], bonusSgxDistributor.address), "bonusSgxTracker.initialize")
  await sendTxn(bonusSgxDistributor.updateLastDistributionTime(), "bonusSgxDistributor.updateLastDistributionTime")

  const feeSgxTracker = await deployContract("RewardTracker", ["Staked + Bonus + Fee SGX", "sbfSGX"])
  const feeSgxDistributor = await deployContract("RewardDistributor", [nativeToken.address, feeSgxTracker.address])
  await sendTxn(feeSgxTracker.initialize([bonusSgxTracker.address, bnSgx.address], feeSgxDistributor.address), "feeSgxTracker.initialize")
  await sendTxn(feeSgxDistributor.updateLastDistributionTime(), "feeSgxDistributor.updateLastDistributionTime")

  const feeSgxLpTracker = await deployContract("RewardTracker", ["Fee SGXLP", "fSGXLP"])
  const feeSgxLpDistributor = await deployContract("RewardDistributor", [nativeToken.address, feeSgxLpTracker.address])
  await sendTxn(feeSgxLpTracker.initialize([sgxlp.address], feeSgxLpDistributor.address), "feeSgxLpTracker.initialize")
  await sendTxn(feeSgxLpDistributor.updateLastDistributionTime(), "feeSgxLpDistributor.updateLastDistributionTime")

  const stakedSgxLpTracker = await deployContract("RewardTracker", ["Fee + Staked SGXLP", "fsSGXLP"])
  const stakedSgxLpDistributor = await deployContract("RewardDistributor", [esSgx.address, stakedSgxLpTracker.address])
  await sendTxn(stakedSgxLpTracker.initialize([feeSgxLpTracker.address], stakedSgxLpDistributor.address), "stakedSgxLpTracker.initialize")
  await sendTxn(stakedSgxLpDistributor.updateLastDistributionTime(), "stakedSgxLpDistributor.updateLastDistributionTime")

  await sendTxn(stakedSgxTracker.setInPrivateTransferMode(true), "stakedSgxTracker.setInPrivateTransferMode")
  await sendTxn(stakedSgxTracker.setInPrivateStakingMode(true), "stakedSgxTracker.setInPrivateStakingMode")
  await sendTxn(bonusSgxTracker.setInPrivateTransferMode(true), "bonusSgxTracker.setInPrivateTransferMode")
  await sendTxn(bonusSgxTracker.setInPrivateStakingMode(true), "bonusSgxTracker.setInPrivateStakingMode")
  await sendTxn(bonusSgxTracker.setInPrivateClaimingMode(true), "bonusSgxTracker.setInPrivateClaimingMode")
  await sendTxn(feeSgxTracker.setInPrivateTransferMode(true), "feeSgxTracker.setInPrivateTransferMode")
  await sendTxn(feeSgxTracker.setInPrivateStakingMode(true), "feeSgxTracker.setInPrivateStakingMode")

  await sendTxn(feeSgxLpTracker.setInPrivateTransferMode(true), "feeSgxLpTracker.setInPrivateTransferMode")
  await sendTxn(feeSgxLpTracker.setInPrivateStakingMode(true), "feeSgxLpTracker.setInPrivateStakingMode")
  await sendTxn(stakedSgxLpTracker.setInPrivateTransferMode(true), "stakedSgxLpTracker.setInPrivateTransferMode")
  await sendTxn(stakedSgxLpTracker.setInPrivateStakingMode(true), "stakedSgxLpTracker.setInPrivateStakingMode")

  const sgxVester = await deployContract("Vester", [
    "Vested SGX", // _name
    "vSGX", // _symbol
    vestingDuration, // _vestingDuration
    esSgx.address, // _esToken
    feeSgxTracker.address, // _pairToken
    sgx.address, // _claimableToken
    stakedSgxTracker.address, // _rewardTracker
  ])

  const sgxlpVester = await deployContract("Vester", [
    "Vested SGXLP", // _name
    "vSGXLP", // _symbol
    vestingDuration, // _vestingDuration
    esSgx.address, // _esToken
    stakedSgxLpTracker.address, // _pairToken
    sgx.address, // _claimableToken
    stakedSgxLpTracker.address, // _rewardTracker
  ])

  const rewardRouter = await deployContract("RewardRouterV2", [])
  await sendTxn(rewardRouter.initialize(
    nativeToken.address,
    sgx.address,
    esSgx.address,
    bnSgx.address,
    sgxlp.address,
    stakedSgxTracker.address,
    bonusSgxTracker.address,
    feeSgxTracker.address,
    feeSgxLpTracker.address,
    stakedSgxLpTracker.address,
    sgxlpManager.address,
    sgxVester.address,
    sgxlpVester.address
  ), "rewardRouter.initialize")

  await sendTxn(sgxlpManager.setHandler(rewardRouter.address), "sgxlpManager.setHandler(rewardRouter)")

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

  // allow stakedSgxLpTracker to stake feeSgxLpTracker
  await sendTxn(feeSgxLpTracker.setHandler(stakedSgxLpTracker.address, true), "feeSgxLpTracker.setHandler(stakedSgxLpTracker)")
  // allow feeSgxLpTracker to stake sgxlp
  await sendTxn(sgxlp.setHandler(feeSgxLpTracker.address, true), "sgxlp.setHandler(feeSgxLpTracker)")

  // allow rewardRouter to stake in feeSgxLpTracker
  await sendTxn(feeSgxLpTracker.setHandler(rewardRouter.address, true), "feeSgxLpTracker.setHandler(rewardRouter)")
  // allow rewardRouter to stake in stakedSgxLpTracker
  await sendTxn(stakedSgxLpTracker.setHandler(rewardRouter.address, true), "stakedSgxLpTracker.setHandler(rewardRouter)")

  await sendTxn(esSgx.setHandler(rewardRouter.address, true), "esSgx.setHandler(rewardRouter)")
  await sendTxn(esSgx.setHandler(stakedSgxDistributor.address, true), "esSgx.setHandler(stakedSgxDistributor)")
  await sendTxn(esSgx.setHandler(stakedSgxLpDistributor.address, true), "esSgx.setHandler(stakedSgxLpDistributor)")
  await sendTxn(esSgx.setHandler(stakedSgxLpTracker.address, true), "esSgx.setHandler(stakedSgxLpTracker)")
  await sendTxn(esSgx.setHandler(sgxVester.address, true), "esSgx.setHandler(sgxVester)")
  await sendTxn(esSgx.setHandler(sgxlpVester.address, true), "esSgx.setHandler(sgxlpVester)")

  await sendTxn(esSgx.setMinter(sgxVester.address, true), "esSgx.setMinter(sgxVester)")
  await sendTxn(esSgx.setMinter(sgxlpVester.address, true), "esSgx.setMinter(sgxlpVester)")

  await sendTxn(sgxVester.setHandler(rewardRouter.address, true), "sgxVester.setHandler(rewardRouter)")
  await sendTxn(sgxlpVester.setHandler(rewardRouter.address, true), "sgxlpVester.setHandler(rewardRouter)")

  await sendTxn(feeSgxTracker.setHandler(sgxVester.address, true), "feeSgxTracker.setHandler(sgxVester)")
  await sendTxn(stakedSgxLpTracker.setHandler(sgxlpVester.address, true), "stakedSgxLpTracker.setHandler(sgxlpVester)")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
