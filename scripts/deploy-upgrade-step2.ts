require("@nomiclabs/hardhat-ethers");

const { ethers, upgrades } = require("hardhat");

const { provider } = ethers;

const { parseEther } = ethers.utils;

// const dollarAddr = "0xd93B719017FaBbAb4E94BE2A8b93287bc2918c7F"; //testnet
// const governanceTokenAddr = "0x69a0118BF01Cd76C45e470CD3331631593dD72eF"; //testnet

// const treasuryAddr = "0x247C08e7f043B960457676516A3258484aD8e7Bb";
// const DAI = "0x33D000dfe25424Ac6f87aC771728fF231d5b1E35"; //testnet

// const uniV2PairAddress = "0xf1c5d05eD032EF2Eca202c55646FdFFD41354B6e"; //testnet

// const rootAddress = "0xFfBabED8FEba6cC5a1274f72901473693C26EDc6"; //testnet

const main = async () => {
  const owner = await provider.getSigner(0);

  const ownerAddress = await owner.getAddress();
  console.log("ownerAddress  " + ownerAddress);

  console.log("deploy implementation");
  const impl = await ethers.getContractFactory("Implementation").then(x => x.deploy({ gasLimit: 6000000 }));

  console.log(
    JSON.stringify({
      implementation: impl.address,
    }),
  );
};

main();
