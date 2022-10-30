const { deployContract, contractAt , sendTxn, writeTmpAddresses } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'mainnet');
const tokens = require('./tokens')[network];

async function main() {
  const { nativeToken } = tokens

  const orderBook = await deployContract("OrderBook", []);

  // Arbitrum mainnet addresses
  await sendTxn(orderBook.initialize(
    "0x558C53E9C3d83cFdB8eb50D55EB2370cdA10A7b9", // router
    "0xEFF4b7FdC9ee22387a6183B814f2467007C065b2", // vault
    nativeToken.address, // weth
    "0xcf100fa8Acf1BA927ffC5e857285DdD5f3CcC3C3", // sgusd
    "10000000000000000", // 0.01 BNB
    expandDecimals(10, 30) // min purchase token amount usd
  ), "orderBook.initialize");

  writeTmpAddresses({
    orderBook: orderBook.address
  })
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
