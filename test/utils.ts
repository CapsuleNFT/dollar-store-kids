import { ethers } from 'hardhat'

import { IERC20 } from '../typechain-types'
import { setBalance } from '@nomicfoundation/hardhat-network-helpers'
import { BigNumberish } from 'ethers'

const Address = {
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  CAPSULE_FACTORY: '0x4Ced59c19F1f3a9EeBD670f746B737ACf504d1eB',
  DEPLOYER: '0x53a50ac9Bb98dFd61d4031390ebecC4e2bD7f9b1',
  DSK_COLLECTION: '0xC67F5E3a5B697AE004Edd8F84925189a81c6DC4b',
  DSK_V2: '0x22d8f86350E983de8758eaF66A19558b73F11A00',
}
const erc20WhaleWallet = {
  [Address.USDC]: '0x0a59649758aa4d66e25f08dd01271e891fe52199',
  [Address.DAI]: '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
}

async function adjustERC20Balance(token: string, receiver: string, amount: BigNumberish) {
  const walletWithBalance = erc20WhaleWallet[token]
  if (walletWithBalance === undefined) {
    throw new Error(`Missing token ${token} configuration.`)
  }
  const tokenObj = (await ethers.getContractAt('IERC20', token)) as IERC20
  const balance = await tokenObj.balanceOf(walletWithBalance)

  if (balance.lt(amount)) {
    throw new Error('Wallet has less token balance than requested amount')
  }

  // Set some ETH at wallet for transfer
  await setBalance(walletWithBalance, ethers.utils.parseEther('1'))

  const walletSigner = await ethers.getImpersonatedSigner(walletWithBalance)
  await tokenObj.connect(walletSigner).transfer(receiver, amount)
  return tokenObj.balanceOf(receiver)
}

export { Address, adjustERC20Balance }
