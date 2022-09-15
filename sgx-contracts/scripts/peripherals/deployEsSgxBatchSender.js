const { getFrameSigner, deployContract, contractAt, sendTxn } = require("../shared/helpers")

const network = (process.env.HARDHAT_NETWORK || 'mainnet');

async function getArbValues() {
  const signer = await getFrameSigner()

  const esSgx = await contractAt("EsSGX", "0xf42Ae1D54fd613C9bb14810b0588FaAa09a426cA")
  const esSgxGov = await contractAt("Timelock", await esSgx.gov(), signer)
  const sgxVester = await contractAt("Vester", "0x199070DDfd1CFb69173aa2F7e20906F26B363004")
  const sgxVesterGov = await contractAt("Timelock", await sgxVester.gov(), signer)
  const sgxlpVester = await contractAt("Vester", "0xA75287d2f8b217273E7FCD7E86eF07D33972042E")
  const sgxlpVesterGov = await contractAt("Timelock", await sgxlpVester.gov(), signer)

  return { esSgx, esSgxGov, sgxVester, sgxVesterGov, sgxlpVester, sgxlpVesterGov }
}

async function getAvaxValues() {
  const signer = await getFrameSigner()

  const esSgx = await contractAt("EsSGX", "0xFf1489227BbAAC61a9209A08929E4c2a526DdD17")
  const esSgxGov = await contractAt("Timelock", await esSgx.gov(), signer)
  const sgxVester = await contractAt("Vester", "0x472361d3cA5F49c8E633FB50385BfaD1e018b445")
  const sgxVesterGov = await contractAt("Timelock", await sgxVester.gov(), signer)
  const sgxlpVester = await contractAt("Vester", "0x62331A7Bd1dfB3A7642B7db50B5509E57CA3154A")
  const sgxlpVesterGov = await contractAt("Timelock", await sgxlpVester.gov(), signer)

  return { esSgx, esSgxGov, sgxVester, sgxVesterGov, sgxlpVester, sgxlpVesterGov }
}

async function main() {
  const method = network === "arbitrum" ? getArbValues : getAvaxValues
  const { esSgx, esSgxGov, sgxVester, sgxVesterGov, sgxlpVester, sgxlpVesterGov } = await method()

  const esSgxBatchSender = await deployContract("EsSgxBatchSender", [esSgx.address])

  console.log("esSgx", esSgx.address)
  console.log("esSgxGov", esSgxGov.address)
  console.log("sgxVester", sgxVester.address)
  console.log("sgxVesterGov", sgxVesterGov.address)
  console.log("sgxlpVester", sgxlpVester.address)
  console.log("sgxlpVesterGov", sgxlpVesterGov.address)

  await sendTxn(esSgxGov.signalSetHandler(esSgx.address, esSgxBatchSender.address, true), "esSgxGov.signalSetHandler")
  await sendTxn(sgxVesterGov.signalSetHandler(sgxVester.address, esSgxBatchSender.address, true), "sgxVesterGov.signalSetHandler")
  await sendTxn(sgxlpVesterGov.signalSetHandler(sgxlpVester.address, esSgxBatchSender.address, true), "sgxlpVesterGov.signalSetHandler")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
