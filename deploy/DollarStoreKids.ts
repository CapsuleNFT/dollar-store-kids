import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const dollarStoreKids = 'DollarStoreKids'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()

  await deploy(dollarStoreKids, {
    from: deployer,
    log: true,
    args: ['ipfs://bafybeigdpqvfrvddgbteaugtcomffhauxcyba777iiifbwmffrqd73voeu/'],
    value: ethers.utils.parseEther('0.025'),
  })
}
export default func
func.tags = [dollarStoreKids]
