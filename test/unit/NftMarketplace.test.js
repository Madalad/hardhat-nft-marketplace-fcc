const { assert, expect } = require("chai")
const { network, ethers, deployments } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config.js")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("NftMarketplace", function () {
          let nftMarketplace, basicNft, deployer, player
          const PRICE = ethers.utils.parseEther("0.1")
          const TOKEN_ID = 0
          beforeEach(async function () {
              const accounts = await ethers.getSigners()
              deployer = accounts[0]
              player = accounts[1]

              await deployments.fixture(["all"])

              nftMarketplace = await ethers.getContract("NftMarketplace")
              basicNft = await ethers.getContract("BasicNft")

              await basicNft.mintNft()
              await basicNft.approve(nftMarketplace.address, TOKEN_ID)
          })

          it("lists and can be bought, emits events", async function () {
              await expect(nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE))
                  .to.emit(nftMarketplace, "ItemListed")
                  .withArgs(deployer.address, basicNft.address, TOKEN_ID, PRICE)
              await expect(
                  nftMarketplace
                      .connect(player)
                      .buyItem(basicNft.address, TOKEN_ID, { value: PRICE })
              )
                  .to.emit(nftMarketplace, "ItemBought")
                  .withArgs(player.address, basicNft.address, TOKEN_ID, PRICE)
              const newOwner = await basicNft.ownerOf(TOKEN_ID)
              const deployerProceeds = await nftMarketplace.getProceeds(deployer.address)
              assert.equal(newOwner, player.address)
              assert.equal(deployerProceeds.toString(), PRICE.toString())
          })

          describe("listItem", function () {
              it("should revert when necessary", async function () {
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, "0")
                  ).to.be.revertedWith("PriceMustBeAboveZero")

                  await expect(
                      nftMarketplace.connect(player).listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NotOwner")

                  await basicNft.approve(player.address, TOKEN_ID)
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NotApprovedForMarketplace")

                  await basicNft.approve(nftMarketplace.address, TOKEN_ID)
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith(`AlreadyListed("${basicNft.address}", ${TOKEN_ID})`)
              })
              it("should update listings mapping", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                  assert.equal(listing.price.toString(), PRICE.toString())
                  assert.equal(listing.seller, deployer.address)
              })
          })

          describe("buyItem", function () {
              it("should revert if not listed", async function () {
                  await expect(
                      nftMarketplace.buyItem(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith(`NotListed("${basicNft.address}", ${TOKEN_ID})`)
              })
              it("should revert if price not met", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(
                      nftMarketplace.connect(player).buyItem(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith("PriceNotMet")
              })
              it("should transfer nft and update state variables", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await nftMarketplace
                      .connect(player)
                      .buyItem(basicNft.address, TOKEN_ID, { value: PRICE })
                  const newOwner = await basicNft.ownerOf(TOKEN_ID)
                  assert.equal(newOwner, player.address)
                  const sellerProceeds = await nftMarketplace.getProceeds(deployer.address)
                  assert.equal(sellerProceeds.toString(), PRICE.toString())
                  const listingPrice = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                  assert.equal(listingPrice.price.toString(), "0")
              })
          })

          describe("cancelListing", function () {
              it("should revert if not listed or not owner", async function () {
                  await expect(
                      nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith("NotListed")
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(
                      nftMarketplace.connect(player).cancelListing(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith("NotOwner")
              })
              it("should update mapping and emit event", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(nftMarketplace.cancelListing(basicNft.address, TOKEN_ID))
                      .to.emit(nftMarketplace, "ListingCancelled")
                      .withArgs(deployer.address, basicNft.address, TOKEN_ID)
                  const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                  assert.equal(listing.price.toString(), "0")
              })
          })

          describe("updateListing", async function () {
              it("should revert if not listed or not owner", async function () {
                  const NEW_PRICE = ethers.utils.parseEther("0.2")
                  await expect(
                      nftMarketplace.updateListing(basicNft.address, TOKEN_ID, NEW_PRICE)
                  ).to.be.revertedWith("NotListed")
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(
                      nftMarketplace
                          .connect(player)
                          .updateListing(basicNft.address, TOKEN_ID, NEW_PRICE)
                  ).to.be.revertedWith("NotOwner")
              })
              it("should update mapping and emit event", async function () {
                  const NEW_PRICE = ethers.utils.parseEther("0.2")
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(nftMarketplace.updateListing(basicNft.address, TOKEN_ID, NEW_PRICE))
                      .to.emit(nftMarketplace, "ItemListed")
                      .withArgs(deployer.address, basicNft.address, TOKEN_ID, NEW_PRICE)
                  const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                  assert.equal(listing.price.toString(), NEW_PRICE.toString())
              })
          })

          describe("withdrawProceeds", function () {
              it("should revert if no proceeds", async function () {
                  await expect(nftMarketplace.withdrawProceeds()).to.be.revertedWith("NoProceeds")
              })
              it("should transfer ETH and update mapping", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await nftMarketplace
                      .connect(player)
                      .buyItem(basicNft.address, TOKEN_ID, { value: PRICE })
                  const balanceBefore = await deployer.getBalance()
                  const tx = await nftMarketplace.withdrawProceeds()
                  const txReceipt = await tx.wait()
                  const spentOnGas = txReceipt.cumulativeGasUsed.mul(txReceipt.effectiveGasPrice)
                  const balanceAfter = await deployer.getBalance()
                  assert.equal(
                      balanceAfter.toString(),
                      balanceBefore.add(PRICE).sub(spentOnGas).toString()
                  )
              })
          })
      })
