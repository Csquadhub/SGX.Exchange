const { deployContract, contractAt, sendTxn, getFrameSigner } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'mainnet');

async function getArbValues() {
  const vault = await contractAt("Vault", "0x489ee077994B6658eAfA855C308275EAd8097C4A")
  const tokenManager = { address: "0x7b78CeEa0a89040873277e279C40a08dE59062f5" }
  const sgxlpManager = { address: "0x321F653eED006AD1C29D174e17d96351BDe22649" }

  const positionRouter = { address: "0x3D6bA331e3D9702C5e8A8d254e5d8a285F223aba" }
  const positionManager = { address: "0x87a4088Bd721F83b6c2E5102e2FA47022Cb1c831" }

  return { vault, tokenManager, sgxlpManager, positionRouter, positionManager }
}

async function getAvaxValues() {
  const vault = await contractAt("Vault", "0x9ab2De34A33fB459b538c43f251eB825645e8595")
  const tokenManager = { address: "0x26137dfA81f9Ac8BACd748f6A298262f11504Da9" }
  const sgxlpManager = { address: "0xe1ae4d4b06A5Fe1fc288f6B4CD72f9F8323B107F" }

  const positionRouter = { address: "0x195256074192170d1530527abC9943759c7167d8" }
  const positionManager = { address: "0xF2ec2e52c3b5F8b8bd5A3f93945d05628A233216" }

  return { vault, tokenManager, sgxlpManager, positionRouter, positionManager }
}

async function getBscTestnetValues() {
  const vault = await contractAt("Vault", "0xEFF4b7FdC9ee22387a6183B814f2467007C065b2")
  const tokenManager = { address: "0xC734E9c50158Ab7513E1fa9d236fB4A91923e255" }
  const sgxlpManager = { address: "0xD11D58C3912736e045Bb1ec300A4c5765b95f347" }

  const positionRouter = { address: "0x5Fb6a4B08E893E56640971f2646Bc7f2E5fB42DA" }
  const positionManager = { address: "0x0639859E49D8Fe28447cc47F4F286Eb47462fc34" }

  return { vault, tokenManager, sgxlpManager, positionRouter, positionManager }
}

async function getValues() {
  if (network === "arbitrum") {
    return getArbValues()
  }

  if (network === "avax") {
    return getAvaxValues()
  }

  if (network === "testnet") {
    return getBscTestnetValues()
  }
}

async function main() {
  const admin = "0x8e338d2246085CaD626603beFc82672fa7A9C025"
  const buffer = 24 * 60 * 60
  const maxTokenSupply = expandDecimals("13250000", 18)

  const { vault, tokenManager, sgxlpManager, positionRouter, positionManager } = await getValues()
  const mintReceiver = tokenManager

  const timelock = await deployContract("Timelock", [
    admin,
    buffer,
    tokenManager.address,
    mintReceiver.address,
    sgxlpManager.address,
    maxTokenSupply,
    10, // marginFeeBasisPoints 0.1%
    100 // maxMarginFeeBasisPoints 1%
  ], "Timelock")

  const deployedTimelock = await contractAt("Timelock", timelock.address)

  await sendTxn(deployedTimelock.setShouldToggleIsLeverageEnabled(true), "deployedTimelock.setShouldToggleIsLeverageEnabled(true)")
  await sendTxn(deployedTimelock.setContractHandler(positionRouter.address, true), "deployedTimelock.setContractHandler(positionRouter)")
  await sendTxn(deployedTimelock.setContractHandler(positionManager.address, true), "deployedTimelock.setContractHandler(positionManager)")

  // // update gov of vault
  const vaultGov = await contractAt("Timelock", await vault.gov())

  await sendTxn(vaultGov.signalSetGov(vault.address, deployedTimelock.address), "vaultGov.signalSetGov")
  await sendTxn(deployedTimelock.signalSetGov(vault.address, vaultGov.address), "deployedTimelock.signalSetGov(vault)")

  const signers = [
    "0x8e338d2246085CaD626603beFc82672fa7A9C025",
  ]

  for (let i = 0; i < signers.length; i++) {
    const signer = signers[i]
    await sendTxn(deployedTimelock.setContractHandler(signer, true), `deployedTimelock.setContractHandler(${signer})`)
  }

  const keepers = [
    "0x8e338d2246085CaD626603beFc82672fa7A9C025" // X
  ]

  for (let i = 0; i < keepers.length; i++) {
    const keeper = keepers[i]
    await sendTxn(deployedTimelock.setKeeper(keeper, true), `deployedTimelock.setKeeper(${keeper})`)
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
