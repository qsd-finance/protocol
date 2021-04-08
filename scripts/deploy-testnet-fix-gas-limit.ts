const { ethers, upgrades } = require("hardhat");

const { provider } = ethers;

const { parseEther } = ethers.utils;

const DAI = "0x33d000dfe25424ac6f87ac771728ff231d5b1e35"; //fakeDAI //'0xec5dcb5dbf4b114c9d0f65bccab49ec54f6a0867'; //bsctestnet dai    //"0x6b175474e89094c44da98b954eedeac495271d0f";

const UNISWAP_FACTORY = "0xB9fA84912FF2383a617d8b433E926Adf0Dd3FEa1"; //NarwhalswapFactory     //"0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
const UNISWAP_ROUTER = "0xE85C6ab56A3422E7bAfd71e81Eb7d0f290646078"; //NarwhalswapRouter      // original value: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

const blockchainFuture = async () => {
  const blockNumber = await provider.getBlockNumber();
  const block = await provider.getBlock(blockNumber);

  return block.timestamp + 15000;
};

const main = async () => {
  const owner = await provider.getSigner(0);
  const user1 = await provider.getSigner(1);

  const ownerAddress = await owner.getAddress();
  const user1Address = await user1.getAddress();
  console.log("ownerAddress  " + ownerAddress);
  console.log("user1Address  " + user1Address);

  // // 1. Deploy tokens and oracle
  // console.log("Deploying Dollar");
  // const dollar = await ethers.getContractFactory("Dollar").then(x => x.deploy());
  // console.log("Dollar contract is " + dollar.address);
  // console.log("Deploying gov token");
  // const governanceToken = await ethers.getContractFactory("Governance").then(x => x.deploy());
  // console.log("governanceToken contract is " + governanceToken.address);
  // const dai = dollar.attach(DAI);

  // // 2. Supply to Uniswap and do some trades
  const uniswapRouter = await ethers.getContractAt("INarwhalswapRouter02", UNISWAP_ROUTER); //const uniswapRouter = await ethers.getContractAt("IUniswapV2Router02", UNISWAP_ROUTER);
  // console.log("minting 35000 tokens to " + user1Address);
  // await dollar.mint(user1Address, parseEther("35000"));
  // await dollar.mint("0x0cB8F68A167Cd11715d5589cF9858892DDa91a3B", parseEther("2500")); //Jimmy later mint for testing
  // console.log("minted 2500 tokens to " + "0x0cB8F68A167Cd11715d5589cF9858892DDa91a3B");
  // //console.log('do some token swap shit')
  // /*await uniswapRouter
  //   .connect(user1)
  //   //.swapExactETHForTokens(0, [WETH, DAI], user1Address, await blockchainFuture(), { value: parseEther("100") })
  //   .swapExactBNBForTokens(0, [WETH, DAI], user1Address, await blockchainFuture(), { value: parseEther("1") })
  //   .then(x => x.wait());*/
  // console.log("approve user1 to trade dollar on uni");
  // await dollar.connect(user1).approve(uniswapRouter.address, ethers.constants.MaxUint256);
  // console.log("approve user1 to trade fakeDAI on uni");
  // await dollar.attach(DAI).connect(user1).approve(uniswapRouter.address, ethers.constants.MaxUint256);

  let dollarAddress = "0xCcF82f696E37FfbcD8C5ce7Ea8607c14F95DaCb6";

  console.log("add liq");
  await uniswapRouter
    .connect(ownerAddress)
    .addLiquidity(
      dollarAddress,
      DAI,
      parseEther("21000"),
      parseEther("21000"),
      parseEther("20000"),
      parseEther("20000"),
      ownerAddress,
      await blockchainFuture(),
      { from: ownerAddress, gasLimit: 8000000, value: 100000 },
    );
  /*console.log('swap thru our pool')
    await uniswapRouter
      .connect(user1)
      .swapExactTokensForTokens(parseEther("2500"), 0, [DAI, dollar.address], user1Address, await blockchainFuture())
      .then(x => x.wait()); */

  //   console.log("now getting uni contracts up");
  //   const uniswapFactory = await ethers.getContractAt("INarwhalswapFactory", UNISWAP_FACTORY); //const uniswapFactory = await ethers.getContractAt("IUniswapV2Factory", UNISWAP_FACTORY);
  //   const uniV2PairAddress = await uniswapFactory.getPair(DAI, dollar.address);
  //   const uniV2Token = await dollar.attach(uniV2PairAddress);

  //   // 3. Deploy implementation and dao
  //   console.log("deploy implementation");
  //   const impl = await ethers.getContractFactory("Implementation").then(x => x.deploy({ gasLimit: 8000000 }));
  //   console.log("deploy root");
  //   const root = await ethers.getContractFactory("Root").then(x => x.deploy(impl.address, { gasLimit: 8000000 }));
  //   const dao = await ethers.getContractAt("Implementation", root.address);

  //   // Change minter role
  //   console.log("change minter role for dollar to dao");
  //   await dollar.addMinter(dao.address);
  //   await dollar.renounceMinter();

  //   console.log("change minter role for gov to dao");
  //   await governanceToken.addMinter(dao.address);
  //   await governanceToken.renounceMinter();

  //   // 4. Deploy pool contracts

  //   // Bonding pool, you stake Dollars, and get Dollars OR Governance token as a reward
  //   // Don't want it to auto-compound
  //   console.log("do some poolBonding shit");
  //   const poolBonding = await ethers
  //     .getContractFactory("PoolBonding")
  //     .then(x => x.deploy(dao.address, dollar.address, dollar.address, governanceToken.address, { gasLimit: 8000000 }));
  //   console.log("do some poolLP shit");
  //   const poolLP = await ethers
  //     .getContractFactory("PoolLP")
  //     .then(x => x.deploy(dao.address, uniV2PairAddress, dollar.address, { gasLimit: 8000000 }));
  //   console.log("do some PoolGov shit");
  //   const poolGov = await ethers
  //     .getContractFactory("PoolGov")
  //     .then(x => x.deploy(dao.address, governanceToken.address, dollar.address, { gasLimit: 8000000 }));

  //   // 5. Initialize dao
  //   console.log("dao init tokenaddr");
  //   await dao.initializeTokenAddresses(dollar.address, governanceToken.address);
  //   console.log("dao init oracle");
  //   await dao.initializeOracle({ gasLimit: 8000000 });
  //   console.log("dao initpooladdress");
  //   await dao.initializePoolAddresses(poolBonding.address, poolLP.address, poolGov.address, uniV2PairAddress);

  //   // Output contract addresses
  //   console.log(
  //     JSON.stringify(
  //       {
  //         dao: dao.address,
  //         poolBonding: poolBonding.address,
  //         poolLP: poolLP.address,
  //         poolGov: poolGov.address,
  //         dollar: dollar.address,
  //         governanceToken: governanceToken.address,
  //         uniV2PairAddress,
  //         implementation: impl.address,
  //         root: root.address,
  //       },
  //       null,
  //       4,
  //     ),
  //   );
};

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
