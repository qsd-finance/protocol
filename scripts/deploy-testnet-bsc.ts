const { ethers, upgrades } = require("hardhat");

const { provider } = ethers;

const { parseEther } = ethers.utils;

const readline = require("readline");

function getUserInput() {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question("Please enter the UNI pair address: ", answer => {
      resolve(answer);
      // console.log("Will keep dices: ", answer);
      rl.close();
    });
  });
}

const delay = ms => new Promise(res => setTimeout(res, ms));

/**
 * busd 0xe9e7cea3dedca5984780bafc599bd69add087d56
 * pcs factory  0xBCfCcbde45cE874adCB698cC183deBcF17952812
 * pcs router   0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F
 * treasury 0x247C08e7f043B960457676516A3258484aD8e7Bb
 */

const DAI = "0x33D000dfe25424Ac6f87aC771728fF231d5b1E35"; //fakeDAI //'0xec5dcb5dbf4b114c9d0f65bccab49ec54f6a0867'; //bsctestnet dai    //"0x6b175474e89094c44da98b954eedeac495271d0f";
// const WETH = "0xae13d989dac2f0debff460ac112a837c89baa7cd"; //wbnb             //"0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

const UNISWAP_FACTORY = "0xB9fA84912FF2383a617d8b433E926Adf0Dd3FEa1"; //NarwhalswapFactory     //"0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
const UNISWAP_ROUTER = "0xE85C6ab56A3422E7bAfd71e81Eb7d0f290646078"; //NarwhalswapRouter      // original value: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const RJ_ADDRESS = "0xA37f39c248d65f5F07A0b65550FaF63C267Fbe0d";

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

  // 1. Deploy tokens and oracle
  console.log("Deploying Dollar");
  const dollar = await ethers.getContractFactory("Dollar").then(x => x.deploy());
  console.log("Dollar contract is " + dollar.address);
  console.log("Deploying gov token");
  const governanceToken = await ethers.getContractFactory("Governance").then(x => x.deploy());
  console.log("governanceToken contract is " + governanceToken.address);
  const dai = dollar.attach(DAI);

  // 2. Supply to Uniswap and do some trades
  const uniswapRouter = await ethers.getContractAt("INarwhalswapRouter02", UNISWAP_ROUTER); //const uniswapRouter = await ethers.getContractAt("IUniswapV2Router02", UNISWAP_ROUTER);
  console.log("minting 35000 tokens to " + ownerAddress);
  await dollar.mint(ownerAddress, parseEther("35000"));
  console.log("minting 35000 tokens to " + RJ_ADDRESS);
  await dollar.mint(RJ_ADDRESS, parseEther("35000"));

  console.log("minting test gov tokens to " + ownerAddress);
  await governanceToken.mint(ownerAddress, parseEther("10000"));
  // await dollar.mint("0x0cB8F68A167Cd11715d5589cF9858892DDa91a3B", parseEther("2500")); //Jimmy later mint for testing
  // console.log("minted 2500 tokens to " + "0x0cB8F68A167Cd11715d5589cF9858892DDa91a3B");
  //console.log('do some token swap shit')
  /*await uniswapRouter
    .connect(user1)
    //.swapExactETHForTokens(0, [WETH, DAI], user1Address, await blockchainFuture(), { value: parseEther("100") })
    .swapExactBNBForTokens(0, [WETH, DAI], user1Address, await blockchainFuture(), { value: parseEther("1") })
    .then(x => x.wait());*/
  console.log("approve owner to trade dollar on uni");
  await dollar.connect(owner).approve(uniswapRouter.address, ethers.constants.MaxUint256);
  console.log("approve owner to trade fakeDAI on uni");
  await dollar.attach(DAI).connect(owner).approve(uniswapRouter.address, ethers.constants.MaxUint256);
  console.log("add liq");
  console.log(uniswapRouter.address);
  // console.log(uniswapRouter);
  // var overrideOptions = {
  //   gasLimit: 8000000,
  // };
  await uniswapRouter
    .connect(owner)
    .addLiquidity(
      dollar.address,
      DAI,
      parseEther("11000"),
      parseEther("11000"),
      parseEther("10500"),
      parseEther("10500"),
      ownerAddress,
      await blockchainFuture(),
      { gasLimit: 8000000 },
    );
  /*console.log('swap thru our pool')
  await uniswapRouter
    .connect(user1)
    .swapExactTokensForTokens(parseEther("2500"), 0, [DAI, dollar.address], user1Address, await blockchainFuture())
    .then(x => x.wait()); */

  console.log("now getting uni contracts up");
  const uniswapFactory = await ethers.getContractAt("INarwhalswapFactory", UNISWAP_FACTORY); //const uniswapFactory = await ethers.getContractAt("IUniswapV2Factory", UNISWAP_FACTORY);

  await delay(10000);

  const uniV2PairAddress = await uniswapFactory.getPair(DAI, dollar.address);
  console.log("uni pair address reported is " + uniV2PairAddress);
  const uniV2Token = await dollar.attach(uniV2PairAddress);
  console.log("uniV2Token reported is " + uniV2Token.address);

  const userUniV2AddressInput = await getUserInput();
  const userUniV2Address = ethers.utils.getAddress(userUniV2AddressInput);

  console.log("user input for user uni address is " + userUniV2Address);

  // 3. Deploy implementation and dao
  console.log("deploy implementation");
  const impl = await ethers.getContractFactory("Implementation").then(x => x.deploy({ gasLimit: 10000000 }));
  console.log("deploy root");
  const root = await ethers.getContractFactory("Root").then(x => x.deploy(impl.address, { gasLimit: 10000000 }));
  const dao = await ethers.getContractAt("Implementation", root.address);

  // Change minter role
  console.log("change minter role for dollar to dao");
  await dollar.addMinter(dao.address);
  await dollar.renounceMinter();

  console.log("change minter role for gov to dao");
  await governanceToken.addMinter(dao.address);
  await governanceToken.renounceMinter();

  // 4. Deploy pool contracts

  // Bonding pool, you stake Dollars, and get Dollars OR Governance token as a reward
  // Don't want it to auto-compound
  console.log("do some poolBonding shit");
  const poolBonding = await ethers
    .getContractFactory("PoolBonding")
    .then(x =>
      x.deploy(dao.address, dollar.address, dollar.address, governanceToken.address, DAI, { gasLimit: 10000000 }),
    );
  console.log("do some poolLP shit");
  const poolLP = await ethers
    .getContractFactory("PoolLP")
    .then(x => x.deploy(dao.address, userUniV2Address, dollar.address, DAI, { gasLimit: 10000000 }));
  console.log("do some PoolGov shit");
  const poolGov = await ethers
    .getContractFactory("PoolGov")
    .then(x => x.deploy(dao.address, governanceToken.address, dollar.address, { gasLimit: 10000000 }));

  // 5. Initialize dao
  console.log("dao init tokenaddr");
  await dao.initializeTokenAddresses(dollar.address, governanceToken.address);
  console.log("dao init oracle");
  await dao.initializeOracle({ gasLimit: 10000000 });
  console.log("dao initpooladdress");
  await dao.initializePoolAddresses(poolBonding.address, poolLP.address, poolGov.address, userUniV2Address);

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
        userUniV2Address,
        implementation: impl.address,
        root: root.address,
      },
      null,
      4,
    ),
  );
};

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
