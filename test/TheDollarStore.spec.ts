import { ethers } from 'hardhat'
import { expect } from 'chai'
import { ICapsule, ICapsuleFactory, ICapsuleMinter, IERC20, TheDollarStore } from '../typechain-types'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
const BigNumber = ethers.BigNumber
const { hexlify, solidityKeccak256, zeroPad, hexStripZeros } = ethers.utils
import { impersonateAccount, setBalance } from '@nomicfoundation/hardhat-network-helpers'

describe('Dollar Store tests', async function () {
  const capsuleFactoryAddress = '0x4Ced59c19F1f3a9EeBD670f746B737ACf504d1eB'
  const usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  const baseURI = 'http://localhost/'
  let dollarStore: TheDollarStore, capsuleFactory: ICapsuleFactory, capsuleMinter: ICapsuleMinter
  let capsule: ICapsule, usdc: IERC20
  let governor: SignerWithAddress, user1: SignerWithAddress, user2: SignerWithAddress

  let capsuleCollectionTax, mintTax, maxUsdcAmount

  async function getUSDC(dollarStore: string, usdcAmount: string | number) {
    const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    const balanceSlot = 9
    const index = hexStripZeros(hexlify(solidityKeccak256(['uint256', 'uint256'], [dollarStore, balanceSlot])))
    const value = hexlify(zeroPad(BigNumber.from(usdcAmount).toHexString(), 32))
    await ethers.provider.send('hardhat_setStorageAt', [USDC, index, value])
    await ethers.provider.send('evm_mine', [])
  }

  before(async function () {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;[governor, user1, user2] = await ethers.getSigners()
  })

  beforeEach(async function () {
    capsuleFactory = (await ethers.getContractAt('ICapsuleFactory', capsuleFactoryAddress)) as ICapsuleFactory
    capsuleCollectionTax = await capsuleFactory.capsuleCollectionTax()
    // Note setting owner address here so that later we don't have to call connect for owner
    const factory = await ethers.getContractFactory('TheDollarStore', governor)
    dollarStore = (await factory.deploy(baseURI, { value: capsuleCollectionTax })) as TheDollarStore

    const collection = await dollarStore.capsuleCollection()
    expect(collection).to.properAddress
    capsule = (await ethers.getContractAt('ICapsule', collection)) as ICapsule

    capsuleMinter = (await ethers.getContractAt('ICapsuleMinter', await dollarStore.CAPSULE_MINTER())) as ICapsuleMinter
    mintTax = await capsuleMinter.capsuleMintTax()
    maxUsdcAmount = ethers.utils.parseUnits((await dollarStore.MAX_DOLLARS()).toString(), 6)
    usdc = (await ethers.getContractAt('IERC20', usdcAddress)) as IERC20
  })

  context('Verify deployment', function () {
    it('Should verify dollar store deployed correctly', async function () {
      // Given Dollar Store is deployed and collection is created
      const maxDollars = await dollarStore.MAX_DOLLARS()
      const maxId = await capsule.maxId()
      // Then maxId should be 1 less than maxDollars. MaxId starts from 0
      expect(maxId, 'collection is not locked properly').to.eq(maxDollars - 1)
      expect(await dollarStore.isMintEnabled(), 'Minting should be disabled').to.false
      const allowance = await usdc.allowance(dollarStore.address, capsuleMinter.address)
      expect(allowance, 'incorrect allowance').to.eq(maxUsdcAmount)
    })
  })

  describe('Mint status', function () {
    it('Should revert if non governor toggle mint status', async function () {
      // When mint status is toggled by non governor user
      const tx = dollarStore.connect(user2).toggleMint()
      // Then revert with
      await expect(tx).to.revertedWith('not governor')
    })

    it('Should toggle mint status', async function () {
      // Given Dollar Stored is deployed
      expect(await dollarStore.isMintEnabled(), 'mint should be disabled').to.false
      // When mint status is toggled
      await dollarStore.toggleMint()
      // Then minting should be enabled
      expect(await dollarStore.isMintEnabled(), 'mint should be enabled').to.true
      // When mint status is toggled again
      await dollarStore.toggleMint()
      // Then minting should be disabled
      expect(await dollarStore.isMintEnabled(), 'mint should be disabled').to.false
    })
  })

  context('Mint Dollar', function () {
    beforeEach(async function () {
      await dollarStore.toggleMint()
    })

    it('Should revert if minting is not allowed', async function () {
      // Given minting is disabled
      await dollarStore.toggleMint()
      // Then mint should revert with mint-is-not-enabled
      await expect(dollarStore.mint()).to.revertedWith('mint-is-not-enabled')
    })

    it('Should revert when mint tax is not sent', async function () {
      // When minting dollar without sending mint tax
      const tx = dollarStore.connect(user1).mint()
      // Then revert with INCORRECT_TAX_AMOUNT = 19
      await expect(tx).to.revertedWith('19')
    })

    it('Should revert when there are no USDC in contract', async function () {
      // When minting dollar
      const tx = dollarStore.connect(user1).mint({ value: mintTax })
      // Then revert with ERC20: transfer amount exceeds balance
      await expect(tx).to.revertedWith('ERC20: transfer amount exceeds balance')
    })

    it('Should mint Dollar', async function () {
      // Given Dollar Store has USDC balance
      await getUSDC(dollarStore.address, maxUsdcAmount)
      // Verify USDC balance
      expect(await usdc.balanceOf(dollarStore.address), 'incorrect usdc balance').to.eq(maxUsdcAmount)
      // When minting dollar
      const tx = await dollarStore.connect(user1).mint({ value: mintTax })
      // Then verify event is emitted with proper args
      expect(tx).to.emit(dollarStore, 'DollarMinted').withArgs(user1.address, 0)
    })

    it('Should verify capsule data after Dollar minting', async function () {
      // Given Dollar Store has USDC balance
      await getUSDC(dollarStore.address, maxUsdcAmount)
      const id = (await capsule.counter()).toString()
      // When minting dollar
      await dollarStore.connect(user1).mint({ value: mintTax })
      const uri = `${baseURI}${id}`
      // Then verify tokenURI is correct
      expect(await capsule.tokenURI(id), 'tokenURI is incorrect').to.eq(uri)
      const data = await capsuleMinter.singleERC20Capsule(capsule.address, id)
      // Then verify Minter has correct data for ERC20 Capsule
      expect(data._token, 'token should be USDC').to.eq(usdcAddress)
      expect(data._amount, 'amount in Capsule should be 1 USDC').to.eq('1000000')
    })

    it('Should revert when same address minting again', async function () {
      // Given Dollar Store has USDC balance
      await getUSDC(dollarStore.address, maxUsdcAmount)
      // When minting dollar twice
      await dollarStore.connect(user1).mint({ value: mintTax })
      const tx = dollarStore.connect(user1).mint({ value: mintTax })
      // Then 2nd minting should revert with already-minted-dollar
      await expect(tx, 'should fail with correct message').to.revertedWith('already-minted-dollar')
    })
  })

  context('Burn Dollar', function () {
    let id
    beforeEach(async function () {
      await dollarStore.toggleMint()
      await getUSDC(dollarStore.address, maxUsdcAmount)
      id = await capsule.counter()
      await dollarStore.connect(user2).mint({ value: mintTax })
    })

    it('should burn Dollar', async function () {
      // Given user2 already minted Dollar and approved Dollar for burning
      await capsule.connect(user2).approve(dollarStore.address, id)
      // Then verify user2 Dollar balance is 1
      expect(await capsule.balanceOf(user2.address), 'incorrect balance').to.eq(1)
      // Then verify user2 is owner of Dollar
      expect(await capsule.ownerOf(id), '!owner').to.eq(user2.address)
      // When user2 burns Dollar
      const tx = await dollarStore.connect(user2).burn(id)
      // Then verify event is emitted with proper args
      expect(tx).to.emit(dollarStore, 'DollarBurnt').withArgs(user2.address, id)
      // Then verify user2 Dollar balance is zero
      expect(await capsule.balanceOf(user2.address), 'incorrect balance').to.eq(0)
    })

    it('should verify USDC balance after burning Dollar', async function () {
      // Given user2 has a Dollar
      const usdcBefore = await usdc.balanceOf(user2.address)
      await capsule.connect(user2).approve(dollarStore.address, id)
      // When user2 is burns Dollar
      await dollarStore.connect(user2).burn(id)
      const usdcAfter = await usdc.balanceOf(user2.address)
      // Then USDC balance of user2 should increase by 1 USDC
      expect(usdcAfter, 'balance should be 1 USDC more than before').to.eq(usdcBefore.add('1000000'))
    })
  })

  context('Transfer collection ownership', function () {
    it('Should revert if non governor user call transfer ownership', async function () {
      const tx = dollarStore.connect(user1).transferCollectionOwnership(user2.address)
      await expect(tx).to.revertedWith('not governor')
    })

    it('Should transfer collection ownership of Dollar collection', async function () {
      expect(await capsule.owner()).to.eq(dollarStore.address)
      await dollarStore.transferCollectionOwnership(user1.address)
      expect(await capsule.owner()).to.eq(user1.address)
    })
  })

  context('Update MetaMaster', function () {
    it('Should revert if non governor user call update meta master', async function () {
      const tx = dollarStore.connect(user1).updateMetaMaster(user2.address)
      await expect(tx).to.revertedWith('not governor')
    })

    it('Should update meta master of Dollar collection', async function () {
      expect(await capsule.tokenURIOwner()).to.eq(dollarStore.address)
      await dollarStore.updateMetaMaster(user1.address)
      expect(await capsule.tokenURIOwner()).to.eq(user1.address)
    })
  })

  context('Sweep tokens', function () {
    it('Should sweep DAI from Dollar Store', async function () {
      const daiAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
      const daiWhale = '0x6c6bc977e13df9b0de53b251522280bb72383700'
      // Add 10 ETH to whale account
      await setBalance(daiWhale, ethers.utils.parseEther('10'))

      // Impersonate DAI whale account
      await impersonateAccount(daiWhale)
      const whaleSigner = await ethers.getSigner(daiWhale)
      const dai = (await ethers.getContractAt('IERC20', daiAddress)) as IERC20

      // Given someone send DAI to Dollar Store
      const daiAmount = ethers.utils.parseEther('1500')
      await dai.connect(whaleSigner).transfer(dollarStore.address, daiAmount)

      // Verify Dollar Store has DAI
      const daiBalance = await dai.balanceOf(dollarStore.address)
      expect(daiBalance, 'incorrect DAI balance').to.eq(daiAmount)
      // Verify governor has no DAI
      const daiBalanceOwner = await dai.balanceOf(governor.address)
      expect(daiBalanceOwner, 'DAI balance should be zero').to.eq(0)

      // When governor sweep DAI
      await dollarStore.sweep(daiAddress)

      // Then verify Dollar Store has no DAI
      const daiBalance2 = await dai.balanceOf(dollarStore.address)
      expect(daiBalance2, 'DAI balance should be zero').to.eq(0)
      // Then verify governor has new DAI balance
      const daiBalanceOwner2 = await dai.balanceOf(governor.address)
      expect(daiBalanceOwner2, 'incorrect DAI balance').to.eq(daiAmount)
    })
  })
})
