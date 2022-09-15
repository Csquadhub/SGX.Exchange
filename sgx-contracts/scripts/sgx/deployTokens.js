const { deployContract, contractAt, writeTmpAddresses } = require("../shared/helpers")

async function main() {
  // await deployContract("EsSGX", [])
  // await deployContract("SGXLP", [])
  await deployContract("MintableBaseToken", ["esSGX IOU", "esSGX:IOU", 0])
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
