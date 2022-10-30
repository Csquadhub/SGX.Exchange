const { deployContract, contractAt } = require("../shared/helpers")
const { bigNumberify, expandDecimals } = require("../../test/shared/utilities")

async function main() {
  const { MaxUint256 } = ethers.constants
  const precision = 1000000

  const sgxMigrator = await deployContract("SgxMigrator", [2])
  const gmtSgxIou = await deployContract("SgxIou", [sgxMigrator.address, "GMT SGX (IOU)", "GMT:SGX"])
  const xgmtSgxIou = await deployContract("SgxIou", [sgxMigrator.address, "xGMT SGX (IOU)", "xGMT:SGX"])
  const gmtSgusdSgxIou = await deployContract("SgxIou", [sgxMigrator.address, "GMT-SGUSD SGX (IOU)", "GMT-SGUSD:SGX"])
  const xgmtSgusdSgxIou = await deployContract("SgxIou", [sgxMigrator.address, "xGMT-SGUSD SGX (IOU)", "xGMT-SGUSD:SGX"])

  const gmt = { address: "0x99e92123eB77Bc8f999316f622e5222498438784" }
  const xgmt = { address: "0xe304ff0983922787Fd84BC9170CD21bF78B16B10" }
  const gmtSgusd = { address: "0xa41e57459f09a126F358E118b693789d088eA8A0" }
  const xgmtSgusd = { address: "0x0b622208fc0691C2486A3AE6B7C875b4A174b317" }
  const sgusd = { address: "0x85E76cbf4893c1fbcB34dCF1239A91CE2A4CF5a7" }

  const ammRouter = { address: "0x10ED43C718714eb63d5aA57B78B54704E256024E" }
  const sgxPrice = bigNumberify(2 * precision)

  const signers = [
    "0x45e48668F090a3eD1C7961421c60Df4E66f693BD", // Dovey
    "0x881690382102106b00a99E3dB86056D0fC71eee6", // Han Wen
    "0x2e5d207a4c0f7e7c52f6622dcc6eb44bc0fe1a13" // Krunal Amin
  ]

  const gmtPrice = bigNumberify(10.97 * precision)
  const xgmtPrice = bigNumberify(90.31 * precision)
  const gmtSgusdPrice = bigNumberify(parseInt(6.68 * precision * 1.1))
  const xgmtSgusdPrice = bigNumberify(parseInt(19.27 * precision * 1.1))

  const whitelistedTokens = [gmt.address, xgmt.address, gmtSgusd.address, xgmtSgusd.address]
  const iouTokens = [gmtSgxIou.address, xgmtSgxIou.address, gmtSgusdSgxIou.address, xgmtSgusdSgxIou.address]
  const prices = [gmtPrice, xgmtPrice, gmtSgusdPrice, xgmtSgusdPrice]
  const caps = [MaxUint256, MaxUint256, expandDecimals(483129, 18), expandDecimals(150191, 18)]
  const lpTokens = [gmtSgusd.address, xgmtSgusd.address]
  const lpTokenAs = [gmt.address, xgmt.address]
  const lpTokenBs = [sgusd.address, sgusd.address]

  await sgxMigrator.initialize(
    ammRouter.address,
    sgxPrice,
    signers,
    whitelistedTokens,
    iouTokens,
    prices,
    caps,
    lpTokens,
    lpTokenAs,
    lpTokenBs
  )
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
