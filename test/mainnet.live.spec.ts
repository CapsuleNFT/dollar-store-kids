import { ethers } from 'hardhat'
import { expect } from 'chai'
import { IERC20, DollarStoreKids } from '../typechain-types'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { impersonateAccount, setBalance } from '@nomicfoundation/hardhat-network-helpers'

describe('Dollar Store Kids live tests', async function () {
  const usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  const dskAddress = '0xE4c3c91De9Eb9b92CedeE9ddB1e4d3388318151c'
  const governorAddress = '0x53a50ac9Bb98dFd61d4031390ebecC4e2bD7f9b1'

  let dollarStoreKids: DollarStoreKids, capsuleMinter
  let capsule, usdc: IERC20
  let governor: SignerWithAddress, user1: SignerWithAddress, user2: SignerWithAddress, user3: SignerWithAddress
  let mintTax

  before(async function () {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;[user1, user2, user3] = await ethers.getSigners()
    await impersonateAccount(governorAddress)
    await setBalance(governorAddress, ethers.utils.parseEther('10'))
    governor = await ethers.getSigner(governorAddress)
  })

  beforeEach(async function () {
    dollarStoreKids = (await ethers.getContractAt('DollarStoreKids', dskAddress)) as DollarStoreKids

    const collection = await dollarStoreKids.capsuleCollection()
    expect(collection).to.properAddress
    capsule = await ethers.getContractAt('ICapsule', collection)

    capsuleMinter = await ethers.getContractAt('ICapsuleMinter', await dollarStoreKids.CAPSULE_MINTER())
    mintTax = await capsuleMinter.capsuleMintTax()
    usdc = (await ethers.getContractAt('IERC20', usdcAddress)) as IERC20
  })

  context('Mint DSK', function () {
    beforeEach(async function () {
      if (!(await dollarStoreKids.isMintEnabled())) {
        await dollarStoreKids.connect(governor).toggleMint()
      }
    })

    it('Should verify capsule data after DSK minting', async function () {
      const id = (await capsule.counter()).toString()
      // When minting dollar
      await dollarStoreKids.connect(user1).mint({ value: mintTax })
      const uri = `${await capsule.baseURI()}${id}`
      // Then verify tokenURI is correct
      expect(await capsule.tokenURI(id), 'tokenURI is incorrect').to.eq(uri)
      const data = await capsuleMinter.singleERC20Capsule(capsule.address, id)
      // Then verify Minter has correct data for ERC20 Capsule
      expect(data._token, 'token should be USDC').to.eq(usdcAddress)
      expect(data._amount, 'amount in Capsule should be 1 USDC').to.eq('1000000')
    })

    it('Should revert when same address minting again', async function () {
      // When minting DSK twice
      await dollarStoreKids.connect(user3).mint({ value: mintTax })
      const tx = dollarStoreKids.connect(user3).mint({ value: mintTax })
      // Then 2nd minting should revert with already-minted-dollar
      await expect(tx, 'should fail with correct message').to.revertedWith('already-minted-dsk')
    })
  })

  context('Burn DSK', function () {
    let id
    beforeEach(async function () {
      if (!(await dollarStoreKids.isMintEnabled())) {
        await dollarStoreKids.connect(governor).toggleMint()
      }
      id = await capsule.counter()
      await dollarStoreKids.connect(user2).mint({ value: mintTax })
    })

    it('should burn DSK', async function () {
      const usdcBefore = await usdc.balanceOf(user2.address)
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
      const usdcAfter = await usdc.balanceOf(user2.address)
      // Then USDC balance of user2 should increase by 1 USDC
      expect(usdcAfter, 'balance should be 1 USDC more than before').to.eq(usdcBefore.add('1000000'))
    })
  })
})
