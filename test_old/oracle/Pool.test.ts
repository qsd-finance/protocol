import { ethers } from "hardhat";
import { mine, expectBNEq, expectEventIn, expectRevert, BN, increaseTime, expectBNAproxEq } from "../Utils";

import { Contract, ContractFactory, ContractReceipt } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { expect } from "chai";
import { BOOTSTRAPPING_PERIOD } from "../Constants";

const INITIAL_STAKE_MULTIPLE = BN(10).pow(BN(6)); // 100 ESD -> 100M ESDS

const FROZEN = BN(0);
const FLUID = BN(1);

async function incrementEpoch(dao) {
  await dao.set((await dao.epoch()).toNumber() + 1);
}

describe("pool", function () {
  let [owner, user, user1, user2, mockDao]: SignerWithAddress[] = [];

  let MockPoolBonding: ContractFactory;
  let MockPoolLP: ContractFactory;
  let MockToken: ContractFactory;
  let MockUniswapV2PairLiquidity: ContractFactory;
  let MockSettableDAO: ContractFactory;
  let MockSettableOracle: ContractFactory;

  let stakingToken: Contract;
  let rewardsToken: Contract;
  let dao: Contract;
  let dai: Contract;
  let dollar: Contract;
  let univ2: Contract;
  let poolLP: Contract;
  let oracle: Contract;

  before(async function () {
    [owner, user, user1, user2, mockDao] = await ethers.getSigners();

    MockPoolBonding = await ethers.getContractFactory("MockPoolBonding");
    MockPoolLP = await ethers.getContractFactory("MockPoolLP");
    MockToken = await ethers.getContractFactory("MockToken");
    MockUniswapV2PairLiquidity = await ethers.getContractFactory("MockUniswapV2PairLiquidity");
    MockSettableDAO = await ethers.getContractFactory("MockSettableDAO");
    MockSettableOracle = await ethers.getContractFactory("MockSettableOracle");
  });

  beforeEach(async function () {
    oracle = await MockSettableOracle.deploy({ gasLimit: 8000000 });
    await oracle.set(101, 100, true);

    dao = await MockSettableDAO.connect(owner).deploy({ gasLimit: 8000000 });
    await dao.set(1);
    await dao.setOracle(oracle.address);

    dollar = await MockToken.connect(owner).deploy("Empty Set Dollar", "ESD", 18, { gasLimit: 8000000 });
    dai = await MockToken.connect(owner).deploy("DAI", "DAI", 18, { gasLimit: 8000000 });
    stakingToken = await MockToken.connect(owner).deploy("Staking Token", "STAKE", 18, { gasLimit: 8000000 });
    rewardsToken = await MockToken.connect(owner).deploy("Rewards Token", "RWD", 18, { gasLimit: 8000000 });

    univ2 = await MockUniswapV2PairLiquidity.connect(owner).deploy({ gasLimit: 8000000 });

    poolLP = await MockPoolLP.connect(owner).deploy(univ2.address, dollar.address, {
      gasLimit: 8000000,
    });
    await poolLP.set(dao.address, dai.address, dollar.address);
  });

  describe("pool bonding", function () {
    let poolBonding: Contract;
    let daoBonding: Contract;
    let oracleBonding: Contract;

    const stakeAmount = ethers.utils.parseEther("1");
    const rewardAmount1 = ethers.utils.parseEther("10");
    const rewardAmount2 = ethers.utils.parseEther("20");

    beforeEach(async function () {
      oracleBonding = await MockSettableOracle.deploy({ gasLimit: 8000000 });
      await oracleBonding.set(101, 100, true);

      daoBonding = await MockSettableDAO.connect(owner).deploy({ gasLimit: 8000000 });
      await daoBonding.set(1);
      await daoBonding.setOracle(oracleBonding.address);

      poolBonding = await MockPoolBonding.connect(owner).deploy(
        stakingToken.address,
        stakingToken.address,
        rewardsToken.address,
        {
          gasLimit: 8000000,
        },
      );
      poolBonding.connect(owner).set(daoBonding.address, dai.address, dollar.address);
    });

    it("staking logic passes", async function () {
      await stakingToken.mint(user.address, stakeAmount);
      await stakingToken.connect(user).approve(poolBonding.address, ethers.constants.MaxUint256);

      await stakingToken.mint(user2.address, stakeAmount);
      await stakingToken.connect(user2).approve(poolBonding.address, ethers.constants.MaxUint256);

      await poolBonding.connect(user).deposit(stakeAmount);
      await poolBonding.connect(user).bond(stakeAmount);

      await poolBonding.connect(user2).deposit(stakeAmount);
      await poolBonding.connect(user2).bond(stakeAmount);

      await stakingToken.mint(poolBonding.address, rewardAmount1);
      expectBNEq(await poolBonding.totalRewarded1(), rewardAmount1);
      await poolBonding.connect(user).unbond(stakeAmount);

      await stakingToken.mint(poolBonding.address, rewardAmount1);
      expectBNEq(await poolBonding.totalRewarded1(), rewardAmount1.div(BN(2)).mul(BN(3)));
      expectBNEq(await poolBonding.totalClaimable1(), rewardAmount1.div(BN(2)));

      expectBNEq(await poolBonding.balanceOfClaimable1(user.address), rewardAmount1.div(BN(2)));
      expectBNEq(await poolBonding.balanceOfRewarded1(user2.address), rewardAmount1.div(BN(2)).mul(BN(3)));

      await poolBonding.connect(user).bond(stakeAmount);

      await rewardsToken.mint(poolBonding.address, rewardAmount2);
      expectBNEq(await poolBonding.totalRewarded2(), rewardAmount2);
      expectBNEq(await poolBonding.totalClaimable2(), BN(0));

      await poolBonding.connect(user).unbond(stakeAmount);
      expectBNEq(await poolBonding.totalRewarded2(), rewardAmount2.div(BN(2)));
      expectBNEq(await poolBonding.totalClaimable2(), rewardAmount2.div(BN(2)));

      expectBNEq(await poolBonding.balanceOfClaimable2(user.address), rewardAmount2.div(BN(2)));
      expectBNEq(await poolBonding.balanceOfRewarded2(user2.address), rewardAmount2.div(BN(2)));
    });

    it("cannot bond if twap >=1", async function () {
      await daoBonding.set(BOOTSTRAPPING_PERIOD + 2);
      await oracleBonding.set(101, 100, true);

      await stakingToken.mint(user.address, stakeAmount);
      await stakingToken.connect(user).approve(poolBonding.address, ethers.constants.MaxUint256);
      await poolBonding.connect(user).deposit(stakeAmount);

      await expectRevert(poolBonding.connect(user).bond(stakeAmount), "Cannot bond when price >1");
    });

    it("can bond if twap <1", async function () {
      await daoBonding.set(BOOTSTRAPPING_PERIOD + 2);
      await oracleBonding.set(99, 100, true);

      await stakingToken.mint(user.address, stakeAmount);
      await stakingToken.connect(user).approve(poolBonding.address, ethers.constants.MaxUint256);
      await poolBonding.connect(user).deposit(stakeAmount);

      await poolBonding.connect(user).bond(stakeAmount)
    });
  });

  describe("frozen", function () {
    describe("starts as frozen", function () {
      it("mints new Dollar tokens", async function () {
        expectBNEq(await poolLP.statusOf(user.address), FROZEN);
      });
    });

    describe("when deposit", function () {
      let txRecp: ContractReceipt;

      beforeEach(async function () {
        await univ2.faucet(user.address, 1000);
        await univ2.connect(user).approve(poolLP.address, 1000);

        const tx = await poolLP.connect(user).deposit(1000);
        txRecp = await tx.wait();
      });

      it("is frozen", async function () {
        expectBNEq(await poolLP.statusOf(user.address), FROZEN);
      });

      it("updates users balances", async function () {
        expectBNEq(await univ2.balanceOf(user.address), BN(0));
        expectBNEq(await poolLP.balanceOfStaged(user.address), BN(1000));
        expectBNEq(await poolLP.balanceOfBonded(user.address), BN(0));
      });

      it("updates dao balances", async function () {
        expectBNEq(await univ2.balanceOf(poolLP.address), BN(1000));
        expectBNEq(await poolLP.totalBonded(), BN(0));
        expectBNEq(await poolLP.totalStaged(), BN(1000));
      });

      it("emits Deposit event", async function () {
        await expectEventIn(txRecp, "Deposit", {
          account: user.address,
          value: BN(1000),
        });
      });
    });

    describe("when withdraw", function () {
      describe("simple", function () {
        let txRecp: ContractReceipt;

        beforeEach(async function () {
          await univ2.faucet(user.address, 1000);
          await univ2.connect(user).approve(poolLP.address, 1000);
          await poolLP.connect(user).deposit(1000);

          const tx = await poolLP.connect(user).withdraw(1000);
          txRecp = await tx.wait();
        });

        it("is frozen", async function () {
          expectBNEq(await poolLP.statusOf(user.address), FROZEN);
        });

        it("updates users balances", async function () {
          expectBNEq(await univ2.balanceOf(user.address), BN(1000));
          expectBNEq(await poolLP.balanceOfStaged(user.address), BN(0));
          expectBNEq(await poolLP.balanceOfBonded(user.address), BN(0));
        });

        it("updates dao balances", async function () {
          expectBNEq(await univ2.balanceOf(poolLP.address), BN(0));
          expectBNEq(await poolLP.totalBonded(), BN(0));
          expectBNEq(await poolLP.totalStaged(), BN(0));
        });

        it("emits Withdraw event", async function () {
          await expectEventIn(txRecp, "Withdraw", {
            account: user.address,
            value: BN(1000),
          });
        });
      });

      describe("too much", function () {
        beforeEach(async function () {
          await univ2.faucet(user.address, 1000);
          await univ2.connect(user).approve(poolLP.address, 1000);
          await poolLP.connect(user).deposit(1000);

          await univ2.faucet(user1.address, 10000);
          await univ2.connect(user1).approve(poolLP.address, 10000);
          await poolLP.connect(user1).deposit(10000);
        });

        it("reverts", async function () {
          await expectRevert(poolLP.connect(user).withdraw(2000), "insufficient staged balance");
        });
      });
    });

    describe("when claim", function () {
      beforeEach(async function () {
        await univ2.faucet(user.address, 1000);
        await univ2.connect(user).approve(poolLP.address, 1000);
        await poolLP.connect(user).deposit(1000);
        await poolLP.connect(user).bond(1000);
        await dao.set((await dao.epoch()) + 1);
        await dollar.mint(poolLP.address, 1000);
        await poolLP.connect(user).unbond(1000);
        await dao.set((await dao.epoch()) + 1);
      });

      describe("simple", function () {
        let txRecp: ContractReceipt;
        beforeEach(async function () {
          const tx = await poolLP.connect(user).claim(1000);
          txRecp = await tx.wait();
        });

        it("is frozen", async function () {
          expectBNEq(await poolLP.statusOf(user.address), FROZEN);
        });

        it("updates users balances", async function () {
          expectBNEq(await dollar.balanceOf(user.address), BN(1000));
          expectBNEq(await poolLP.balanceOfClaimable(user.address), BN(0));
          expectBNEq(await poolLP.balanceOfRewarded(user.address), BN(0));
        });

        it("updates dao balances", async function () {
          expectBNEq(await dollar.balanceOf(poolLP.address), BN(0));
          expectBNEq(await poolLP.totalClaimable(), BN(0));
          expectBNEq(await poolLP.totalRewarded(), BN(0));
        });

        it("emits Claim event", async function () {
          await expectEventIn(txRecp, "Claim", {
            account: user.address,
            value: BN(1000),
          });
        });
      });

      describe("too much", function () {
        beforeEach(async function () {
          await dollar.mint(poolLP.address, 1000);
        });

        it("reverts", async function () {
          await expectRevert(poolLP.connect(user).claim(2000), "insufficient claimable balance");
        });
      });
    });

    describe("when bond", function () {
      describe("no reward", function () {
        describe("simple", function () {
          let txRecp: ContractReceipt;
          beforeEach(async function () {
            await univ2.faucet(user.address, 1000);
            await univ2.connect(user).approve(poolLP.address, 1000);
            await poolLP.connect(user).deposit(1000);

            const tx = await poolLP.connect(user).bond(1000);
            txRecp = await tx.wait();
          });

          it("is fluid", async function () {
            expectBNEq(await poolLP.statusOf(user.address), FLUID);
          });

          it("updates users balances", async function () {
            expectBNEq(await univ2.balanceOf(user.address), BN(0));
            expectBNEq(await poolLP.balanceOfStaged(user.address), BN(0));
            expectBNEq(await poolLP.balanceOfBonded(user.address), BN(1000));
          });

          it("updates dao balances", async function () {
            expectBNEq(await univ2.balanceOf(poolLP.address), BN(1000));
            expectBNEq(await poolLP.totalBonded(), BN(1000));
            expectBNEq(await poolLP.totalStaged(), BN(0));
          });

          it("emits Bond event", async function () {
            await expectEventIn(txRecp, "Bond", {
              account: user.address,
              start: BN(2),
              value: BN(1000),
            });
          });
        });

        describe("partial", function () {
          let txRecp: ContractReceipt;

          beforeEach(async function () {
            await univ2.faucet(user.address, 1000);
            await univ2.connect(user).approve(poolLP.address, 1000);
            await poolLP.connect(user).deposit(800);

            const tx = await poolLP.connect(user).bond(500);
            txRecp = await tx.wait();
          });

          it("is fluid", async function () {
            expectBNEq(await poolLP.statusOf(user.address), FLUID);
          });

          it("updates users balances", async function () {
            expectBNEq(await univ2.balanceOf(user.address), BN(200));
            expectBNEq(await poolLP.balanceOfStaged(user.address), BN(300));
            expectBNEq(await poolLP.balanceOfBonded(user.address), BN(500));
          });

          it("updates dao balances", async function () {
            expectBNEq(await univ2.balanceOf(poolLP.address), BN(800));
            expectBNEq(await poolLP.totalBonded(), BN(500));
            expectBNEq(await poolLP.totalStaged(), BN(300));
          });

          it("emits Bond event", async function () {
            await expectEventIn(txRecp, "Bond", {
              account: user.address,
              start: BN(2),
              value: BN(500),
            });
          });
        });

        describe("multiple", function () {
          let txRecp: ContractReceipt;
          beforeEach(async function () {
            await univ2.faucet(user1.address, 1000);
            await univ2.connect(user1).approve(poolLP.address, 1000);
            await poolLP.connect(user1).deposit(1000);

            await univ2.faucet(user2.address, 1000);
            await univ2.connect(user2).approve(poolLP.address, 1000);
            await poolLP.connect(user2).deposit(1000);

            await poolLP.connect(user1).bond(600);
            await poolLP.connect(user2).bond(400);

            await incrementEpoch(dao);

            await univ2.faucet(user.address, 1000);
            await univ2.connect(user).approve(poolLP.address, 800);
            await poolLP.connect(user).deposit(800);

            const tx = await poolLP.connect(user).bond(500);
            txRecp = await tx.wait();
          });

          it("is frozen", async function () {
            expectBNEq(await poolLP.statusOf(user.address), FLUID);
          });

          it("updates users balances", async function () {
            expectBNEq(await univ2.balanceOf(user.address), BN(200));
            expectBNEq(await poolLP.balanceOfStaged(user.address), BN(300));
            expectBNEq(await poolLP.balanceOfBonded(user.address), BN(500));
          });

          it("updates dao balances", async function () {
            expectBNEq(await univ2.balanceOf(poolLP.address), BN(2800));
            expectBNEq(await poolLP.totalBonded(), BN(1500));
            expectBNEq(await poolLP.totalStaged(), BN(1300));
          });

          it("emits Bond event", async function () {
            await expectEventIn(txRecp, "Bond", {
              account: user.address,
              start: BN(3),
              value: BN(500),
            });
          });
        });
      });

      describe("with reward", function () {
        describe("before bonding", function () {
          let txRecp: ContractReceipt;
          beforeEach(async function () {
            await univ2.faucet(user.address, 1000);
            await dollar.mint(poolLP.address, 1000);
            await univ2.connect(user).approve(poolLP.address, 1000);
            await poolLP.connect(user).deposit(1000);

            const tx = await poolLP.connect(user).bond(1000);
            txRecp = await tx.wait();
          });

          it("is fluid", async function () {
            expectBNEq(await poolLP.statusOf(user.address), FLUID);
          });

          it("updates users balances", async function () {
            expectBNEq(await dollar.balanceOf(user.address), BN(0));
            expectBNEq(await poolLP.balanceOfClaimable(user.address), BN(0));
            expectBNEq(await poolLP.balanceOfRewarded(user.address), BN(1000));
          });

          it("updates dao balances", async function () {
            expectBNEq(await dollar.balanceOf(poolLP.address), BN(1000));
            expectBNEq(await poolLP.totalClaimable(), BN(0));
            expectBNEq(await poolLP.totalRewarded(), BN(1000));
          });

          it("emits Bond event", async function () {
            await expectEventIn(txRecp, "Bond", {
              account: user.address,
              start: BN(2),
              value: BN(1000),
            });
          });
        });

        describe("after bond", function () {
          let txRecp: ContractReceipt;
          beforeEach(async function () {
            await univ2.faucet(user.address, 1000);
            await univ2.connect(user).approve(poolLP.address, 1000);
            await poolLP.connect(user).deposit(800);

            const tx = await poolLP.connect(user).bond(500);
            txRecp = await tx.wait();

            await dollar.mint(poolLP.address, 1000);
          });

          it("is fluid", async function () {
            expectBNEq(await poolLP.statusOf(user.address), FLUID);
          });

          it("updates users balances", async function () {
            expectBNEq(await dollar.balanceOf(user.address), BN(0));
            expectBNEq(await poolLP.balanceOfClaimable(user.address), BN(0));
            expectBNEq(await poolLP.balanceOfRewarded(user.address), BN(1000));
          });

          it("updates dao balances", async function () {
            expectBNEq(await dollar.balanceOf(poolLP.address), BN(1000));
            expectBNEq(await poolLP.totalClaimable(), BN(0));
            expectBNEq(await poolLP.totalRewarded(), BN(1000));
          });

          it("emits Bond event", async function () {
            await expectEventIn(txRecp, "Bond", {
              account: user.address,
              start: BN(2),
              value: BN(500),
            });
          });
        });

        describe("multiple with reward first", function () {
          let txRecp: ContractReceipt;
          beforeEach(async function () {
            await univ2.faucet(user1.address, 1000);
            await dollar.mint(poolLP.address, BN(1000));
            await univ2.connect(user1).approve(poolLP.address, 1000);
            await poolLP.connect(user1).deposit(1000);

            await univ2.faucet(user2.address, 1000);
            await univ2.connect(user2).approve(poolLP.address, 1000);
            await poolLP.connect(user2).deposit(1000);

            await poolLP.connect(user1).bond(600);
            await poolLP.connect(user2).bond(400);

            await incrementEpoch(dao);
            await dollar.mint(poolLP.address, BN(1000));

            await univ2.faucet(user.address, 1000);
            await univ2.connect(user).approve(poolLP.address, 800);
            await poolLP.connect(user).deposit(800);

            const tx = await poolLP.connect(user).bond(500);
            txRecp = await tx.wait();
          });

          it("is frozen", async function () {
            expectBNEq(await poolLP.statusOf(user.address), FLUID);
          });

          it("updates users balances", async function () {
            expectBNEq(await dollar.balanceOf(user.address), BN(0));
            expectBNEq(await poolLP.balanceOfRewarded(user1.address), BN(1599));
            expectBNEq(await poolLP.balanceOfPhantom(user1.address), BN(0));
            expectBNEq(await poolLP.balanceOfRewarded(user2.address), BN(400));
            expectBNEq(await poolLP.balanceOfPhantom(user2.address), BN(666));
            expectBNEq(await poolLP.balanceOfRewarded(user.address), BN(0));
            expectBNEq(await poolLP.balanceOfPhantom(user.address), BN(1333));
          });

          it("updates dao balances", async function () {
            expectBNEq(await dollar.balanceOf(poolLP.address), BN(2000));
            expectBNEq(await poolLP.totalRewarded(), BN(2000));
            expectBNEq(await poolLP.totalPhantom(), BN(1999));
          });

          it("emits Bond event", async function () {
            await expectEventIn(txRecp, "Bond", {
              account: user.address,
              start: BN(3),
              value: BN(500),
            });
          });
        });

        describe("multiple without reward first", function () {
          let txRecp: ContractReceipt;
          beforeEach(async function () {
            await univ2.faucet(user1.address, 1000);
            await univ2.connect(user1).approve(poolLP.address, 1000);
            await poolLP.connect(user1).deposit(1000);

            await univ2.faucet(user2.address, 1000);
            await univ2.connect(user2).approve(poolLP.address, 1000);
            await poolLP.connect(user2).deposit(1000);

            await poolLP.connect(user1).bond(600);
            await poolLP.connect(user2).bond(400);

            await incrementEpoch(dao);
            await dollar.mint(poolLP.address, BN(1000).mul(INITIAL_STAKE_MULTIPLE));

            await univ2.faucet(user.address, 1000);
            await univ2.connect(user).approve(poolLP.address, 800);
            await poolLP.connect(user).deposit(800);

            const tx = await poolLP.connect(user).bond(500);
            txRecp = await tx.wait();
          });

          it("is frozen", async function () {
            expectBNEq(await poolLP.statusOf(user.address), FLUID);
          });

          it("updates users balances", async function () {
            expectBNEq(await dollar.balanceOf(user.address), BN(0));
            expectBNEq(await poolLP.balanceOfRewarded(user1.address), BN(600).mul(INITIAL_STAKE_MULTIPLE));
            expectBNEq(await poolLP.balanceOfPhantom(user1.address), BN(600).mul(INITIAL_STAKE_MULTIPLE));
            expectBNEq(await poolLP.balanceOfRewarded(user2.address), BN(400).mul(INITIAL_STAKE_MULTIPLE));
            expectBNEq(await poolLP.balanceOfPhantom(user2.address), BN(400).mul(INITIAL_STAKE_MULTIPLE));
            expectBNEq(await poolLP.balanceOfRewarded(user.address), BN(0));
            expectBNEq(await poolLP.balanceOfPhantom(user.address), BN(1000).mul(INITIAL_STAKE_MULTIPLE));
          });

          it("updates dao balances", async function () {
            expectBNEq(await dollar.balanceOf(poolLP.address), BN(1000).mul(INITIAL_STAKE_MULTIPLE));
            expectBNEq(await poolLP.totalRewarded(), BN(1000).mul(INITIAL_STAKE_MULTIPLE));
            expectBNEq(await poolLP.totalPhantom(), BN(2000).mul(INITIAL_STAKE_MULTIPLE));
          });

          it("emits Bond event", async function () {
            await expectEventIn(txRecp, "Bond", {
              account: user.address,
              start: BN(3),
              value: BN(500),
            });
          });
        });
      });
    });

    describe("when unbond", function () {
      describe("without reward", function () {
        beforeEach(async function () {
          await univ2.faucet(user.address, 1000);
          await univ2.connect(user).approve(poolLP.address, 1000);
          await poolLP.connect(user).deposit(1000);

          await poolLP.connect(user).bond(1000);
          await incrementEpoch(dao);
        });

        describe("simple", function () {
          let txRecp: ContractReceipt;
          beforeEach(async function () {
            const tx = await poolLP.connect(user).unbond(BN(1000));
            txRecp = await tx.wait();
          });

          it("is fluid", async function () {
            expectBNEq(await poolLP.statusOf(user.address), FLUID);
          });

          it("updates users balances", async function () {
            expectBNEq(await univ2.balanceOf(user.address), BN(0));
            expectBNEq(await poolLP.balanceOfStaged(user.address), BN(1000));
            expectBNEq(await poolLP.balanceOfBonded(user.address), BN(0));
          });

          it("updates dao balances", async function () {
            expectBNEq(await univ2.balanceOf(poolLP.address), BN(1000));
            expectBNEq(await poolLP.totalBonded(), BN(0));
            expectBNEq(await poolLP.totalStaged(), BN(1000));
          });

          it("emits Unbond event", async function () {
            await expectEventIn(txRecp, "Unbond", {
              account: user.address,
              start: BN(3),
              value: BN(1000),
              newClaimable: BN(0),
            });
          });
        });

        describe("partial", function () {
          let txRecp: ContractReceipt;
          beforeEach(async function () {
            const tx = await poolLP.connect(user).unbond(BN(800));
            txRecp = await tx.wait();
          });

          it("is fluid", async function () {
            expectBNEq(await poolLP.statusOf(user.address), FLUID);
          });

          it("updates users balances", async function () {
            expectBNEq(await univ2.balanceOf(user.address), BN(0));
            expectBNEq(await poolLP.balanceOfStaged(user.address), BN(800));
            expectBNEq(await poolLP.balanceOfBonded(user.address), BN(200));
          });

          it("updates dao balances", async function () {
            expectBNEq(await univ2.balanceOf(poolLP.address), BN(1000));
            expectBNEq(await poolLP.totalBonded(), BN(200));
            expectBNEq(await poolLP.totalStaged(), BN(800));
          });

          it("emits Unbond event", async function () {
            await expectEventIn(txRecp, "Unbond", {
              account: user.address,
              start: BN(3),
              value: BN(800),
              newClaimable: BN(0),
            });
          });
        });

        describe("multiple", function () {
          let txRecp: ContractReceipt;
          beforeEach(async function () {
            await univ2.faucet(user1.address, 1000);
            await univ2.connect(user1).approve(poolLP.address, 1000);
            await poolLP.connect(user1).deposit(1000);

            await univ2.faucet(user2.address, 1000);
            await univ2.connect(user2).approve(poolLP.address, 1000);
            await poolLP.connect(user2).deposit(1000);

            await poolLP.connect(user1).bond(600);
            await poolLP.connect(user2).bond(400);

            await incrementEpoch(dao);

            const tx = await poolLP.connect(user).unbond(BN(800));
            txRecp = await tx.wait();
          });

          it("is frozen", async function () {
            expectBNEq(await poolLP.statusOf(user.address), FLUID);
          });

          it("updates users balances", async function () {
            expectBNEq(await univ2.balanceOf(user.address), BN(0));
            expectBNEq(await poolLP.balanceOfStaged(user.address), BN(800));
            expectBNEq(await poolLP.balanceOfBonded(user.address), BN(200));
          });

          it("updates dao balances", async function () {
            expectBNEq(await univ2.balanceOf(poolLP.address), BN(3000));
            expectBNEq(await poolLP.totalBonded(), BN(1200));
            expectBNEq(await poolLP.totalStaged(), BN(1800));
          });

          it("emits Unbond event", async function () {
            await expectEventIn(txRecp, "Unbond", {
              account: user.address,
              start: BN(4),
              value: BN(800),
              newClaimable: BN(0),
            });
          });
        });
      });

      describe("with reward", function () {
        beforeEach(async function () {
          await univ2.faucet(user.address, 1000);
          await univ2.connect(user).approve(poolLP.address, 1000);
          await poolLP.connect(user).deposit(1000);

          await poolLP.connect(user).bond(1000);
          await incrementEpoch(dao);
          await dollar.mint(poolLP.address, 1000);
        });

        describe("simple", function () {
          let txRecp: ContractReceipt;
          beforeEach(async function () {
            const tx = await poolLP.connect(user).unbond(BN(1000));
            txRecp = await tx.wait();
          });

          it("is fluid", async function () {
            expectBNEq(await poolLP.statusOf(user.address), FLUID);
          });

          it("updates users balances", async function () {
            expectBNEq(await dollar.balanceOf(user.address), BN(0));
            expectBNEq(await poolLP.balanceOfClaimable(user.address), BN(1000));
            expectBNEq(await poolLP.balanceOfRewarded(user.address), BN(0));
            expectBNEq(await poolLP.balanceOfPhantom(user.address), BN(0));
          });

          it("updates dao balances", async function () {
            expectBNEq(await dollar.balanceOf(poolLP.address), BN(1000));
            expectBNEq(await poolLP.totalClaimable(), BN(1000));
            expectBNEq(await poolLP.totalRewarded(), BN(0));
            expectBNEq(await poolLP.totalPhantom(), BN(0));
          });

          it("emits Unbond event", async function () {
            await expectEventIn(txRecp, "Unbond", {
              account: user.address,
              start: BN(3),
              value: BN(1000),
              newClaimable: BN(1000),
            });
          });
        });

        describe("partial", function () {
          let txRecp: ContractReceipt;
          beforeEach(async function () {
            const tx = await poolLP.connect(user).unbond(BN(800));
            txRecp = await tx.wait();
          });

          it("is fluid", async function () {
            expectBNEq(await poolLP.statusOf(user.address), FLUID);
          });

          it("updates users balances", async function () {
            expectBNEq(await dollar.balanceOf(user.address), BN(0));
            expectBNEq(await poolLP.balanceOfClaimable(user.address), BN(800));
            expectBNEq(await poolLP.balanceOfRewarded(user.address), BN(200));
            expectBNEq(await poolLP.balanceOfPhantom(user.address), BN(200).mul(INITIAL_STAKE_MULTIPLE));
          });

          it("updates dao balances", async function () {
            expectBNEq(await dollar.balanceOf(poolLP.address), BN(1000));
            expectBNEq(await poolLP.totalClaimable(), BN(800));
            expectBNEq(await poolLP.totalRewarded(), BN(200));
            expectBNEq(await poolLP.totalPhantom(), BN(200).mul(INITIAL_STAKE_MULTIPLE));
          });

          it("emits Unbond event", async function () {
            await expectEventIn(txRecp, "Unbond", {
              account: user.address,
              start: BN(3),
              value: BN(800),
              newClaimable: BN(800),
            });
          });
        });

        describe("multiple", function () {
          let txRecp: ContractReceipt;
          beforeEach(async function () {
            await univ2.faucet(user1.address, 1000);
            await univ2.connect(user1).approve(poolLP.address, 1000);
            await poolLP.connect(user1).deposit(1000);

            await univ2.faucet(user2.address, 1000);
            await univ2.connect(user2).approve(poolLP.address, 1000);
            await poolLP.connect(user2).deposit(1000);

            await poolLP.connect(user1).bond(600);
            await poolLP.connect(user2).bond(400);

            await incrementEpoch(dao);
            await dollar.mint(poolLP.address, 1000);

            const tx = await poolLP.connect(user).unbond(BN(800));
            txRecp = await tx.wait();
          });

          it("is frozen", async function () {
            expectBNEq(await poolLP.statusOf(user.address), FLUID);
          });

          it("updates users balances", async function () {
            expectBNEq(await dollar.balanceOf(user.address), BN(0));
            expectBNEq(await poolLP.balanceOfClaimable(user.address), BN(1200));
            expectBNEq(await poolLP.balanceOfRewarded(user.address), BN(300));
            expectBNEq(await poolLP.balanceOfPhantom(user.address), BN(200).mul(INITIAL_STAKE_MULTIPLE));
            expectBNEq(await poolLP.balanceOfClaimable(user1.address), BN(0));
            expectBNEq(await poolLP.balanceOfRewarded(user1.address), BN(300));
            expectBNEq(await poolLP.balanceOfPhantom(user1.address), BN(600).mul(INITIAL_STAKE_MULTIPLE).add(BN(600)));
            expectBNEq(await poolLP.balanceOfClaimable(user2.address), BN(0));
            expectBNEq(await poolLP.balanceOfRewarded(user2.address), BN(200));
            expectBNEq(await poolLP.balanceOfPhantom(user2.address), BN(400).mul(INITIAL_STAKE_MULTIPLE).add(BN(400)));
          });

          it("updates dao balances", async function () {
            expectBNEq(await dollar.balanceOf(poolLP.address), BN(2000));
            expectBNEq(await poolLP.totalClaimable(), BN(1200));
            expectBNEq(await poolLP.totalRewarded(), BN(800));
            expectBNEq(await poolLP.totalPhantom(), BN(1200).mul(INITIAL_STAKE_MULTIPLE).add(BN(1000)));
          });

          it("emits Unbond event", async function () {
            await expectEventIn(txRecp, "Unbond", {
              account: user.address,
              start: BN(4),
              value: BN(800),
              newClaimable: BN(1200),
            });
          });
        });

        describe("potential subtraction underflow", function () {
          let txRecp: ContractReceipt;

          beforeEach(async function () {
            await univ2.faucet(user1.address, 1000);
            await univ2.connect(user1).approve(poolLP.address, 1000);
            await poolLP.connect(user1).deposit(1000);

            await univ2.faucet(user2.address, 1000);
            await univ2.connect(user2).approve(poolLP.address, 1000);
            await poolLP.connect(user2).deposit(1000);

            await poolLP.connect(user1).bond(600);
            await poolLP.connect(user2).bond(500);

            await incrementEpoch(dao);
            await dollar.mint(poolLP.address, 1000);

            await poolLP.connect(user).unbond(BN(1000));
            await poolLP.connect(user).bond(BN(1000));
            await poolLP.connect(user).unbond(BN(600));

            const tx = await poolLP.connect(user).unbond(BN(200));
            txRecp = await tx.wait();
          });

          it("is frozen", async function () {
            expectBNEq(await poolLP.statusOf(user.address), FLUID);
          });

          it("updates users balances", async function () {
            expectBNEq(await dollar.balanceOf(user.address), BN(0));
            expectBNEq(await poolLP.balanceOfClaimable(user.address), BN(1476));
            expectBNEq(await poolLP.balanceOfRewarded(user.address), BN(0));
            expectBNEq(await poolLP.balanceOfPhantom(user.address), BN(200).mul(INITIAL_STAKE_MULTIPLE).add(BN(296)));
            expectBNEq(await poolLP.balanceOfClaimable(user1.address), BN(0));
            expectBNEq(await poolLP.balanceOfRewarded(user1.address), BN(286));
            expectBNEq(await poolLP.balanceOfPhantom(user1.address), BN(600).mul(INITIAL_STAKE_MULTIPLE).add(BN(600)));
            expectBNEq(await poolLP.balanceOfClaimable(user2.address), BN(0));
            expectBNEq(await poolLP.balanceOfRewarded(user2.address), BN(238));
            expectBNEq(await poolLP.balanceOfPhantom(user2.address), BN(500).mul(INITIAL_STAKE_MULTIPLE).add(BN(500)));
          });

          it("updates dao balances", async function () {
            expectBNEq(await dollar.balanceOf(poolLP.address), BN(2000));
            expectBNEq(await poolLP.totalClaimable(), BN(1476));
            expectBNEq(await poolLP.totalRewarded(), BN(524));
            expectBNEq(await poolLP.totalPhantom(), BN(1300).mul(INITIAL_STAKE_MULTIPLE).add(BN(1396)));
          });

          it("emits Unbond event", async function () {
            await expectEventIn(txRecp, "Unbond", {
              account: user.address,
              start: BN(4),
              value: BN(200),
              newClaimable: BN(0),
            });
          });
        });
      });
    });

    describe("when provide", function () {
      beforeEach(async function () {
        await univ2.faucet(user.address, 1000);
        await univ2.connect(user).approve(poolLP.address, 1000);
        await poolLP.connect(user).deposit(1000);
        await poolLP.connect(user).bond(1000);

        await univ2.setToken0(dollar.address);
        await univ2.setToken1(dollar.address);

        const poolLockupEpochs = 5;
        for (let i = 0; i < poolLockupEpochs; i++) {
          await incrementEpoch(dao);
        }
        await dollar.mint(poolLP.address, 1000);
      });

      describe("not enough rewards", function () {
        it("reverts", async function () {
          await expectRevert(poolLP.connect(user).provide(2000), "Liquidity: insufficient rewarded balance");
        });
      });

      describe("simple", function () {
        let txRecp: ContractReceipt;

        const phantomAfterLessReward = BN(1000).mul(INITIAL_STAKE_MULTIPLE).add(BN(1000));
        const phantomAfterNewBonded = phantomAfterLessReward.add(BN(10).mul(INITIAL_STAKE_MULTIPLE).add(BN(10)));

        beforeEach(async function () {
          await dai.mint(user.address, 1000);
          await dai.connect(user).approve(poolLP.address, 1000);

          await univ2.set(1000, 1000, 10);

          const tx = await poolLP.connect(user).provide(1000);
          txRecp = await tx.wait();
        });

        it("is frozen", async function () {
          expectBNEq(await poolLP.statusOf(user.address), FROZEN);
        });

        it("updates users balances", async function () {
          expectBNEq(await univ2.balanceOf(user.address), BN(0));
          expectBNEq(await poolLP.balanceOfStaged(user.address), BN(0));
          expectBNEq(await poolLP.balanceOfClaimable(user.address), BN(0));
          expectBNEq(await poolLP.balanceOfBonded(user.address), BN(1010));
          expectBNEq(await poolLP.balanceOfRewarded(user.address), BN(0));
          expectBNEq(await poolLP.balanceOfPhantom(user.address), phantomAfterNewBonded);
        });

        it("updates dao balances", async function () {
          expectBNEq(await univ2.balanceOf(poolLP.address), BN(1010));
          expectBNEq(await poolLP.totalStaged(), BN(0));
          expectBNEq(await poolLP.totalClaimable(), BN(0));
          expectBNEq(await poolLP.totalBonded(), BN(1010));
          expectBNEq(await poolLP.totalRewarded(), BN(0));
          expectBNEq(await poolLP.totalPhantom(), phantomAfterNewBonded);
        });

        it("emits Deposit event", async function () {
          await expectEventIn(txRecp, "Provide", {
            account: user.address,
            value: BN(1000),
            lessDai: BN(1000),
            newUniv2: BN(10),
          });
        });
      });

      describe("complex", function () {
        let txRecp: ContractReceipt;

        const phantomAfterLessReward = BN(1000).mul(INITIAL_STAKE_MULTIPLE).add(BN(1000));
        const phantomAfterNewBonded = phantomAfterLessReward.add(BN(10).mul(INITIAL_STAKE_MULTIPLE).add(BN(15)));
        const totalPhantom = phantomAfterNewBonded.add(BN(1000).mul(INITIAL_STAKE_MULTIPLE).add(BN(1000)));

        beforeEach(async function () {
          await dai.mint(user.address, 3000);
          await dai.connect(user).approve(poolLP.address, 3000);

          await univ2.faucet(user1.address, 1000);
          await univ2.connect(user1).approve(poolLP.address, 1000);
          await poolLP.connect(user1).deposit(1000);
          await poolLP.connect(user1).bond(1000);

          await incrementEpoch(dao);
          await dollar.mint(poolLP.address, 1000);

          // 1000 ESD + 3000 dai
          await univ2.set(1000, 3000, 10);

          const tx = await poolLP.connect(user).provide(1000);
          txRecp = await tx.wait();
        });

        it("is frozen", async function () {
          expectBNEq(await poolLP.statusOf(user.address), FROZEN);
        });

        it("updates users balances", async function () {
          expectBNEq(await univ2.balanceOf(user.address), BN(0));
          expectBNEq(await poolLP.balanceOfStaged(user.address), BN(0));
          expectBNEq(await poolLP.balanceOfClaimable(user.address), BN(0));
          expectBNEq(await poolLP.balanceOfBonded(user.address), BN(1010));
          expectBNEq(await poolLP.balanceOfRewarded(user.address), BN(500));
          expectBNEq(await poolLP.balanceOfPhantom(user.address), phantomAfterNewBonded);
        });

        it("updates dao balances", async function () {
          expectBNEq(await univ2.balanceOf(poolLP.address), BN(2010));
          expectBNEq(await poolLP.totalStaged(), BN(0));
          expectBNEq(await poolLP.totalClaimable(), BN(0));
          expectBNEq(await poolLP.totalBonded(), BN(2010));
          expectBNEq(await poolLP.totalRewarded(), BN(1000));
          expectBNEq(await poolLP.totalPhantom(), totalPhantom);
        });

        it("emits Deposit event", async function () {
          await expectEventIn(txRecp, "Provide", {
            account: user.address,
            value: BN(1000),
            lessDai: BN(3000),
            newUniv2: BN(10),
          });
        });
      });
    });
  });

  describe("fluid", function () {
    beforeEach(async function () {
      await dollar.mint(poolLP.address, 1000);
      await univ2.faucet(user.address, 1000);
      await univ2.connect(user).approve(poolLP.address, 1000);
      await poolLP.connect(user).deposit(1000);

      await poolLP.connect(user).bond(500);
    });

    it("is fluid", async function () {
      expectBNEq(await poolLP.statusOf(user.address), FLUID);
    });

    describe("when deposit", function () {
      it("reverts", async function () {
        await expectRevert(poolLP.connect(user).deposit(1000), "Permission: Not frozen");
      });
    });

    describe("when withdraw", function () {
      it("reverts", async function () {
        await expectRevert(poolLP.connect(user).withdraw(1000), "Permission: Not frozen");
      });
    });

    describe("when claim", function () {
      it("reverts", async function () {
        await expectRevert(poolLP.connect(user).claim(1000), "Permission: Not frozen");
      });
    });

    describe("when provide", function () {
      it("reverts", async function () {
        await expectRevert(poolLP.connect(user).provide(1000), "Permission: Not frozen");
      });
    });

    describe("when bond", function () {
      let txRecp: ContractReceipt;

      beforeEach(async function () {
        const tx = await poolLP.connect(user).bond(500);
        txRecp = await tx.wait();
      });

      it("is fluid", async function () {
        expectBNEq(await poolLP.statusOf(user.address), FLUID);
      });

      it("updates users balances", async function () {
        expectBNEq(await univ2.balanceOf(user.address), BN(0));
        expectBNEq(await poolLP.balanceOfStaged(user.address), BN(0));
        expectBNEq(await poolLP.balanceOfBonded(user.address), BN(1000));
      });

      it("updates dao balances", async function () {
        expectBNEq(await univ2.balanceOf(poolLP.address), BN(1000));
        expectBNEq(await poolLP.totalBonded(), BN(1000));
        expectBNEq(await poolLP.totalStaged(), BN(0));
      });

      it("emits Bond event", async function () {
        await expectEventIn(txRecp, "Bond", {
          account: user.address,
          start: BN(2),
          value: BN(500),
        });
      });
    });

    describe("when unbond", function () {
      let txRecp: ContractReceipt;

      beforeEach(async function () {
        const tx = await poolLP.connect(user).unbond(BN(500));
        txRecp = await tx.wait();
      });

      it("is fluid", async function () {
        expectBNEq(await poolLP.statusOf(user.address), FLUID);
      });

      it("updates users balances", async function () {
        expectBNEq(await univ2.balanceOf(user.address), BN(0));
        expectBNEq(await poolLP.balanceOfStaged(user.address), BN(1000));
        expectBNEq(await poolLP.balanceOfBonded(user.address), BN(0));
      });

      it("updates dao balances", async function () {
        expectBNEq(await univ2.balanceOf(poolLP.address), BN(1000));
        expectBNEq(await poolLP.totalBonded(), BN(0));
        expectBNEq(await poolLP.totalStaged(), BN(1000));
      });

      it("emits Unbond event", async function () {
        await expectEventIn(txRecp, "Unbond", {
          account: user.address,
          start: BN(2),
          value: BN(500),
          newClaimable: BN(1000),
        });
      });
    });
  });

  describe("when pause", function () {
    beforeEach(async function () {
      await univ2.faucet(user.address, 1000);
      await univ2.connect(user).approve(poolLP.address, 1000);
      await poolLP.connect(user).deposit(1000);
      await poolLP.connect(user).bond(1000);
      await dao.set((await dao.epoch()) + 1);
      await dollar.mint(poolLP.address, 1000);
      await poolLP.connect(user).unbond(500);
      await dao.set((await dao.epoch()) + 1);
    });

    describe("as dao", function () {
      beforeEach(async function () {
        await poolLP.set(mockDao.address, dai.address, dollar.address);
        await poolLP.connect(mockDao).emergencyPause();
        await poolLP.set(dao.address, dai.address, dollar.address);
      });

      it("is paused", async function () {
        expect(await poolLP.paused()).to.be.equal(true);
      });

      it("reverts on deposit", async function () {
        await expectRevert(poolLP.connect(user).deposit(2000), "Paused");
      });

      it("reverts on bond", async function () {
        await expectRevert(poolLP.connect(user).bond(2000), "Paused");
      });

      it("reverts on provide", async function () {
        await expectRevert(poolLP.connect(user).provide(2000), "Paused");
      });

      describe("withdraw", function () {
        beforeEach(async function () {
          await poolLP.connect(user).withdraw(200);
        });

        it("basic withdraw check", async function () {
          expectBNEq(await univ2.balanceOf(user.address), BN(200));
        });
      });

      describe("unbond", function () {
        beforeEach(async function () {
          await poolLP.connect(user).unbond(200);
        });

        it("basic unbond check", async function () {
          expectBNEq(await poolLP.balanceOfStaged(user.address), BN(700));
          expectBNEq(await poolLP.balanceOfClaimable(user.address), BN(700));
        });
      });

      describe("claim", function () {
        beforeEach(async function () {
          await poolLP.connect(user).claim(200);
        });

        it("basic claim check", async function () {
          expectBNEq(await dollar.balanceOf(user.address), BN(200));
        });
      });
    });

    describe("as not dao", function () {
      it("reverts", async function () {
        await expectRevert(poolLP.connect(user).emergencyPause(), "Not dao");
      });
    });
  });

  describe("when emergency withdraw", function () {
    beforeEach(async function () {
      await univ2.faucet(user.address, 1000);
      await univ2.connect(user).approve(poolLP.address, 1000);
      await poolLP.connect(user).deposit(1000);
      await poolLP.connect(user).bond(1000);
      await dao.set((await dao.epoch()) + 1);
      await dollar.mint(poolLP.address, 1000);
    });

    describe("as dao", function () {
      beforeEach(async function () {
        await poolLP.set(mockDao.address, dai.address, dollar.address);
        await poolLP.connect(mockDao).emergencyWithdraw(univ2.address, 1000);
        await poolLP.connect(mockDao).emergencyWithdraw(dollar.address, 1000);
      });

      it("transfers funds to the dao", async function () {
        expectBNEq(await univ2.balanceOf(mockDao.address), BN(1000));
        expectBNEq(await univ2.balanceOf(poolLP.address), BN(0));
        expectBNEq(await dollar.balanceOf(mockDao.address), BN(1000));
        expectBNEq(await dollar.balanceOf(poolLP.address), BN(0));
      });
    });

    describe("as not dao", function () {
      it("reverts", async function () {
        await expectRevert(poolLP.connect(user).emergencyWithdraw(univ2.address, 1000), "Not dao");
      });
    });
  });
});
