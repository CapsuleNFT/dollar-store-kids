import { HardhatUserConfig } from "hardhat/types";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
import "solidity-coverage";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "hardhat-contract-sizer";
import dotenv from "dotenv";
dotenv.config();

let contractSizer;

if (process.env.ENABLE_CONTRACT_SIZER === "true") {
  contractSizer = {
    alphaSort: false,
    runOnCompile: true,
  };
}

const localhost = "http://localhost:8545";

// DON'T PUT YOUR MNEMONIC HERE AND DO NOT COMMIT ANY MNEMONIC, IT SHOULD BE PLACED IN THE .ENV
const testMnemonic = "test test test test test test test test test test test junk";

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  contractSizer,
  gasReporter: {
    enabled: process.env.ENABLE_GAS_REPORTER === "true",
    noColors: true,
  },
  networks: {
    localhost: {
      url: localhost,
      saveDeployments: true,
    },
    mainnet: {
      url: process.env.NODE_URL || "",
      chainId: 1,
      accounts: { mnemonic: process.env.MNEMONIC || testMnemonic },
    },
    ropsten: {
      url: process.env.NODE_URL || "",
      chainId: 3,
      accounts: { mnemonic: process.env.MNEMONIC || testMnemonic },
    },
    rinkeby: {
      url: process.env.NODE_URL || "",
      chainId: 4,
      accounts: { mnemonic: process.env.MNEMONIC || testMnemonic },
    },
  },
  namedAccounts: {
    deployer: process.env.DEPLOYER || 0,
  },

  solidity: {
    version: "0.8.15",
    settings: {
      optimizer: {
        enabled: false,
        runs: 200,
      },
    },
  },
};

export default config;
