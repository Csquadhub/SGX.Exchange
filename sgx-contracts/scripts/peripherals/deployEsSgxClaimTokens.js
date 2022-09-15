const { deployContract, contractAt, writeTmpAddresses } = require("../shared/helpers")

async function main() {
  await deployContract("MintableBaseToken", ["VestingOption", "ARB:SGX", 0])
  await deployContract("MintableBaseToken", ["VestingOption", "ARB:SGXLP", 0])
  await deployContract("MintableBaseToken", ["VestingOption", "AVAX:SGX", 0])
  await deployContract("MintableBaseToken", ["VestingOption", "AVAX:SGXLP", 0])
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
