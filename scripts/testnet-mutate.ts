import { parse } from "@solidity-parser/parser";
import { ethers } from "hardhat";

const { provider } = ethers;

const { parseEther } = ethers.utils;

const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

const UNISWAP_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
const UNISWAP_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

const blockchainFuture = async () => {
  const blockNumber = await provider.getBlockNumber();
  const block = await provider.getBlock(blockNumber);

  return block.timestamp + 6000;
};

const address = {
  dao: "0xEc9dCB3DC47FF5edc02666cE4Db459841853B7B4",
  poolBonding: "0xCd72c0A874782d7D5c85208c1bbAE46c409478dd",
  poolLP: "0xDBAf2265C74AD30a90B08D14E8097D13B891a2cF",
  poolGov: "0xD9122DB4cB0E1c42dA965Ee5D25606C7ef607145",
  dollar: "0x35b4EBBb9bD9d967B1EFE4ccDDCe38F22E38198c",
  governanceToken: "0x9f54B1E1122AE6978A70fdE254CA95Ae6Df35459",
  uniV2PairAddress: "0x3a06787da3507528b33Fe28C2207456B6c687871",
};

const main = async () => {
  const [owner, user1] = await ethers.getSigners();

  const dollar = await ethers.getContractAt("Dollar", address.dollar);
  const governanceToken = await ethers.getContractAt("Governance", address.governanceToken);
  const dai = dollar.attach(DAI);
  const uniswapRouter = await ethers.getContractAt("IUniswapV2Router02", UNISWAP_ROUTER);
  const uniV2Token = await dollar.attach(address.uniV2PairAddress);
  const dao = await ethers.getContractAt("Implementation", address.dao);

  const poolBonding = await ethers.getContractAt("PoolBonding", address.poolBonding);
  const poolLP = await ethers.getContractAt("PoolLP", address.poolLP);
  const poolGov = await ethers.getContractAt("PoolGov", address.poolGov);

  // const impl = await ethers.getContractFactory("Implementation").then(x => x.deploy({ gasLimit: 8000000 }));

  // console.log(impl.address)

  // await dollar.connect(user1).approve(poolBonding.address, ethers.constants.MaxUint256);
  // await poolBonding.connect(user1).deposit(100);
  // await poolBonding.connect(user1).bond(100);

  // await dollar.connect(user1).approve(uniswapRouter.address, ethers.constants.MaxUint256);
  for (let i = 0; i < 10; i++) {
    await uniswapRouter
      .connect(user1)
      .swapExactETHForTokens(0, [WETH, DAI, dollar.address], await user1.getAddress(), await blockchainFuture(), {
        value: parseEther("0.1"),
      })
      .then(x => x.wait());
  }

  // Approve
  // await dollar.connect(user1).approve(dao.address, ethers.constants.MaxUint256);
  // await dao.connect(user1).deposit(parseEther("25"));
  // await dollar.connect(user1).transfer("0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0", parseEther("50"));
  // for (let i = 0; i < 72; i++) {
  //   await dao.connect(owner).advance({ gasLimit: 1000000 });
  //   const epoch = await dao.epoch();
  //   console.log("epoch", epoch);
  // }
  //   await user1.sendTransaction({
  //     to: "0x3ad174B6a80575268e6736bC6F27E6d253910e41",
  //     value: parseEther("100"),
  //   });

  // await uniV2Token
  //   .connect(user1)
  //   .transfer("0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0", await uniV2Token.balanceOf(user1.address));
  //   console.log("amount", await uniV2Token.balanceOf("0xAbcCB8f0a3c206Bb0468C52CCc20f3b81077417B"));
};

main();
