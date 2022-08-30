import { task } from 'hardhat/config'
import fs from 'fs'

const contractNames = ['DollarStoreKids']
const abiDir = 'abi'

function readFile(fileName) {
  return JSON.parse(fs.readFileSync(fileName).toString())
}

function getContractAddress(contractName, networkName) {
  const nName = networkName === 'hardhat' ? 'localhost' : networkName
  const deployDataFile = `./deployments/${nName}/${contractName}.json`
  if (fs.existsSync(deployDataFile)) {
    const deployData = readFile(deployDataFile)
    return deployData.address
  }
}

function writeContractData(abiSource, contractName, networkName, chainId) {
  const destFile = `${abiDir}/${contractName}.json`
  const abi = readFile(abiSource).abi
  const address = getContractAddress(contractName, networkName)
  let contractData = {
    networks: {
      [chainId]: {
        address,
        abi,
      },
    },
  }
  if (fs.existsSync(destFile)) {
    contractData = readFile(destFile)
    contractData.networks[chainId] = { address, abi }
  }
  fs.writeFileSync(destFile, JSON.stringify(contractData, null, 2))
}

task('generate-abi', 'Generate ABI')
  .addOptionalParam(
    'networkName',
    'network name. Default to localhost. It will be used to read deployed address, if any.'
  )
  .setAction(async function ({ networkName = 'localhost' }, hre) {
    if (!hre.config.networks[networkName]) {
      throw new Error(`Network configuration is missing for ${networkName}`)
    }
    const chainId = hre.config.networks[networkName].chainId || 31337
    for (const name of contractNames) {
      const abiFileName = `artifacts/contracts/${name}.sol/${name}.json`
      writeContractData(abiFileName, name, networkName, chainId)
    }
  })
