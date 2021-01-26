import { resolve } from "path";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: resolve(__dirname, "./.env") });

import { HardhatUserConfig } from "hardhat/config";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.5.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  networks: {
    localhost: {
      url: "http://localhost:8545",
    },
    hardhat: {
      forking: {
        enabled: true,
        url: "https://mainnet.infura.io/v3/58073b4a32df4105906c702f167b91d2",
        blockNumber: 11728264
      },
      chainId: 1,
      accounts: {
        mnemonic: "myth like bonus scare over problem client lizard pioneer submit female collect",
      },
    },
  },
};

export default config;
