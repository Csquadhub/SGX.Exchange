const { contractAt, sendTxn } = require("../shared/helpers")

const wallet = { address: "0x5F799f365Fa8A2B60ac0429C48B153cA5a6f0Cf8" }
const timelock = { address: "0x59c46156ED614164eC66A3CFa5822797f533c902" }

async function printRewardTracker(rewardTracker, label) {
  // console.log(label, "inPrivateTransferMode", await rewardTracker.inPrivateTransferMode())
  // console.log(label, "inPrivateStakingMode", await rewardTracker.inPrivateStakingMode())
  // console.log(label, "inPrivateClaimingMode", await rewardTracker.inPrivateClaimingMode())
  console.log(label, "isHandler", await rewardTracker.isHandler(wallet.address))
  console.log(label, "gov", await rewardTracker.gov())
}

async function updateHandler(rewardTracker, label) {
  await sendTxn(rewardTracker.setHandler(wallet.address, false), `${label}, rewardTracker.setHandler`)
}

async function printToken(token, label) {
  console.log(label, "inPrivateTransferMode", await token.inPrivateTransferMode())
  console.log(label, "isHandler", await token.isHandler(wallet.address))
  console.log(label, "isMinter", await token.isMinter(wallet.address))
  console.log(label, "gov", await token.gov())
}

async function printSgusd(token, label) {
  console.log(label, "isVault", await token.vaults(wallet.address))
  console.log(label, "gov", await token.gov())
}

async function updateToken(token, label) {
  // await sendTxn(token.removeAdmin(wallet.address), `${label}, token.removeAdmin`)
  await sendTxn(token.setMinter(wallet.address, false), `${label}, token.setMinter`)
}

async function updateGov(contract, label) {
  await sendTxn(contract.setGov(timelock.address), `${label}.setGov`)
}

async function signalGov(prevGov, contract, nextGov, label) {
  await sendTxn(prevGov.signalSetGov(contract.address, nextGov.address), `${label}.signalSetGov`)
}

async function updateRewardTrackerGov(rewardTracker, label) {
  const distributorAddress = await rewardTracker.distributor()
  const distributor = await contractAt("RewardDistributor", distributorAddress)
  await sendTxn(rewardTracker.setGov(timelock.address), `${label}.setGov`)
  await sendTxn(distributor.setGov(timelock.address), `${label}.distributor.setGov`)
}

async function main() {
  const stakedSgxTracker = await contractAt("RewardTracker", "0x2bD10f8E93B3669b6d42E74eEedC65dd1B0a1342")
  const bonusSgxTracker = await contractAt("RewardTracker", "0x908C4D94D34924765f1eDc22A1DD098397c59dD4")
  const feeSgxTracker = await contractAt("RewardTracker", "0x4d268a7d4C16ceB5a606c173Bd974984343fea13")

  const stakedSgxLpTracker = await contractAt("RewardTracker", "0x9e295B5B976a184B14aD8cd72413aD846C299660")
  const feeSgxLpTracker = await contractAt("RewardTracker", "0xd2D1162512F927a7e282Ef43a362659E4F2a728F")

  await printRewardTracker(stakedSgxTracker, "stakedSgxTracker")
  await printRewardTracker(bonusSgxTracker, "bonusSgxTracker")
  await printRewardTracker(feeSgxTracker, "feeSgxTracker")

  await printRewardTracker(stakedSgxLpTracker, "stakedSgxLpTracker")
  await printRewardTracker(feeSgxLpTracker, "feeSgxLpTracker")

  const sgxlp = await contractAt("MintableBaseToken", "0x01234181085565ed162a948b6a5e88758CD7c7b8")
  const sgusd = await contractAt("SGUSD", "0xc0253c3cC6aa5Ab407b5795a04c28fB063273894")
  // const sgx = await contractAt("MintableBaseToken", "0x62edc0692BD897D2295872a9FFCac5425011c661")
  // const esSgx = await contractAt("MintableBaseToken", "0xFf1489227BbAAC61a9209A08929E4c2a526DdD17")
  const bnSgx = await contractAt("MintableBaseToken", "0x8087a341D32D445d9aC8aCc9c14F5781E04A26d2")

  await printToken(sgxlp, "sgxlp")
  await printSgusd(sgusd, "sgusd")
  // await printToken(sgx, "sgx")
  // await printToken(esSgx, "esSgx")
  await printToken(bnSgx, "bnSgx")

  // const prevGov = await contractAt("Timelock", "0x4a3930b629f899fe19c1f280c73a376382d61a78")
  // const nextGov = await contractAt("Timelock", "0x09214C0A3594fbcad59A58099b0A63E2B29b15B8")

  // await signalGov(prevGov, sgxlp, nextGov, "sgxlp")
  // await signalGov(prevGov, sgx, nextGov, "sgx")
  // await signalGov(prevGov, esSgx, nextGov, "esSgx")
  // await signalGov(prevGov, bnSgx, nextGov, "bnSgx")

  await updateToken(sgx, "sgx")
  await updateToken(esSgx, "esSgx")
  await updateToken(bnSgx, "bnSgx")

  await updateHandler(stakedSgxTracker, "stakedSgxTracker")
  await updateHandler(bonusSgxTracker, "bonusSgxTracker")
  await updateHandler(feeSgxTracker, "feeSgxTracker")
  await updateHandler(stakedSgxLpTracker, "stakedSgxLpTracker")
  await updateHandler(feeSgxLpTracker, "feeSgxLpTracker")

  await updateRewardTrackerGov(stakedSgxTracker, "stakedSgxTracker")

  await updateRewardTrackerGov(bonusSgxTracker, "bonusSgxTracker")
  await updateRewardTrackerGov(feeSgxTracker, "feeSgxTracker")
  await updateRewardTrackerGov(stakedSgxLpTracker, "stakedSgxLpTracker")
  await updateRewardTrackerGov(feeSgxLpTracker, "feeSgxLpTracker")

  await updateGov(sgxlp, "sgxlp")
  await updateGov(sgusd, "sgusd")
  // await updateGov(sgx, "sgx")
  // await updateGov(esSgx, "esSgx")
  await updateGov(bnSgx, "bnSgx")

  const vault = await contractAt("Vault", "0x9ab2De34A33fB459b538c43f251eB825645e8595")
  const vaultPriceFeedAddress = await vault.priceFeed()
  const vaultPriceFeed = await contractAt("VaultPriceFeed", vaultPriceFeedAddress)
  const sgxlpManager = await contractAt("SgxLpManager", "0xe1ae4d4b06A5Fe1fc288f6B4CD72f9F8323B107F")
  const router = await contractAt("Router", "0x5F719c2F1095F7B9fc68a68e35B51194f4b6abe8")

  await updateGov(vault, "vault")
  await updateGov(vaultPriceFeed, "vaultPriceFeed")
  await updateGov(sgxlpManager, "sgxlpManager")
  await updateGov(router, "router")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
