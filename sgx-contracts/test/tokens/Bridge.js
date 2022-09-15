const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { deployContract } = require("../shared/fixtures")
const { expandDecimals, getBlockTime, increaseTime, mineBlock, reportGasUsed } = require("../shared/utilities")

use(solidity)

describe("Bridge", function () {
  const provider = waffle.provider
  const [wallet, user0, user1, user2, user3] = provider.getWallets()
  let sgx
  let wsgx
  let bridge

  beforeEach(async () => {
    sgx = await deployContract("SGX", [])
    wsgx = await deployContract("SGX", [])
    bridge = await deployContract("Bridge", [sgx.address, wsgx.address])
  })

  it("wrap, unwrap", async () => {
    await sgx.setMinter(wallet.address, true)
    await sgx.mint(user0.address, 100)
    await sgx.connect(user0).approve(bridge.address, 100)
    await expect(bridge.connect(user0).wrap(200, user1.address))
      .to.be.revertedWith("BaseToken: transfer amount exceeds allowance")

    await expect(bridge.connect(user0).wrap(100, user1.address))
      .to.be.revertedWith("BaseToken: transfer amount exceeds balance")

    await wsgx.setMinter(wallet.address, true)
    await wsgx.mint(bridge.address, 50)

    await expect(bridge.connect(user0).wrap(100, user1.address))
      .to.be.revertedWith("BaseToken: transfer amount exceeds balance")

    await wsgx.mint(bridge.address, 50)

    expect(await sgx.balanceOf(user0.address)).eq(100)
    expect(await sgx.balanceOf(bridge.address)).eq(0)
    expect(await wsgx.balanceOf(user1.address)).eq(0)
    expect(await wsgx.balanceOf(bridge.address)).eq(100)

    await bridge.connect(user0).wrap(100, user1.address)

    expect(await sgx.balanceOf(user0.address)).eq(0)
    expect(await sgx.balanceOf(bridge.address)).eq(100)
    expect(await wsgx.balanceOf(user1.address)).eq(100)
    expect(await wsgx.balanceOf(bridge.address)).eq(0)

    await wsgx.connect(user1).approve(bridge.address, 100)

    expect(await sgx.balanceOf(user2.address)).eq(0)
    expect(await sgx.balanceOf(bridge.address)).eq(100)
    expect(await wsgx.balanceOf(user1.address)).eq(100)
    expect(await wsgx.balanceOf(bridge.address)).eq(0)

    await bridge.connect(user1).unwrap(100, user2.address)

    expect(await sgx.balanceOf(user2.address)).eq(100)
    expect(await sgx.balanceOf(bridge.address)).eq(0)
    expect(await wsgx.balanceOf(user1.address)).eq(0)
    expect(await wsgx.balanceOf(bridge.address)).eq(100)
  })

  it("withdrawToken", async () => {
    await sgx.setMinter(wallet.address, true)
    await sgx.mint(bridge.address, 100)

    await expect(bridge.connect(user0).withdrawToken(sgx.address, user1.address, 100))
      .to.be.revertedWith("Governable: forbidden")

    await expect(bridge.connect(user0).setGov(user0.address))
      .to.be.revertedWith("Governable: forbidden")

    await bridge.connect(wallet).setGov(user0.address)

    expect(await sgx.balanceOf(user1.address)).eq(0)
    expect(await sgx.balanceOf(bridge.address)).eq(100)
    await bridge.connect(user0).withdrawToken(sgx.address, user1.address, 100)
    expect(await sgx.balanceOf(user1.address)).eq(100)
    expect(await sgx.balanceOf(bridge.address)).eq(0)
  })
})
