const { ethers, upgrades } = require("hardhat");

const { provider } = ethers;

const { parseEther } = ethers.utils;

import { Contract } from "ethers";

const readline = require("readline");

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

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

describe("Integration", function () {
  let [owner, user1, user2, user3]: SignerWithAddress[] = [];
  let dollar: Contract;
  let governanceToken: Contract;
  let dai: Contract;
  let impl: Contract;
  let dao: Contract;
  let root: Contract;
  let uniswapRouter: Contract;
  let uniV2Token: Contract;
  let poolBonding: Contract;
  let poolGov: Contract;
  let poolLP: Contract;

  let uniV2PairAddress: string;
  const DAIADDRESS = "0x33D000dfe25424Ac6f87aC771728fF231d5b1E35"; //fakeDAI //'0xec5dcb5dbf4b114c9d0f65bccab49ec54f6a0867'; //bsctestnet dai    //"0x6b175474e89094c44da98b954eedeac495271d0f";

  const UNISWAP_FACTORY = "0xB9fA84912FF2383a617d8b433E926Adf0Dd3FEa1"; //NarwhalswapFactory     //"0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
  const UNISWAP_ROUTER = "0xE85C6ab56A3422E7bAfd71e81Eb7d0f290646078"; //NarwhalswapRouter      // original value: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

  const blockchainFuture = async () => {
    const blockNumber = await provider.getBlockNumber();
    const block = await provider.getBlock(blockNumber);

    return block.timestamp + 15000;
  };

  beforeEach(async function () {
    // [owner, user1, user2, user3] = await ethers.getSigners();
    owner = await provider.getSigner(0);
    user1 = await provider.getSigner(1);

    const ownerAddress = await owner.getAddress();
    const user1Address = await user1.getAddress();
    console.log("ownerAddress  " + ownerAddress);
    console.log("user1Address  " + user1Address);

    // 1. Deploy tokens and oracle
    console.log("Deploying Dollar");
    dollar = await ethers.getContractFactory("Dollar").then(x => x.deploy());
    console.log("Dollar contract is " + dollar.address);
    console.log("Deploying gov token");
    governanceToken = await ethers.getContractFactory("Governance").then(x => x.deploy());
    console.log("governanceToken contract is " + governanceToken.address);
    dai = dollar.attach(DAIADDRESS);

    // 2. Supply to Uniswap and do some trades
    uniswapRouter = await ethers.getContractAt("INarwhalswapRouter02", UNISWAP_ROUTER); //const uniswapRouter = await ethers.getContractAt("IUniswapV2Router02", UNISWAP_ROUTER);
    console.log("minting 35000 tokens to " + ownerAddress);
    await dollar.mint(ownerAddress, parseEther("35000"));
    console.log("approve owner to trade dollar on uni");
    await dollar.connect(owner).approve(uniswapRouter.address, ethers.constants.MaxUint256);
    console.log("approve owner to trade fakeDAI on uni");
    await dollar.attach(DAIADDRESS).connect(owner).approve(uniswapRouter.address, ethers.constants.MaxUint256);
    console.log("add liq");
    console.log("uniswap router address is " + uniswapRouter.address);
    await uniswapRouter
      .connect(owner)
      .addLiquidity(
        dollar.address,
        DAIADDRESS,
        parseEther("11000"),
        parseEther("11000"),
        parseEther("10500"),
        parseEther("10500"),
        ownerAddress,
        await blockchainFuture(),
        { gasLimit: 9500000 },
      );

    console.log("now getting uni contracts up");
    const uniswapFactory = await ethers.getContractAt("INarwhalswapFactory", UNISWAP_FACTORY); //const uniswapFactory = await ethers.getContractAt("IUniswapV2Factory", UNISWAP_FACTORY);
    uniV2PairAddress = await uniswapFactory.getPair(DAIADDRESS, dollar.address);
    console.log("uni pair address reported is " + uniV2PairAddress);
    uniV2Token = await dollar.attach(uniV2PairAddress);
    console.log("uniV2Token reported is " + uniV2Token.address);

    const userUniV2AddressInput = await getUserInput();
    const userUniV2Address = ethers.utils.getAddress(userUniV2AddressInput);

    console.log("user input for user uni address is " + userUniV2Address);

    // 3. Deploy implementation and dao
    console.log("deploy implementation");
    impl = await ethers.getContractFactory("Implementation").then(x => x.deploy({ gasLimit: 10000000 }));
    console.log("deploy root");
    root = await ethers.getContractFactory("Root").then(x => x.deploy(impl.address, { gasLimit: 10000000 }));
    dao = await ethers.getContractAt("Implementation", root.address);

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
    poolBonding = await ethers.getContractFactory("PoolBonding").then(x =>
      x.deploy(dao.address, dollar.address, dollar.address, governanceToken.address, DAIADDRESS, {
        gasLimit: 10000000,
      }),
    );
    console.log("do some poolLP shit");
    poolLP = await ethers
      .getContractFactory("PoolLP")
      .then(x => x.deploy(dao.address, userUniV2Address, dollar.address, DAIADDRESS, { gasLimit: 10000000 }));
    console.log("do some PoolGov shit");
    poolGov = await ethers
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
  });

  it("Advance works", async function () {
    await dao.methods.advance();
  });
});
