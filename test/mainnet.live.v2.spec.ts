import { ethers } from 'hardhat'
import { expect } from 'chai'
import { IERC20, DollarStoreKidsV2, ICapsule, ICapsuleMinter } from '../typechain-types'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { setBalance } from '@nomicfoundation/hardhat-network-helpers'
import { Address } from './utils'

describe('DSK V2 live tests', async function () {
  const usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

  let dollarStoreKids: DollarStoreKidsV2, capsuleMinter: ICapsuleMinter
  let capsule, usdc: IERC20
  let deployer: SignerWithAddress, alice: SignerWithAddress
  let mintTax

  before(async function () {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;[alice] = await ethers.getSigners()
    deployer = await ethers.getImpersonatedSigner(Address.DEPLOYER)
    await setBalance(deployer.address, ethers.utils.parseEther('10'))

    dollarStoreKids = (await ethers.getContractAt('DollarStoreKidsV2', Address.DSK_V2)) as DollarStoreKidsV2

    capsule = (await ethers.getContractAt('ICapsule', Address.DSK_COLLECTION)) as ICapsule

    const minter = await dollarStoreKids.CAPSULE_MINTER()
    capsuleMinter = (await ethers.getContractAt('ICapsuleMinter', minter)) as ICapsuleMinter
    mintTax = await capsuleMinter.capsuleMintTax()

    usdc = (await ethers.getContractAt('IERC20', usdcAddress)) as IERC20
  })

  context('Mint DSK', function () {
    it('Should verify current counter is at 3333', async function () {
      expect(await capsule.counter()).to.eq(3333)
    })

    it('Should revert mint call', async function () {
      if (!(await dollarStoreKids.isMintEnabled())) {
        await dollarStoreKids.connect(deployer).toggleMint()
      }
      const tx = dollarStoreKids.connect(alice).mint({ value: mintTax })
      await expect(tx).to.revertedWith('max-supply-reached')
    })
  })

  context('Burn DSK', function () {
    it('should burn DSK', async function () {
      const id = 64 // DSK id owned by deployer
      const usdcBefore = await usdc.balanceOf(deployer.address)

      // given deployer DSK balance is 1
      expect(await capsule.balanceOf(deployer.address)).to.eq(1)
      // then verify deployer is owner of DSK
      expect(await capsule.ownerOf(id), '!owner').to.eq(deployer.address)

      // when deployer burns DSK
      const tx = dollarStoreKids.connect(deployer).burn(id)

      // then verify event is emitted with proper args
      await expect(tx).to.emit(dollarStoreKids, 'DollarStoreKidsBurnt').withArgs(deployer.address, id)
      // then verify deployer DSK balance is zero
      expect(await capsule.balanceOf(deployer.address)).to.eq(0)
      const usdcAfter = await usdc.balanceOf(deployer.address)
      // Then USDC balance of deployer should increase by 1 USDC
      expect(usdcAfter).to.eq(usdcBefore.add('1000000'))
    })
  })
})
