const { deployContract, contractAt , sendTxn, writeTmpAddresses, callWithRetries } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")
const { toUsd } = require("../../test/shared/units")

const network = (process.env.HARDHAT_NETWORK || 'mainnet');
const tokens = require('./tokens')[network];

async function main() {
  const {
    nativeToken
  } = tokens

  const vault = await contractAt("Vault", "0xDE3590067c811b6F023b557ed45E4f1067859663")
  const sgusd = await contractAt("SGUSD", "0x45096e7aA921f27590f8F19e457794EB09678141")
  const sgxlp = await contractAt("SGXLP", "0x4277f8F2c384827B5273592FF7CeBd9f2C1ac258")

  const sgxlpManager = await deployContract("SgxLpManager", [vault.address, sgusd.address, sgxlp.address, 15 * 60])

  await sendTxn(sgxlpManager.setInPrivateMode(true), "sgxlpManager.setInPrivateMode")

  await sendTxn(sgxlp.setMinter(sgxlpManager.address, true), "sgxlp.setMinter")
  await sendTxn(sgusd.addVault(sgxlpManager.address), "sgusd.addVault")
  await sendTxn(vault.setManager(sgxlpManager.address, true), "vault.setManager")

  writeTmpAddresses({
    sgxlpManager: sgxlpManager.address
  })
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
