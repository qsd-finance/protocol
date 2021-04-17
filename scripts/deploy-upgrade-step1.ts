// import { ethers } from "hardhat";

require("@nomiclabs/hardhat-ethers");

const { ethers, upgrades } = require("hardhat");

const { provider } = ethers;

const { parseEther } = ethers.utils;

const dollarAddr = "0xBc7cbad358EeB296AEBeAEe6B854E86aC166c1a0"; //testnet
const governanceTokenAddr = "0xA1E3E85213F5D9f243104B942e9f5A59539F04e3"; //testnet

const treasuryAddr = "0x247C08e7f043B960457676516A3258484aD8e7Bb";
const DAI = "0x33D000dfe25424Ac6f87aC771728fF231d5b1E35"; //testnet

const uniV2PairAddress = "0xD9Ad7F4e150567163517cA0b6F2701c6891685ec"; //tesnet

const rootAddress = "0xCAfF3425Adc7C63be8DC2c050c6ae5f6A9163514"; //testnet

const main = async () => {
  const owner = await provider.getSigner(0);

  const ownerAddress = await owner.getAddress();
  console.log("ownerAddress  " + ownerAddress);

  const dollar = await ethers.getContractAt("Dollar", dollarAddr);
  const governanceToken = await ethers.getContractAt("Governance", governanceTokenAddr);

  // Deploy pool contracts

  console.log("do some poolBonding shit");
  const poolBonding = await ethers
    .getContractFactory("PoolBonding")
    .then(x =>
      x.deploy(rootAddress, dollar.address, dollar.address, governanceToken.address, DAI, { gasLimit: 6000000 }),
    );
  console.log("do some poolLP shit");
  const poolLP = await ethers
    .getContractFactory("PoolLP")
    .then(x => x.deploy(rootAddress, uniV2PairAddress, dollar.address, DAI, { gasLimit: 6000000 }));

  console.log(
    JSON.stringify({
      poolBonding: poolBonding.address,
      poolLP: poolLP.address,
      dollar: dollar.address,
      governanceToken: governanceToken.address,
      uniV2PairAddress,
    }),
  );
};

main();

console.log("Now go update the implementation contract, compile it and run step 2");
