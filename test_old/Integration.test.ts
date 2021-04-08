import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";
import { BN, expectBNEq, expectRevert, increaseTime, getLatestBlockTime, expectBNAproxEq } from "./Utils";
import { BOOTSTRAPPING_PERIOD } from "./Constants";
import { Contract } from "ethers";

const { parseEther } = ethers.utils;

const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

const UNISWAP_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
const UNISWAP_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

const blockchainFuture = async () => {
  const t = await getLatestBlockTime();
  return t + 6000;
};

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

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();

    // 1. Deploy tokens and oracle
    dollar = await ethers.getContractFactory("Dollar").then(x => x.deploy());
    governanceToken = await ethers.getContractFactory("Governance").then(x => x.deploy());
    dai = dollar.attach(DAI);

    // 2. Supply to Uniswap and do some trades
    uniswapRouter = await ethers.getContractAt("IUniswapV2Router02", UNISWAP_ROUTER);
    await dollar.mint(user1.address, parseEther("35000"));
    await uniswapRouter
      .connect(user1)
      .swapExactETHForTokens(0, [WETH, DAI], user1.address, await blockchainFuture(), { value: parseEther("100") })
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
        user1.address,
        await blockchainFuture(),
      );

    await uniswapRouter
      .connect(user1)
      .swapExactTokensForTokens(parseEther("2500"), 0, [dollar.address, DAI], user1.address, await blockchainFuture())
      .then(x => x.wait());

    const uniswapFactory = await ethers.getContractAt("IUniswapV2Factory", UNISWAP_FACTORY);
    uniV2PairAddress = await uniswapFactory.getPair(dollar.address, DAI);
    uniV2Token = await dollar.attach(uniV2PairAddress);

    // 3. Deploy implementation and dao
    impl = await ethers.getContractFactory("Implementation").then(x => x.deploy({ gasLimit: 8000000 }));
    root = await ethers.getContractFactory("Root").then(x => x.deploy(impl.address, { gasLimit: 8000000 }));
    dao = await ethers.getContractAt("Implementation", root.address);

    // Change minter role
    await dollar.addMinter(dao.address);
    await dollar.renounceMinter();

    await governanceToken.addMinter(dao.address);
    await governanceToken.renounceMinter();

    // 4. Deploy pool contracts

    // Bonding pool, you stake Dollars, and get Dollars OR Governance token as a reward
    // Don't want it to auto-compound
    poolBonding = await ethers
      .getContractFactory("PoolBonding")
      .then(x => x.deploy(dao.address, dollar.address, dollar.address, governanceToken.address, { gasLimit: 8000000 }));
    poolLP = await ethers
      .getContractFactory("PoolLP")
      .then(x => x.deploy(dao.address, uniV2PairAddress, dollar.address, { gasLimit: 8000000 }));
    poolGov = await ethers
      .getContractFactory("PoolGov")
      .then(x => x.deploy(dao.address, governanceToken.address, dollar.address, { gasLimit: 8000000 }));

    // 5. Initialize dao
    await expectRevert(dao.initializeOracle(), "not initialized!");
    await dao.initializeTokenAddresses(dollar.address, governanceToken.address);
    await dao.initializeOracle();
    await dao.initializePoolAddresses(poolBonding.address, poolLP.address, poolGov.address);
  });

  it("Overall logic", async function () {
    this.timeout(1000000);

    const implB = await ethers.getContractFactory("Implementation").then(x => x.deploy({ gasLimit: 8000000 }));

    // Initialization checks
    await expectRevert(dao.initializeOracle(), "initialized!");
    await expectRevert(dao.initializeTokenAddresses(dollar.address, governanceToken.address), "initialized!");
    await expectRevert(
      dao.initializePoolAddresses(poolBonding.address, poolLP.address, poolGov.address),
      "initialized!",
    );

    // Balance checks
    expect(await dao.poolBonding()).to.be.eq(poolBonding.address);
    expect(await dao.poolLP()).to.be.eq(poolLP.address);
    expect(await dao.poolGov()).to.be.eq(poolGov.address);
    expect(await dao.dollar()).to.be.eq(dollar.address);
    expect(await dao.governance()).to.be.eq(governanceToken.address);

    expect(await poolLP.dao()).to.be.eq(dao.address);
    expect(await poolLP.stakingToken()).to.be.eq(uniV2PairAddress);
    expect(await poolLP.rewardsToken()).to.be.eq(dollar.address);

    expect(await poolBonding.dao()).to.be.eq(dao.address);
    expect(await poolBonding.stakingToken()).to.be.eq(dollar.address);
    expect(await poolBonding.rewardsToken1()).to.be.eq(dollar.address);
    expect(await poolBonding.rewardsToken2()).to.be.eq(governanceToken.address);

    expect(await poolGov.dao()).to.be.eq(dao.address);
    expect(await poolGov.stakingToken()).to.be.eq(governanceToken.address);
    expect(await poolGov.rewardsToken()).to.be.eq(dollar.address);

    expect(await dollar.isMinter(dao.address)).to.be.true;
    expect(await governanceToken.isMinter(dao.address)).to.be.true;

    // Stake in the DAO and LP _before_ the first advance
    const dollarBal = await dollar.balanceOf(user1.address);
    const univ2Bal = await uniV2Token.balanceOf(user1.address);

    await dollar.connect(user1).approve(dao.address, ethers.constants.MaxUint256);
    await dao.connect(user1).deposit(dollarBal);
    await dao.connect(user1).bond(dollarBal);

    // Founder rewards check
    expect((await dollar.balanceOf("0xC1b89f59c600e4beFfD6df16186048f828d411f6")).eq(BN(0))).to.be.true;
    expect((await dollar.balanceOf("0xdBba5c9AB0F3Ac341Fc741b053678Ade367236e6")).eq(BN(0))).to.be.true;
    expect((await dollar.balanceOf("0x5aB60b1c7d78014c4490D5e78BA551D51729E1De")).eq(BN(0))).to.be.true;
    expect((await dollar.balanceOf("0x8E290D948D0955B7e4AB66DA0202f491A96A4184")).eq(BN(0))).to.be.true;
    expect((await dollar.balanceOf("0xbcb8171050Fe9c08066a5008f5Da484cC5E8e3FF")).eq(BN(0))).to.be.true;
    expect((await dollar.balanceOf("0x8d4CA87F859D9581954586e671a66B2636fD7Bdd")).eq(BN(0))).to.be.true;
    expect((await dollar.balanceOf("0xB006be3e08b54DBdA89725a313803f4B1875259f")).eq(BN(0))).to.be.true;
    expect((await dollar.balanceOf("0xD6F82502F20647dd8d78DFFb6AD7F8D8193d5e29")).eq(BN(0))).to.be.true;
    expect((await dollar.balanceOf("0x81725dFB3F92f8301DDADe77E29536605e8Df162")).eq(BN(0))).to.be.true;
    expect((await dollar.balanceOf("0x82e1dE949DF695AAA8053f53008320F8EAd52814")).eq(BN(0))).to.be.true;
    expect((await dollar.balanceOf("0x5dDE36a3d062150AdbF1107c976A33D8E835aE62")).eq(BN(0))).to.be.true;
    await dao.advance();
    expectBNEq(await dao.epoch(), BN(1));
    expect((await dollar.balanceOf("0xC1b89f59c600e4beFfD6df16186048f828d411f6")).gt(BN(0))).to.be.true;
    expect((await dollar.balanceOf("0xdBba5c9AB0F3Ac341Fc741b053678Ade367236e6")).gt(BN(0))).to.be.true;
    expect((await dollar.balanceOf("0x5aB60b1c7d78014c4490D5e78BA551D51729E1De")).gt(BN(0))).to.be.true;
    expect((await dollar.balanceOf("0xbcb8171050Fe9c08066a5008f5Da484cC5E8e3FF")).gt(BN(0))).to.be.true;
    expect((await dollar.balanceOf("0x8d4CA87F859D9581954586e671a66B2636fD7Bdd")).gt(BN(0))).to.be.true;
    expect((await dollar.balanceOf("0xB006be3e08b54DBdA89725a313803f4B1875259f")).gt(BN(0))).to.be.true;
    expect((await dollar.balanceOf("0xD6F82502F20647dd8d78DFFb6AD7F8D8193d5e29")).gt(BN(0))).to.be.true;
    expect((await dollar.balanceOf("0x81725dFB3F92f8301DDADe77E29536605e8Df162")).gt(BN(0))).to.be.true;
    expect((await dollar.balanceOf("0x82e1dE949DF695AAA8053f53008320F8EAd52814")).gt(BN(0))).to.be.true;
    expect((await dollar.balanceOf("0x5dDE36a3d062150AdbF1107c976A33D8E835aE62")).gt(BN(0))).to.be.true;
    await increaseTime(60 * 60 * 4 * BOOTSTRAPPING_PERIOD);

    // Pool logic checks
    await uniV2Token.connect(user1).approve(poolLP.address, ethers.constants.MaxUint256);
    await poolLP.connect(user1).deposit(univ2Bal);
    await poolLP.connect(user1).bond(univ2Bal);

    for (let i = 0; i < 71; i++) {
      await dao.advance();
    }
    expectBNEq(await dao.epoch(), BN(72));

    await dao
      .connect(user1)
      .unbondUnderlying(await dao.balanceOfBonded(user1.address))
      .then(x => x.wait());

    await poolLP
      .connect(user1)
      .unbond(await poolLP.balanceOfBonded(user1.address))
      .then(x => x.wait());

    await dao.advance();

    await dao
      .connect(user1)
      .withdraw(await dao.balanceOfStaged(user1.address))
      .then(x => x.wait());

    await poolLP
      .connect(user1)
      .withdraw(await poolLP.balanceOfStaged(user1.address))
      .then(x => x.wait());

    const compoundedDollarBal = await dollar.balanceOf(user1.address);
    const compoundedUniv2Bal = await uniV2Token.balanceOf(user1.address);

    await poolLP
      .connect(user1)
      .claim(await poolLP.balanceOfClaimable(user1.address))
      .then(x => x.wait());

    const compoundedWithLPDollarBal = await dollar.balanceOf(user1.address);

    expect(compoundedDollarBal.gt(dollarBal)).to.be.true;
    expect(compoundedWithLPDollarBal.gt(compoundedDollarBal)).to.be.true;
    expect(compoundedUniv2Bal.eq(univ2Bal)).to.be.true;

    // Stake in LP pool again
    await poolLP.connect(user1).deposit(univ2Bal);
    await poolLP.connect(user1).bond(univ2Bal);

    // Stake in Bonding Pool
    await dollar.connect(user1).approve(poolBonding.address, ethers.constants.MaxUint256);
    await poolBonding.connect(user1).deposit(compoundedWithLPDollarBal);
    await poolBonding.connect(user1).bond(compoundedWithLPDollarBal);

    expectBNEq(await poolBonding.balanceOfRewarded1(user1.address), BN(0));
    expectBNEq(await poolBonding.balanceOfRewarded2(user1.address), BN(0));

    await dao.advance();

    expectBNEq(await poolBonding.balanceOfRewarded1(user1.address), BN(0));
    expect((await poolBonding.balanceOfRewarded2(user1.address)).gt(BN(0))).to.be.true;

    await poolBonding.connect(user1).unbond(compoundedWithLPDollarBal);

    const beforeRewards = await poolLP.balanceOfRewarded(user1.address);

    // Advance
    await dao.advance();

    // Pool LP gives no rewards
    const afterRewards = await poolLP.balanceOfRewarded(user1.address);

    // Pool LP earns no $
    expect(afterRewards.eq(beforeRewards)).to.be.true;

    // Withdraw governance token
    expect((await poolBonding.balanceOfClaimable2(user1.address)).gt(BN(0))).to.be.true;
    await poolBonding.connect(user1).claim2(await poolBonding.balanceOfClaimable2(user1.address));
    expect((await governanceToken.balanceOf(user1.address)).gt(BN(0))).to.be.true;

    // Stake governance token
    const govBal = await governanceToken.balanceOf(user1.address);
    await governanceToken.connect(user1).approve(poolGov.address, ethers.constants.MaxUint256);
    await poolGov.connect(user1).deposit(govBal);
    await poolGov.connect(user1).bond(govBal);
    await poolGov.connect(user1).unbond(govBal);
    await poolGov.connect(user1).bond(govBal);

    await dao.advance();

    // 73 epoch rewards
    expect((await poolGov.totalRewarded()).gt(BN(0))).to.be.true;
    expect((await poolGov.balanceOfRewarded(user1.address)).gt(BN(0))).to.be.true;

    await poolGov.connect(user1).claim(await poolGov.balanceOfClaimable(user1.address));

    await dao.advance();

    // Can bond again
    await poolBonding.connect(user1).bond(compoundedDollarBal);

    // Vote for new implementation
    await dao.connect(user1).vote(implB.address, BN(1));

    // Vote no yet ended
    await expectRevert(dao.connect(user1).commit(implB.address), "ended");

    for (let i = 0; i < 9; i++) {
      await dao.advance();
    }

    await dao.connect(user1).commit(implB.address);

    const newImplAddress = await dao.provider
      .getStorageAt(dao.address, BN("24440054405305269366569402256811496959409073762505157381672968839269610695612"))
      .then(x => x.slice(26));

    expect(`0x${newImplAddress.toLowerCase()}`).to.be.eq(implB.address.toLowerCase());

    // Vote back for original implementation
    await dao.connect(user1).vote(impl.address, BN(1));

    for (let i = 0; i < 6; i++) {
      await dao.advance();
    }

    await expectRevert(dao.connect(user1).emergencyCommit(impl.address), "Already initialized");

    // Some final balance checks
    const beforePoolGovRewards = await poolGov.totalRewarded();
    const beforePoolBondingRewards1 = await poolBonding.totalRewarded1();
    const beforePoolBondingRewards2 = await poolBonding.totalRewarded2();
    const beforePoolLPRewards = await poolLP.totalRewarded();
    const beforeDAOBonded = await dao.totalBonded();

    await dao.advance();
    await dao.advance();

    const afterPoolGovRewards = await poolGov.totalRewarded();
    const afterPoolBondingRewards1 = await poolBonding.totalRewarded1();
    const afterPoolBondingRewards2 = await poolBonding.totalRewarded2();
    const afterPoolLPRewards = await poolLP.totalRewarded();
    const afterDAOBonded = await dao.totalBonded();

    expect(afterPoolGovRewards.gt(beforePoolGovRewards)).to.be.true;
    expect(afterPoolBondingRewards1.eq(beforePoolBondingRewards1)).to.be.true;
    expect(afterPoolBondingRewards2.gt(beforePoolBondingRewards2)).to.be.true;
    expect(afterPoolLPRewards.eq(beforePoolLPRewards)).to.be.true;
    expect(afterDAOBonded.eq(beforeDAOBonded)).to.be.true;

    // Change uniswap TWAP price
    await uniswapRouter
      .connect(user1)
      .swapExactTokensForTokens(
        await dai.balanceOf(user1.address),
        0,
        [DAI, dollar.address],
        user1.address,
        await blockchainFuture(),
      )
      .then(x => x.wait());

    await dao.advance();
    await poolBonding.connect(user1).unbond(compoundedDollarBal);
    await dao.advance();
    await expectRevert(poolBonding.connect(user1).bond(compoundedDollarBal), ">1");
  });

  it("provideOneSided", async function () {
    this.timeout(1000000);

    // Supply some poolLP Tokens
    const univ2Bal = await uniV2Token.balanceOf(user1.address);
    await uniV2Token.connect(user1).approve(poolLP.address, ethers.constants.MaxUint256);
    await poolLP.connect(user1).deposit(univ2Bal);
    await poolLP.connect(user1).bond(univ2Bal);

    await dao.advance();

    const beforeBonded = await poolLP.balanceOfBonded(user1.address);
    const beforeRewarded = await poolLP.balanceOfRewarded(user1.address);
    const beforePoolDaiBalance = await dai.balanceOf(poolLP.address);
    await poolLP
      .connect(user1)
      .provideOneSided(await poolLP.balanceOfRewarded(user1.address))
      .then(x => x.wait());

    const afterBonded = await poolLP.balanceOfBonded(user1.address);
    const afterRewarded = await poolLP.balanceOfRewarded(user1.address);
    const afterPoolDaiBalance = await dai.balanceOf(poolLP.address);

    expect(afterBonded.gt(beforeBonded)).to.be.true;
    expect(afterRewarded.lt(beforeRewarded)).to.be.true;
    expect(afterPoolDaiBalance.eq(beforePoolDaiBalance)).to.be.true;
    expect(afterPoolDaiBalance.eq(BN(0))).to.be.true;
  });

  it("dao pool", async function () {
    this.timeout(1000000);

    await dollar.connect(user1).transfer(user2.address, parseEther("1"));

    await dollar.connect(user1).approve(dao.address, ethers.constants.MaxUint256);
    await dollar.connect(user2).approve(dao.address, ethers.constants.MaxUint256);

    await dao.connect(user1).deposit(parseEther("2"));
    await dao.connect(user1).bond(parseEther("2"));

    await dao.connect(user2).deposit(parseEther("1"));
    await dao.connect(user2).bond(parseEther("1"));

    expectBNEq(await dao.balanceOfBonded(user1.address), parseEther("2"));
    expectBNEq(await dao.balanceOfBonded(user2.address), parseEther("1"));

    await dao.advance();

    expect((await dao.balanceOfBonded(user1.address)).gt(parseEther("2"))).to.be.true;
    expect((await dao.balanceOfBonded(user2.address)).gt(parseEther("1"))).to.be.true;
    expectBNEq(
      await dao.balanceOfBonded(user1.address),
      await dao.balanceOfBonded(user2.address).then(x => x.mul(BN(2))),
    );
  });

  it("pool bonding (twap <1)", async function () {
    this.timeout(1000000);

    await dollar.connect(user1).transfer(user2.address, parseEther("1"));

    await dollar.connect(user1).approve(poolBonding.address, ethers.constants.MaxUint256);
    await dollar.connect(user2).approve(poolBonding.address, ethers.constants.MaxUint256);

    for (let i = 0; i < 73; i++) {
      await dao.advance();
    }

    await poolBonding.connect(user1).deposit(parseEther("2"));
    await poolBonding.connect(user1).bond(parseEther("2"));

    await poolBonding.connect(user2).deposit(parseEther("1"));
    await poolBonding.connect(user2).bond(parseEther("1"));

    expectBNEq(await poolBonding.balanceOfBonded(user1.address), parseEther("2"));
    expectBNEq(await poolBonding.balanceOfBonded(user2.address), parseEther("1"));

    await dao.advance();

    expectBNEq(await poolBonding.balanceOfBonded(user1.address), parseEther("2"));
    expectBNEq(await poolBonding.balanceOfBonded(user2.address), parseEther("1"));

    expect((await poolBonding.balanceOfRewarded1(user1.address)).eq(BN(0))).to.be.true;
    expect((await poolBonding.balanceOfRewarded1(user2.address)).eq(BN(0))).to.be.true;

    expect((await poolBonding.balanceOfRewarded2(user1.address)).gt(BN(0))).to.be.true;
    expect((await poolBonding.balanceOfRewarded2(user2.address)).gt(BN(0))).to.be.true;

    expect(
      (await poolBonding.balanceOfRewarded2(user1.address)).gt(await poolBonding.balanceOfRewarded2(user2.address)),
    ).to.be.true;
  });

  it("pool bonding (twap >1)", async function () {
    this.timeout(1000000);

    await uniswapRouter
      .connect(user1)
      .swapExactTokensForTokens(parseEther("2500"), 0, [DAI, dollar.address], user1.address, await blockchainFuture())
      .then(x => x.wait());

    await dollar.connect(user1).transfer(user2.address, parseEther("1"));

    await dollar.connect(user1).approve(poolBonding.address, ethers.constants.MaxUint256);
    await dollar.connect(user2).approve(poolBonding.address, ethers.constants.MaxUint256);

    for (let i = 0; i < 73; i++) {
      await dao.advance();
    }

    await poolBonding.connect(user1).deposit(parseEther("2"));
    await poolBonding.connect(user1).bond(parseEther("2"));

    await poolBonding.connect(user2).deposit(parseEther("1"));
    await poolBonding.connect(user2).bond(parseEther("1"));

    expectBNEq(await poolBonding.balanceOfBonded(user1.address), parseEther("2"));
    expectBNEq(await poolBonding.balanceOfBonded(user2.address), parseEther("1"));

    await dao.advance();

    expectBNEq(await poolBonding.balanceOfBonded(user1.address), parseEther("2"));
    expectBNEq(await poolBonding.balanceOfBonded(user2.address), parseEther("1"));

    expect((await poolBonding.balanceOfRewarded2(user1.address)).eq(BN(0))).to.be.true;
    expect((await poolBonding.balanceOfRewarded2(user2.address)).eq(BN(0))).to.be.true;

    expect((await poolBonding.balanceOfRewarded1(user1.address)).gt(BN(0))).to.be.true;
    expect((await poolBonding.balanceOfRewarded1(user2.address)).gt(BN(0))).to.be.true;

    expect(
      (await poolBonding.balanceOfRewarded1(user1.address)).gt(await poolBonding.balanceOfRewarded1(user2.address)),
    ).to.be.true;

    // Bond fails
    await poolBonding.connect(user2).unbond(parseEther("0.5"));
    await dao.advance();
    await expectRevert(poolBonding.connect(user2).bond(parseEther("0.5")), ">1");
    await poolBonding.connect(user2).claim1(await poolBonding.balanceOfClaimable1(user2.address));

    // Pool Bonding rewards
    const user1Rewards = await poolBonding.balanceOfRewarded1(user1.address);
    const user2Rewards = await poolBonding.balanceOfRewarded1(user2.address);

    // However we can poke rewards even if TWAP > 1
    await poolBonding.connect(user1).pokeRewards();
    await poolBonding.connect(user2).pokeRewards();

    await dao.advance();

    expect(user1Rewards.gt(BN(0))).to.be.true;
    expect(user2Rewards.gt(BN(0))).to.be.true;
    expectBNEq(user1Rewards, await poolBonding.balanceOfClaimable1(user1.address));
    expectBNAproxEq(user2Rewards, await poolBonding.balanceOfClaimable1(user2.address), BN(1));

    // Can claim them
    const beforeUser1Bal = await dollar.balanceOf(user1.address);
    const beforeUser2Bal = await dollar.balanceOf(user2.address);

    await poolBonding.connect(user1).claim1(await poolBonding.balanceOfClaimable1(user1.address));
    await poolBonding.connect(user2).claim1(await poolBonding.balanceOfClaimable1(user2.address));

    const afterUser1Bal = await dollar.balanceOf(user1.address);
    const afterUser2Bal = await dollar.balanceOf(user2.address);

    expectBNEq(afterUser1Bal.sub(beforeUser1Bal), user1Rewards);
    expectBNAproxEq(afterUser2Bal.sub(beforeUser2Bal), user2Rewards, BN(1));
  });

  it("pool gov", async function () {
    this.timeout(1000000);

    await dollar.connect(user1).transfer(user2.address, parseEther("1"));

    await dollar.connect(user1).approve(poolBonding.address, ethers.constants.MaxUint256);
    await dollar.connect(user2).approve(poolBonding.address, ethers.constants.MaxUint256);

    for (let i = 0; i < 73; i++) {
      await dao.advance();
    }

    await poolBonding.connect(user1).deposit(parseEther("2"));
    await poolBonding.connect(user1).bond(parseEther("2"));

    await poolBonding.connect(user2).deposit(parseEther("1"));
    await poolBonding.connect(user2).bond(parseEther("1"));

    expectBNEq(await poolBonding.balanceOfBonded(user1.address), parseEther("2"));
    expectBNEq(await poolBonding.balanceOfBonded(user2.address), parseEther("1"));

    await dao.advance();

    await poolBonding.connect(user1).unbond(parseEther("2"));
    await poolBonding.connect(user2).unbond(parseEther("1"));

    await dao.advance();

    await poolBonding.connect(user1).claim2(await poolBonding.balanceOfClaimable2(user1.address));
    await poolBonding.connect(user2).claim2(await poolBonding.balanceOfClaimable2(user2.address));

    expect((await governanceToken.balanceOf(user1.address)).gt(BN(0))).to.be.true;
    expect((await governanceToken.balanceOf(user2.address)).gt(BN(0))).to.be.true;

    await governanceToken.connect(user1).approve(poolGov.address, ethers.constants.MaxUint256);
    await governanceToken.connect(user2).approve(poolGov.address, ethers.constants.MaxUint256);

    await poolGov.connect(user1).deposit(await governanceToken.balanceOf(user1.address));
    await poolGov.connect(user1).bond(await poolGov.balanceOfStaged(user1.address));

    await poolGov.connect(user2).deposit(await governanceToken.balanceOf(user2.address));
    await poolGov.connect(user2).bond(await poolGov.balanceOfStaged(user2.address));

    const beforeUser1Rewarded = await poolGov.balanceOfRewarded(user1.address);
    const beforeUser2Rewarded = await poolGov.balanceOfRewarded(user2.address);

    await dao.advance();

    expect((await poolGov.balanceOfRewarded(user1.address)).gt(beforeUser1Rewarded)).to.be.true;
    expect((await poolGov.balanceOfRewarded(user2.address)).gt(beforeUser2Rewarded)).to.be.true;

    expect((await poolGov.balanceOfRewarded(user1.address)).gt(await poolGov.balanceOfRewarded(user2.address))).to.be
      .true;
  });

  it("pool lp (twap >1)", async function () {
    this.timeout(1000000);

    await uniV2Token.connect(user1).transfer(user2.address, (await uniV2Token.balanceOf(user1.address)).div(BN(3)));

    await uniV2Token.connect(user1).approve(poolLP.address, ethers.constants.MaxUint256);
    await uniV2Token.connect(user2).approve(poolLP.address, ethers.constants.MaxUint256);

    await poolLP.connect(user1).deposit(await uniV2Token.balanceOf(user1.address));
    await poolLP.connect(user1).bond(await poolLP.balanceOfStaged(user1.address));

    await poolLP.connect(user2).deposit(await uniV2Token.balanceOf(user2.address));
    await poolLP.connect(user2).bond(await poolLP.balanceOfStaged(user2.address));

    expect((await poolLP.balanceOfRewarded(user1.address)).eq(BN(0))).to.be.true;
    expect((await poolLP.balanceOfRewarded(user2.address)).eq(BN(0))).to.be.true;

    await dao.advance();

    expect((await poolLP.balanceOfRewarded(user1.address)).gt(BN(0))).to.be.true;
    expect((await poolLP.balanceOfRewarded(user2.address)).gt(BN(0))).to.be.true;
  });

  it("pool lp (twap <1)", async function () {
    this.timeout(1000000);

    for (let i = 0; i < 73; i++) {
      await dao.advance();
    }

    await uniV2Token.connect(user1).transfer(user2.address, (await uniV2Token.balanceOf(user1.address)).div(BN(3)));

    await uniV2Token.connect(user1).approve(poolLP.address, ethers.constants.MaxUint256);
    await uniV2Token.connect(user2).approve(poolLP.address, ethers.constants.MaxUint256);

    await poolLP.connect(user1).deposit(await uniV2Token.balanceOf(user1.address));
    await poolLP.connect(user1).bond(await poolLP.balanceOfStaged(user1.address));

    await poolLP.connect(user2).deposit(await uniV2Token.balanceOf(user2.address));
    await poolLP.connect(user2).bond(await poolLP.balanceOfStaged(user2.address));

    const beforeUser1 = await poolLP.balanceOfRewarded(user1.address);
    const beforeUser2 = await poolLP.balanceOfRewarded(user2.address);

    await dao.advance();

    expect((await poolLP.balanceOfRewarded(user1.address)).eq(beforeUser1)).to.be.true;
    expect((await poolLP.balanceOfRewarded(user2.address)).eq(beforeUser2)).to.be.true;
  });

  it("deposit flow", async function () {
    this.timeout(1000000);

    await dollar.connect(user1).approve(dao.address, ethers.constants.MaxUint256);

    await dao.connect(user1).deposit(parseEther("1"));
    await dao.connect(user1).bond(parseEther("1"));

    await expectRevert(dao.connect(user1).deposit(parseEther("1")), "frozen");

    await dao.advance();

    await dao.connect(user1).deposit(parseEther("1"));
    await dao.connect(user1).bond(parseEther("1"));
  });
});
