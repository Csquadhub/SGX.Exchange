const { deployContract, contractAt, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

async function main() {
  const sgusd = await contractAt("SGUSD", "0x85E76cbf4893c1fbcB34dCF1239A91CE2A4CF5a7")
  const wbnb = await contractAt("WETH", "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c")
  const xgmt = await contractAt("YieldToken", "0xe304ff0983922787Fd84BC9170CD21bF78B16B10")

  const gmtSgusdPair = { address: "0xa41e57459f09a126F358E118b693789d088eA8A0" }
  const gmtSgusdFarm = await deployContract("YieldFarm", ["GMT-SGUSD Farm", "GMT-SGUSD:FARM", gmtSgusdPair.address], "gmtSgusdFarm")

  const xgmtSgusdPair = { address: "0x0b622208fc0691C2486A3AE6B7C875b4A174b317" }
  const xgmtSgusdFarm = await deployContract("YieldFarm", ["xGMT-SGUSD Farm", "xGMT-SGUSD:FARM", xgmtSgusdPair.address], "xgmtSgusdFarm")

  const sgusdYieldTracker = await deployContract("YieldTracker", [sgusd.address], "sgusdYieldTracker")
  const sgusdRewardDistributor = await deployContract("TimeDistributor", [], "sgusdRewardDistributor")

  await sendTxn(sgusd.setYieldTrackers([sgusdYieldTracker.address]), "sgusd.setYieldTrackers")
  await sendTxn(sgusdYieldTracker.setDistributor(sgusdRewardDistributor.address), "sgusdYieldTracker.setDistributor")
  await sendTxn(sgusdRewardDistributor.setDistribution([sgusdYieldTracker.address], ["0"], [wbnb.address]), "sgusdRewardDistributor.setDistribution")

  const xgmtYieldTracker = await deployContract("YieldTracker", [xgmt.address], "xgmtYieldTracker")
  const xgmtRewardDistributor = await deployContract("TimeDistributor", [], "xgmtRewardDistributor")

  await sendTxn(xgmt.setYieldTrackers([xgmtYieldTracker.address]), "xgmt.setYieldTrackers")
  await sendTxn(xgmtYieldTracker.setDistributor(xgmtRewardDistributor.address), "xgmtYieldTracker.setDistributor")
  await sendTxn(xgmtRewardDistributor.setDistribution([xgmtYieldTracker.address], ["0"], [wbnb.address]), "xgmtRewardDistributor.setDistribution")

  const gmtSgusdFarmYieldTrackerXgmt = await deployContract("YieldTracker", [gmtSgusdFarm.address], "gmtSgusdFarmYieldTrackerXgmt")
  const gmtSgusdFarmDistributorXgmt = await deployContract("TimeDistributor", [], "gmtSgusdFarmDistributorXgmt")

  await sendTxn(gmtSgusdFarmYieldTrackerXgmt.setDistributor(gmtSgusdFarmDistributorXgmt.address), "gmtSgusdFarmYieldTrackerXgmt.setDistributor")
  await sendTxn(gmtSgusdFarmDistributorXgmt.setDistribution([gmtSgusdFarmYieldTrackerXgmt.address], ["0"], [xgmt.address]), "gmtSgusdFarmDistributorXgmt.setDistribution")

  const gmtSgusdFarmYieldTrackerWbnb = await deployContract("YieldTracker", [gmtSgusdFarm.address], "gmtSgusdFarmYieldTrackerWbnb")
  const gmtSgusdFarmDistributorWbnb = await deployContract("TimeDistributor", [], "gmtSgusdFarmDistributorWbnb")

  await sendTxn(gmtSgusdFarmYieldTrackerWbnb.setDistributor(gmtSgusdFarmDistributorWbnb.address), "gmtSgusdFarmYieldTrackerWbnb.setDistributor")
  await sendTxn(gmtSgusdFarmDistributorWbnb.setDistribution([gmtSgusdFarmYieldTrackerWbnb.address], ["0"], [wbnb.address]), "gmtSgusdFarmDistributorWbnb.setDistribution")

  await sendTxn(gmtSgusdFarm.setYieldTrackers([gmtSgusdFarmYieldTrackerXgmt.address, gmtSgusdFarmYieldTrackerWbnb.address]), "gmtSgusdFarm.setYieldTrackers")

  const xgmtSgusdFarmYieldTrackerXgmt = await deployContract("YieldTracker", [xgmtSgusdFarm.address], "xgmtSgusdFarmYieldTrackerXgmt")
  const xgmtSgusdFarmDistributorXgmt = await deployContract("TimeDistributor", [], "xgmtSgusdFarmDistributorXgmt")

  await sendTxn(xgmtSgusdFarmYieldTrackerXgmt.setDistributor(xgmtSgusdFarmDistributorXgmt.address), "xgmtSgusdFarmYieldTrackerXgmt.setDistributor")
  await sendTxn(xgmtSgusdFarmDistributorXgmt.setDistribution([xgmtSgusdFarmYieldTrackerXgmt.address], ["0"], [xgmt.address]), "xgmtSgusdFarmDistributorXgmt.setDistribution")

  const xgmtSgusdFarmYieldTrackerWbnb = await deployContract("YieldTracker", [xgmtSgusdFarm.address], "xgmtSgusdFarmYieldTrackerWbnb")
  const xgmtSgusdFarmDistributorWbnb = await deployContract("TimeDistributor", [], "xgmtSgusdFarmDistributorWbnb")

  await sendTxn(xgmtSgusdFarmYieldTrackerWbnb.setDistributor(xgmtSgusdFarmDistributorWbnb.address), "xgmtSgusdFarmYieldTrackerWbnb.setDistributor")
  await sendTxn(xgmtSgusdFarmDistributorWbnb.setDistribution([xgmtSgusdFarmYieldTrackerWbnb.address], ["0"], [wbnb.address]), "gmtSgusdFarmDistributorWbnb.setDistribution")

  await sendTxn(xgmtSgusdFarm.setYieldTrackers([xgmtSgusdFarmYieldTrackerXgmt.address, xgmtSgusdFarmYieldTrackerWbnb.address]), "xgmtSgusdFarm.setYieldTrackers")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
