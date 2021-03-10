import { resolve } from "path";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: resolve(__dirname, "./.env") });

import { HardhatUserConfig } from "hardhat/config";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.5.17",
        settings: {
          optimizer: {
          enabled: true,
          runs: 200,
          },
        },
      },
      {
        version: "0.6.2", //"0.5.17",
        settings: {
          optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  ]
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
      accounts: {mnemonic: "busy junk employ candy express barely replace seminar abandon yellow royal dragon"} 
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
    bsctestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      gasPrice: 20000000000,
      blockGasLimit: 3033580,
      accounts: {mnemonic: "inflict artist merge observe tobacco roast toward invest fit romance provide basket"} //0x183fd225C946712ed8A7C7583B5D5efb964835c9
    },
  },
  etherscan: {apiKey: "Z4YXSKDYMP79MN22ZEPD2I513YQY42ER7U"},
};

export default config;

