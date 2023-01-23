import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const dollarStoreKidsOld = 'DollarStoreKids'
const dollarStoreKidsV2 = 'DollarStoreKidsV2'
const dskCollection = '0xC67F5E3a5B697AE004Edd8F84925189a81c6DC4b'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy, execute } = deployments
  const { deployer } = await getNamedAccounts()
  const dsk = await deploy(dollarStoreKidsV2, { from: deployer, log: true, args: [dskCollection] })

  await execute(dollarStoreKidsOld, { from: deployer, log: true }, 'transferCollectionOwnership', dsk.address)
}
export default func
func.tags = [dollarStoreKidsV2]
