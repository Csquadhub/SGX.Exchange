require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-contract-sizer");
require("@typechain/hardhat");


/**
 * @type import('hardhat/config').HardhatUserConfig
 */
 module.exports = {
  // networks: {
  //   hardhat: {
  //     allowUnlimitedContractSize: true
  //   },
  //   bsc: {
  //     url: BSC_URL,
  //     chainId: 56,
  //     gasPrice: 10000000000,
  //     accounts: [BSC_DEPLOY_KEY]
  //   },
  //   testnet: {
  //     url: BSC_TESTNET_URL,
  //     chainId: 97,
  //     gasPrice: 20000000000,
  //     accounts: [BSC_TESTNET_DEPLOY_KEY]
  //   },
  //   arbitrumTestnet: {
  //     url: ARBITRUM_TESTNET_URL,
  //     gasPrice: 10000000000,
  //     chainId: 421611,
  //     accounts: [ARBITRUM_TESTNET_DEPLOY_KEY]
  //   },
  //   arbitrum: {
  //     url: ARBITRUM_URL,
  //     gasPrice: 30000000000,
  //     chainId: 42161,
  //     accounts: [ARBITRUM_DEPLOY_KEY]
  //   },
  //   avax: {
  //     url: AVAX_URL,
  //     gasPrice: 200000000000,
  //     chainId: 43114,
  //     accounts: [AVAX_DEPLOY_KEY]
  //   },
  //   polygon: {
  //     url: POLYGON_URL,
  //     gasPrice: 100000000000,
  //     chainId: 137,
  //     accounts: [POLYGON_DEPLOY_KEY]
  //   },
  //   mainnet: {
  //     url: MAINNET_URL,
  //     gasPrice: 50000000000,
  //     accounts: [MAINNET_DEPLOY_KEY]
  //   }
  // },
  // etherscan: {
  //   apiKey: {
  //     mainnet: MAINNET_DEPLOY_KEY,
  //     arbitrumOne: ARBISCAN_API_KEY,
  //     arbitrumTestnet: ARBISCAN_TESTNET_API_KEY,
  //     avalanche: SNOWTRACE_API_KEY,
  //     bsc: BSCSCAN_API_KEY,
  //     polygon: POLYGONSCAN_API_KEY,
  //   }
  // },
  solidity: {
    version: "0.6.12",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1
      }
    }
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
  },
}
