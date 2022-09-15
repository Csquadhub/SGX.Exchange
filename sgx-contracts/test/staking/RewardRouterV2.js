const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { deployContract } = require("../shared/fixtures")
const { expandDecimals, getBlockTime, increaseTime, mineBlock, reportGasUsed, print, newWallet } = require("../shared/utilities")
const { toChainlinkPrice } = require("../shared/chainlink")
const { toUsd, toNormalizedPrice } = require("../shared/units")
const { initVault, getBnbConfig, getBtcConfig, getDaiConfig } = require("../core/Vault/helpers")

use(solidity)

describe("RewardRouterV2", function () {
  const provider = waffle.provider
  const [wallet, user0, user1, user2, user3, user4, tokenManager] = provider.getWallets()

  const vestingDuration = 365 * 24 * 60 * 60

  let timelock

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

  let sgxVester
  let sgxlpVester

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

    timelock = await deployContract("Timelock", [
      wallet.address,
      10,
      tokenManager.address,
      tokenManager.address,
      sgxlpManager.address,
      expandDecimals(1000000, 18),
      10,
      100
    ])

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

    sgxVester = await deployContract("Vester", [
      "Vested SGX", // _name
      "vSGX", // _symbol
      vestingDuration, // _vestingDuration
      esSgx.address, // _esToken
      feeSgxTracker.address, // _pairToken
      sgx.address, // _claimableToken
      stakedSgxTracker.address, // _rewardTracker
    ])

    sgxlpVester = await deployContract("Vester", [
      "Vested SGXLP", // _name
      "vSGXLP", // _symbol
      vestingDuration, // _vestingDuration
      esSgx.address, // _esToken
      stakedSgxLpTracker.address, // _pairToken
      sgx.address, // _claimableToken
      stakedSgxLpTracker.address, // _rewardTracker
    ])

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

    await esSgx.setInPrivateTransferMode(true)

    rewardRouter = await deployContract("RewardRouterV2", [])
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
      sgxlpManager.address,
      sgxVester.address,
      sgxlpVester.address
    )

    // allow bonusSgxTracker to stake stakedSgxTracker
    await stakedSgxTracker.setHandler(bonusSgxTracker.address, true)
    // allow bonusSgxTracker to stake feeSgxTracker
    await bonusSgxTracker.setHandler(feeSgxTracker.address, true)
    await bonusSgxDistributor.setBonusMultiplier(10000)
    // allow feeSgxTracker to stake bnSgx
    await bnSgx.setHandler(feeSgxTracker.address, true)

    // allow stakedSgxLpTracker to stake feeSgxLpTracker
    await feeSgxLpTracker.setHandler(stakedSgxLpTracker.address, true)
    // allow feeSgxLpTracker to stake sgxlp
    await sgxlp.setHandler(feeSgxLpTracker.address, true)

    // mint esSgx for distributors
    await esSgx.setMinter(wallet.address, true)
    await esSgx.mint(stakedSgxDistributor.address, expandDecimals(50000, 18))
    await stakedSgxDistributor.setTokensPerInterval("20667989410000000") // 0.02066798941 esSgx per second
    await esSgx.mint(stakedSgxLpDistributor.address, expandDecimals(50000, 18))
    await stakedSgxLpDistributor.setTokensPerInterval("20667989410000000") // 0.02066798941 esSgx per second

    // mint bnSgx for distributor
    await bnSgx.setMinter(wallet.address, true)
    await bnSgx.mint(bonusSgxDistributor.address, expandDecimals(1500, 18))

    await esSgx.setHandler(tokenManager.address, true)
    await sgxVester.setHandler(wallet.address, true)

    await esSgx.setHandler(rewardRouter.address, true)
    await esSgx.setHandler(stakedSgxDistributor.address, true)
    await esSgx.setHandler(stakedSgxLpDistributor.address, true)
    await esSgx.setHandler(stakedSgxTracker.address, true)
    await esSgx.setHandler(stakedSgxLpTracker.address, true)
    await esSgx.setHandler(sgxVester.address, true)
    await esSgx.setHandler(sgxlpVester.address, true)

    await sgxlpManager.setHandler(rewardRouter.address, true)
    await stakedSgxTracker.setHandler(rewardRouter.address, true)
    await bonusSgxTracker.setHandler(rewardRouter.address, true)
    await feeSgxTracker.setHandler(rewardRouter.address, true)
    await feeSgxLpTracker.setHandler(rewardRouter.address, true)
    await stakedSgxLpTracker.setHandler(rewardRouter.address, true)

    await esSgx.setHandler(rewardRouter.address, true)
    await bnSgx.setMinter(rewardRouter.address, true)
    await esSgx.setMinter(sgxVester.address, true)
    await esSgx.setMinter(sgxlpVester.address, true)

    await sgxVester.setHandler(rewardRouter.address, true)
    await sgxlpVester.setHandler(rewardRouter.address, true)

    await feeSgxTracker.setHandler(sgxVester.address, true)
    await stakedSgxLpTracker.setHandler(sgxlpVester.address, true)

    await sgxlpManager.setGov(timelock.address)
    await stakedSgxTracker.setGov(timelock.address)
    await bonusSgxTracker.setGov(timelock.address)
    await feeSgxTracker.setGov(timelock.address)
    await feeSgxLpTracker.setGov(timelock.address)
    await stakedSgxLpTracker.setGov(timelock.address)
    await stakedSgxDistributor.setGov(timelock.address)
    await stakedSgxLpDistributor.setGov(timelock.address)
    await esSgx.setGov(timelock.address)
    await bnSgx.setGov(timelock.address)
    await sgxVester.setGov(timelock.address)
    await sgxlpVester.setGov(timelock.address)    
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

    expect(await rewardRouter.sgxVester()).eq(sgxVester.address)
    expect(await rewardRouter.sgxlpVester()).eq(sgxlpVester.address)

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
      sgxlpManager.address,
      sgxVester.address,
      sgxlpVester.address
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

    await esSgx.mint(tokenManager.address, expandDecimals(500, 18))
    await esSgx.connect(tokenManager).transfer(user2.address, expandDecimals(500, 18))
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

  it("sgx: signalTransfer, acceptTransfer", async () =>{
    await sgx.setMinter(wallet.address, true)
    await sgx.mint(user1.address, expandDecimals(200, 18))
    expect(await sgx.balanceOf(user1.address)).eq(expandDecimals(200, 18))
    await sgx.connect(user1).approve(stakedSgxTracker.address, expandDecimals(200, 18))
    await rewardRouter.connect(user1).stakeSgx(expandDecimals(200, 18))
    expect(await sgx.balanceOf(user1.address)).eq(0)

    await sgx.mint(user2.address, expandDecimals(200, 18))
    expect(await sgx.balanceOf(user2.address)).eq(expandDecimals(200, 18))
    await sgx.connect(user2).approve(stakedSgxTracker.address, expandDecimals(400, 18))
    await rewardRouter.connect(user2).stakeSgx(expandDecimals(200, 18))
    expect(await sgx.balanceOf(user2.address)).eq(0)

    await rewardRouter.connect(user2).signalTransfer(user1.address)

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    await rewardRouter.connect(user2).signalTransfer(user1.address)
    await rewardRouter.connect(user1).claim()

    await expect(rewardRouter.connect(user2).signalTransfer(user1.address))
      .to.be.revertedWith("RewardRouter: stakedSgxTracker.averageStakedAmounts > 0")

    await rewardRouter.connect(user2).signalTransfer(user3.address)

    await expect(rewardRouter.connect(user3).acceptTransfer(user1.address))
      .to.be.revertedWith("RewardRouter: transfer not signalled")

    await sgxVester.setBonusRewards(user2.address, expandDecimals(100, 18))

    expect(await stakedSgxTracker.depositBalances(user2.address, sgx.address)).eq(expandDecimals(200, 18))
    expect(await stakedSgxTracker.depositBalances(user2.address, esSgx.address)).eq(0)
    expect(await feeSgxTracker.depositBalances(user2.address, bnSgx.address)).eq(0)
    expect(await stakedSgxTracker.depositBalances(user3.address, sgx.address)).eq(0)
    expect(await stakedSgxTracker.depositBalances(user3.address, esSgx.address)).eq(0)
    expect(await feeSgxTracker.depositBalances(user3.address, bnSgx.address)).eq(0)
    expect(await sgxVester.transferredAverageStakedAmounts(user3.address)).eq(0)
    expect(await sgxVester.transferredCumulativeRewards(user3.address)).eq(0)
    expect(await sgxVester.bonusRewards(user2.address)).eq(expandDecimals(100, 18))
    expect(await sgxVester.bonusRewards(user3.address)).eq(0)
    expect(await sgxVester.getCombinedAverageStakedAmount(user2.address)).eq(0)
    expect(await sgxVester.getCombinedAverageStakedAmount(user3.address)).eq(0)
    expect(await sgxVester.getMaxVestableAmount(user2.address)).eq(expandDecimals(100, 18))
    expect(await sgxVester.getMaxVestableAmount(user3.address)).eq(0)
    expect(await sgxVester.getPairAmount(user2.address, expandDecimals(892, 18))).eq(0)
    expect(await sgxVester.getPairAmount(user3.address, expandDecimals(892, 18))).eq(0)

    await rewardRouter.connect(user3).acceptTransfer(user2.address)

    expect(await stakedSgxTracker.depositBalances(user2.address, sgx.address)).eq(0)
    expect(await stakedSgxTracker.depositBalances(user2.address, esSgx.address)).eq(0)
    expect(await feeSgxTracker.depositBalances(user2.address, bnSgx.address)).eq(0)
    expect(await stakedSgxTracker.depositBalances(user3.address, sgx.address)).eq(expandDecimals(200, 18))
    expect(await stakedSgxTracker.depositBalances(user3.address, esSgx.address)).gt(expandDecimals(892, 18))
    expect(await stakedSgxTracker.depositBalances(user3.address, esSgx.address)).lt(expandDecimals(893, 18))
    expect(await feeSgxTracker.depositBalances(user3.address, bnSgx.address)).gt("547000000000000000") // 0.547
    expect(await feeSgxTracker.depositBalances(user3.address, bnSgx.address)).lt("549000000000000000") // 0.548
    expect(await sgxVester.transferredAverageStakedAmounts(user3.address)).eq(expandDecimals(200, 18))
    expect(await sgxVester.transferredCumulativeRewards(user3.address)).gt(expandDecimals(892, 18))
    expect(await sgxVester.transferredCumulativeRewards(user3.address)).lt(expandDecimals(893, 18))
    expect(await sgxVester.bonusRewards(user2.address)).eq(0)
    expect(await sgxVester.bonusRewards(user3.address)).eq(expandDecimals(100, 18))
    expect(await sgxVester.getCombinedAverageStakedAmount(user2.address)).eq(expandDecimals(200, 18))
    expect(await sgxVester.getCombinedAverageStakedAmount(user3.address)).eq(expandDecimals(200, 18))
    expect(await sgxVester.getMaxVestableAmount(user2.address)).eq(0)
    expect(await sgxVester.getMaxVestableAmount(user3.address)).gt(expandDecimals(992, 18))
    expect(await sgxVester.getMaxVestableAmount(user3.address)).lt(expandDecimals(993, 18))
    expect(await sgxVester.getPairAmount(user2.address, expandDecimals(992, 18))).eq(0)
    expect(await sgxVester.getPairAmount(user3.address, expandDecimals(992, 18))).gt(expandDecimals(199, 18))
    expect(await sgxVester.getPairAmount(user3.address, expandDecimals(992, 18))).lt(expandDecimals(200, 18))

    await sgx.connect(user3).approve(stakedSgxTracker.address, expandDecimals(400, 18))
    await rewardRouter.connect(user3).signalTransfer(user4.address)
    await rewardRouter.connect(user4).acceptTransfer(user3.address)

    expect(await stakedSgxTracker.depositBalances(user3.address, sgx.address)).eq(0)
    expect(await stakedSgxTracker.depositBalances(user3.address, esSgx.address)).eq(0)
    expect(await feeSgxTracker.depositBalances(user3.address, bnSgx.address)).eq(0)
    expect(await stakedSgxTracker.depositBalances(user4.address, sgx.address)).eq(expandDecimals(200, 18))
    expect(await stakedSgxTracker.depositBalances(user4.address, esSgx.address)).gt(expandDecimals(892, 18))
    expect(await stakedSgxTracker.depositBalances(user4.address, esSgx.address)).lt(expandDecimals(893, 18))
    expect(await feeSgxTracker.depositBalances(user4.address, bnSgx.address)).gt("547000000000000000") // 0.547
    expect(await feeSgxTracker.depositBalances(user4.address, bnSgx.address)).lt("549000000000000000") // 0.548
    expect(await sgxVester.transferredAverageStakedAmounts(user4.address)).gt(expandDecimals(200, 18))
    expect(await sgxVester.transferredAverageStakedAmounts(user4.address)).lt(expandDecimals(201, 18))
    expect(await sgxVester.transferredCumulativeRewards(user4.address)).gt(expandDecimals(892, 18))
    expect(await sgxVester.transferredCumulativeRewards(user4.address)).lt(expandDecimals(894, 18))
    expect(await sgxVester.bonusRewards(user3.address)).eq(0)
    expect(await sgxVester.bonusRewards(user4.address)).eq(expandDecimals(100, 18))
    expect(await stakedSgxTracker.averageStakedAmounts(user3.address)).gt(expandDecimals(1092, 18))
    expect(await stakedSgxTracker.averageStakedAmounts(user3.address)).lt(expandDecimals(1094, 18))
    expect(await sgxVester.transferredAverageStakedAmounts(user3.address)).eq(0)
    expect(await sgxVester.getCombinedAverageStakedAmount(user3.address)).gt(expandDecimals(1092, 18))
    expect(await sgxVester.getCombinedAverageStakedAmount(user3.address)).lt(expandDecimals(1094, 18))
    expect(await sgxVester.getCombinedAverageStakedAmount(user4.address)).gt(expandDecimals(200, 18))
    expect(await sgxVester.getCombinedAverageStakedAmount(user4.address)).lt(expandDecimals(201, 18))
    expect(await sgxVester.getMaxVestableAmount(user3.address)).eq(0)
    expect(await sgxVester.getMaxVestableAmount(user4.address)).gt(expandDecimals(992, 18))
    expect(await sgxVester.getMaxVestableAmount(user4.address)).lt(expandDecimals(993, 18))
    expect(await sgxVester.getPairAmount(user3.address, expandDecimals(992, 18))).eq(0)
    expect(await sgxVester.getPairAmount(user4.address, expandDecimals(992, 18))).gt(expandDecimals(199, 18))
    expect(await sgxVester.getPairAmount(user4.address, expandDecimals(992, 18))).lt(expandDecimals(200, 18))

    await expect(rewardRouter.connect(user4).acceptTransfer(user3.address))
      .to.be.revertedWith("RewardRouter: transfer not signalled")
  })

  it("sgx, sgxlp: signalTransfer, acceptTransfer", async () =>{
    await sgx.setMinter(wallet.address, true)
    await sgx.mint(sgxVester.address, expandDecimals(10000, 18))
    await sgx.mint(sgxlpVester.address, expandDecimals(10000, 18))
    await eth.mint(feeSgxLpDistributor.address, expandDecimals(100, 18))
    await feeSgxLpDistributor.setTokensPerInterval("41335970000000") // 0.00004133597 ETH per second

    await bnb.mint(user1.address, expandDecimals(1, 18))
    await bnb.connect(user1).approve(sgxlpManager.address, expandDecimals(1, 18))
    await rewardRouter.connect(user1).mintAndStakeSgxLp(
      bnb.address,
      expandDecimals(1, 18),
      expandDecimals(299, 18),
      expandDecimals(299, 18)
    )

    await bnb.mint(user2.address, expandDecimals(1, 18))
    await bnb.connect(user2).approve(sgxlpManager.address, expandDecimals(1, 18))
    await rewardRouter.connect(user2).mintAndStakeSgxLp(
      bnb.address,
      expandDecimals(1, 18),
      expandDecimals(299, 18),
      expandDecimals(299, 18)
    )

    await sgx.mint(user1.address, expandDecimals(200, 18))
    expect(await sgx.balanceOf(user1.address)).eq(expandDecimals(200, 18))
    await sgx.connect(user1).approve(stakedSgxTracker.address, expandDecimals(200, 18))
    await rewardRouter.connect(user1).stakeSgx(expandDecimals(200, 18))
    expect(await sgx.balanceOf(user1.address)).eq(0)

    await sgx.mint(user2.address, expandDecimals(200, 18))
    expect(await sgx.balanceOf(user2.address)).eq(expandDecimals(200, 18))
    await sgx.connect(user2).approve(stakedSgxTracker.address, expandDecimals(400, 18))
    await rewardRouter.connect(user2).stakeSgx(expandDecimals(200, 18))
    expect(await sgx.balanceOf(user2.address)).eq(0)

    await rewardRouter.connect(user2).signalTransfer(user1.address)

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    await rewardRouter.connect(user2).signalTransfer(user1.address)
    await rewardRouter.connect(user1).compound()

    await expect(rewardRouter.connect(user2).signalTransfer(user1.address))
      .to.be.revertedWith("RewardRouter: stakedSgxTracker.averageStakedAmounts > 0")

    await rewardRouter.connect(user2).signalTransfer(user3.address)

    await expect(rewardRouter.connect(user3).acceptTransfer(user1.address))
      .to.be.revertedWith("RewardRouter: transfer not signalled")

    await sgxVester.setBonusRewards(user2.address, expandDecimals(100, 18))

    expect(await stakedSgxTracker.depositBalances(user2.address, sgx.address)).eq(expandDecimals(200, 18))
    expect(await stakedSgxTracker.depositBalances(user2.address, esSgx.address)).eq(0)
    expect(await stakedSgxTracker.depositBalances(user3.address, sgx.address)).eq(0)
    expect(await stakedSgxTracker.depositBalances(user3.address, esSgx.address)).eq(0)

    expect(await feeSgxTracker.depositBalances(user2.address, bnSgx.address)).eq(0)
    expect(await feeSgxTracker.depositBalances(user3.address, bnSgx.address)).eq(0)

    expect(await feeSgxLpTracker.depositBalances(user2.address, sgxlp.address)).eq("299100000000000000000") // 299.1
    expect(await feeSgxLpTracker.depositBalances(user3.address, sgxlp.address)).eq(0)

    expect(await stakedSgxLpTracker.depositBalances(user2.address, feeSgxLpTracker.address)).eq("299100000000000000000") // 299.1
    expect(await stakedSgxLpTracker.depositBalances(user3.address, feeSgxLpTracker.address)).eq(0)

    expect(await sgxVester.transferredAverageStakedAmounts(user3.address)).eq(0)
    expect(await sgxVester.transferredCumulativeRewards(user3.address)).eq(0)
    expect(await sgxVester.bonusRewards(user2.address)).eq(expandDecimals(100, 18))
    expect(await sgxVester.bonusRewards(user3.address)).eq(0)
    expect(await sgxVester.getCombinedAverageStakedAmount(user2.address)).eq(0)
    expect(await sgxVester.getCombinedAverageStakedAmount(user3.address)).eq(0)
    expect(await sgxVester.getMaxVestableAmount(user2.address)).eq(expandDecimals(100, 18))
    expect(await sgxVester.getMaxVestableAmount(user3.address)).eq(0)
    expect(await sgxVester.getPairAmount(user2.address, expandDecimals(892, 18))).eq(0)
    expect(await sgxVester.getPairAmount(user3.address, expandDecimals(892, 18))).eq(0)

    await rewardRouter.connect(user3).acceptTransfer(user2.address)

    expect(await stakedSgxTracker.depositBalances(user2.address, sgx.address)).eq(0)
    expect(await stakedSgxTracker.depositBalances(user2.address, esSgx.address)).eq(0)
    expect(await stakedSgxTracker.depositBalances(user3.address, sgx.address)).eq(expandDecimals(200, 18))
    expect(await stakedSgxTracker.depositBalances(user3.address, esSgx.address)).gt(expandDecimals(1785, 18))
    expect(await stakedSgxTracker.depositBalances(user3.address, esSgx.address)).lt(expandDecimals(1786, 18))

    expect(await feeSgxTracker.depositBalances(user2.address, bnSgx.address)).eq(0)
    expect(await feeSgxTracker.depositBalances(user3.address, bnSgx.address)).gt("547000000000000000") // 0.547
    expect(await feeSgxTracker.depositBalances(user3.address, bnSgx.address)).lt("549000000000000000") // 0.548

    expect(await feeSgxLpTracker.depositBalances(user2.address, sgxlp.address)).eq(0)
    expect(await feeSgxLpTracker.depositBalances(user3.address, sgxlp.address)).eq("299100000000000000000") // 299.1

    expect(await stakedSgxLpTracker.depositBalances(user2.address, feeSgxLpTracker.address)).eq(0)
    expect(await stakedSgxLpTracker.depositBalances(user3.address, feeSgxLpTracker.address)).eq("299100000000000000000") // 299.1

    expect(await sgxVester.transferredAverageStakedAmounts(user3.address)).eq(expandDecimals(200, 18))
    expect(await sgxVester.transferredCumulativeRewards(user3.address)).gt(expandDecimals(892, 18))
    expect(await sgxVester.transferredCumulativeRewards(user3.address)).lt(expandDecimals(893, 18))
    expect(await sgxVester.bonusRewards(user2.address)).eq(0)
    expect(await sgxVester.bonusRewards(user3.address)).eq(expandDecimals(100, 18))
    expect(await sgxVester.getCombinedAverageStakedAmount(user2.address)).eq(expandDecimals(200, 18))
    expect(await sgxVester.getCombinedAverageStakedAmount(user3.address)).eq(expandDecimals(200, 18))
    expect(await sgxVester.getMaxVestableAmount(user2.address)).eq(0)
    expect(await sgxVester.getMaxVestableAmount(user3.address)).gt(expandDecimals(992, 18))
    expect(await sgxVester.getMaxVestableAmount(user3.address)).lt(expandDecimals(993, 18))
    expect(await sgxVester.getPairAmount(user2.address, expandDecimals(992, 18))).eq(0)
    expect(await sgxVester.getPairAmount(user3.address, expandDecimals(992, 18))).gt(expandDecimals(199, 18))
    expect(await sgxVester.getPairAmount(user3.address, expandDecimals(992, 18))).lt(expandDecimals(200, 18))
    expect(await sgxVester.getPairAmount(user1.address, expandDecimals(892, 18))).gt(expandDecimals(199, 18))
    expect(await sgxVester.getPairAmount(user1.address, expandDecimals(892, 18))).lt(expandDecimals(200, 18))

    await rewardRouter.connect(user1).compound()

    await expect(rewardRouter.connect(user3).acceptTransfer(user1.address))
      .to.be.revertedWith("RewardRouter: transfer not signalled")

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    await rewardRouter.connect(user1).claim()
    await rewardRouter.connect(user2).claim()
    await rewardRouter.connect(user3).claim()

    expect(await sgxVester.getCombinedAverageStakedAmount(user1.address)).gt(expandDecimals(1092, 18))
    expect(await sgxVester.getCombinedAverageStakedAmount(user1.address)).lt(expandDecimals(1094, 18))
    expect(await sgxVester.getCombinedAverageStakedAmount(user3.address)).gt(expandDecimals(1092, 18))
    expect(await sgxVester.getCombinedAverageStakedAmount(user3.address)).lt(expandDecimals(1094, 18))

    expect(await sgxVester.getMaxVestableAmount(user2.address)).eq(0)
    expect(await sgxVester.getMaxVestableAmount(user3.address)).gt(expandDecimals(1885, 18))
    expect(await sgxVester.getMaxVestableAmount(user3.address)).lt(expandDecimals(1887, 18))
    expect(await sgxVester.getMaxVestableAmount(user1.address)).gt(expandDecimals(1785, 18))
    expect(await sgxVester.getMaxVestableAmount(user1.address)).lt(expandDecimals(1787, 18))

    expect(await sgxVester.getPairAmount(user2.address, expandDecimals(992, 18))).eq(0)
    expect(await sgxVester.getPairAmount(user3.address, expandDecimals(1885, 18))).gt(expandDecimals(1092, 18))
    expect(await sgxVester.getPairAmount(user3.address, expandDecimals(1885, 18))).lt(expandDecimals(1094, 18))
    expect(await sgxVester.getPairAmount(user1.address, expandDecimals(1785, 18))).gt(expandDecimals(1092, 18))
    expect(await sgxVester.getPairAmount(user1.address, expandDecimals(1785, 18))).lt(expandDecimals(1094, 18))

    await rewardRouter.connect(user1).compound()
    await rewardRouter.connect(user3).compound()

    expect(await feeSgxTracker.balanceOf(user1.address)).gt(expandDecimals(1992, 18))
    expect(await feeSgxTracker.balanceOf(user1.address)).lt(expandDecimals(1993, 18))

    await sgxVester.connect(user1).deposit(expandDecimals(1785, 18))

    expect(await feeSgxTracker.balanceOf(user1.address)).gt(expandDecimals(1991 - 1092, 18)) // 899
    expect(await feeSgxTracker.balanceOf(user1.address)).lt(expandDecimals(1993 - 1092, 18)) // 901

    expect(await feeSgxTracker.depositBalances(user1.address, bnSgx.address)).gt(expandDecimals(4, 18))
    expect(await feeSgxTracker.depositBalances(user1.address, bnSgx.address)).lt(expandDecimals(6, 18))

    await rewardRouter.connect(user1).unstakeSgx(expandDecimals(200, 18))
    await expect(rewardRouter.connect(user1).unstakeEsSgx(expandDecimals(699, 18)))
      .to.be.revertedWith("RewardTracker: burn amount exceeds balance")

    await rewardRouter.connect(user1).unstakeEsSgx(expandDecimals(599, 18))

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    expect(await feeSgxTracker.balanceOf(user1.address)).gt(expandDecimals(97, 18))
    expect(await feeSgxTracker.balanceOf(user1.address)).lt(expandDecimals(99, 18))

    expect(await esSgx.balanceOf(user1.address)).gt(expandDecimals(599, 18))
    expect(await esSgx.balanceOf(user1.address)).lt(expandDecimals(601, 18))

    expect(await sgx.balanceOf(user1.address)).eq(expandDecimals(200, 18))

    await sgxVester.connect(user1).withdraw()

    expect(await feeSgxTracker.balanceOf(user1.address)).gt(expandDecimals(1190, 18)) // 1190 - 98 => 1092
    expect(await feeSgxTracker.balanceOf(user1.address)).lt(expandDecimals(1191, 18))

    expect(await esSgx.balanceOf(user1.address)).gt(expandDecimals(2378, 18))
    expect(await esSgx.balanceOf(user1.address)).lt(expandDecimals(2380, 18))

    expect(await sgx.balanceOf(user1.address)).gt(expandDecimals(204, 18))
    expect(await sgx.balanceOf(user1.address)).lt(expandDecimals(206, 18))

    expect(await sgxlpVester.getMaxVestableAmount(user3.address)).gt(expandDecimals(1785, 18))
    expect(await sgxlpVester.getMaxVestableAmount(user3.address)).lt(expandDecimals(1787, 18))

    expect(await sgxlpVester.getPairAmount(user3.address, expandDecimals(1785, 18))).gt(expandDecimals(298, 18))
    expect(await sgxlpVester.getPairAmount(user3.address, expandDecimals(1785, 18))).lt(expandDecimals(300, 18))

    expect(await stakedSgxLpTracker.balanceOf(user3.address)).eq("299100000000000000000")

    expect(await esSgx.balanceOf(user3.address)).gt(expandDecimals(1785, 18))
    expect(await esSgx.balanceOf(user3.address)).lt(expandDecimals(1787, 18))

    expect(await sgx.balanceOf(user3.address)).eq(0)

    await sgxlpVester.connect(user3).deposit(expandDecimals(1785, 18))

    expect(await stakedSgxLpTracker.balanceOf(user3.address)).gt(0)
    expect(await stakedSgxLpTracker.balanceOf(user3.address)).lt(expandDecimals(1, 18))

    expect(await esSgx.balanceOf(user3.address)).gt(0)
    expect(await esSgx.balanceOf(user3.address)).lt(expandDecimals(1, 18))

    expect(await sgx.balanceOf(user3.address)).eq(0)

    await expect(rewardRouter.connect(user3).unstakeAndRedeemSgxLp(
      bnb.address,
      expandDecimals(1, 18),
      0,
      user3.address
    )).to.be.revertedWith("RewardTracker: burn amount exceeds balance")

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    await sgxlpVester.connect(user3).withdraw()

    expect(await stakedSgxLpTracker.balanceOf(user3.address)).eq("299100000000000000000")

    expect(await esSgx.balanceOf(user3.address)).gt(expandDecimals(1785 - 5, 18))
    expect(await esSgx.balanceOf(user3.address)).lt(expandDecimals(1787 - 5, 18))

    expect(await sgx.balanceOf(user3.address)).gt(expandDecimals(4, 18))
    expect(await sgx.balanceOf(user3.address)).lt(expandDecimals(6, 18))

    expect(await feeSgxTracker.balanceOf(user1.address)).gt(expandDecimals(1190, 18))
    expect(await feeSgxTracker.balanceOf(user1.address)).lt(expandDecimals(1191, 18))

    expect(await esSgx.balanceOf(user1.address)).gt(expandDecimals(2379, 18))
    expect(await esSgx.balanceOf(user1.address)).lt(expandDecimals(2381, 18))

    expect(await sgx.balanceOf(user1.address)).gt(expandDecimals(204, 18))
    expect(await sgx.balanceOf(user1.address)).lt(expandDecimals(206, 18))

    await sgxVester.connect(user1).deposit(expandDecimals(365 * 2, 18))

    expect(await feeSgxTracker.balanceOf(user1.address)).gt(expandDecimals(743, 18)) // 1190 - 743 => 447
    expect(await feeSgxTracker.balanceOf(user1.address)).lt(expandDecimals(754, 18))

    expect(await sgxVester.claimable(user1.address)).eq(0)

    await increaseTime(provider, 48 * 60 * 60)
    await mineBlock(provider)

    expect(await sgxVester.claimable(user1.address)).gt("3900000000000000000") // 3.9
    expect(await sgxVester.claimable(user1.address)).lt("4100000000000000000") // 4.1

    await sgxVester.connect(user1).deposit(expandDecimals(365, 18))

    expect(await feeSgxTracker.balanceOf(user1.address)).gt(expandDecimals(522, 18)) // 743 - 522 => 221
    expect(await feeSgxTracker.balanceOf(user1.address)).lt(expandDecimals(524, 18))

    await increaseTime(provider, 48 * 60 * 60)
    await mineBlock(provider)

    expect(await sgxVester.claimable(user1.address)).gt("9900000000000000000") // 9.9
    expect(await sgxVester.claimable(user1.address)).lt("10100000000000000000") // 10.1

    expect(await sgx.balanceOf(user1.address)).gt(expandDecimals(204, 18))
    expect(await sgx.balanceOf(user1.address)).lt(expandDecimals(206, 18))

    await sgxVester.connect(user1).claim()

    expect(await sgx.balanceOf(user1.address)).gt(expandDecimals(214, 18))
    expect(await sgx.balanceOf(user1.address)).lt(expandDecimals(216, 18))

    await sgxVester.connect(user1).deposit(expandDecimals(365, 18))
    expect(await sgxVester.balanceOf(user1.address)).gt(expandDecimals(1449, 18)) // 365 * 4 => 1460, 1460 - 10 => 1450
    expect(await sgxVester.balanceOf(user1.address)).lt(expandDecimals(1451, 18))
    expect(await sgxVester.getVestedAmount(user1.address)).eq(expandDecimals(1460, 18))

    expect(await feeSgxTracker.balanceOf(user1.address)).gt(expandDecimals(303, 18)) // 522 - 303 => 219
    expect(await feeSgxTracker.balanceOf(user1.address)).lt(expandDecimals(304, 18))

    await increaseTime(provider, 48 * 60 * 60)
    await mineBlock(provider)

    expect(await sgxVester.claimable(user1.address)).gt("7900000000000000000") // 7.9
    expect(await sgxVester.claimable(user1.address)).lt("8100000000000000000") // 8.1

    await sgxVester.connect(user1).withdraw()

    expect(await feeSgxTracker.balanceOf(user1.address)).gt(expandDecimals(1190, 18))
    expect(await feeSgxTracker.balanceOf(user1.address)).lt(expandDecimals(1191, 18))

    expect(await sgx.balanceOf(user1.address)).gt(expandDecimals(222, 18))
    expect(await sgx.balanceOf(user1.address)).lt(expandDecimals(224, 18))

    expect(await esSgx.balanceOf(user1.address)).gt(expandDecimals(2360, 18))
    expect(await esSgx.balanceOf(user1.address)).lt(expandDecimals(2362, 18))

    await sgxVester.connect(user1).deposit(expandDecimals(365, 18))

    await increaseTime(provider, 500 * 24 * 60 * 60)
    await mineBlock(provider)

    expect(await sgxVester.claimable(user1.address)).eq(expandDecimals(365, 18))

    await sgxVester.connect(user1).withdraw()

    expect(await sgx.balanceOf(user1.address)).gt(expandDecimals(222 + 365, 18))
    expect(await sgx.balanceOf(user1.address)).lt(expandDecimals(224 + 365, 18))

    expect(await esSgx.balanceOf(user1.address)).gt(expandDecimals(2360 - 365, 18))
    expect(await esSgx.balanceOf(user1.address)).lt(expandDecimals(2362 - 365, 18))

    expect(await sgxVester.transferredAverageStakedAmounts(user2.address)).eq(0)
    expect(await sgxVester.transferredAverageStakedAmounts(user3.address)).eq(expandDecimals(200, 18))
    expect(await stakedSgxTracker.cumulativeRewards(user2.address)).gt(expandDecimals(892, 18))
    expect(await stakedSgxTracker.cumulativeRewards(user2.address)).lt(expandDecimals(893, 18))
    expect(await stakedSgxTracker.cumulativeRewards(user3.address)).gt(expandDecimals(892, 18))
    expect(await stakedSgxTracker.cumulativeRewards(user3.address)).lt(expandDecimals(893, 18))
    expect(await sgxVester.transferredCumulativeRewards(user3.address)).gt(expandDecimals(892, 18))
    expect(await sgxVester.transferredCumulativeRewards(user3.address)).lt(expandDecimals(893, 18))
    expect(await sgxVester.bonusRewards(user2.address)).eq(0)
    expect(await sgxVester.bonusRewards(user3.address)).eq(expandDecimals(100, 18))
    expect(await sgxVester.getCombinedAverageStakedAmount(user2.address)).eq(expandDecimals(200, 18))
    expect(await sgxVester.getCombinedAverageStakedAmount(user3.address)).gt(expandDecimals(1092, 18))
    expect(await sgxVester.getCombinedAverageStakedAmount(user3.address)).lt(expandDecimals(1093, 18))
    expect(await sgxVester.getMaxVestableAmount(user2.address)).eq(0)
    expect(await sgxVester.getMaxVestableAmount(user3.address)).gt(expandDecimals(1884, 18))
    expect(await sgxVester.getMaxVestableAmount(user3.address)).lt(expandDecimals(1886, 18))
    expect(await sgxVester.getPairAmount(user2.address, expandDecimals(992, 18))).eq(0)
    expect(await sgxVester.getPairAmount(user3.address, expandDecimals(992, 18))).gt(expandDecimals(574, 18))
    expect(await sgxVester.getPairAmount(user3.address, expandDecimals(992, 18))).lt(expandDecimals(575, 18))
    expect(await sgxVester.getPairAmount(user1.address, expandDecimals(892, 18))).gt(expandDecimals(545, 18))
    expect(await sgxVester.getPairAmount(user1.address, expandDecimals(892, 18))).lt(expandDecimals(546, 18))

    const esSgxBatchSender = await deployContract("EsSgxBatchSender", [esSgx.address])

    await timelock.signalSetHandler(esSgx.address, esSgxBatchSender.address, true)
    await timelock.signalSetHandler(sgxVester.address, esSgxBatchSender.address, true)
    await timelock.signalSetHandler(sgxlpVester.address, esSgxBatchSender.address, true)
    await timelock.signalMint(esSgx.address, wallet.address, expandDecimals(1000, 18))

    await increaseTime(provider, 20)
    await mineBlock(provider)

    await timelock.setHandler(esSgx.address, esSgxBatchSender.address, true)
    await timelock.setHandler(sgxVester.address, esSgxBatchSender.address, true)
    await timelock.setHandler(sgxlpVester.address, esSgxBatchSender.address, true)
    await timelock.processMint(esSgx.address, wallet.address, expandDecimals(1000, 18))

    await esSgxBatchSender.connect(wallet).send(
      sgxVester.address,
      4,
      [user2.address, user3.address],
      [expandDecimals(100, 18), expandDecimals(200, 18)]
    )

    expect(await sgxVester.transferredAverageStakedAmounts(user2.address)).gt(expandDecimals(37648, 18))
    expect(await sgxVester.transferredAverageStakedAmounts(user2.address)).lt(expandDecimals(37649, 18))
    expect(await sgxVester.transferredAverageStakedAmounts(user3.address)).gt(expandDecimals(12810, 18))
    expect(await sgxVester.transferredAverageStakedAmounts(user3.address)).lt(expandDecimals(12811, 18))
    expect(await sgxVester.transferredCumulativeRewards(user2.address)).eq(expandDecimals(100, 18))
    expect(await sgxVester.transferredCumulativeRewards(user3.address)).gt(expandDecimals(892 + 200, 18))
    expect(await sgxVester.transferredCumulativeRewards(user3.address)).lt(expandDecimals(893 + 200, 18))
    expect(await sgxVester.bonusRewards(user2.address)).eq(0)
    expect(await sgxVester.bonusRewards(user3.address)).eq(expandDecimals(100, 18))
    expect(await sgxVester.getCombinedAverageStakedAmount(user2.address)).gt(expandDecimals(3971, 18))
    expect(await sgxVester.getCombinedAverageStakedAmount(user2.address)).lt(expandDecimals(3972, 18))
    expect(await sgxVester.getCombinedAverageStakedAmount(user3.address)).gt(expandDecimals(7943, 18))
    expect(await sgxVester.getCombinedAverageStakedAmount(user3.address)).lt(expandDecimals(7944, 18))
    expect(await sgxVester.getMaxVestableAmount(user2.address)).eq(expandDecimals(100, 18))
    expect(await sgxVester.getMaxVestableAmount(user3.address)).gt(expandDecimals(1884 + 200, 18))
    expect(await sgxVester.getMaxVestableAmount(user3.address)).lt(expandDecimals(1886 + 200, 18))
    expect(await sgxVester.getPairAmount(user2.address, expandDecimals(100, 18))).gt(expandDecimals(3971, 18))
    expect(await sgxVester.getPairAmount(user2.address, expandDecimals(100, 18))).lt(expandDecimals(3972, 18))
    expect(await sgxVester.getPairAmount(user3.address, expandDecimals(1884 + 200, 18))).gt(expandDecimals(7936, 18))
    expect(await sgxVester.getPairAmount(user3.address, expandDecimals(1884 + 200, 18))).lt(expandDecimals(7937, 18))

    expect(await sgxlpVester.transferredAverageStakedAmounts(user4.address)).eq(0)
    expect(await sgxlpVester.transferredCumulativeRewards(user4.address)).eq(0)
    expect(await sgxlpVester.bonusRewards(user4.address)).eq(0)
    expect(await sgxlpVester.getCombinedAverageStakedAmount(user4.address)).eq(0)
    expect(await sgxlpVester.getMaxVestableAmount(user4.address)).eq(0)
    expect(await sgxlpVester.getPairAmount(user4.address, expandDecimals(10, 18))).eq(0)

    await esSgxBatchSender.connect(wallet).send(
      sgxlpVester.address,
      320,
      [user4.address],
      [expandDecimals(10, 18)]
    )

    expect(await sgxlpVester.transferredAverageStakedAmounts(user4.address)).eq(expandDecimals(3200, 18))
    expect(await sgxlpVester.transferredCumulativeRewards(user4.address)).eq(expandDecimals(10, 18))
    expect(await sgxlpVester.bonusRewards(user4.address)).eq(0)
    expect(await sgxlpVester.getCombinedAverageStakedAmount(user4.address)).eq(expandDecimals(3200, 18))
    expect(await sgxlpVester.getMaxVestableAmount(user4.address)).eq(expandDecimals(10, 18))
    expect(await sgxlpVester.getPairAmount(user4.address, expandDecimals(10, 18))).eq(expandDecimals(3200, 18))

    await esSgxBatchSender.connect(wallet).send(
      sgxlpVester.address,
      320,
      [user4.address],
      [expandDecimals(10, 18)]
    )

    expect(await sgxlpVester.transferredAverageStakedAmounts(user4.address)).eq(expandDecimals(6400, 18))
    expect(await sgxlpVester.transferredCumulativeRewards(user4.address)).eq(expandDecimals(20, 18))
    expect(await sgxlpVester.bonusRewards(user4.address)).eq(0)
    expect(await sgxlpVester.getCombinedAverageStakedAmount(user4.address)).eq(expandDecimals(6400, 18))
    expect(await sgxlpVester.getMaxVestableAmount(user4.address)).eq(expandDecimals(20, 18))
    expect(await sgxlpVester.getPairAmount(user4.address, expandDecimals(10, 18))).eq(expandDecimals(3200, 18))
  })

  it("handleRewards", async () => {
    const timelockV2 = wallet

    // use new rewardRouter, use eth for weth
    const rewardRouterV2 = await deployContract("RewardRouterV2", [])
    await rewardRouterV2.initialize(
      eth.address,
      sgx.address,
      esSgx.address,
      bnSgx.address,
      sgxlp.address,
      stakedSgxTracker.address,
      bonusSgxTracker.address,
      feeSgxTracker.address,
      feeSgxLpTracker.address,
      stakedSgxLpTracker.address,
      sgxlpManager.address,
      sgxVester.address,
      sgxlpVester.address
    )

    await timelock.signalSetGov(sgxlpManager.address, timelockV2.address)
    await timelock.signalSetGov(stakedSgxTracker.address, timelockV2.address)
    await timelock.signalSetGov(bonusSgxTracker.address, timelockV2.address)
    await timelock.signalSetGov(feeSgxTracker.address, timelockV2.address)
    await timelock.signalSetGov(feeSgxLpTracker.address, timelockV2.address)
    await timelock.signalSetGov(stakedSgxLpTracker.address, timelockV2.address)
    await timelock.signalSetGov(stakedSgxDistributor.address, timelockV2.address)
    await timelock.signalSetGov(stakedSgxLpDistributor.address, timelockV2.address)
    await timelock.signalSetGov(esSgx.address, timelockV2.address)
    await timelock.signalSetGov(bnSgx.address, timelockV2.address)
    await timelock.signalSetGov(sgxVester.address, timelockV2.address)
    await timelock.signalSetGov(sgxlpVester.address, timelockV2.address)

    await increaseTime(provider, 20)
    await mineBlock(provider)

    await timelock.setGov(sgxlpManager.address, timelockV2.address)
    await timelock.setGov(stakedSgxTracker.address, timelockV2.address)
    await timelock.setGov(bonusSgxTracker.address, timelockV2.address)
    await timelock.setGov(feeSgxTracker.address, timelockV2.address)
    await timelock.setGov(feeSgxLpTracker.address, timelockV2.address)
    await timelock.setGov(stakedSgxLpTracker.address, timelockV2.address)
    await timelock.setGov(stakedSgxDistributor.address, timelockV2.address)
    await timelock.setGov(stakedSgxLpDistributor.address, timelockV2.address)
    await timelock.setGov(esSgx.address, timelockV2.address)
    await timelock.setGov(bnSgx.address, timelockV2.address)
    await timelock.setGov(sgxVester.address, timelockV2.address)
    await timelock.setGov(sgxlpVester.address, timelockV2.address)

    await esSgx.setHandler(rewardRouterV2.address, true)
    await esSgx.setHandler(stakedSgxDistributor.address, true)
    await esSgx.setHandler(stakedSgxLpDistributor.address, true)
    await esSgx.setHandler(stakedSgxTracker.address, true)
    await esSgx.setHandler(stakedSgxLpTracker.address, true)
    await esSgx.setHandler(sgxVester.address, true)
    await esSgx.setHandler(sgxlpVester.address, true)

    await sgxlpManager.setHandler(rewardRouterV2.address, true)
    await stakedSgxTracker.setHandler(rewardRouterV2.address, true)
    await bonusSgxTracker.setHandler(rewardRouterV2.address, true)
    await feeSgxTracker.setHandler(rewardRouterV2.address, true)
    await feeSgxLpTracker.setHandler(rewardRouterV2.address, true)
    await stakedSgxLpTracker.setHandler(rewardRouterV2.address, true)

    await esSgx.setHandler(rewardRouterV2.address, true)
    await bnSgx.setMinter(rewardRouterV2.address, true)
    await esSgx.setMinter(sgxVester.address, true)
    await esSgx.setMinter(sgxlpVester.address, true)

    await sgxVester.setHandler(rewardRouterV2.address, true)
    await sgxlpVester.setHandler(rewardRouterV2.address, true)

    await feeSgxTracker.setHandler(sgxVester.address, true)
    await stakedSgxLpTracker.setHandler(sgxlpVester.address, true)

    await eth.deposit({ value: expandDecimals(10, 18) })

    await sgx.setMinter(wallet.address, true)
    await sgx.mint(sgxVester.address, expandDecimals(10000, 18))
    await sgx.mint(sgxlpVester.address, expandDecimals(10000, 18))

    await eth.mint(feeSgxLpDistributor.address, expandDecimals(50, 18))
    await feeSgxLpDistributor.setTokensPerInterval("41335970000000") // 0.00004133597 ETH per second

    await eth.mint(feeSgxDistributor.address, expandDecimals(50, 18))
    await feeSgxDistributor.setTokensPerInterval("41335970000000") // 0.00004133597 ETH per second

    await bnb.mint(user1.address, expandDecimals(1, 18))
    await bnb.connect(user1).approve(sgxlpManager.address, expandDecimals(1, 18))
    await rewardRouterV2.connect(user1).mintAndStakeSgxLp(
      bnb.address,
      expandDecimals(1, 18),
      expandDecimals(299, 18),
      expandDecimals(299, 18)
    )

    await sgx.mint(user1.address, expandDecimals(200, 18))
    expect(await sgx.balanceOf(user1.address)).eq(expandDecimals(200, 18))
    await sgx.connect(user1).approve(stakedSgxTracker.address, expandDecimals(200, 18))
    await rewardRouterV2.connect(user1).stakeSgx(expandDecimals(200, 18))
    expect(await sgx.balanceOf(user1.address)).eq(0)

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    expect(await sgx.balanceOf(user1.address)).eq(0)
    expect(await esSgx.balanceOf(user1.address)).eq(0)
    expect(await bnSgx.balanceOf(user1.address)).eq(0)
    expect(await sgxlp.balanceOf(user1.address)).eq(0)
    expect(await eth.balanceOf(user1.address)).eq(0)

    expect(await stakedSgxTracker.depositBalances(user1.address, sgx.address)).eq(expandDecimals(200, 18))
    expect(await stakedSgxTracker.depositBalances(user1.address, esSgx.address)).eq(0)
    expect(await feeSgxTracker.depositBalances(user1.address, bnSgx.address)).eq(0)

    await rewardRouterV2.connect(user1).handleRewards(
      true, // _shouldClaimSgx
      true, // _shouldStakeSgx
      true, // _shouldClaimEsSgx
      true, // _shouldStakeEsSgx
      true, // _shouldStakeMultiplierPoints
      true, // _shouldClaimWeth
      false // _shouldConvertWethToEth
    )

    expect(await sgx.balanceOf(user1.address)).eq(0)
    expect(await esSgx.balanceOf(user1.address)).eq(0)
    expect(await bnSgx.balanceOf(user1.address)).eq(0)
    expect(await sgxlp.balanceOf(user1.address)).eq(0)
    expect(await eth.balanceOf(user1.address)).gt(expandDecimals(7, 18))
    expect(await eth.balanceOf(user1.address)).lt(expandDecimals(8, 18))

    expect(await stakedSgxTracker.depositBalances(user1.address, sgx.address)).eq(expandDecimals(200, 18))
    expect(await stakedSgxTracker.depositBalances(user1.address, esSgx.address)).gt(expandDecimals(3571, 18))
    expect(await stakedSgxTracker.depositBalances(user1.address, esSgx.address)).lt(expandDecimals(3572, 18))
    expect(await feeSgxTracker.depositBalances(user1.address, bnSgx.address)).gt("540000000000000000") // 0.54
    expect(await feeSgxTracker.depositBalances(user1.address, bnSgx.address)).lt("560000000000000000") // 0.56

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    const ethBalance0 = await provider.getBalance(user1.address)

    await rewardRouterV2.connect(user1).handleRewards(
      false, // _shouldClaimSgx
      false, // _shouldStakeSgx
      false, // _shouldClaimEsSgx
      false, // _shouldStakeEsSgx
      false, // _shouldStakeMultiplierPoints
      true, // _shouldClaimWeth
      true // _shouldConvertWethToEth
    )

    const ethBalance1 = await provider.getBalance(user1.address)

    expect(await ethBalance1.sub(ethBalance0)).gt(expandDecimals(7, 18))
    expect(await ethBalance1.sub(ethBalance0)).lt(expandDecimals(8, 18))
    expect(await sgx.balanceOf(user1.address)).eq(0)
    expect(await esSgx.balanceOf(user1.address)).eq(0)
    expect(await bnSgx.balanceOf(user1.address)).eq(0)
    expect(await sgxlp.balanceOf(user1.address)).eq(0)
    expect(await eth.balanceOf(user1.address)).gt(expandDecimals(7, 18))
    expect(await eth.balanceOf(user1.address)).lt(expandDecimals(8, 18))

    expect(await stakedSgxTracker.depositBalances(user1.address, sgx.address)).eq(expandDecimals(200, 18))
    expect(await stakedSgxTracker.depositBalances(user1.address, esSgx.address)).gt(expandDecimals(3571, 18))
    expect(await stakedSgxTracker.depositBalances(user1.address, esSgx.address)).lt(expandDecimals(3572, 18))
    expect(await feeSgxTracker.depositBalances(user1.address, bnSgx.address)).gt("540000000000000000") // 0.54
    expect(await feeSgxTracker.depositBalances(user1.address, bnSgx.address)).lt("560000000000000000") // 0.56

    await rewardRouterV2.connect(user1).handleRewards(
      false, // _shouldClaimSgx
      false, // _shouldStakeSgx
      true, // _shouldClaimEsSgx
      false, // _shouldStakeEsSgx
      false, // _shouldStakeMultiplierPoints
      false, // _shouldClaimWeth
      false // _shouldConvertWethToEth
    )

    expect(await ethBalance1.sub(ethBalance0)).gt(expandDecimals(7, 18))
    expect(await ethBalance1.sub(ethBalance0)).lt(expandDecimals(8, 18))
    expect(await sgx.balanceOf(user1.address)).eq(0)
    expect(await esSgx.balanceOf(user1.address)).gt(expandDecimals(3571, 18))
    expect(await esSgx.balanceOf(user1.address)).lt(expandDecimals(3572, 18))
    expect(await bnSgx.balanceOf(user1.address)).eq(0)
    expect(await sgxlp.balanceOf(user1.address)).eq(0)
    expect(await eth.balanceOf(user1.address)).gt(expandDecimals(7, 18))
    expect(await eth.balanceOf(user1.address)).lt(expandDecimals(8, 18))

    expect(await stakedSgxTracker.depositBalances(user1.address, sgx.address)).eq(expandDecimals(200, 18))
    expect(await stakedSgxTracker.depositBalances(user1.address, esSgx.address)).gt(expandDecimals(3571, 18))
    expect(await stakedSgxTracker.depositBalances(user1.address, esSgx.address)).lt(expandDecimals(3572, 18))
    expect(await feeSgxTracker.depositBalances(user1.address, bnSgx.address)).gt("540000000000000000") // 0.54
    expect(await feeSgxTracker.depositBalances(user1.address, bnSgx.address)).lt("560000000000000000") // 0.56

    await sgxVester.connect(user1).deposit(expandDecimals(365, 18))
    await sgxlpVester.connect(user1).deposit(expandDecimals(365 * 2, 18))

    expect(await ethBalance1.sub(ethBalance0)).gt(expandDecimals(7, 18))
    expect(await ethBalance1.sub(ethBalance0)).lt(expandDecimals(8, 18))
    expect(await sgx.balanceOf(user1.address)).eq(0)
    expect(await esSgx.balanceOf(user1.address)).gt(expandDecimals(3571 - 365 * 3, 18))
    expect(await esSgx.balanceOf(user1.address)).lt(expandDecimals(3572 - 365 * 3, 18))
    expect(await bnSgx.balanceOf(user1.address)).eq(0)
    expect(await sgxlp.balanceOf(user1.address)).eq(0)
    expect(await eth.balanceOf(user1.address)).gt(expandDecimals(7, 18))
    expect(await eth.balanceOf(user1.address)).lt(expandDecimals(8, 18))

    expect(await stakedSgxTracker.depositBalances(user1.address, sgx.address)).eq(expandDecimals(200, 18))
    expect(await stakedSgxTracker.depositBalances(user1.address, esSgx.address)).gt(expandDecimals(3571, 18))
    expect(await stakedSgxTracker.depositBalances(user1.address, esSgx.address)).lt(expandDecimals(3572, 18))
    expect(await feeSgxTracker.depositBalances(user1.address, bnSgx.address)).gt("540000000000000000") // 0.54
    expect(await feeSgxTracker.depositBalances(user1.address, bnSgx.address)).lt("560000000000000000") // 0.56

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    await rewardRouterV2.connect(user1).handleRewards(
      true, // _shouldClaimSgx
      false, // _shouldStakeSgx
      false, // _shouldClaimEsSgx
      false, // _shouldStakeEsSgx
      false, // _shouldStakeMultiplierPoints
      false, // _shouldClaimWeth
      false // _shouldConvertWethToEth
    )

    expect(await ethBalance1.sub(ethBalance0)).gt(expandDecimals(7, 18))
    expect(await ethBalance1.sub(ethBalance0)).lt(expandDecimals(8, 18))
    expect(await sgx.balanceOf(user1.address)).gt("2900000000000000000") // 2.9
    expect(await sgx.balanceOf(user1.address)).lt("3100000000000000000") // 3.1
    expect(await esSgx.balanceOf(user1.address)).gt(expandDecimals(3571 - 365 * 3, 18))
    expect(await esSgx.balanceOf(user1.address)).lt(expandDecimals(3572 - 365 * 3, 18))
    expect(await bnSgx.balanceOf(user1.address)).eq(0)
    expect(await sgxlp.balanceOf(user1.address)).eq(0)
    expect(await eth.balanceOf(user1.address)).gt(expandDecimals(7, 18))
    expect(await eth.balanceOf(user1.address)).lt(expandDecimals(8, 18))

    expect(await stakedSgxTracker.depositBalances(user1.address, sgx.address)).eq(expandDecimals(200, 18))
    expect(await stakedSgxTracker.depositBalances(user1.address, esSgx.address)).gt(expandDecimals(3571, 18))
    expect(await stakedSgxTracker.depositBalances(user1.address, esSgx.address)).lt(expandDecimals(3572, 18))
    expect(await feeSgxTracker.depositBalances(user1.address, bnSgx.address)).gt("540000000000000000") // 0.54
    expect(await feeSgxTracker.depositBalances(user1.address, bnSgx.address)).lt("560000000000000000") // 0.56
  })

  it("StakedSgxLp", async () => {
    await eth.mint(feeSgxLpDistributor.address, expandDecimals(100, 18))
    await feeSgxLpDistributor.setTokensPerInterval("41335970000000") // 0.00004133597 ETH per second

    await bnb.mint(user1.address, expandDecimals(1, 18))
    await bnb.connect(user1).approve(sgxlpManager.address, expandDecimals(1, 18))
    await rewardRouter.connect(user1).mintAndStakeSgxLp(
      bnb.address,
      expandDecimals(1, 18),
      expandDecimals(299, 18),
      expandDecimals(299, 18)
    )

    expect(await feeSgxLpTracker.stakedAmounts(user1.address)).eq(expandDecimals(2991, 17))
    expect(await feeSgxLpTracker.depositBalances(user1.address, sgxlp.address)).eq(expandDecimals(2991, 17))

    expect(await stakedSgxLpTracker.stakedAmounts(user1.address)).eq(expandDecimals(2991, 17))
    expect(await stakedSgxLpTracker.depositBalances(user1.address, feeSgxLpTracker.address)).eq(expandDecimals(2991, 17))

    const stakedSgxLp = await deployContract("StakedSgxLp", [sgxlp.address, sgxlpManager.address, stakedSgxLpTracker.address, feeSgxLpTracker.address])

    await expect(stakedSgxLp.connect(user2).transferFrom(user1.address, user3.address, expandDecimals(2991, 17)))
      .to.be.revertedWith("StakedSgxLp: transfer amount exceeds allowance")

    await stakedSgxLp.connect(user1).approve(user2.address, expandDecimals(2991, 17))

    await expect(stakedSgxLp.connect(user2).transferFrom(user1.address, user3.address, expandDecimals(2991, 17)))
      .to.be.revertedWith("StakedSgxLp: cooldown duration not yet passed")

    await increaseTime(provider, 24 * 60 * 60 + 10)
    await mineBlock(provider)

    await expect(stakedSgxLp.connect(user2).transferFrom(user1.address, user3.address, expandDecimals(2991, 17)))
      .to.be.revertedWith("RewardTracker: forbidden")

    await timelock.signalSetHandler(stakedSgxLpTracker.address, stakedSgxLp.address, true)
    await increaseTime(provider, 20)
    await mineBlock(provider)
    await timelock.setHandler(stakedSgxLpTracker.address, stakedSgxLp.address, true)

    await expect(stakedSgxLp.connect(user2).transferFrom(user1.address, user3.address, expandDecimals(2991, 17)))
      .to.be.revertedWith("RewardTracker: forbidden")

    await timelock.signalSetHandler(feeSgxLpTracker.address, stakedSgxLp.address, true)
    await increaseTime(provider, 20)
    await mineBlock(provider)
    await timelock.setHandler(feeSgxLpTracker.address, stakedSgxLp.address, true)

    expect(await feeSgxLpTracker.stakedAmounts(user1.address)).eq(expandDecimals(2991, 17))
    expect(await feeSgxLpTracker.depositBalances(user1.address, sgxlp.address)).eq(expandDecimals(2991, 17))

    expect(await stakedSgxLpTracker.stakedAmounts(user1.address)).eq(expandDecimals(2991, 17))
    expect(await stakedSgxLpTracker.depositBalances(user1.address, feeSgxLpTracker.address)).eq(expandDecimals(2991, 17))

    expect(await feeSgxLpTracker.stakedAmounts(user3.address)).eq(0)
    expect(await feeSgxLpTracker.depositBalances(user3.address, sgxlp.address)).eq(0)

    expect(await stakedSgxLpTracker.stakedAmounts(user3.address)).eq(0)
    expect(await stakedSgxLpTracker.depositBalances(user3.address, feeSgxLpTracker.address)).eq(0)

    await stakedSgxLp.connect(user2).transferFrom(user1.address, user3. address, expandDecimals(2991, 17))

    expect(await feeSgxLpTracker.stakedAmounts(user1.address)).eq(0)
    expect(await feeSgxLpTracker.depositBalances(user1.address, sgxlp.address)).eq(0)

    expect(await stakedSgxLpTracker.stakedAmounts(user1.address)).eq(0)
    expect(await stakedSgxLpTracker.depositBalances(user1.address, feeSgxLpTracker.address)).eq(0)

    expect(await feeSgxLpTracker.stakedAmounts(user3.address)).eq(expandDecimals(2991, 17))
    expect(await feeSgxLpTracker.depositBalances(user3.address, sgxlp.address)).eq(expandDecimals(2991, 17))

    expect(await stakedSgxLpTracker.stakedAmounts(user3.address)).eq(expandDecimals(2991, 17))
    expect(await stakedSgxLpTracker.depositBalances(user3.address, feeSgxLpTracker.address)).eq(expandDecimals(2991, 17))

    await expect(stakedSgxLp.connect(user2).transferFrom(user3.address, user1.address, expandDecimals(3000, 17)))
      .to.be.revertedWith("StakedSgxLp: transfer amount exceeds allowance")

    await stakedSgxLp.connect(user3).approve(user2.address, expandDecimals(3000, 17))

    await expect(stakedSgxLp.connect(user2).transferFrom(user3.address, user1.address, expandDecimals(3000, 17)))
      .to.be.revertedWith("RewardTracker: _amount exceeds stakedAmount")

    await stakedSgxLp.connect(user2).transferFrom(user3.address, user1.address, expandDecimals(1000, 17))

    expect(await feeSgxLpTracker.stakedAmounts(user1.address)).eq(expandDecimals(1000, 17))
    expect(await feeSgxLpTracker.depositBalances(user1.address, sgxlp.address)).eq(expandDecimals(1000, 17))

    expect(await stakedSgxLpTracker.stakedAmounts(user1.address)).eq(expandDecimals(1000, 17))
    expect(await stakedSgxLpTracker.depositBalances(user1.address, feeSgxLpTracker.address)).eq(expandDecimals(1000, 17))

    expect(await feeSgxLpTracker.stakedAmounts(user3.address)).eq(expandDecimals(1991, 17))
    expect(await feeSgxLpTracker.depositBalances(user3.address, sgxlp.address)).eq(expandDecimals(1991, 17))

    expect(await stakedSgxLpTracker.stakedAmounts(user3.address)).eq(expandDecimals(1991, 17))
    expect(await stakedSgxLpTracker.depositBalances(user3.address, feeSgxLpTracker.address)).eq(expandDecimals(1991, 17))

    await stakedSgxLp.connect(user3).transfer(user1.address, expandDecimals(1500, 17))

    expect(await feeSgxLpTracker.stakedAmounts(user1.address)).eq(expandDecimals(2500, 17))
    expect(await feeSgxLpTracker.depositBalances(user1.address, sgxlp.address)).eq(expandDecimals(2500, 17))

    expect(await stakedSgxLpTracker.stakedAmounts(user1.address)).eq(expandDecimals(2500, 17))
    expect(await stakedSgxLpTracker.depositBalances(user1.address, feeSgxLpTracker.address)).eq(expandDecimals(2500, 17))

    expect(await feeSgxLpTracker.stakedAmounts(user3.address)).eq(expandDecimals(491, 17))
    expect(await feeSgxLpTracker.depositBalances(user3.address, sgxlp.address)).eq(expandDecimals(491, 17))

    expect(await stakedSgxLpTracker.stakedAmounts(user3.address)).eq(expandDecimals(491, 17))
    expect(await stakedSgxLpTracker.depositBalances(user3.address, feeSgxLpTracker.address)).eq(expandDecimals(491, 17))

    await expect(stakedSgxLp.connect(user3).transfer(user1.address, expandDecimals(492, 17)))
      .to.be.revertedWith("RewardTracker: _amount exceeds stakedAmount")

    expect(await bnb.balanceOf(user1.address)).eq(0)

    await rewardRouter.connect(user1).unstakeAndRedeemSgxLp(
      bnb.address,
      expandDecimals(2500, 17),
      "830000000000000000", // 0.83
      user1.address
    )

    expect(await bnb.balanceOf(user1.address)).eq("830833333333333333")

    await usdg.addVault(sgxlpManager.address)

    expect(await bnb.balanceOf(user3.address)).eq("0")

    await rewardRouter.connect(user3).unstakeAndRedeemSgxLp(
      bnb.address,
      expandDecimals(491, 17),
      "160000000000000000", // 0.16
      user3.address
    )

    expect(await bnb.balanceOf(user3.address)).eq("163175666666666666")
  })

  it("FeeSgxLp", async () => {
    await eth.mint(feeSgxLpDistributor.address, expandDecimals(100, 18))
    await feeSgxLpDistributor.setTokensPerInterval("41335970000000") // 0.00004133597 ETH per second

    await bnb.mint(user1.address, expandDecimals(1, 18))
    await bnb.connect(user1).approve(sgxlpManager.address, expandDecimals(1, 18))
    await rewardRouter.connect(user1).mintAndStakeSgxLp(
      bnb.address,
      expandDecimals(1, 18),
      expandDecimals(299, 18),
      expandDecimals(299, 18)
    )

    expect(await feeSgxLpTracker.stakedAmounts(user1.address)).eq(expandDecimals(2991, 17))
    expect(await feeSgxLpTracker.depositBalances(user1.address, sgxlp.address)).eq(expandDecimals(2991, 17))

    expect(await stakedSgxLpTracker.stakedAmounts(user1.address)).eq(expandDecimals(2991, 17))
    expect(await stakedSgxLpTracker.depositBalances(user1.address, feeSgxLpTracker.address)).eq(expandDecimals(2991, 17))

    const sgxlpBalance = await deployContract("SgxLpBalance", [sgxlpManager.address, stakedSgxLpTracker.address])

    await expect(sgxlpBalance.connect(user2).transferFrom(user1.address, user3.address, expandDecimals(2991, 17)))
      .to.be.revertedWith("SgxLpBalance: transfer amount exceeds allowance")

    await sgxlpBalance.connect(user1).approve(user2.address, expandDecimals(2991, 17))

    await expect(sgxlpBalance.connect(user2).transferFrom(user1.address, user3.address, expandDecimals(2991, 17)))
      .to.be.revertedWith("SgxLpBalance: cooldown duration not yet passed")

    await increaseTime(provider, 24 * 60 * 60 + 10)
    await mineBlock(provider)

    await expect(sgxlpBalance.connect(user2).transferFrom(user1.address, user3.address, expandDecimals(2991, 17)))
      .to.be.revertedWith("RewardTracker: transfer amount exceeds allowance")

    await timelock.signalSetHandler(stakedSgxLpTracker.address, sgxlpBalance.address, true)
    await increaseTime(provider, 20)
    await mineBlock(provider)
    await timelock.setHandler(stakedSgxLpTracker.address, sgxlpBalance.address, true)

    expect(await feeSgxLpTracker.stakedAmounts(user1.address)).eq(expandDecimals(2991, 17))
    expect(await feeSgxLpTracker.depositBalances(user1.address, sgxlp.address)).eq(expandDecimals(2991, 17))

    expect(await stakedSgxLpTracker.stakedAmounts(user1.address)).eq(expandDecimals(2991, 17))
    expect(await stakedSgxLpTracker.depositBalances(user1.address, feeSgxLpTracker.address)).eq(expandDecimals(2991, 17))
    expect(await stakedSgxLpTracker.balanceOf(user1.address)).eq(expandDecimals(2991, 17))

    expect(await feeSgxLpTracker.stakedAmounts(user3.address)).eq(0)
    expect(await feeSgxLpTracker.depositBalances(user3.address, sgxlp.address)).eq(0)

    expect(await stakedSgxLpTracker.stakedAmounts(user3.address)).eq(0)
    expect(await stakedSgxLpTracker.depositBalances(user3.address, feeSgxLpTracker.address)).eq(0)
    expect(await stakedSgxLpTracker.balanceOf(user3.address)).eq(0)

    await sgxlpBalance.connect(user2).transferFrom(user1.address, user3.address, expandDecimals(2991, 17))

    expect(await feeSgxLpTracker.stakedAmounts(user1.address)).eq(expandDecimals(2991, 17))
    expect(await feeSgxLpTracker.depositBalances(user1.address, sgxlp.address)).eq(expandDecimals(2991, 17))

    expect(await stakedSgxLpTracker.stakedAmounts(user1.address)).eq(expandDecimals(2991, 17))
    expect(await stakedSgxLpTracker.depositBalances(user1.address, feeSgxLpTracker.address)).eq(expandDecimals(2991, 17))
    expect(await stakedSgxLpTracker.balanceOf(user1.address)).eq(0)

    expect(await feeSgxLpTracker.stakedAmounts(user3.address)).eq(0)
    expect(await feeSgxLpTracker.depositBalances(user3.address, sgxlp.address)).eq(0)

    expect(await stakedSgxLpTracker.stakedAmounts(user3.address)).eq(0)
    expect(await stakedSgxLpTracker.depositBalances(user3.address, feeSgxLpTracker.address)).eq(0)
    expect(await stakedSgxLpTracker.balanceOf(user3.address)).eq(expandDecimals(2991, 17))

    await expect(rewardRouter.connect(user1).unstakeAndRedeemSgxLp(
      bnb.address,
      expandDecimals(2991, 17),
      "0",
      user1.address
    )).to.be.revertedWith("RewardTracker: burn amount exceeds balance")

    await sgxlpBalance.connect(user3).approve(user2.address, expandDecimals(3000, 17))

    await expect(sgxlpBalance.connect(user2).transferFrom(user3.address, user1.address, expandDecimals(2992, 17)))
      .to.be.revertedWith("RewardTracker: transfer amount exceeds balance")

    await sgxlpBalance.connect(user2).transferFrom(user3.address, user1.address, expandDecimals(2991, 17))

    expect(await bnb.balanceOf(user1.address)).eq(0)

    await rewardRouter.connect(user1).unstakeAndRedeemSgxLp(
      bnb.address,
      expandDecimals(2991, 17),
      "0",
      user1.address
    )

    expect(await bnb.balanceOf(user1.address)).eq("994009000000000000")
  })
})
