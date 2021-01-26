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

const main = async () => {
  const owner = await provider.getSigner(0);
  const user1 = await provider.getSigner(1);

  const ownerAddress = await owner.getAddress();
  const user1Address = await user1.getAddress();

  // 1. Deploy tokens and oracle
  const dollar = await ethers.getContractFactory("Dollar").then(x => x.deploy());
  const governanceToken = await ethers.getContractFactory("Governance").then(x => x.deploy());
  const dai = dollar.attach(DAI);

  // 2. Supply to Uniswap and do some trades
  const uniswapRouter = await ethers.getContractAt("IUniswapV2Router02", UNISWAP_ROUTER);
  await dollar.mint(user1Address, parseEther("35000"));
  await uniswapRouter
    .connect(user1)
    .swapExactETHForTokens(0, [WETH, DAI], user1Address, await blockchainFuture(), { value: parseEther("100") })
    .then(x => x.wait());
  await dollar.connect(user1).approve(uniswapRouter.address, ethers.constants.MaxUint256);
  await dollar.attach(DAI).connect(user1).approve(uniswapRouter.address, ethers.constants.MaxUint256);
  await uniswapRouter
    .connect(user1)
    .addLiquidity(
      dollar.address,
      DAI,
      parseEther("21000"),
      parseEther("21000"),
      parseEther("20000"),
      parseEther("20000"),
      user1Address,
      await blockchainFuture(),
    );

  await uniswapRouter
    .connect(user1)
    .swapExactTokensForTokens(parseEther("2500"), 0, [dollar.address, DAI], user1Address, await blockchainFuture())
    .then(x => x.wait());

  const uniswapFactory = await ethers.getContractAt("IUniswapV2Factory", UNISWAP_FACTORY);
  const uniV2PairAddress = await uniswapFactory.getPair(dollar.address, DAI);
  const uniV2Token = await dollar.attach(uniV2PairAddress);

  // 3. Deploy implementation and dao
  const impl = await ethers.getContractFactory("Implementation").then(x => x.deploy({ gasLimit: 8000000 }));
  const root = await ethers.getContractFactory("Root").then(x => x.deploy(impl.address, { gasLimit: 8000000 }));
  const dao = await ethers.getContractAt("Implementation", root.address);

  // Change minter role
  await dollar.addMinter(dao.address);
  await dollar.renounceMinter();

  await governanceToken.addMinter(dao.address);
  await governanceToken.renounceMinter();

  // 4. Deploy pool contracts

  // Bonding pool, you stake Dollars, and get Dollars OR Governance token as a reward
  // Don't want it to auto-compound
  const poolBonding = await ethers
    .getContractFactory("PoolBonding")
    .then(x => x.deploy(dao.address, dollar.address, dollar.address, governanceToken.address, { gasLimit: 8000000 }));
  const poolLP = await ethers
    .getContractFactory("PoolLP")
    .then(x => x.deploy(dao.address, uniV2PairAddress, dollar.address, { gasLimit: 8000000 }));
  const poolGov = await ethers
    .getContractFactory("PoolGov")
    .then(x => x.deploy(dao.address, governanceToken.address, dollar.address, { gasLimit: 8000000 }));

  // 5. Initialize dao
  await dao.initializeTokenAddresses(dollar.address, governanceToken.address);
  await dao.initializeOracle();
  await dao.initializePoolAddresses(poolBonding.address, poolLP.address, poolGov.address);

  // Output contract addresses
  console.log(
    JSON.stringify(
      {
        dao: dao.address,
        poolBonding: poolBonding.address,
        poolLP: poolLP.address,
        poolGov: poolGov.address,
        dollar: dollar.address,
        governanceToken: governanceToken.address,
        uniV2PairAddress,
      },
      null,
      4,
    ),
  );
};

main();
