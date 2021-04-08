require("@nomiclabs/hardhat-ethers");

const { ethers, upgrades } = require("hardhat");

const { provider } = ethers;

const { parseEther } = ethers.utils;

const dollarAddr = "0x58a614E374b070AC650d69bE961F93d48a479498";
const governanceTokenAddr = "0x440b3e6DbdFdE1A10974aC726Eb511a2eAF66626";

const treasuryAddr = "0x247C08e7f043B960457676516A3258484aD8e7Bb";
const DAI = "0x33d000dfe25424ac6f87ac771728ff231d5b1e35"; //TESTDAI

const uniV2PairAddress = "0x13677c370F0fB57297cF8fcF2e9D43b65fbC5119";

const rootAddress = "0x6d1d3337A411c6381FFE4B49a7f59A970Db3929a";

const main = async () => {
  const owner = await provider.getSigner(0);
  const user1 = await provider.getSigner(1);

  const ownerAddress = await owner.getAddress();
  const user1Address = await user1.getAddress();
  console.log("ownerAddress  " + ownerAddress);
  console.log("user1Address  " + user1Address);

  console.log("deploy implementation");
  const impl = await ethers.getContractFactory("Implementation").then(x => x.deploy({ gasLimit: 6000000 }));

  console.log(
    JSON.stringify({
      implementation: impl.address,
    }),
  );
};

main();