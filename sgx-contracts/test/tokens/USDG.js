const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { deployContract } = require("../shared/fixtures")
const { expandDecimals, getBlockTime, increaseTime, mineBlock, reportGasUsed } = require("../shared/utilities")

use(solidity)

describe("SGUSD", function () {
  const provider = waffle.provider
  const [wallet, user0, user1, user2, user3] = provider.getWallets()
  let sgusd

  beforeEach(async () => {
    sgusd = await deployContract("SGUSD", [user1.address])
  })

  it("addVault", async () => {
    await expect(sgusd.connect(user0).addVault(user0.address))
      .to.be.revertedWith("YieldToken: forbidden")

    await sgusd.setGov(user0.address)

    expect(await sgusd.vaults(user0.address)).eq(false)
    await sgusd.connect(user0).addVault(user0.address)
    expect(await sgusd.vaults(user0.address)).eq(true)
  })

  it("removeVault", async () => {
    await expect(sgusd.connect(user0).removeVault(user0.address))
      .to.be.revertedWith("YieldToken: forbidden")

    await sgusd.setGov(user0.address)

    expect(await sgusd.vaults(user0.address)).eq(false)
    await sgusd.connect(user0).addVault(user0.address)
    expect(await sgusd.vaults(user0.address)).eq(true)
    await sgusd.connect(user0).removeVault(user0.address)
    expect(await sgusd.vaults(user0.address)).eq(false)
  })

  it("mint", async () => {
    expect(await sgusd.balanceOf(user1.address)).eq(0)
    await sgusd.connect(user1).mint(user1.address, 1000)
    expect(await sgusd.balanceOf(user1.address)).eq(1000)
    expect(await sgusd.totalSupply()).eq(1000)

    await expect(sgusd.connect(user0).mint(user1.address, 1000))
      .to.be.revertedWith("SGUSD: forbidden")

    await sgusd.addVault(user0.address)

    expect(await sgusd.balanceOf(user1.address)).eq(1000)
    await sgusd.connect(user0).mint(user1.address, 500)
    expect(await sgusd.balanceOf(user1.address)).eq(1500)
    expect(await sgusd.totalSupply()).eq(1500)
  })

  it("burn", async () => {
    expect(await sgusd.balanceOf(user1.address)).eq(0)
    await sgusd.connect(user1).mint(user1.address, 1000)
    expect(await sgusd.balanceOf(user1.address)).eq(1000)
    await sgusd.connect(user1).burn(user1.address, 300)
    expect(await sgusd.balanceOf(user1.address)).eq(700)
    expect(await sgusd.totalSupply()).eq(700)

    await expect(sgusd.connect(user0).burn(user1.address, 100))
      .to.be.revertedWith("SGUSD: forbidden")

    await sgusd.addVault(user0.address)

    await sgusd.connect(user0).burn(user1.address, 100)
    expect(await sgusd.balanceOf(user1.address)).eq(600)
    expect(await sgusd.totalSupply()).eq(600)
  })
})
