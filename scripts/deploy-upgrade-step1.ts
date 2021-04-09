// import { ethers } from "hardhat";

require("@nomiclabs/hardhat-ethers");

const { ethers, upgrades } = require("hardhat");

const { provider } = ethers;

const { parseEther } = ethers.utils;

const dollarAddr = "0xE8F12Efeb864b152AbBf6826338516746BB70820";
const governanceTokenAddr = "0x97f721c18166eeb5Dee72873fd07bfD1b4D5F3A4";

const treasuryAddr = "0x247C08e7f043B960457676516A3258484aD8e7Bb";
const DAI = "0xe9e7cea3dedca5984780bafc599bd69add087d56"; //BUSD

const uniV2PairAddress = "0x83abc20d35fc4c0acf5d61f026107c94788373fa";

const rootAddress = "0x0a28D6F9a63739176B36Eba95B0c95df360691E5";

const main = async () => {
  const owner = await provider.getSigner(2);

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
