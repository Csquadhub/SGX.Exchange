const { deployContract, contractAt, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

async function main() {
  const sgusd = await contractAt("SGUSD", "0x85E76cbf4893c1fbcB34dCF1239A91CE2A4CF5a7")
  const wbnb = await contractAt("WETH", "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c")
  const xgmt = await contractAt("YieldToken", "0xe304ff0983922787Fd84BC9170CD21bF78B16B10")

  const autoSgusdPair = { address: "0x0523FD5C53ea5419B4DAF656BC1b157dDFE3ce50" }
  const autoSgusdFarm = await deployContract("YieldFarm", ["AUTO-SGUSD Farm", "AUTO-SGUSD:FARM", autoSgusdPair.address], "autoSgusdFarm")

  const autoSgusdFarmYieldTrackerXgmt = await deployContract("YieldTracker", [autoSgusdFarm.address], "autoSgusdFarmYieldTrackerXgmt")
  const autoSgusdFarmDistributorXgmt = await deployContract("TimeDistributor", [], "autoSgusdFarmDistributorXgmt")

  await sendTxn(autoSgusdFarmYieldTrackerXgmt.setDistributor(autoSgusdFarmDistributorXgmt.address), "autoSgusdFarmYieldTrackerXgmt.setDistributor")
  await sendTxn(autoSgusdFarmDistributorXgmt.setDistribution([autoSgusdFarmYieldTrackerXgmt.address], ["0"], [xgmt.address]), "autoSgusdFarmDistributorXgmt.setDistribution")

  const autoSgusdFarmYieldTrackerWbnb = await deployContract("YieldTracker", [autoSgusdFarm.address], "autoSgusdFarmYieldTrackerWbnb")
  const autoSgusdFarmDistributorWbnb = await deployContract("TimeDistributor", [], "autoSgusdFarmDistributorWbnb")

  await sendTxn(autoSgusdFarmYieldTrackerWbnb.setDistributor(autoSgusdFarmDistributorWbnb.address), "autoSgusdFarmYieldTrackerWbnb.setDistributor")
  await sendTxn(autoSgusdFarmDistributorWbnb.setDistribution([autoSgusdFarmYieldTrackerWbnb.address], ["0"], [wbnb.address]), "autoSgusdFarmDistributorWbnb.setDistribution")

  await sendTxn(autoSgusdFarm.setYieldTrackers([autoSgusdFarmYieldTrackerXgmt.address, autoSgusdFarmYieldTrackerWbnb.address]), "autoSgusdFarm.setYieldTrackers")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
