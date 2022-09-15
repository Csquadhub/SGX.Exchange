const { deployContract, contractAt, sendTxn, readCsv } = require("../shared/helpers")
const { expandDecimals, bigNumberify } = require("../../test/shared/utilities")

const path = require('path')
const fs = require('fs')
const parse = require('csv-parse')

const inputDir = path.resolve(__dirname, "../..") + "/data/bonds/"

const network = (process.env.HARDHAT_NETWORK || 'mainnet');

const inputFile = inputDir + "2022-06-01_transfers.csv"
const shouldSendTxns = false

async function getArbValues() {
  const esSgx = await contractAt("EsSGX", "0xf42Ae1D54fd613C9bb14810b0588FaAa09a426cA")
  const esSgxBatchSender = await contractAt("EsSgxBatchSender", "0xc3828fa579996090Dc7767E051341338e60207eF")

  const vestWithSgxOption = "0x544a6ec142Aa9A7F75235fE111F61eF2EbdC250a"
  const vestWithSgxLpOption = "0x9d8f6f6eE45275A5Ca3C6f6269c5622b1F9ED515"

  const sgxVester = await contractAt("Vester", "0x199070DDfd1CFb69173aa2F7e20906F26B363004")
  const sgxlpVester = await contractAt("Vester", "0xA75287d2f8b217273E7FCD7E86eF07D33972042E")

  return { esSgx, esSgxBatchSender, vestWithSgxOption, vestWithSgxLpOption, sgxVester, sgxlpVester }
}

async function getAvaxValues() {
  const esSgx = await contractAt("EsSGX", "0xFf1489227BbAAC61a9209A08929E4c2a526DdD17")
  const esSgxBatchSender = await contractAt("EsSgxBatchSender", "0xc9baFef924159138697e72899a2753a3Dc8D1F4d")
  const vestWithSgxOption = "0x171a321A78dAE0CDC0Ba3409194df955DEEcA746"
  const vestWithSgxLpOption = "0x28863Dd19fb52DF38A9f2C6dfed40eeB996e3818"

  const sgxVester = await contractAt("Vester", "0x472361d3cA5F49c8E633FB50385BfaD1e018b445")
  const sgxlpVester = await contractAt("Vester", "0x62331A7Bd1dfB3A7642B7db50B5509E57CA3154A")

  return { esSgx, esSgxBatchSender, vestWithSgxOption, vestWithSgxLpOption, sgxVester, sgxlpVester }
}

async function main() {
  const wallet = { address: "0x5F799f365Fa8A2B60ac0429C48B153cA5a6f0Cf8" }

  const values = network === "arbitrum" ? await getArbValues() : await getAvaxValues()
  const { esSgx, esSgxBatchSender, vestWithSgxOption, vestWithSgxLpOption, sgxVester, sgxlpVester } = values

  const txns = await readCsv(inputFile)
  console.log("processing list", txns.length)

  const vestWithSgxAccounts = []
  const vestWithSgxAmounts = []

  const vestWithSgxLpAccounts = []
  const vestWithSgxLpAmounts = []

  let totalEsSgx = bigNumberify(0)

  for (let i = 0; i < txns.length; i++) {
    const txn = txns[i]
    if (txn.Method !== "Transfer") {
      continue
    }

    const amount = ethers.utils.parseUnits(txn.Quantity, 18)

    if (txn.To.toLowerCase() === vestWithSgxOption.toLowerCase()) {
      vestWithSgxAccounts.push(txn.From)
      vestWithSgxAmounts.push(amount)
      totalEsSgx = totalEsSgx.add(amount)
    }

    if (txn.To.toLowerCase() === vestWithSgxLpOption.toLowerCase()) {
      vestWithSgxLpAccounts.push(txn.From)
      vestWithSgxLpAmounts.push(amount)
      totalEsSgx = totalEsSgx.add(amount)
    }
  }

  console.log("vestWithSgxAccounts", vestWithSgxAccounts.length)
  console.log("vestWithSgxLpAccounts", vestWithSgxLpAccounts.length)
  console.log("totalEsSgx", totalEsSgx.toString(), ethers.utils.formatUnits(totalEsSgx, 18))

  if (shouldSendTxns) {
    if (vestWithSgxAccounts.length > 0) {
      await sendTxn(esSgxBatchSender.send(sgxVester.address, 4, vestWithSgxAccounts, vestWithSgxAmounts), "esSgxBatchSender.send(sgxVester)")
    }
    if (vestWithSgxLpAccounts.length > 0) {
      await sendTxn(esSgxBatchSender.send(sgxlpVester.address, 320, vestWithSgxLpAccounts, vestWithSgxLpAmounts), "esSgxBatchSender.send(sgxlpVester)")
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
