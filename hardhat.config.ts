import { HardhatUserConfig } from 'hardhat/types'
import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'
import 'solidity-coverage'
import '@typechain/hardhat'
import 'hardhat-gas-reporter'
import 'hardhat-contract-sizer'
import './tasks/generate-abi'
import dotenv from 'dotenv'
dotenv.config()

let contractSizer

if (process.env.ENABLE_CONTRACT_SIZER === 'true') {
  contractSizer = {
    alphaSort: false,
    runOnCompile: true,
  }
}

const localhost = 'http://localhost:8545'

// DON'T PUT YOUR MNEMONIC HERE AND DO NOT COMMIT ANY MNEMONIC, IT SHOULD BE PLACED IN THE .ENV
const testMnemonic = 'test test test test test test test test test test test junk'

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  contractSizer,
  gasReporter: {
    enabled: process.env.ENABLE_GAS_REPORTER === 'true',
    noColors: true,
  },
  networks: {
    hardhat: {
      forking: {
        url: process.env.NODE_URL || localhost,
        blockNumber: process.env.BLOCK_NUMBER ? parseInt(process.env.BLOCK_NUMBER) : undefined,
      },
      saveDeployments: true,
    },
    localhost: {
      url: localhost,
      saveDeployments: true,
    },
    mainnet: {
      url: process.env.NODE_URL || '',
      chainId: 1,
      accounts: { mnemonic: process.env.MNEMONIC || testMnemonic },
    },
    ropsten: {
      url: process.env.NODE_URL || '',
      chainId: 3,
      accounts: { mnemonic: process.env.MNEMONIC || testMnemonic },
    },
    rinkeby: {
      url: process.env.NODE_URL || '',
      chainId: 4,
      accounts: { mnemonic: process.env.MNEMONIC || testMnemonic },
    },
  },
  namedAccounts: {
    deployer: process.env.DEPLOYER || 0,
  },

  solidity: {
    compilers: [
      {
        version: '0.8.15',
        settings: {
          outputSelection: {
            '*': {
              '*': ['storageLayout'],
            },
          },
        },
      },
      {
        version: '0.8.9',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          outputSelection: {
            '*': {
              '*': ['storageLayout'],
            },
          },
        },
      },
    ],
    overrides: {
      'contracts/test/imports.sol': { version: '0.8.9' },
    },
  },
}

export default config
