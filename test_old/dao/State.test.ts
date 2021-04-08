import { ethers } from "hardhat";
import { expectBNEq, expectRevert, BN } from "../Utils";
import { CURRENT_EPOCH_START, BOOTSTRAPPING_PERIOD, CURRENT_EPOCH_PERIOD } from "../Constants";

import { BigNumber, Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { expect } from "chai";

describe("State", function () {
  let [owner, user, candidate]: SignerWithAddress[] = [];
  let MockState: ContractFactory;
  let MockPoolGov: ContractFactory;

  let poolGov: Contract;
  let setters: Contract;

  before(async function () {
    [owner, user, candidate] = await ethers.getSigners();
    MockState = await ethers.getContractFactory("MockState");
    MockPoolGov = await ethers.getContractFactory("MockPoolGov");
  });

  beforeEach(async function () {
    setters = await MockState.connect(owner).deploy();

    poolGov = await MockPoolGov.connect(owner).deploy(ethers.constants.AddressZero, ethers.constants.AddressZero, {
      gasLimit: 8000000,
    });

    await setters.setPoolGov(poolGov.address);
  });

  /**
   * Erc20 Implementation
   */

  describe("erc20 details", function () {
    describe("name", function () {
      it("increments total bonded", async function () {
        expect(await setters.name()).to.be.equal("Quantum Set Dollar Stake");
      });
    });

    describe("symbol", function () {
      it("increments total bonded", async function () {
        expect(await setters.symbol()).to.be.equal("FSDS");
      });
    });

    describe("decimals", function () {
      it("increments total bonded", async function () {
        expectBNEq(await setters.decimals(), BN(18));
      });
    });
  });

  describe("approve", function () {
    describe("when called", function () {
      let success: boolean;

      beforeEach("call", async function () {
        success = await setters.connect(user).callStatic.approve(owner.address, 100);
      });

      it("increments total bonded", async function () {
        expect(success).to.be.equal(false);
      });
    });
  });

  describe("transfer", function () {
    describe("when called", function () {
      let success: boolean;
      beforeEach("call", async function () {
        await setters.incrementBalanceOfE(user.address, 100);
        success = await setters.connect(user).callStatic.transfer(owner.address, 100);
      });

      it("increments total bonded", async function () {
        expect(success).to.be.equal(false);
      });
    });
  });

  describe("transferFrom", function () {
    describe("when called", function () {
      let success: boolean;

      beforeEach("call", async function () {
        await setters.incrementBalanceOfE(user.address, 100);
        success = await setters.connect(user).callStatic.transferFrom(user.address, owner.address, 100);
      });

      it("increments total bonded", async function () {
        expect(success).to.be.equal(false);
      });
    });
  });

  describe("allowance", function () {
    describe("when called", function () {
      let allowance: BigNumber;
      beforeEach("not revert", async function () {
        allowance = await setters.allowance(user.address, owner.address);
      });

      it("is 0", async function () {
        expectBNEq(allowance, BN(0));
      });
    });
  });

  /**
   * Global
   */

  describe("incrementTotalBonded", function () {
    describe("when called", function () {
      beforeEach("call", async function () {
        await setters.incrementTotalBondedE(100);
        await setters.incrementTotalBondedE(100);
      });

      it("increments total bonded", async function () {
        expectBNEq(await setters.totalBonded(), BN(200));
      });
    });
  });

  describe("decrementTotalBonded", function () {
    describe("when called", function () {
      beforeEach("call", async function () {
        await setters.incrementTotalBondedE(500);
        await setters.decrementTotalBondedE(100, "decrementTotalBondedE - 1");
        await setters.decrementTotalBondedE(100, "decrementTotalBondedE - 2");
      });

      it("decrements total bonded", async function () {
        expectBNEq(await setters.totalBonded(), BN(300));
      });
    });

    describe("when called erroneously", function () {
      beforeEach("call", async function () {
        await setters.incrementTotalBondedE(100);
      });

      it("reverts", async function () {
        await expectRevert(setters.decrementTotalBondedE(200, "decrementTotalBondedE"), "revert");
      });
    });
  });

  /**
   * Account
   */

  describe("incrementBalanceOf", function () {
    describe("when called", function () {
      beforeEach("call", async function () {
        await setters.incrementBalanceOfE(user.address, 100);
        await setters.incrementBalanceOfE(user.address, 100);
      });

      it("increments balance of user", async function () {
        expectBNEq(await setters.balanceOf(user.address), BN(200));
      });

      it("increments total supply", async function () {
        expectBNEq(await setters.totalSupply(), BN(200));
      });
    });
  });

  describe("decrementBalanceOf", function () {
    describe("when called", function () {
      beforeEach("call", async function () {
        await setters.incrementBalanceOfE(user.address, 500);
        await setters.decrementBalanceOfE(user.address, 100, "decrementBalanceOfE - 1");
        await setters.decrementBalanceOfE(user.address, 100, "decrementBalanceOfE - 2");
      });

      it("decrements balance of user", async function () {
        expectBNEq(await setters.balanceOf(user.address), BN(300));
      });

      it("decrements total supply", async function () {
        expectBNEq(await setters.totalSupply(), BN(300));
      });
    });

    describe("when called erroneously", function () {
      beforeEach("call", async function () {
        await setters.incrementBalanceOfE(user.address, 100);
      });

      it("reverts", async function () {
        await expectRevert(setters.decrementBalanceOfE(200, "decrementBalanceOfE"), "missing argument");
      });
    });
  });

  describe("incrementBalanceOfStaged", function () {
    describe("when called", function () {
      beforeEach("call", async function () {
        await setters.incrementBalanceOfStagedE(user.address, 100);
        await setters.incrementBalanceOfStagedE(user.address, 100);
      });

      it("increments balance of staged for user", async function () {
        expectBNEq(await setters.balanceOfStaged(user.address), BN(200));
      });

      it("increments total staged", async function () {
        expectBNEq(await setters.totalStaged(), BN(200));
      });
    });
  });

  describe("decrementBalanceOfStaged", function () {
    describe("when called", function () {
      beforeEach("call", async function () {
        await setters.incrementBalanceOfStagedE(user.address, 500);
        await setters.decrementBalanceOfStagedE(user.address, 100, "decrementBalanceOfStagedE - 1");
        await setters.decrementBalanceOfStagedE(user.address, 100, "decrementBalanceOfStagedE - 2");
      });

      it("decrements balance of staged for user", async function () {
        expectBNEq(await setters.balanceOfStaged(user.address), BN(300));
      });

      it("decrements total staged", async function () {
        expectBNEq(await setters.totalStaged(), BN(300));
      });
    });

    describe("when called erroneously", function () {
      beforeEach("call", async function () {
        await setters.incrementBalanceOfStagedE(user.address, 100);
      });

      it("reverts", async function () {
        await expectRevert(setters.decrementBalanceOfStagedE(200, "decrementBalanceOfStagedE"), "missing argument");
      });
    });
  });

  describe("balanceOfBonded", function () {
    describe("when called", function () {
      beforeEach("call", async function () {
        await setters.incrementBalanceOfE(user.address, 100);
        await setters.incrementTotalBondedE(100);
        await setters.incrementBalanceOfE(owner.address, 200);
        await setters.incrementTotalBondedE(200);
      });

      it("returns balance of bonded", async function () {
        expectBNEq(await setters.balanceOfBonded(user.address), BN(100));
      });
    });

    describe("pool reward", function () {
      beforeEach("call", async function () {
        await setters.incrementBalanceOfE(user.address, 100);
        await setters.incrementTotalBondedE(100);

        await setters.incrementBalanceOfE(owner.address, 200);
        await setters.incrementTotalBondedE(200);

        await setters.incrementTotalBondedE(150);
      });

      it("increments balance of bonded", async function () {
        expectBNEq(await setters.balanceOfBonded(user.address), BN(150));
      });
    });

    describe("pool reward and withdrawal", function () {
      beforeEach("call", async function () {
        await setters.incrementBalanceOfE(user.address, 100);
        await setters.incrementTotalBondedE(100);

        await setters.incrementBalanceOfE(owner.address, 200);
        await setters.incrementTotalBondedE(200);

        await setters.incrementTotalBondedE(150);

        await setters.decrementBalanceOfE(owner.address, 200, "decrementBalanceOfE");
        await setters.decrementTotalBondedE(300, "decrementTotalBondedE");
      });

      it("increments balance of bonded", async function () {
        expectBNEq(await setters.balanceOfBonded(user.address), BN(150));
      });
    });
  });

  describe("frozen and fluid states", function () {
    it("respects order", async function () {
      expectBNEq(await setters.statusOf(user.address), BN(0));
      expectBNEq(await setters.fluidUntil(user.address), BN(0));

      await setters.unfreezeE(user.address);

      expectBNEq(await setters.statusOf(user.address), BN(1));
      expectBNEq(await setters.fluidUntil(user.address), BN(1));

      await setters.incrementEpochE();

      expectBNEq(await setters.statusOf(user.address), BN(0));
      expectBNEq(await setters.fluidUntil(user.address), BN(1));
    });
  });

  describe("unfreeze", function () {
    describe("before called", function () {
      it("is frozen", async function () {
        expectBNEq(await setters.statusOf(user.address), BN(0));
        expectBNEq(await setters.fluidUntil(user.address), BN(0));
      });
    });

    describe("when called", function () {
      beforeEach("call", async function () {
        await setters.unfreezeE(user.address);
      });

      it("is fluid", async function () {
        expectBNEq(await setters.statusOf(user.address), BN(1));
        expectBNEq(await setters.fluidUntil(user.address), BN(1));
      });
    });

    describe("when called then advanced within lockup", function () {
      beforeEach("call", async function () {
        await setters.unfreezeE(user.address);
        await setters.incrementEpochE();
      });

      it("is fluid", async function () {
        expectBNEq(await setters.statusOf(user.address), BN(0));
        expectBNEq(await setters.fluidUntil(user.address), BN(1));
      });
    });

    describe("when called then advanced after lockup", function () {
      beforeEach("call", async function () {
        await setters.unfreezeE(user.address);
        for (let i = 0; i < 15; i++) {
          await setters.incrementEpochE();
        }
      });

      it("is frozen", async function () {
        expectBNEq(await setters.statusOf(user.address), BN(0));
        expectBNEq(await setters.fluidUntil(user.address), BN(1));
      });
    });
  });

  /**
   * Epoch
   */

  describe("epochTime", function () {
    beforeEach("call", async function () {
      await setters.setBlockTimestamp(CURRENT_EPOCH_START);
    });

    describe("before start", function () {
      it(`is 0`, async function () {
        expectBNEq(await setters.epochTime(), BN(0));
      });
    });

    describe("after one period", function () {
      beforeEach("call", async function () {
        await setters.setBlockTimestamp(CURRENT_EPOCH_START + CURRENT_EPOCH_PERIOD);
      });

      it("has advanced", async function () {
        expectBNEq(await setters.epochTime(), BN(1));
      });
    });

    describe("after many periods", function () {
      beforeEach("call", async function () {
        await setters.setBlockTimestamp(CURRENT_EPOCH_START + 10 * CURRENT_EPOCH_PERIOD);
      });

      it("has advanced", async function () {
        expectBNEq(await setters.epochTime(), BN(10));
      });
    });

    describe("one before update advance", function () {
      beforeEach("call", async function () {
        await setters.setBlockTimestamp(CURRENT_EPOCH_START + 14 * CURRENT_EPOCH_PERIOD);
      });

      it("has advanced", async function () {
        expectBNEq(await setters.epochTime(), BN(14));
      });
    });

    describe("right before update advance", function () {
      beforeEach("call", async function () {
        await setters.setBlockTimestamp(CURRENT_EPOCH_START + 15 * CURRENT_EPOCH_PERIOD - 1);
      });

      it("has advanced", async function () {
        expectBNEq(await setters.epochTime(), BN(14));
      });
    });

    describe("at update advance", function () {
      beforeEach("call", async function () {
        await setters.setBlockTimestamp(CURRENT_EPOCH_START + 15 * CURRENT_EPOCH_PERIOD);
      });

      it("has advanced", async function () {
        expectBNEq(await setters.epochTime(), BN(15));
      });
    });

    describe("at first after update advance", function () {
      beforeEach("call", async function () {
        await setters.setBlockTimestamp(CURRENT_EPOCH_START + 15 * CURRENT_EPOCH_PERIOD + CURRENT_EPOCH_PERIOD / 3);
      });

      it("has advanced", async function () {
        expectBNEq(await setters.epochTime(), BN(15));
      });
    });

    describe("many after update advance", function () {
      beforeEach("call", async function () {
        await setters.setBlockTimestamp(
          CURRENT_EPOCH_START + 15 * CURRENT_EPOCH_PERIOD + (10 * CURRENT_EPOCH_PERIOD) / 3,
        );
      });

      it("has advanced", async function () {
        expectBNEq(await setters.epochTime(), BN(18));
      });
    });
  });

  describe("incrementEpoch", function () {
    describe("before called", function () {
      it("is 0", async function () {
        expectBNEq(await setters.epoch(), BN(0));
      });
    });

    describe("when called", function () {
      beforeEach("call", async function () {
        await setters.incrementEpochE();
      });

      it("is unbonding", async function () {
        expectBNEq(await setters.epoch(), BN(1));
      });
    });

    describe("when called multiple times", function () {
      beforeEach("call", async function () {
        await setters.incrementEpochE();
        await setters.incrementEpochE();
      });

      it("is bonded", async function () {
        expectBNEq(await setters.epoch(), BN(2));
      });
    });
  });

  describe("snapshotTotalBonded", function () {
    beforeEach("call", async function () {
      await setters.incrementEpochE();
    });

    describe("before called", function () {
      it("is 0", async function () {
        expectBNEq(await setters.totalBondedAt(1), BN(0));
      });
    });

    describe("when called", function () {
      beforeEach("call", async function () {
        await poolGov.incrementTotalBondedE(100);
        await setters.incrementBalanceOfE(user.address, 100);
        await setters.snapshotTotalBondedE();
      });

      it("is snapshotted", async function () {
        expectBNEq(await setters.totalBondedAt(1), BN(100));
      });
    });

    describe("when called multiple times", function () {
      beforeEach("call", async function () {
        await poolGov.incrementTotalBondedE(100);
        await setters.incrementBalanceOfE(user.address, 100);
        await setters.snapshotTotalBondedE();
        await setters.incrementEpochE();

        await poolGov.incrementTotalBondedE(100);
        await setters.incrementBalanceOfE(user.address, 100);
        await setters.snapshotTotalBondedE();
      });

      it("is snapshotted for both epochs", async function () {
        expectBNEq(await setters.totalBondedAt(1), BN(100));
        expectBNEq(await setters.totalBondedAt(2), BN(200));
      });
    });
  });

  describe("incrementEpoch", function () {
    describe("before called", function () {
      it("is 0", async function () {
        expectBNEq(await setters.epoch(), BN(0));
      });
    });

    describe("when called", function () {
      beforeEach("call", async function () {
        await setters.incrementEpochE();
      });

      it("is unbonding", async function () {
        expectBNEq(await setters.epoch(), BN(1));
      });
    });

    describe("when called multiple times", function () {
      beforeEach("call", async function () {
        await setters.incrementEpochE();
        await setters.incrementEpochE();
      });

      it("is bonded", async function () {
        expectBNEq(await setters.epoch(), BN(2));
      });
    });
  });

  describe("bootstrappingAt", function () {
    describe("while bootstrapping", function () {
      it("is bootstrapping", async function () {
        expect(await setters.bootstrappingAt(0)).to.be.equal(true);
      });

      it("is bootstrapping", async function () {
        expect(await setters.bootstrappingAt(1)).to.be.equal(true);
      });

      it("is bootstrapping", async function () {
        expect(await setters.bootstrappingAt(BOOTSTRAPPING_PERIOD)).to.be.equal(true);
      });
    });

    describe("bootstrapped", function () {
      it("isnt bootstrapping", async function () {
        expect(await setters.bootstrappingAt(BOOTSTRAPPING_PERIOD + 1)).to.be.equal(false);
      });
    });
  });

  /**
   * Governance
   */

  describe("createcandidate.address", function () {
    beforeEach("call", async function () {
      await setters.incrementEpochE();
    });

    describe("when called", function () {
      beforeEach("call", async function () {
        await setters.createCandidateE(candidate.address, 7);
      });

      it("has start and period set", async function () {
        expectBNEq(await setters.startFor(candidate.address), BN(1));
        expectBNEq(await setters.periodFor(candidate.address), BN(7));
        expect(await setters.isNominated(candidate.address)).to.be.equal(true);
      });
    });
  });

  describe("recordVote", function () {
    beforeEach("call", async function () {
      await setters.incrementEpochE();
    });

    describe("when called", function () {
      beforeEach("call", async function () {
        await setters.recordVoteE(user.address, candidate.address, 1);
      });

      it("has recorded vote set", async function () {
        expectBNEq(await setters.recordedVote(user.address, candidate.address), BN(1));
      });
    });

    describe("when unvoting", function () {
      beforeEach("call", async function () {
        await setters.recordVoteE(user.address, candidate.address, 1);
        await setters.recordVoteE(user.address, candidate.address, 0);
      });

      it("has recorded vote set", async function () {
        expectBNEq(await setters.recordedVote(user.address, candidate.address), BN(0));
      });
    });

    describe("when revoting", function () {
      beforeEach("call", async function () {
        await setters.recordVoteE(user.address, candidate.address, 1);
        await setters.recordVoteE(user.address, candidate.address, 2);
      });

      it("has recorded vote set", async function () {
        expectBNEq(await setters.recordedVote(user.address, candidate.address), BN(2));
      });
    });
  });

  describe("incrementApproveFor", function () {
    describe("when called", function () {
      beforeEach("call", async function () {
        await setters.incrementApproveForE(candidate.address, 100);
      });

      it("has approve for set", async function () {
        expectBNEq(await setters.approveFor(candidate.address), BN(100));
        expectBNEq(await setters.votesFor(candidate.address), BN(100));
      });
    });

    describe("when called multiple", function () {
      beforeEach("call", async function () {
        await setters.incrementApproveForE(candidate.address, 100);
        await setters.incrementApproveForE(candidate.address, 200);
      });

      it("has approve for set", async function () {
        expectBNEq(await setters.approveFor(candidate.address), BN(300));
        expectBNEq(await setters.votesFor(candidate.address), BN(300));
      });
    });
  });

  describe("decrementApproveFor", function () {
    describe("when called", function () {
      beforeEach("call", async function () {
        await setters.incrementApproveForE(candidate.address, 1000);
        await setters.decrementApproveForE(candidate.address, 100, "decrementApproveForE");
      });

      it("has approve for set", async function () {
        expectBNEq(await setters.approveFor(candidate.address), BN(900));
        expectBNEq(await setters.votesFor(candidate.address), BN(900));
      });
    });

    describe("when called multiple", function () {
      beforeEach("call", async function () {
        await setters.incrementApproveForE(candidate.address, 1000);
        await setters.decrementApproveForE(candidate.address, 100, "decrementApproveForE");
        await setters.decrementApproveForE(candidate.address, 200, "decrementApproveForE");
      });

      it("has approve for set", async function () {
        expectBNEq(await setters.approveFor(candidate.address), BN(700));
        expectBNEq(await setters.votesFor(candidate.address), BN(700));
      });
    });

    describe("when called erroneously", function () {
      beforeEach("call", async function () {
        await setters.incrementApproveForE(candidate.address, 1000);
      });

      it("reverts", async function () {
        await expectRevert(setters.decrementApproveForE(candidate.address, 1100, "decrementApproveForE"), "revert");
      });
    });
  });

  describe("incrementRejectFor", function () {
    describe("when called", function () {
      beforeEach("call", async function () {
        await setters.incrementRejectForE(candidate.address, 100);
      });

      it("has reject for set", async function () {
        expectBNEq(await setters.rejectFor(candidate.address), BN(100));
        expectBNEq(await setters.votesFor(candidate.address), BN(100));
      });
    });

    describe("when called multiple", function () {
      beforeEach("call", async function () {
        await setters.incrementRejectForE(candidate.address, 100);
        await setters.incrementRejectForE(candidate.address, 200);
      });

      it("has reject for set", async function () {
        expectBNEq(await setters.rejectFor(candidate.address), BN(300));
        expectBNEq(await setters.votesFor(candidate.address), BN(300));
      });
    });
  });

  describe("decrementRejectFor", function () {
    describe("when called", function () {
      beforeEach("call", async function () {
        await setters.incrementRejectForE(candidate.address, 1000);
        await setters.decrementRejectForE(candidate.address, 100, "decrementRejectForE");
      });

      it("has reject for set", async function () {
        expectBNEq(await setters.rejectFor(candidate.address), BN(900));
        expectBNEq(await setters.votesFor(candidate.address), BN(900));
      });
    });

    describe("when called multiple", function () {
      beforeEach("call", async function () {
        await setters.incrementRejectForE(candidate.address, 1000);
        await setters.decrementRejectForE(candidate.address, 100, "decrementRejectForE");
        await setters.decrementRejectForE(candidate.address, 200, "decrementRejectForE");
      });

      it("has reject for set", async function () {
        expectBNEq(await setters.rejectFor(candidate.address), BN(700));
        expectBNEq(await setters.votesFor(candidate.address), BN(700));
      });
    });

    describe("when called erroneously", function () {
      beforeEach("call", async function () {
        await setters.incrementRejectForE(candidate.address, 1000);
      });

      it("reverts", async function () {
        await expectRevert(setters.decrementRejectForE(candidate.address, 1100, "decrementRejectForE"), "revert");
      });
    });
  });

  describe("placeLock", function () {
    beforeEach("call", async function () {
      await setters.incrementEpochE();
      await setters.createCandidateE(candidate.address, 7);
    });

    describe("when voting", function () {
      beforeEach("call", async function () {
        await setters.placeLockE(user.address, candidate.address);
      });

      it("should have locked user", async function () {
        expect(await setters.isNominated(candidate.address)).to.be.equal(true);
        expectBNEq(await setters.statusOf(user.address), BN(2));
        expectBNEq(await setters.lockedUntil(user.address), BN(8));
      });
    });

    describe("when voting then wait", function () {
      beforeEach("call", async function () {
        await setters.placeLockE(user.address, candidate.address);

        await setters.incrementEpochE(); // 2
        await setters.incrementEpochE(); // 3
        await setters.incrementEpochE(); // 4
        await setters.incrementEpochE(); // 5
        await setters.incrementEpochE(); // 6
        await setters.incrementEpochE(); // 7
        await setters.incrementEpochE(); // 8
      });

      it("should have unlocked user", async function () {
        expect(await setters.isNominated(candidate.address)).to.be.equal(true);
        expectBNEq(await setters.statusOf(user.address), BN(0));
        expectBNEq(await setters.lockedUntil(user.address), BN(8));
      });
    });

    describe("when voting multiple", function () {
      beforeEach("call", async function () {
        await setters.placeLockE(user.address, candidate.address);

        await setters.incrementEpochE(); // 2
        await setters.incrementEpochE(); // 3
        await setters.createCandidateE(owner.address, 7);
        await setters.placeLockE(user.address, owner.address);
      });

      describe("and not waiting", function () {
        beforeEach("call", async function () {
          await setters.incrementEpochE(); // 4
          await setters.incrementEpochE(); // 5
          await setters.incrementEpochE(); // 6
          await setters.incrementEpochE(); // 7
          await setters.incrementEpochE(); // 8
        });

        it("should still lock user", async function () {
          expect(await setters.isNominated(candidate.address)).to.be.equal(true);
          expect(await setters.isNominated(owner.address)).to.be.equal(true);
          expectBNEq(await setters.statusOf(user.address), BN(2));
          expectBNEq(await setters.lockedUntil(user.address), BN(10));
        });
      });

      describe("and waiting", function () {
        beforeEach("call", async function () {
          await setters.incrementEpochE(); // 4
          await setters.incrementEpochE(); // 5
          await setters.incrementEpochE(); // 6
          await setters.incrementEpochE(); // 7
          await setters.incrementEpochE(); // 8
          await setters.incrementEpochE(); // 9
          await setters.incrementEpochE(); // 10
        });

        it("should have unlocked user", async function () {
          expect(await setters.isNominated(candidate.address)).to.be.equal(true);
          expectBNEq(await setters.statusOf(user.address), BN(0));
          expectBNEq(await setters.lockedUntil(user.address), BN(10));
        });
      });
    });

    describe("when voting multiple reverse", function () {
      beforeEach("call", async function () {
        await setters.incrementEpochE(); // 2
        await setters.incrementEpochE(); // 3
        await setters.createCandidateE(owner.address, 7);
        await setters.placeLockE(user.address, owner.address);
        await setters.placeLockE(user.address, candidate.address);
      });

      describe("and not waiting", function () {
        beforeEach("call", async function () {
          await setters.incrementEpochE(); // 4
          await setters.incrementEpochE(); // 5
          await setters.incrementEpochE(); // 6
          await setters.incrementEpochE(); // 7
          await setters.incrementEpochE(); // 8
        });

        it("should still lock user", async function () {
          expect(await setters.isNominated(candidate.address)).to.be.equal(true);
          expect(await setters.isNominated(owner.address)).to.be.equal(true);
          expectBNEq(await setters.statusOf(user.address), BN(2));
          expectBNEq(await setters.lockedUntil(user.address), BN(10));
        });
      });

      describe("and waiting", function () {
        beforeEach("call", async function () {
          await setters.incrementEpochE(); // 4
          await setters.incrementEpochE(); // 5
          await setters.incrementEpochE(); // 6
          await setters.incrementEpochE(); // 7
          await setters.incrementEpochE(); // 8
          await setters.incrementEpochE(); // 9
          await setters.incrementEpochE(); // 10
        });

        it("should have unlocked user", async function () {
          expect(await setters.isNominated(candidate.address)).to.be.equal(true);
          expectBNEq(await setters.statusOf(user.address), BN(0));
          expectBNEq(await setters.lockedUntil(user.address), BN(10));
        });
      });
    });
  });

  describe("initialized", function () {
    describe("before called", function () {
      it("is not initialized", async function () {
        expect(await setters.isInitialized(candidate.address)).to.be.equal(false);
      });
    });

    describe("when called", function () {
      beforeEach("call", async function () {
        await setters.initializedE(candidate.address);
      });

      it("is initialized", async function () {
        expect(await setters.isInitialized(candidate.address)).to.be.equal(true);
      });
    });
  });
});
