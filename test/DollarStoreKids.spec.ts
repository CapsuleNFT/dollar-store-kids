import { ethers } from 'hardhat'
import { expect } from 'chai'
import { ICapsuleFactory, IERC20, DollarStoreKids } from '../typechain-types'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { adjustERC20Balance, Address } from './utils'

describe('Dollar Store Kids tests', async function () {
  const baseURI = 'http://localhost/'
  let dollarStoreKids: DollarStoreKids, capsuleFactory: ICapsuleFactory, capsuleMinter
  let capsule, usdc: IERC20
  let governor: SignerWithAddress, user1: SignerWithAddress, user2: SignerWithAddress

  let capsuleCollectionTax, mintTax, maxUsdcAmount

  before(async function () {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;[governor, user1, user2] = await ethers.getSigners()
  })

  beforeEach(async function () {
    capsuleFactory = (await ethers.getContractAt('ICapsuleFactory', Address.CAPSULE_FACTORY)) as ICapsuleFactory
    capsuleCollectionTax = await capsuleFactory.capsuleCollectionTax()
    // Note setting owner address here so that later we don't have to call connect for owner
    const factory = await ethers.getContractFactory('DollarStoreKids', governor)
    dollarStoreKids = (await factory.deploy(baseURI, { value: capsuleCollectionTax })) as DollarStoreKids

    const collection = await dollarStoreKids.capsuleCollection()
    expect(collection).to.properAddress
    capsule = await ethers.getContractAt('ICapsule', collection)

    capsuleMinter = await ethers.getContractAt('ICapsuleMinter', await dollarStoreKids.CAPSULE_MINTER())
    mintTax = await capsuleMinter.capsuleMintTax()
    maxUsdcAmount = ethers.utils.parseUnits((await dollarStoreKids.MAX_DSK()).toString(), 6)
    usdc = (await ethers.getContractAt('IERC20', Address.USDC)) as IERC20
  })

  context('Verify deployment', function () {
    it('Should verify DSK deployed correctly', async function () {
      // Given DSK is deployed and collection is created
      const maxDSK = await dollarStoreKids.MAX_DSK()
      const maxId = await capsule.maxId()
      // Then maxId should be 1 less than maxDSK. MaxId starts from 0
      expect(maxId, 'collection is not locked properly').to.eq(maxDSK - 1)
      expect(await dollarStoreKids.isMintEnabled(), 'Minting should be disabled').to.false
      const allowance = await usdc.allowance(dollarStoreKids.address, capsuleMinter.address)
      expect(allowance, 'incorrect allowance').to.eq(maxUsdcAmount)
    })
  })

  describe('Mint status', function () {
    it('Should revert if non governor toggle mint status', async function () {
      // When mint status is toggled by non governor user
      const tx = dollarStoreKids.connect(user2).toggleMint()
      // Then revert with
      await expect(tx).to.revertedWith('not governor')
    })

    it('Should toggle mint status', async function () {
      // Given DSK is deployed
      expect(await dollarStoreKids.isMintEnabled(), 'mint should be disabled').to.false
      // When mint status is toggled
      const tx = dollarStoreKids.toggleMint()
      await expect(tx).to.emit(dollarStoreKids, 'MintToggled').withArgs(true)
      // Then minting should be enabled
      expect(await dollarStoreKids.isMintEnabled(), 'mint should be enabled').to.true
      // When mint status is toggled again
      await dollarStoreKids.toggleMint()
      // Then minting should be disabled
      expect(await dollarStoreKids.isMintEnabled(), 'mint should be disabled').to.false
    })
  })

  context('Mint DSK', function () {
    beforeEach(async function () {
      await dollarStoreKids.toggleMint()
    })

    it('Should revert if minting is not allowed', async function () {
      // Given minting is disabled
      await dollarStoreKids.toggleMint()
      // Then mint should revert with mint-is-not-enabled
      await expect(dollarStoreKids.mint()).to.revertedWith('mint-is-not-enabled')
    })

    it('Should revert when mint tax is not sent', async function () {
      // When minting DSK without sending mint tax
      const tx = dollarStoreKids.connect(user1).mint()
      // Then revert with INCORRECT_TAX_AMOUNT = 19
      await expect(tx).to.revertedWith('19')
    })

    it('Should revert when there are no USDC in contract', async function () {
      // When minting DSK
      const tx = dollarStoreKids.connect(user1).mint({ value: mintTax })
      // Then revert with ERC20: transfer amount exceeds balance
      await expect(tx).to.revertedWith('ERC20: transfer amount exceeds balance')
    })

    it('Should mint DSK', async function () {
      // Given DSK has USDC balance
      await adjustERC20Balance(Address.USDC, dollarStoreKids.address, maxUsdcAmount)
      // Verify USDC balance
      expect(await usdc.balanceOf(dollarStoreKids.address), 'incorrect usdc balance').to.eq(maxUsdcAmount)
      // When minting DSK
      const tx = dollarStoreKids.connect(user1).mint({ value: mintTax })
      // Then verify event is emitted with proper args
      await expect(tx).to.emit(dollarStoreKids, 'DollarStoreKidsMinted').withArgs(user1.address, 0)
    })

    it('Should verify capsule data after DSK minting', async function () {
      // Given DSK has USDC balance
      await adjustERC20Balance(Address.USDC, dollarStoreKids.address, maxUsdcAmount)
      const id = (await capsule.counter()).toString()
      // When minting dollar
      await dollarStoreKids.connect(user1).mint({ value: mintTax })
      const uri = `${baseURI}${id}`
      // Then verify tokenURI is correct
      expect(await capsule.tokenURI(id), 'tokenURI is incorrect').to.eq(uri)
      const data = await capsuleMinter.singleERC20Capsule(capsule.address, id)
      // Then verify Minter has correct data for ERC20 Capsule
      expect(data._token, 'token should be USDC').to.eq(Address.USDC)
      expect(data._amount, 'amount in Capsule should be 1 USDC').to.eq('1000000')
    })

    it('Should revert when same address minting again', async function () {
      // Given DSK has USDC balance
      await adjustERC20Balance(Address.USDC, dollarStoreKids.address, maxUsdcAmount)
      // When minting DSK twice
      await dollarStoreKids.connect(user1).mint({ value: mintTax })
      const tx = dollarStoreKids.connect(user1).mint({ value: mintTax })
      // Then 2nd minting should revert with already-minted-dollar
      await expect(tx, 'should fail with correct message').to.revertedWith('already-minted-dsk')
    })
  })

  context('Burn DSK', function () {
    let id
    beforeEach(async function () {
      await dollarStoreKids.toggleMint()
      await adjustERC20Balance(Address.USDC, dollarStoreKids.address, maxUsdcAmount)
      id = await capsule.counter()
      await dollarStoreKids.connect(user2).mint({ value: mintTax })
    })

    it('should burn DSK', async function () {
      // Given user2 already minted DSK and approved DSK for burning
      await capsule.connect(user2).approve(dollarStoreKids.address, id)
      // Then verify user2 DSK balance is 1
      expect(await capsule.balanceOf(user2.address), 'incorrect balance').to.eq(1)
      // Then verify user2 is owner of DSK
      expect(await capsule.ownerOf(id), '!owner').to.eq(user2.address)
      // When user2 burns DSK
      const tx = dollarStoreKids.connect(user2).burn(id)
      // Then verify event is emitted with proper args
      await expect(tx).to.emit(dollarStoreKids, 'DollarStoreKidsBurnt').withArgs(user2.address, id)
      // Then verify user2 DSK balance is zero
      expect(await capsule.balanceOf(user2.address), 'incorrect balance').to.eq(0)
    })

    it('should verify USDC balance after burning DSK ', async function () {
      // Given user2 has a DSK
      const usdcBefore = await usdc.balanceOf(user2.address)
      await capsule.connect(user2).approve(dollarStoreKids.address, id)
      // When user2 is burns DSK
      await dollarStoreKids.connect(user2).burn(id)
      const usdcAfter = await usdc.balanceOf(user2.address)
      // Then USDC balance of user2 should increase by 1 USDC
      expect(usdcAfter, 'balance should be 1 USDC more than before').to.eq(usdcBefore.add('1000000'))
    })
  })

  context('Transfer collection ownership', function () {
    it('Should revert if non governor user call transfer ownership', async function () {
      const tx = dollarStoreKids.connect(user1).transferCollectionOwnership(user2.address)
      await expect(tx).to.revertedWith('not governor')
    })

    it('Should transfer collection ownership of DSK collection', async function () {
      expect(await capsule.owner()).to.eq(dollarStoreKids.address)
      await dollarStoreKids.transferCollectionOwnership(user1.address)
      expect(await capsule.owner()).to.eq(user1.address)
    })
  })

  context('Update MetaMaster', function () {
    it('Should revert if non governor user call update meta master', async function () {
      const tx = dollarStoreKids.connect(user1).updateMetamaster(user2.address)
      await expect(tx).to.revertedWith('not governor')
    })

    it('Should update meta master of DSK collection', async function () {
      expect(await capsule.tokenURIOwner()).to.eq(dollarStoreKids.address)
      await dollarStoreKids.updateMetamaster(user1.address)
      expect(await capsule.tokenURIOwner()).to.eq(user1.address)
    })
  })

  context('Update baseURI', function () {
    it('Should revert if non governor user call updateBaseURI', async function () {
      const tx = dollarStoreKids.connect(user1).updateBaseURI('https://google.com')
      await expect(tx).revertedWith('not governor')
    })

    it('Should update baseURI of DSK collection', async function () {
      const newBaseURI = 'https://www.google.com'
      expect(await capsule.baseURI()).eq(baseURI)
      await dollarStoreKids.updateBaseURI(newBaseURI)
      expect(await capsule.baseURI()).eq(newBaseURI)
    })
  })

  context('Royalty', function () {
    const ZERO_ADDRESS = ethers.constants.AddressZero
    it('Should allow governor to update royalty config', async function () {
      // Given royalty receiver and rate are not set
      expect(await capsule.royaltyReceiver(), 'receiver should be zero').eq(ZERO_ADDRESS)
      expect(await capsule.royaltyRate(), 'royalty rate should be zero').eq(0)
      //When updating config. User2 as receiver and 2% rate
      const tx = await dollarStoreKids.connect(governor).updateRoyaltyConfig(user2.address, 200)
      // Then verify receiver and rate are updated correctly and event is emitted
      expect(tx).emit(capsule, 'RoyaltyConfigUpdated').withArgs(ZERO_ADDRESS, user2.address, 0, 200)
      expect(await capsule.royaltyReceiver(), 'incorrect receiver').eq(user2.address)
      expect(await capsule.royaltyRate(), 'royalty rate should be 200').eq(200)
    })

    it('Should revert if non governor calls update', async function () {
      // When updating rate to > 100%
      const tx = dollarStoreKids.connect(user1).updateRoyaltyConfig(user2.address, 10001)
      // Then revert
      await expect(tx).revertedWith('not governor')
    })

    it('Should be able to get royalty info', async function () {
      // Given royalty config is not set.
      const royaltyInfo = await capsule.royaltyInfo(0, 0)
      // Then expect a response for token id 0 to be (zero address and 0 amount)
      expect(royaltyInfo.receiver, 'incorrect royalty receiver').to.eq(ZERO_ADDRESS)
      expect(royaltyInfo.royaltyAmount, 'incorrect output royalty amount').to.eq(0)

      // When updating the royaltyReceiver to user 2 and royaltyRate to 1%
      await dollarStoreKids.connect(governor).updateRoyaltyConfig(user2.address, 100)
      // When getting royalty info for tokenId 0 and sale price 500
      const royaltyInfo2 = await capsule.royaltyInfo(0, 500)
      // Then expect a response for token id 0 to be (user2, 1)
      expect(royaltyInfo2.receiver, 'incorrect royalty receiver').to.eq(user2.address)
      expect(royaltyInfo2.royaltyAmount, 'incorrect output royalty amount').to.eq(5)
    })
  })

  context('Sweep tokens', function () {
    it('Should sweep DAI from DSK', async function () {
      const dai = (await ethers.getContractAt('IERC20', Address.DAI)) as IERC20

      // Given someone send DAI to DSK contract
      const daiAmount = ethers.utils.parseEther('1500')
      await adjustERC20Balance(dai.address, dollarStoreKids.address, daiAmount)

      // Verify DSK has DAI
      expect(await dai.balanceOf(dollarStoreKids.address), 'incorrect DAI balance').eq(daiAmount)

      // When governor sweep DAI
      const tx = dollarStoreKids.sweep(dai.address)

      // Then verify DAI balance change
      await expect(tx).to.changeTokenBalances(dai, [dollarStoreKids, governor], [daiAmount.mul(-1), daiAmount])
    })
  })
})
