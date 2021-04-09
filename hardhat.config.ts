// import { resolve } from "path";
// import { config as dotenvConfig } from "dotenv";
// dotenvConfig({ path: resolve(__dirname, "./.env") });

// import { HardhatUserConfig } from "hardhat/config";

require("@tenderly/hardhat-tenderly");

require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
const { mnemonic, etherscan_key } = require("./secrets.json");
require("hardhat-abi-exporter");
import "@nomiclabs/hardhat-etherscan";

// module.exports =  {
//   solidity: {
//     compilers: [
//     version: "0.5.17",
//     settings: {
//       optimizer: {
//         enabled: true,
//         runs: 200,
//       },
//     },
//   ]},
//   paths: {
//     artifacts: "./artifacts",
//     cache: "./cache",
//     sources: "./contracts",
//     tests: "./test",
//   },
//   networks: {
//     localhost: {
//       url: "http://localhost:8545",
//     },
//     hardhat: {
//       // forking: {
//       //   enabled: true,
//       //   url: "https://mainnet.infura.io/v3/58073b4a32df4105906c702f167b91d2",
//       //   blockNumber: 11728264
//       // },
//       // chainId: 1,
//       // accounts: {
//       //   mnemonic: "myth like bonus scare over problem client lizard pioneer submit female collect",
//     },
//     testnet: {
//       url: "https://data-seed-prebsc-1-s1.binance.org:8545",
//       chainId: 97,
//       gasPrice: 20000000000,
//       accounts: { mnemonic: mnemonic },
//     },
//     mainnet: {
//       url: "https://bsc-dataseed.binance.org/",
//       chainId: 56,
//       gasPrice: 20000000000,
//       accounts: { mnemonic: mnemonic },
//     },
//   },
// };

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545/",
    },
    hardhat: {
      forking: {
        url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      },
    },
    testnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      gasPrice: 20000000000,
      accounts: { mnemonic: mnemonic },
    },
    bscmainnet: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      gasPrice: 5000000000,
      accounts: { mnemonic: mnemonic },
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.5.17",
        settings: {
          optimizer: {
            enabled: true,
          },
        },
      },
      {
        version: "0.7.1",
        settings: {
          optimizer: {
            enabled: true,
          },
        },
      },
      {
        version: "0.6.3",
        settings: {
          optimizer: {
            enabled: true,
          },
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 20000,
  },
  abiExporter: {
    path: "./data/abi",
    clear: true,
    flat: false,
    only: [],
    spacing: 2,
  },
  tenderly: {
    username: "JimmyFx",
    project: "project",
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: etherscan_key,
  },
};
