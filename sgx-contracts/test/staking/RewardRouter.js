const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { deployContract } = require("../shared/fixtures")
const { expandDecimals, getBlockTime, increaseTime, mineBlock, reportGasUsed, print, newWallet } = require("../shared/utilities")
const { toChainlinkPrice } = require("../shared/chainlink")
const { toUsd, toNormalizedPrice } = require("../shared/units")
const { initVault, getBnbConfig, getBtcConfig, getDaiConfig } = require("../core/Vault/helpers")

use(solidity)

describe("RewardRouter", function () {
  const provider = waffle.provider
  const [wallet, user0, user1, user2, user3] = provider.getWallets()

  let vault
  let sgxlpManager
  let sgxlp
  let usdg
  let router
  let vaultPriceFeed
  let bnb
  let bnbPriceFeed
  let btc
  let btcPriceFeed
  let eth
  let ethPriceFeed
  let dai
  let daiPriceFeed
  let busd
  let busdPriceFeed

  let sgx
  let esSgx
  let bnSgx

  let stakedSgxTracker
  let stakedSgxDistributor
  let bonusSgxTracker
  let bonusSgxDistributor
  let feeSgxTracker
  let feeSgxDistributor

  let feeSgxLpTracker
  let feeSgxLpDistributor
  let stakedSgxLpTracker
  let stakedSgxLpDistributor

  let rewardRouter

  beforeEach(async () => {
    bnb = await deployContract("Token", [])
    bnbPriceFeed = await deployContract("PriceFeed", [])

    btc = await deployContract("Token", [])
    btcPriceFeed = await deployContract("PriceFeed", [])

    eth = await deployContract("Token", [])
    ethPriceFeed = await deployContract("PriceFeed", [])

    dai = await deployContract("Token", [])
    daiPriceFeed = await deployContract("PriceFeed", [])

    busd = await deployContract("Token", [])
    busdPriceFeed = await deployContract("PriceFeed", [])

    vault = await deployContract("Vault", [])
    usdg = await deployContract("USDG", [vault.address])
    router = await deployContract("Router", [vault.address, usdg.address, bnb.address])
    vaultPriceFeed = await deployContract("VaultPriceFeed", [])
    sgxlp = await deployContract("SGXLP", [])

    await initVault(vault, router, usdg, vaultPriceFeed)
    sgxlpManager = await deployContract("SgxLpManager", [vault.address, usdg.address, sgxlp.address, 24 * 60 * 60])

    await vaultPriceFeed.setTokenConfig(bnb.address, bnbPriceFeed.address, 8, false)
    await vaultPriceFeed.setTokenConfig(btc.address, btcPriceFeed.address, 8, false)
    await vaultPriceFeed.setTokenConfig(eth.address, ethPriceFeed.address, 8, false)
    await vaultPriceFeed.setTokenConfig(dai.address, daiPriceFeed.address, 8, false)

    await daiPriceFeed.setLatestAnswer(toChainlinkPrice(1))
    await vault.setTokenConfig(...getDaiConfig(dai, daiPriceFeed))

    await btcPriceFeed.setLatestAnswer(toChainlinkPrice(60000))
    await vault.setTokenConfig(...getBtcConfig(btc, btcPriceFeed))

    await bnbPriceFeed.setLatestAnswer(toChainlinkPrice(300))
    await vault.setTokenConfig(...getBnbConfig(bnb, bnbPriceFeed))

    await sgxlp.setInPrivateTransferMode(true)
    await sgxlp.setMinter(sgxlpManager.address, true)
    await sgxlpManager.setInPrivateMode(true)

    sgx = await deployContract("SGX", []);
    esSgx = await deployContract("EsSGX", []);
    bnSgx = await deployContract("MintableBaseToken", ["Bonus SGX", "bnSGX", 0]);

    // SGX
    stakedSgxTracker = await deployContract("RewardTracker", ["Staked SGX", "sSGX"])
    stakedSgxDistributor = await deployContract("RewardDistributor", [esSgx.address, stakedSgxTracker.address])
    await stakedSgxTracker.initialize([sgx.address, esSgx.address], stakedSgxDistributor.address)
    await stakedSgxDistributor.updateLastDistributionTime()

    bonusSgxTracker = await deployContract("RewardTracker", ["Staked + Bonus SGX", "sbSGX"])
    bonusSgxDistributor = await deployContract("BonusDistributor", [bnSgx.address, bonusSgxTracker.address])
    await bonusSgxTracker.initialize([stakedSgxTracker.address], bonusSgxDistributor.address)
    await bonusSgxDistributor.updateLastDistributionTime()

    feeSgxTracker = await deployContract("RewardTracker", ["Staked + Bonus + Fee SGX", "sbfSGX"])
    feeSgxDistributor = await deployContract("RewardDistributor", [eth.address, feeSgxTracker.address])
    await feeSgxTracker.initialize([bonusSgxTracker.address, bnSgx.address], feeSgxDistributor.address)
    await feeSgxDistributor.updateLastDistributionTime()

    // SGXLP
    feeSgxLpTracker = await deployContract("RewardTracker", ["Fee SGXLP", "fSGXLP"])
    feeSgxLpDistributor = await deployContract("RewardDistributor", [eth.address, feeSgxLpTracker.address])
    await feeSgxLpTracker.initialize([sgxlp.address], feeSgxLpDistributor.address)
    await feeSgxLpDistributor.updateLastDistributionTime()

    stakedSgxLpTracker = await deployContract("RewardTracker", ["Fee + Staked SGXLP", "fsSGXLP"])
    stakedSgxLpDistributor = await deployContract("RewardDistributor", [esSgx.address, stakedSgxLpTracker.address])
    await stakedSgxLpTracker.initialize([feeSgxLpTracker.address], stakedSgxLpDistributor.address)
    await stakedSgxLpDistributor.updateLastDistributionTime()

    await stakedSgxTracker.setInPrivateTransferMode(true)
    await stakedSgxTracker.setInPrivateStakingMode(true)
    await bonusSgxTracker.setInPrivateTransferMode(true)
    await bonusSgxTracker.setInPrivateStakingMode(true)
    await bonusSgxTracker.setInPrivateClaimingMode(true)
    await feeSgxTracker.setInPrivateTransferMode(true)
    await feeSgxTracker.setInPrivateStakingMode(true)

    await feeSgxLpTracker.setInPrivateTransferMode(true)
    await feeSgxLpTracker.setInPrivateStakingMode(true)
    await stakedSgxLpTracker.setInPrivateTransferMode(true)
    await stakedSgxLpTracker.setInPrivateStakingMode(true)

    rewardRouter = await deployContract("RewardRouter", [])
    await rewardRouter.initialize(
      bnb.address,
      sgx.address,
      esSgx.address,
      bnSgx.address,
      sgxlp.address,
      stakedSgxTracker.address,
      bonusSgxTracker.address,
      feeSgxTracker.address,
      feeSgxLpTracker.address,
      stakedSgxLpTracker.address,
      sgxlpManager.address
    )

    // allow rewardRouter to stake in stakedSgxTracker
    await stakedSgxTracker.setHandler(rewardRouter.address, true)
    // allow bonusSgxTracker to stake stakedSgxTracker
    await stakedSgxTracker.setHandler(bonusSgxTracker.address, true)
    // allow rewardRouter to stake in bonusSgxTracker
    await bonusSgxTracker.setHandler(rewardRouter.address, true)
    // allow bonusSgxTracker to stake feeSgxTracker
    await bonusSgxTracker.setHandler(feeSgxTracker.address, true)
    await bonusSgxDistributor.setBonusMultiplier(10000)
    // allow rewardRouter to stake in feeSgxTracker
    await feeSgxTracker.setHandler(rewardRouter.address, true)
    // allow feeSgxTracker to stake bnSgx
    await bnSgx.setHandler(feeSgxTracker.address, true)
    // allow rewardRouter to burn bnSgx
    await bnSgx.setMinter(rewardRouter.address, true)

    // allow rewardRouter to mint in sgxlpManager
    await sgxlpManager.setHandler(rewardRouter.address, true)
    // allow rewardRouter to stake in feeSgxLpTracker
    await feeSgxLpTracker.setHandler(rewardRouter.address, true)
    // allow stakedSgxLpTracker to stake feeSgxLpTracker
    await feeSgxLpTracker.setHandler(stakedSgxLpTracker.address, true)
    // allow rewardRouter to sake in stakedSgxLpTracker
    await stakedSgxLpTracker.setHandler(rewardRouter.address, true)
    // allow feeSgxLpTracker to stake sgxlp
    await sgxlp.setHandler(feeSgxLpTracker.address, true)

    // mint esSgx for distributors
    await esSgx.setMinter(wallet.address, true)
    await esSgx.mint(stakedSgxDistributor.address, expandDecimals(50000, 18))
    await stakedSgxDistributor.setTokensPerInterval("20667989410000000") // 0.02066798941 esSgx per second
    await esSgx.mint(stakedSgxLpDistributor.address, expandDecimals(50000, 18))
    await stakedSgxLpDistributor.setTokensPerInterval("20667989410000000") // 0.02066798941 esSgx per second

    await esSgx.setInPrivateTransferMode(true)
    await esSgx.setHandler(stakedSgxDistributor.address, true)
    await esSgx.setHandler(stakedSgxLpDistributor.address, true)
    await esSgx.setHandler(stakedSgxTracker.address, true)
    await esSgx.setHandler(stakedSgxLpTracker.address, true)
    await esSgx.setHandler(rewardRouter.address, true)

    // mint bnSgx for distributor
    await bnSgx.setMinter(wallet.address, true)
    await bnSgx.mint(bonusSgxDistributor.address, expandDecimals(1500, 18))
  })

  it("inits", async () => {
    expect(await rewardRouter.isInitialized()).eq(true)

    expect(await rewardRouter.weth()).eq(bnb.address)
    expect(await rewardRouter.sgx()).eq(sgx.address)
    expect(await rewardRouter.esSgx()).eq(esSgx.address)
    expect(await rewardRouter.bnSgx()).eq(bnSgx.address)

    expect(await rewardRouter.sgxlp()).eq(sgxlp.address)

    expect(await rewardRouter.stakedSgxTracker()).eq(stakedSgxTracker.address)
    expect(await rewardRouter.bonusSgxTracker()).eq(bonusSgxTracker.address)
    expect(await rewardRouter.feeSgxTracker()).eq(feeSgxTracker.address)

    expect(await rewardRouter.feeSgxLpTracker()).eq(feeSgxLpTracker.address)
    expect(await rewardRouter.stakedSgxLpTracker()).eq(stakedSgxLpTracker.address)

    expect(await rewardRouter.sgxlpManager()).eq(sgxlpManager.address)

    await expect(rewardRouter.initialize(
      bnb.address,
      sgx.address,
      esSgx.address,
      bnSgx.address,
      sgxlp.address,
      stakedSgxTracker.address,
      bonusSgxTracker.address,
      feeSgxTracker.address,
      feeSgxLpTracker.address,
      stakedSgxLpTracker.address,
      sgxlpManager.address
    )).to.be.revertedWith("RewardRouter: already initialized")
  })

  it("stakeSgxForAccount, stakeSgx, stakeEsSgx, unstakeSgx, unstakeEsSgx, claimEsSgx, claimFees, compound, batchCompoundForAccounts", async () => {
    await eth.mint(feeSgxDistributor.address, expandDecimals(100, 18))
    await feeSgxDistributor.setTokensPerInterval("41335970000000") // 0.00004133597 ETH per second

    await sgx.setMinter(wallet.address, true)
    await sgx.mint(user0.address, expandDecimals(1500, 18))
    expect(await sgx.balanceOf(user0.address)).eq(expandDecimals(1500, 18))

    await sgx.connect(user0).approve(stakedSgxTracker.address, expandDecimals(1000, 18))
    await expect(rewardRouter.connect(user0).stakeSgxForAccount(user1.address, expandDecimals(1000, 18)))
      .to.be.revertedWith("Governable: forbidden")

    await rewardRouter.setGov(user0.address)
    await rewardRouter.connect(user0).stakeSgxForAccount(user1.address, expandDecimals(800, 18))
    expect(await sgx.balanceOf(user0.address)).eq(expandDecimals(700, 18))

    await sgx.mint(user1.address, expandDecimals(200, 18))
    expect(await sgx.balanceOf(user1.address)).eq(expandDecimals(200, 18))
    await sgx.connect(user1).approve(stakedSgxTracker.address, expandDecimals(200, 18))
    await rewardRouter.connect(user1).stakeSgx(expandDecimals(200, 18))
    expect(await sgx.balanceOf(user1.address)).eq(0)

    expect(await stakedSgxTracker.stakedAmounts(user0.address)).eq(0)
    expect(await stakedSgxTracker.depositBalances(user0.address, sgx.address)).eq(0)
    expect(await stakedSgxTracker.stakedAmounts(user1.address)).eq(expandDecimals(1000, 18))
    expect(await stakedSgxTracker.depositBalances(user1.address, sgx.address)).eq(expandDecimals(1000, 18))

    expect(await bonusSgxTracker.stakedAmounts(user0.address)).eq(0)
    expect(await bonusSgxTracker.depositBalances(user0.address, stakedSgxTracker.address)).eq(0)
    expect(await bonusSgxTracker.stakedAmounts(user1.address)).eq(expandDecimals(1000, 18))
    expect(await bonusSgxTracker.depositBalances(user1.address, stakedSgxTracker.address)).eq(expandDecimals(1000, 18))

    expect(await feeSgxTracker.stakedAmounts(user0.address)).eq(0)
    expect(await feeSgxTracker.depositBalances(user0.address, bonusSgxTracker.address)).eq(0)
    expect(await feeSgxTracker.stakedAmounts(user1.address)).eq(expandDecimals(1000, 18))
    expect(await feeSgxTracker.depositBalances(user1.address, bonusSgxTracker.address)).eq(expandDecimals(1000, 18))

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    expect(await stakedSgxTracker.claimable(user0.address)).eq(0)
    expect(await stakedSgxTracker.claimable(user1.address)).gt(expandDecimals(1785, 18)) // 50000 / 28 => ~1785
    expect(await stakedSgxTracker.claimable(user1.address)).lt(expandDecimals(1786, 18))

    expect(await bonusSgxTracker.claimable(user0.address)).eq(0)
    expect(await bonusSgxTracker.claimable(user1.address)).gt("2730000000000000000") // 2.73, 1000 / 365 => ~2.74
    expect(await bonusSgxTracker.claimable(user1.address)).lt("2750000000000000000") // 2.75

    expect(await feeSgxTracker.claimable(user0.address)).eq(0)
    expect(await feeSgxTracker.claimable(user1.address)).gt("3560000000000000000") // 3.56, 100 / 28 => ~3.57
    expect(await feeSgxTracker.claimable(user1.address)).lt("3580000000000000000") // 3.58

    await esSgx.setMinter(wallet.address, true)
    await esSgx.mint(user2.address, expandDecimals(500, 18))
    await rewardRouter.connect(user2).stakeEsSgx(expandDecimals(500, 18))

    expect(await stakedSgxTracker.stakedAmounts(user0.address)).eq(0)
    expect(await stakedSgxTracker.depositBalances(user0.address, sgx.address)).eq(0)
    expect(await stakedSgxTracker.stakedAmounts(user1.address)).eq(expandDecimals(1000, 18))
    expect(await stakedSgxTracker.depositBalances(user1.address, sgx.address)).eq(expandDecimals(1000, 18))
    expect(await stakedSgxTracker.stakedAmounts(user2.address)).eq(expandDecimals(500, 18))
    expect(await stakedSgxTracker.depositBalances(user2.address, esSgx.address)).eq(expandDecimals(500, 18))

    expect(await bonusSgxTracker.stakedAmounts(user0.address)).eq(0)
    expect(await bonusSgxTracker.depositBalances(user0.address, stakedSgxTracker.address)).eq(0)
    expect(await bonusSgxTracker.stakedAmounts(user1.address)).eq(expandDecimals(1000, 18))
    expect(await bonusSgxTracker.depositBalances(user1.address, stakedSgxTracker.address)).eq(expandDecimals(1000, 18))
    expect(await bonusSgxTracker.stakedAmounts(user2.address)).eq(expandDecimals(500, 18))
    expect(await bonusSgxTracker.depositBalances(user2.address, stakedSgxTracker.address)).eq(expandDecimals(500, 18))

    expect(await feeSgxTracker.stakedAmounts(user0.address)).eq(0)
    expect(await feeSgxTracker.depositBalances(user0.address, bonusSgxTracker.address)).eq(0)
    expect(await feeSgxTracker.stakedAmounts(user1.address)).eq(expandDecimals(1000, 18))
    expect(await feeSgxTracker.depositBalances(user1.address, bonusSgxTracker.address)).eq(expandDecimals(1000, 18))
    expect(await feeSgxTracker.stakedAmounts(user2.address)).eq(expandDecimals(500, 18))
    expect(await feeSgxTracker.depositBalances(user2.address, bonusSgxTracker.address)).eq(expandDecimals(500, 18))

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    expect(await stakedSgxTracker.claimable(user0.address)).eq(0)
    expect(await stakedSgxTracker.claimable(user1.address)).gt(expandDecimals(1785 + 1190, 18))
    expect(await stakedSgxTracker.claimable(user1.address)).lt(expandDecimals(1786 + 1191, 18))
    expect(await stakedSgxTracker.claimable(user2.address)).gt(expandDecimals(595, 18))
    expect(await stakedSgxTracker.claimable(user2.address)).lt(expandDecimals(596, 18))

    expect(await bonusSgxTracker.claimable(user0.address)).eq(0)
    expect(await bonusSgxTracker.claimable(user1.address)).gt("5470000000000000000") // 5.47, 1000 / 365 * 2 => ~5.48
    expect(await bonusSgxTracker.claimable(user1.address)).lt("5490000000000000000")
    expect(await bonusSgxTracker.claimable(user2.address)).gt("1360000000000000000") // 1.36, 500 / 365 => ~1.37
    expect(await bonusSgxTracker.claimable(user2.address)).lt("1380000000000000000")

    expect(await feeSgxTracker.claimable(user0.address)).eq(0)
    expect(await feeSgxTracker.claimable(user1.address)).gt("5940000000000000000") // 5.94, 3.57 + 100 / 28 / 3 * 2 => ~5.95
    expect(await feeSgxTracker.claimable(user1.address)).lt("5960000000000000000")
    expect(await feeSgxTracker.claimable(user2.address)).gt("1180000000000000000") // 1.18, 100 / 28 / 3 => ~1.19
    expect(await feeSgxTracker.claimable(user2.address)).lt("1200000000000000000")

    expect(await esSgx.balanceOf(user1.address)).eq(0)
    await rewardRouter.connect(user1).claimEsSgx()
    expect(await esSgx.balanceOf(user1.address)).gt(expandDecimals(1785 + 1190, 18))
    expect(await esSgx.balanceOf(user1.address)).lt(expandDecimals(1786 + 1191, 18))

    expect(await eth.balanceOf(user1.address)).eq(0)
    await rewardRouter.connect(user1).claimFees()
    expect(await eth.balanceOf(user1.address)).gt("5940000000000000000")
    expect(await eth.balanceOf(user1.address)).lt("5960000000000000000")

    expect(await esSgx.balanceOf(user2.address)).eq(0)
    await rewardRouter.connect(user2).claimEsSgx()
    expect(await esSgx.balanceOf(user2.address)).gt(expandDecimals(595, 18))
    expect(await esSgx.balanceOf(user2.address)).lt(expandDecimals(596, 18))

    expect(await eth.balanceOf(user2.address)).eq(0)
    await rewardRouter.connect(user2).claimFees()
    expect(await eth.balanceOf(user2.address)).gt("1180000000000000000")
    expect(await eth.balanceOf(user2.address)).lt("1200000000000000000")

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    const tx0 = await rewardRouter.connect(user1).compound()
    await reportGasUsed(provider, tx0, "compound gas used")

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    const tx1 = await rewardRouter.connect(user0).batchCompoundForAccounts([user1.address, user2.address])
    await reportGasUsed(provider, tx1, "batchCompoundForAccounts gas used")

    expect(await stakedSgxTracker.stakedAmounts(user1.address)).gt(expandDecimals(3643, 18))
    expect(await stakedSgxTracker.stakedAmounts(user1.address)).lt(expandDecimals(3645, 18))
    expect(await stakedSgxTracker.depositBalances(user1.address, sgx.address)).eq(expandDecimals(1000, 18))
    expect(await stakedSgxTracker.depositBalances(user1.address, esSgx.address)).gt(expandDecimals(2643, 18))
    expect(await stakedSgxTracker.depositBalances(user1.address, esSgx.address)).lt(expandDecimals(2645, 18))

    expect(await bonusSgxTracker.stakedAmounts(user1.address)).gt(expandDecimals(3643, 18))
    expect(await bonusSgxTracker.stakedAmounts(user1.address)).lt(expandDecimals(3645, 18))

    expect(await feeSgxTracker.stakedAmounts(user1.address)).gt(expandDecimals(3657, 18))
    expect(await feeSgxTracker.stakedAmounts(user1.address)).lt(expandDecimals(3659, 18))
    expect(await feeSgxTracker.depositBalances(user1.address, bonusSgxTracker.address)).gt(expandDecimals(3643, 18))
    expect(await feeSgxTracker.depositBalances(user1.address, bonusSgxTracker.address)).lt(expandDecimals(3645, 18))
    expect(await feeSgxTracker.depositBalances(user1.address, bnSgx.address)).gt("14100000000000000000") // 14.1
    expect(await feeSgxTracker.depositBalances(user1.address, bnSgx.address)).lt("14300000000000000000") // 14.3

    expect(await sgx.balanceOf(user1.address)).eq(0)
    await rewardRouter.connect(user1).unstakeSgx(expandDecimals(300, 18))
    expect(await sgx.balanceOf(user1.address)).eq(expandDecimals(300, 18))

    expect(await stakedSgxTracker.stakedAmounts(user1.address)).gt(expandDecimals(3343, 18))
    expect(await stakedSgxTracker.stakedAmounts(user1.address)).lt(expandDecimals(3345, 18))
    expect(await stakedSgxTracker.depositBalances(user1.address, sgx.address)).eq(expandDecimals(700, 18))
    expect(await stakedSgxTracker.depositBalances(user1.address, esSgx.address)).gt(expandDecimals(2643, 18))
    expect(await stakedSgxTracker.depositBalances(user1.address, esSgx.address)).lt(expandDecimals(2645, 18))

    expect(await bonusSgxTracker.stakedAmounts(user1.address)).gt(expandDecimals(3343, 18))
    expect(await bonusSgxTracker.stakedAmounts(user1.address)).lt(expandDecimals(3345, 18))

    expect(await feeSgxTracker.stakedAmounts(user1.address)).gt(expandDecimals(3357, 18))
    expect(await feeSgxTracker.stakedAmounts(user1.address)).lt(expandDecimals(3359, 18))
    expect(await feeSgxTracker.depositBalances(user1.address, bonusSgxTracker.address)).gt(expandDecimals(3343, 18))
    expect(await feeSgxTracker.depositBalances(user1.address, bonusSgxTracker.address)).lt(expandDecimals(3345, 18))
    expect(await feeSgxTracker.depositBalances(user1.address, bnSgx.address)).gt("13000000000000000000") // 13
    expect(await feeSgxTracker.depositBalances(user1.address, bnSgx.address)).lt("13100000000000000000") // 13.1

    const esSgxBalance1 = await esSgx.balanceOf(user1.address)
    const esSgxUnstakeBalance1 = await stakedSgxTracker.depositBalances(user1.address, esSgx.address)
    await rewardRouter.connect(user1).unstakeEsSgx(esSgxUnstakeBalance1)
    expect(await esSgx.balanceOf(user1.address)).eq(esSgxBalance1.add(esSgxUnstakeBalance1))

    expect(await stakedSgxTracker.stakedAmounts(user1.address)).eq(expandDecimals(700, 18))
    expect(await stakedSgxTracker.depositBalances(user1.address, sgx.address)).eq(expandDecimals(700, 18))
    expect(await stakedSgxTracker.depositBalances(user1.address, esSgx.address)).eq(0)

    expect(await bonusSgxTracker.stakedAmounts(user1.address)).eq(expandDecimals(700, 18))

    expect(await feeSgxTracker.stakedAmounts(user1.address)).gt(expandDecimals(702, 18))
    expect(await feeSgxTracker.stakedAmounts(user1.address)).lt(expandDecimals(703, 18))
    expect(await feeSgxTracker.depositBalances(user1.address, bonusSgxTracker.address)).eq(expandDecimals(700, 18))
    expect(await feeSgxTracker.depositBalances(user1.address, bnSgx.address)).gt("2720000000000000000") // 2.72
    expect(await feeSgxTracker.depositBalances(user1.address, bnSgx.address)).lt("2740000000000000000") // 2.74

    await expect(rewardRouter.connect(user1).unstakeEsSgx(expandDecimals(1, 18)))
      .to.be.revertedWith("RewardTracker: _amount exceeds depositBalance")
  })

  it("mintAndStakeSgxLp, unstakeAndRedeemSgxLp, compound, batchCompoundForAccounts", async () => {
    await eth.mint(feeSgxLpDistributor.address, expandDecimals(100, 18))
    await feeSgxLpDistributor.setTokensPerInterval("41335970000000") // 0.00004133597 ETH per second

    await bnb.mint(user1.address, expandDecimals(1, 18))
    await bnb.connect(user1).approve(sgxlpManager.address, expandDecimals(1, 18))
    const tx0 = await rewardRouter.connect(user1).mintAndStakeSgxLp(
      bnb.address,
      expandDecimals(1, 18),
      expandDecimals(299, 18),
      expandDecimals(299, 18)
    )
    await reportGasUsed(provider, tx0, "mintAndStakeSgxLp gas used")

    expect(await feeSgxLpTracker.stakedAmounts(user1.address)).eq(expandDecimals(2991, 17))
    expect(await feeSgxLpTracker.depositBalances(user1.address, sgxlp.address)).eq(expandDecimals(2991, 17))

    expect(await stakedSgxLpTracker.stakedAmounts(user1.address)).eq(expandDecimals(2991, 17))
    expect(await stakedSgxLpTracker.depositBalances(user1.address, feeSgxLpTracker.address)).eq(expandDecimals(2991, 17))

    await bnb.mint(user1.address, expandDecimals(2, 18))
    await bnb.connect(user1).approve(sgxlpManager.address, expandDecimals(2, 18))
    await rewardRouter.connect(user1).mintAndStakeSgxLp(
      bnb.address,
      expandDecimals(2, 18),
      expandDecimals(299, 18),
      expandDecimals(299, 18)
    )

    await increaseTime(provider, 24 * 60 * 60 + 1)
    await mineBlock(provider)

    expect(await feeSgxLpTracker.claimable(user1.address)).gt("3560000000000000000") // 3.56, 100 / 28 => ~3.57
    expect(await feeSgxLpTracker.claimable(user1.address)).lt("3580000000000000000") // 3.58

    expect(await stakedSgxLpTracker.claimable(user1.address)).gt(expandDecimals(1785, 18)) // 50000 / 28 => ~1785
    expect(await stakedSgxLpTracker.claimable(user1.address)).lt(expandDecimals(1786, 18))

    await bnb.mint(user2.address, expandDecimals(1, 18))
    await bnb.connect(user2).approve(sgxlpManager.address, expandDecimals(1, 18))
    await rewardRouter.connect(user2).mintAndStakeSgxLp(
      bnb.address,
      expandDecimals(1, 18),
      expandDecimals(299, 18),
      expandDecimals(299, 18)
    )

    await expect(rewardRouter.connect(user2).unstakeAndRedeemSgxLp(
      bnb.address,
      expandDecimals(299, 18),
      "990000000000000000", // 0.99
      user2.address
    )).to.be.revertedWith("SgxLpManager: cooldown duration not yet passed")

    expect(await feeSgxLpTracker.stakedAmounts(user1.address)).eq("897300000000000000000") // 897.3
    expect(await stakedSgxLpTracker.stakedAmounts(user1.address)).eq("897300000000000000000")
    expect(await bnb.balanceOf(user1.address)).eq(0)

    const tx1 = await rewardRouter.connect(user1).unstakeAndRedeemSgxLp(
      bnb.address,
      expandDecimals(299, 18),
      "990000000000000000", // 0.99
      user1.address
    )
    await reportGasUsed(provider, tx1, "unstakeAndRedeemSgxLp gas used")

    expect(await feeSgxLpTracker.stakedAmounts(user1.address)).eq("598300000000000000000") // 598.3
    expect(await stakedSgxLpTracker.stakedAmounts(user1.address)).eq("598300000000000000000")
    expect(await bnb.balanceOf(user1.address)).eq("993676666666666666") // ~0.99

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    expect(await feeSgxLpTracker.claimable(user1.address)).gt("5940000000000000000") // 5.94, 3.57 + 100 / 28 / 3 * 2 => ~5.95
    expect(await feeSgxLpTracker.claimable(user1.address)).lt("5960000000000000000")
    expect(await feeSgxLpTracker.claimable(user2.address)).gt("1180000000000000000") // 1.18, 100 / 28 / 3 => ~1.19
    expect(await feeSgxLpTracker.claimable(user2.address)).lt("1200000000000000000")

    expect(await stakedSgxLpTracker.claimable(user1.address)).gt(expandDecimals(1785 + 1190, 18))
    expect(await stakedSgxLpTracker.claimable(user1.address)).lt(expandDecimals(1786 + 1191, 18))
    expect(await stakedSgxLpTracker.claimable(user2.address)).gt(expandDecimals(595, 18))
    expect(await stakedSgxLpTracker.claimable(user2.address)).lt(expandDecimals(596, 18))

    expect(await esSgx.balanceOf(user1.address)).eq(0)
    await rewardRouter.connect(user1).claimEsSgx()
    expect(await esSgx.balanceOf(user1.address)).gt(expandDecimals(1785 + 1190, 18))
    expect(await esSgx.balanceOf(user1.address)).lt(expandDecimals(1786 + 1191, 18))

    expect(await eth.balanceOf(user1.address)).eq(0)
    await rewardRouter.connect(user1).claimFees()
    expect(await eth.balanceOf(user1.address)).gt("5940000000000000000")
    expect(await eth.balanceOf(user1.address)).lt("5960000000000000000")

    expect(await esSgx.balanceOf(user2.address)).eq(0)
    await rewardRouter.connect(user2).claimEsSgx()
    expect(await esSgx.balanceOf(user2.address)).gt(expandDecimals(595, 18))
    expect(await esSgx.balanceOf(user2.address)).lt(expandDecimals(596, 18))

    expect(await eth.balanceOf(user2.address)).eq(0)
    await rewardRouter.connect(user2).claimFees()
    expect(await eth.balanceOf(user2.address)).gt("1180000000000000000")
    expect(await eth.balanceOf(user2.address)).lt("1200000000000000000")

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    const tx2 = await rewardRouter.connect(user1).compound()
    await reportGasUsed(provider, tx2, "compound gas used")

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    const tx3 = await rewardRouter.batchCompoundForAccounts([user1.address, user2.address])
    await reportGasUsed(provider, tx1, "batchCompoundForAccounts gas used")

    expect(await stakedSgxTracker.stakedAmounts(user1.address)).gt(expandDecimals(4165, 18))
    expect(await stakedSgxTracker.stakedAmounts(user1.address)).lt(expandDecimals(4167, 18))
    expect(await stakedSgxTracker.depositBalances(user1.address, sgx.address)).eq(0)
    expect(await stakedSgxTracker.depositBalances(user1.address, esSgx.address)).gt(expandDecimals(4165, 18))
    expect(await stakedSgxTracker.depositBalances(user1.address, esSgx.address)).lt(expandDecimals(4167, 18))

    expect(await bonusSgxTracker.stakedAmounts(user1.address)).gt(expandDecimals(4165, 18))
    expect(await bonusSgxTracker.stakedAmounts(user1.address)).lt(expandDecimals(4167, 18))

    expect(await feeSgxTracker.stakedAmounts(user1.address)).gt(expandDecimals(4179, 18))
    expect(await feeSgxTracker.stakedAmounts(user1.address)).lt(expandDecimals(4180, 18))
    expect(await feeSgxTracker.depositBalances(user1.address, bonusSgxTracker.address)).gt(expandDecimals(4165, 18))
    expect(await feeSgxTracker.depositBalances(user1.address, bonusSgxTracker.address)).lt(expandDecimals(4167, 18))
    expect(await feeSgxTracker.depositBalances(user1.address, bnSgx.address)).gt("12900000000000000000") // 12.9
    expect(await feeSgxTracker.depositBalances(user1.address, bnSgx.address)).lt("13100000000000000000") // 13.1

    expect(await feeSgxLpTracker.stakedAmounts(user1.address)).eq("598300000000000000000") // 598.3
    expect(await stakedSgxLpTracker.stakedAmounts(user1.address)).eq("598300000000000000000")
    expect(await bnb.balanceOf(user1.address)).eq("993676666666666666") // ~0.99
  })

  it("mintAndStakeSgxLpETH, unstakeAndRedeemSgxLpETH", async () => {
    const receiver0 = newWallet()
    await expect(rewardRouter.connect(user0).mintAndStakeSgxLpETH(expandDecimals(300, 18), expandDecimals(300, 18), { value: 0 }))
      .to.be.revertedWith("RewardRouter: invalid msg.value")

    await expect(rewardRouter.connect(user0).mintAndStakeSgxLpETH(expandDecimals(300, 18), expandDecimals(300, 18), { value: expandDecimals(1, 18) }))
      .to.be.revertedWith("SgxLpManager: insufficient USDG output")

    await expect(rewardRouter.connect(user0).mintAndStakeSgxLpETH(expandDecimals(299, 18), expandDecimals(300, 18), { value: expandDecimals(1, 18) }))
      .to.be.revertedWith("SgxLpManager: insufficient SGXLP output")

    expect(await bnb.balanceOf(user0.address)).eq(0)
    expect(await bnb.balanceOf(vault.address)).eq(0)
    expect(await bnb.totalSupply()).eq(0)
    expect(await provider.getBalance(bnb.address)).eq(0)
    expect(await stakedSgxLpTracker.balanceOf(user0.address)).eq(0)

    await rewardRouter.connect(user0).mintAndStakeSgxLpETH(expandDecimals(299, 18), expandDecimals(299, 18), { value: expandDecimals(1, 18) })

    expect(await bnb.balanceOf(user0.address)).eq(0)
    expect(await bnb.balanceOf(vault.address)).eq(expandDecimals(1, 18))
    expect(await provider.getBalance(bnb.address)).eq(expandDecimals(1, 18))
    expect(await bnb.totalSupply()).eq(expandDecimals(1, 18))
    expect(await stakedSgxLpTracker.balanceOf(user0.address)).eq("299100000000000000000") // 299.1

    await expect(rewardRouter.connect(user0).unstakeAndRedeemSgxLpETH(expandDecimals(300, 18), expandDecimals(1, 18), receiver0.address))
      .to.be.revertedWith("RewardTracker: _amount exceeds stakedAmount")

    await expect(rewardRouter.connect(user0).unstakeAndRedeemSgxLpETH("299100000000000000000", expandDecimals(1, 18), receiver0.address))
      .to.be.revertedWith("SgxLpManager: cooldown duration not yet passed")

    await increaseTime(provider, 24 * 60 * 60 + 10)

    await expect(rewardRouter.connect(user0).unstakeAndRedeemSgxLpETH("299100000000000000000", expandDecimals(1, 18), receiver0.address))
      .to.be.revertedWith("SgxLpManager: insufficient output")

    await rewardRouter.connect(user0).unstakeAndRedeemSgxLpETH("299100000000000000000", "990000000000000000", receiver0.address)
    expect(await provider.getBalance(receiver0.address)).eq("994009000000000000") // 0.994009
    expect(await bnb.balanceOf(vault.address)).eq("5991000000000000") // 0.005991
    expect(await provider.getBalance(bnb.address)).eq("5991000000000000")
    expect(await bnb.totalSupply()).eq("5991000000000000")
  })
})
