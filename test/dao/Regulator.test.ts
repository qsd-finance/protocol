import { ethers } from "hardhat";
import { expectBNEq, expectEventIn, BN } from "../Utils";

import {
  POOL_BONDING_REWARD_PERCENT,
  SUPPLY_CHANGE_LIMIT,
  TREASURY_ADDRESS,
  TREASURY_REWARD_PERCENT,
  POOL_LP_REWARD_PERCENT,
} from "../Constants";
import { Contract, ContractFactory, ContractReceipt } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";

const INITIAL_SUPPLY = 1000000;

function poolBondingIncentive(newAmount) {
  return BN(newAmount).mul(POOL_BONDING_REWARD_PERCENT).div(BN(100));
}

function poolLPIncentive(newAmount) {
  return BN(newAmount).mul(POOL_LP_REWARD_PERCENT).div(BN(100));
}

function treasuryIncentive(newAmount) {
  return BN(newAmount).mul(TREASURY_REWARD_PERCENT).div(BN(100));
}

describe("Regulator", function () {
  let [owner, poolLP, poolBonding]: SignerWithAddress[] = [];

  let MockSettableOracle: ContractFactory;
  let MockRegulator: ContractFactory;
  let MockToken: ContractFactory;

  let oracle: Contract;
  let regulator: Contract;
  let dollar: Contract;
  let governanceToken: Contract;

  before(async function () {
    [owner, poolLP, poolBonding] = await ethers.getSigners();

    MockSettableOracle = await ethers.getContractFactory("MockSettableOracle");
    MockRegulator = await ethers.getContractFactory("MockRegulator");
    MockToken = await ethers.getContractFactory("MockToken");
  });

  beforeEach(async function () {
    governanceToken = await MockToken.deploy("TOKEN", "TKN", 18, { gasLimit: 8000000 });

    oracle = await MockSettableOracle.connect(owner).deploy({ gasLimit: 8000000 });
    regulator = await MockRegulator.connect(owner).deploy(oracle.address, poolLP.address, poolBonding.address, {
      gasLimit: 8000000,
    });
    regulator.setGovernanceToken(governanceToken.address);
    dollar = await ethers.getContractAt("Dollar", await regulator.dollar());
  });

  describe("bootstrapping", function () {
    let expectedReward: number;
    beforeEach(async function () {
      // bootstrapping price at 1.1
      expectedReward = INITIAL_SUPPLY * SUPPLY_CHANGE_LIMIT;
      await regulator.mintToE(regulator.address, INITIAL_SUPPLY);
      await regulator.incrementEpochE(); // 1
      await regulator.incrementTotalBondedE(INITIAL_SUPPLY);
      await regulator.stepE();
    });

    describe("simple", function () {
      it("test", async function () {
        expectBNEq(await dollar.totalSupply(), BN(INITIAL_SUPPLY + expectedReward));
        expectBNEq(await regulator.totalBonded(), BN(INITIAL_SUPPLY + expectedReward / 2));
        expectBNEq(await dollar.balanceOf(regulator.address), BN(INITIAL_SUPPLY + expectedReward / 2));
        expectBNEq(await dollar.balanceOf(poolLP.address), BN(expectedReward / 2));
        expectBNEq(await dollar.balanceOf(poolBonding.address), BN(0));
        expectBNEq(await dollar.balanceOf(TREASURY_ADDRESS), BN(0));
      });
    });
  });

  describe("after bootstrapped", function () {
    beforeEach(async function () {
      await regulator.incrementEpochE(); // 1
      await regulator.incrementEpochE(); // 2
      await regulator.incrementEpochE(); // 3
      await regulator.incrementEpochE(); // 4
      await regulator.incrementEpochE(); // 5
    });

    describe("distributes governance token when TWAP <$1", function () {
      it("to poolBonding", async function () {
        await regulator.incrementEpochE();
        await regulator.incrementEpochE();

        await oracle.set(95, 100, true);
        const before = await governanceToken.balanceOf(poolBonding.address);
        await regulator.stepE();
        const after = await governanceToken.balanceOf(poolBonding.address);

        expect(after.gt(before)).to.be.true;
      });
    });

    describe("up regulation", function () {
      describe("above limit", function () {
        let expectedReward: number;

        beforeEach(async function () {
          await regulator.incrementEpochE(); // 1
          await regulator.incrementEpochE(); // 2
          await regulator.incrementTotalBondedE(INITIAL_SUPPLY);
          await regulator.mintToE(regulator.address, INITIAL_SUPPLY);
        });

        describe("on step", function () {
          let txRecp: ContractReceipt;
          beforeEach(async function () {
            await oracle.set(115, 100, true);
            expectedReward = INITIAL_SUPPLY * SUPPLY_CHANGE_LIMIT;

            const tx = await regulator.stepE();
            txRecp = await tx.wait();
          });

          it("mints new Dollar tokens", async function () {
            expectBNEq(await dollar.totalSupply(), BN(INITIAL_SUPPLY + expectedReward));
            expectBNEq(await dollar.balanceOf(regulator.address), BN(INITIAL_SUPPLY));
            expectBNEq(await dollar.balanceOf(poolLP.address), poolLPIncentive(expectedReward));
            expectBNEq(await dollar.balanceOf(poolBonding.address), poolBondingIncentive(expectedReward));
            expectBNEq(await dollar.balanceOf(TREASURY_ADDRESS), treasuryIncentive(expectedReward));
          });

          it("updates totals", async function () {
            expectBNEq(await regulator.totalStaged(), BN(0));
            expectBNEq(await regulator.totalBonded(), BN(INITIAL_SUPPLY));
            expectBNEq(await regulator.totalSupply(), BN(0));
          });

          it("emits SupplyIncrease event", async function () {
            await expectEventIn(txRecp, "SupplyIncrease", {
              epoch: BN(7),
              price: BN(115).mul(BN(10).pow(BN(16))),
              newRedeemable: BN(0),
              lessDebt: BN(0),
              newBonded: BN(expectedReward),
            });
          });
        });
      });

      describe("(2) - only to bonded", function () {
        beforeEach(async function () {
          await regulator.incrementEpochE(); // 1
          await regulator.incrementEpochE(); // 2
          await regulator.incrementTotalBondedE(INITIAL_SUPPLY);
          await regulator.mintToE(regulator.address, INITIAL_SUPPLY);
        });

        describe("on step", function () {
          let expectedReward: number;
          let txRecp: ContractReceipt;

          beforeEach(async function () {
            await oracle.set(101, 100, true);
            expectedReward = 10000;

            const tx = await regulator.stepE();
            txRecp = await tx.wait();
          });

          it("mints new Dollar tokens", async function () {
            expectBNEq(await dollar.totalSupply(), BN(INITIAL_SUPPLY).add(BN(expectedReward)));
            expectBNEq(await dollar.balanceOf(regulator.address), BN(INITIAL_SUPPLY));
            expectBNEq(await dollar.balanceOf(poolLP.address), poolLPIncentive(expectedReward));
            expectBNEq(await dollar.balanceOf(poolBonding.address), poolBondingIncentive(expectedReward));
            expectBNEq(await dollar.balanceOf(TREASURY_ADDRESS), treasuryIncentive(expectedReward));
          });

          it("updates totals", async function () {
            expectBNEq(await regulator.totalStaged(), BN(0));
            expectBNEq(await regulator.totalBonded(), BN(INITIAL_SUPPLY));
            expectBNEq(await regulator.totalSupply(), BN(0));
          });

          it("emits SupplyIncrease event", async function () {
            await expectEventIn(txRecp, "SupplyIncrease", {
              epoch: BN(7),
              price: BN(101).mul(BN(10).pow(BN(16))),
              newRedeemable: BN(0),
              lessDebt: BN(0),
              newBonded: BN(expectedReward),
            });
          });
        });
      });

      describe("(1) - refresh redeemable at specified ratio", function () {
        beforeEach(async function () {
          await regulator.incrementEpochE(); // 1

          await regulator.incrementTotalBondedE(INITIAL_SUPPLY);
          await regulator.mintToE(regulator.address, INITIAL_SUPPLY);

          await regulator.incrementEpochE(); // 2
        });

        describe("on step", function () {
          let [expectedReward]: number[] = [];
          let txRecp: ContractReceipt;

          beforeEach(async function () {
            await oracle.set(101, 100, true);
            expectedReward = 10000;

            const tx = await regulator.stepE();
            txRecp = await tx.wait();
          });

          it("mints new Dollar tokens", async function () {
            expectBNEq(await dollar.totalSupply(), BN(INITIAL_SUPPLY).add(BN(expectedReward)));
            expectBNEq(await dollar.balanceOf(poolLP.address), poolLPIncentive(expectedReward));
            expectBNEq(await dollar.balanceOf(poolBonding.address), poolBondingIncentive(expectedReward));
            expectBNEq(await dollar.balanceOf(TREASURY_ADDRESS), treasuryIncentive(expectedReward));
          });

          it("updates totals", async function () {
            expectBNEq(await regulator.totalStaged(), BN(0));
            expectBNEq(await regulator.totalBonded(), BN(INITIAL_SUPPLY));
            expectBNEq(await regulator.totalSupply(), BN(0));
          });

          it("emits SupplyIncrease event", async function () {
            await expectEventIn(txRecp, "SupplyIncrease", {
              epoch: BN(7),
              price: BN(101).mul(BN(10).pow(BN(16))),
              lessDebt: BN(0),
              newBonded: BN(expectedReward),
            });
          });
        });
      });
    });

    describe("(1 + 2) - refresh redeemable then mint to bonded", function () {
      beforeEach(async function () {
        await regulator.incrementEpochE(); // 1

        await regulator.incrementTotalBondedE(INITIAL_SUPPLY);
        await regulator.mintToE(regulator.address, INITIAL_SUPPLY);

        await regulator.incrementEpochE(); // 2
      });

      describe("on step", function () {
        let txRecp: ContractReceipt;
        let [expectedReward]: number[] = [];

        beforeEach(async function () {
          await oracle.set(101, 100, true);
          expectedReward = 10000;

          const tx = await regulator.stepE();
          txRecp = await tx.wait();
        });

        it("mints new Dollar tokens", async function () {
          expectBNEq(await dollar.totalSupply(), BN(1010000));
          expectBNEq(await dollar.balanceOf(regulator.address), BN(INITIAL_SUPPLY));
          expectBNEq(await dollar.balanceOf(poolLP.address), poolLPIncentive(expectedReward));
          expectBNEq(await dollar.balanceOf(poolBonding.address), poolBondingIncentive(expectedReward));
          expectBNEq(await dollar.balanceOf(TREASURY_ADDRESS), treasuryIncentive(expectedReward));
        });

        it("updates totals", async function () {
          expectBNEq(await regulator.totalStaged(), BN(0));
          expectBNEq(await regulator.totalBonded(), BN(INITIAL_SUPPLY));
          expectBNEq(await regulator.totalSupply(), BN(0));
        });

        it("emits SupplyIncrease event", async function () {
          await expectEventIn(txRecp, "SupplyIncrease", {
            epoch: BN(7),
            price: BN(101).mul(BN(10).pow(BN(16))),
            newRedeemable: BN(0),
            lessDebt: BN(0),
            newBonded: BN(10000),
          });
        });
      });
    });

    describe("(3) - above limit but below coupon limit", function () {
      beforeEach(async function () {
        await regulator.incrementEpochE(); // 1

        await regulator.incrementTotalBondedE(INITIAL_SUPPLY);
        await regulator.mintToE(regulator.address, INITIAL_SUPPLY);

        await regulator.incrementEpochE(); // 2
      });

      describe("on step", function () {
        let [expectedReward]: number[] = [];
        let txRecp: ContractReceipt;

        beforeEach(async function () {
          await oracle.set(105, 100, true);
          expectedReward = 50000;

          const tx = await regulator.stepE();
          txRecp = await tx.wait();
        });

        it("mints new Dollar tokens", async function () {
          expectBNEq(await dollar.totalSupply(), BN(INITIAL_SUPPLY).add(BN(expectedReward)));
          expectBNEq(await dollar.balanceOf(poolLP.address), poolLPIncentive(expectedReward));
          expectBNEq(await dollar.balanceOf(poolBonding.address), poolBondingIncentive(expectedReward));
          expectBNEq(await dollar.balanceOf(TREASURY_ADDRESS), treasuryIncentive(expectedReward));
        });

        it("updates totals", async function () {
          expectBNEq(await regulator.totalStaged(), BN(0));
          expectBNEq(await regulator.totalBonded(), BN(INITIAL_SUPPLY));
          expectBNEq(await regulator.totalSupply(), BN(0));
        });

        it("emits SupplyIncrease event", async function () {
          await expectEventIn(txRecp, "SupplyIncrease", {
            epoch: BN(7),
            price: BN(105).mul(BN(10).pow(BN(16))),
            lessDebt: BN(0),
            newBonded: BN(expectedReward),
          });
        });
      });
    });

    describe("down regulation", function () {
      describe("under limit", function () {
        beforeEach(async function () {
          await regulator.incrementEpochE(); // 1
          await regulator.incrementEpochE(); // 2

          await regulator.incrementTotalBondedE(INITIAL_SUPPLY);
          await regulator.mintToE(regulator.address, INITIAL_SUPPLY);

          await regulator.incrementEpochE(); // 3
        });

        describe("on step", function () {
          beforeEach(async function () {
            await oracle.set(85, 100, true);
            const tx = await regulator.stepE();
            await tx.wait();
          });

          it("doesnt mint new Dollar tokens", async function () {
            expectBNEq(await dollar.totalSupply(), BN(INITIAL_SUPPLY));
            expectBNEq(await dollar.balanceOf(regulator.address), BN(INITIAL_SUPPLY));
            expectBNEq(await dollar.balanceOf(poolLP.address), BN(0));
          });

          it("updates totals", async function () {
            expectBNEq(await regulator.totalStaged(), BN(0));
            expectBNEq(await regulator.totalBonded(), BN(INITIAL_SUPPLY));
            expectBNEq(await regulator.totalSupply(), BN(0));
          });
        });
      });

      describe("without debt", function () {
        beforeEach(async function () {
          await regulator.incrementEpochE(); // 1

          await regulator.incrementTotalBondedE(INITIAL_SUPPLY);
          await regulator.mintToE(regulator.address, INITIAL_SUPPLY);

          await regulator.incrementEpochE(); // 2
        });

        describe("on step", function () {
          beforeEach(async function () {
            await oracle.set(99, 100, true);

            const tx = await regulator.stepE();
            await tx.wait();
          });

          it("doesnt mint new Dollar tokens", async function () {
            expectBNEq(await dollar.totalSupply(), BN(INITIAL_SUPPLY));
            expectBNEq(await dollar.balanceOf(regulator.address), BN(INITIAL_SUPPLY));
            expectBNEq(await dollar.balanceOf(poolLP.address), BN(0));
          });

          it("updates totals", async function () {
            expectBNEq(await regulator.totalStaged(), BN(0));
            expectBNEq(await regulator.totalBonded(), BN(INITIAL_SUPPLY));
            expectBNEq(await regulator.totalSupply(), BN(0));
          });
        });
      });

      describe("with debt", function () {
        beforeEach(async function () {
          await regulator.incrementEpochE(); // 1

          await regulator.incrementTotalBondedE(INITIAL_SUPPLY);
          await regulator.mintToE(regulator.address, INITIAL_SUPPLY);

          await regulator.incrementEpochE(); // 2
        });

        describe("on step", function () {
          beforeEach(async function () {
            await oracle.set(99, 100, true);

            const tx = await regulator.stepE();
            await tx.wait();
          });

          it("doesnt mint new Dollar tokens", async function () {
            expectBNEq(await dollar.totalSupply(), BN(INITIAL_SUPPLY));
            expectBNEq(await dollar.balanceOf(regulator.address), BN(INITIAL_SUPPLY));
            expectBNEq(await dollar.balanceOf(poolLP.address), BN(0));
          });

          it("updates totals", async function () {
            it("updates totals", async function () {
              expectBNEq(await regulator.totalStaged(), BN(0));
              expectBNEq(await regulator.totalBonded(), BN(INITIAL_SUPPLY));
              expectBNEq(await regulator.totalSupply(), BN(0));
            });
          });
        });
      });

      describe("with debt over limit", function () {
        beforeEach(async function () {
          await regulator.incrementEpochE(); // 1
          await regulator.incrementTotalBondedE(INITIAL_SUPPLY);
          await regulator.mintToE(regulator.address, INITIAL_SUPPLY);
          await regulator.incrementEpochE(); // 2
        });

        describe("on step", function () {
          beforeEach(async function () {
            await oracle.set(95, 100, true);

            const tx = await regulator.stepE();
            await tx.wait();
          });

          it("doesnt mint new Dollar tokens", async function () {
            expectBNEq(await dollar.totalSupply(), BN(INITIAL_SUPPLY));
            expectBNEq(await dollar.balanceOf(regulator.address), BN(INITIAL_SUPPLY));
            expectBNEq(await dollar.balanceOf(poolLP.address), BN(0));
          });

          it("updates totals", async function () {
            it("updates totals", async function () {
              expectBNEq(await regulator.totalStaged(), BN(0));
              expectBNEq(await regulator.totalBonded(), BN(INITIAL_SUPPLY));
              expectBNEq(await regulator.totalSupply(), BN(0));
            });
          });
        });
      });

      describe("with debt some capped", function () {
        beforeEach(async function () {
          await regulator.incrementEpochE(); // 1

          await regulator.incrementTotalBondedE(INITIAL_SUPPLY);
          await regulator.mintToE(regulator.address, INITIAL_SUPPLY);

          await regulator.incrementEpochE(); // 2
        });

        describe("on step", function () {
          beforeEach(async function () {
            await oracle.set(99, 100, true);

            const tx = await regulator.stepE();
            await tx.wait();
          });

          it("doesnt mint new Dollar tokens", async function () {
            expectBNEq(await dollar.totalSupply(), BN(INITIAL_SUPPLY));
            expectBNEq(await dollar.balanceOf(regulator.address), BN(INITIAL_SUPPLY));
            expectBNEq(await dollar.balanceOf(poolLP.address), BN(0));
          });

          it("updates totals", async function () {
            it("updates totals", async function () {
              expectBNEq(await regulator.totalStaged(), BN(0));
              expectBNEq(await regulator.totalBonded(), BN(INITIAL_SUPPLY));
              expectBNEq(await regulator.totalSupply(), BN(0));
            });
          });
        });
      });

      describe("with debt all capped", function () {
        beforeEach(async function () {
          await regulator.incrementEpochE(); // 1

          await regulator.incrementTotalBondedE(INITIAL_SUPPLY);
          await regulator.mintToE(regulator.address, INITIAL_SUPPLY);

          await regulator.incrementEpochE(); // 2
        });

        describe("on step", function () {
          beforeEach(async function () {
            await oracle.set(99, 100, true);

            const tx = await regulator.stepE();
            await tx.wait();
          });

          it("doesnt mint new Dollar tokens", async function () {
            expectBNEq(await dollar.totalSupply(), BN(INITIAL_SUPPLY));
            expectBNEq(await dollar.balanceOf(regulator.address), BN(INITIAL_SUPPLY));
            expectBNEq(await dollar.balanceOf(poolLP.address), BN(0));
          });

          it("updates totals", async function () {
            it("updates totals", async function () {
              expectBNEq(await regulator.totalStaged(), BN(0));
              expectBNEq(await regulator.totalBonded(), BN(INITIAL_SUPPLY));
              expectBNEq(await regulator.totalSupply(), BN(0));
            });
          });
        });
      });
    });

    describe("neutral regulation", function () {
      beforeEach(async function () {
        await regulator.incrementEpochE(); // 1

        await regulator.incrementTotalBondedE(INITIAL_SUPPLY);
        await regulator.mintToE(regulator.address, INITIAL_SUPPLY);

        await regulator.incrementEpochE(); // 2
      });

      describe("on step", function () {
        beforeEach(async function () {
          await oracle.set(100, 100, true);
          const tx = await regulator.stepE();
          await tx.wait();
        });

        it("doesnt mint new Dollar tokens", async function () {
          expectBNEq(await dollar.totalSupply(), BN(INITIAL_SUPPLY));
          expectBNEq(await dollar.balanceOf(regulator.address), BN(INITIAL_SUPPLY));
          expectBNEq(await dollar.balanceOf(poolLP.address), BN(0));
        });

        it("updates totals", async function () {
          expectBNEq(await regulator.totalStaged(), BN(0));
          expectBNEq(await regulator.totalBonded(), BN(INITIAL_SUPPLY));
          expectBNEq(await regulator.totalSupply(), BN(0));
        });
      });
    });

    describe("not valid", function () {
      beforeEach(async function () {
        await regulator.incrementEpochE(); // 1

        await regulator.incrementTotalBondedE(INITIAL_SUPPLY);
        await regulator.mintToE(regulator.address, INITIAL_SUPPLY);

        await regulator.incrementEpochE(); // 2
      });

      describe("on step", function () {
        beforeEach(async function () {
          await oracle.set(105, 100, false);
          await regulator.stepE();
        });

        it("doesnt mint new Dollar tokens", async function () {
          expectBNEq(await dollar.totalSupply(), BN(INITIAL_SUPPLY));
          expectBNEq(await dollar.balanceOf(regulator.address), BN(INITIAL_SUPPLY));
          expectBNEq(await dollar.balanceOf(poolLP.address), BN(0));
        });

        it("updates totals", async function () {
          expectBNEq(await regulator.totalStaged(), BN(0));
          expectBNEq(await regulator.totalBonded(), BN(INITIAL_SUPPLY));
          expectBNEq(await regulator.totalSupply(), BN(0));
        });
      });
    });
  });
});
