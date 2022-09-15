const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { deployContract } = require("../shared/fixtures")
const { expandDecimals, getBlockTime, increaseTime, mineBlock, reportGasUsed, print } = require("../shared/utilities")
const { toChainlinkPrice } = require("../shared/chainlink")
const { toUsd, toNormalizedPrice } = require("../shared/units")

use(solidity)

describe("BonusDistributor", function () {
  const provider = waffle.provider
  const [wallet, rewardRouter, user0, user1, user2, user3] = provider.getWallets()
  let sgx
  let esSgx
  let bnSgx
  let stakedSgxTracker
  let stakedSgxDistributor
  let bonusSgxTracker
  let bonusSgxDistributor

  beforeEach(async () => {
    sgx = await deployContract("SGX", []);
    esSgx = await deployContract("EsSGX", []);
    bnSgx = await deployContract("MintableBaseToken", ["Bonus SGX", "bnSGX", 0]);

    stakedSgxTracker = await deployContract("RewardTracker", ["Staked SGX", "stSGX"])
    stakedSgxDistributor = await deployContract("RewardDistributor", [esSgx.address, stakedSgxTracker.address])
    await stakedSgxDistributor.updateLastDistributionTime()

    bonusSgxTracker = await deployContract("RewardTracker", ["Staked + Bonus SGX", "sbSGX"])
    bonusSgxDistributor = await deployContract("BonusDistributor", [bnSgx.address, bonusSgxTracker.address])
    await bonusSgxDistributor.updateLastDistributionTime()

    await stakedSgxTracker.initialize([sgx.address, esSgx.address], stakedSgxDistributor.address)
    await bonusSgxTracker.initialize([stakedSgxTracker.address], bonusSgxDistributor.address)

    await stakedSgxTracker.setInPrivateTransferMode(true)
    await stakedSgxTracker.setInPrivateStakingMode(true)
    await bonusSgxTracker.setInPrivateTransferMode(true)
    await bonusSgxTracker.setInPrivateStakingMode(true)

    await stakedSgxTracker.setHandler(rewardRouter.address, true)
    await stakedSgxTracker.setHandler(bonusSgxTracker.address, true)
    await bonusSgxTracker.setHandler(rewardRouter.address, true)
    await bonusSgxDistributor.setBonusMultiplier(10000)
  })

  it("distributes bonus", async () => {
    await esSgx.setMinter(wallet.address, true)
    await esSgx.mint(stakedSgxDistributor.address, expandDecimals(50000, 18))
    await bnSgx.setMinter(wallet.address, true)
    await bnSgx.mint(bonusSgxDistributor.address, expandDecimals(1500, 18))
    await stakedSgxDistributor.setTokensPerInterval("20667989410000000") // 0.02066798941 esSgx per second
    await sgx.setMinter(wallet.address, true)
    await sgx.mint(user0.address, expandDecimals(1000, 18))

    await sgx.connect(user0).approve(stakedSgxTracker.address, expandDecimals(1001, 18))
    await expect(stakedSgxTracker.connect(rewardRouter).stakeForAccount(user0.address, user0.address, sgx.address, expandDecimals(1001, 18)))
      .to.be.revertedWith("BaseToken: transfer amount exceeds balance")
    await stakedSgxTracker.connect(rewardRouter).stakeForAccount(user0.address, user0.address, sgx.address, expandDecimals(1000, 18))
    await expect(bonusSgxTracker.connect(rewardRouter).stakeForAccount(user0.address, user0.address, stakedSgxTracker.address, expandDecimals(1001, 18)))
      .to.be.revertedWith("RewardTracker: transfer amount exceeds balance")
    await bonusSgxTracker.connect(rewardRouter).stakeForAccount(user0.address, user0.address, stakedSgxTracker.address, expandDecimals(1000, 18))

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    expect(await stakedSgxTracker.claimable(user0.address)).gt(expandDecimals(1785, 18)) // 50000 / 28 => ~1785
    expect(await stakedSgxTracker.claimable(user0.address)).lt(expandDecimals(1786, 18))
    expect(await bonusSgxTracker.claimable(user0.address)).gt("2730000000000000000") // 2.73, 1000 / 365 => ~2.74
    expect(await bonusSgxTracker.claimable(user0.address)).lt("2750000000000000000") // 2.75

    await esSgx.mint(user1.address, expandDecimals(500, 18))
    await esSgx.connect(user1).approve(stakedSgxTracker.address, expandDecimals(500, 18))
    await stakedSgxTracker.connect(rewardRouter).stakeForAccount(user1.address, user1.address, esSgx.address, expandDecimals(500, 18))
    await bonusSgxTracker.connect(rewardRouter).stakeForAccount(user1.address, user1.address, stakedSgxTracker.address, expandDecimals(500, 18))

    await increaseTime(provider, 24 * 60 * 60)
    await mineBlock(provider)

    expect(await stakedSgxTracker.claimable(user0.address)).gt(expandDecimals(1785 + 1190, 18))
    expect(await stakedSgxTracker.claimable(user0.address)).lt(expandDecimals(1786 + 1191, 18))

    expect(await stakedSgxTracker.claimable(user1.address)).gt(expandDecimals(595, 18))
    expect(await stakedSgxTracker.claimable(user1.address)).lt(expandDecimals(596, 18))

    expect(await bonusSgxTracker.claimable(user0.address)).gt("5470000000000000000") // 5.47, 1000 / 365 * 2 => ~5.48
    expect(await bonusSgxTracker.claimable(user0.address)).lt("5490000000000000000") // 5.49

    expect(await bonusSgxTracker.claimable(user1.address)).gt("1360000000000000000") // 1.36, 500 / 365 => ~1.37
    expect(await bonusSgxTracker.claimable(user1.address)).lt("1380000000000000000") // 1.38
  })
})
