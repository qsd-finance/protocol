import { ethers } from "hardhat";
import { expectBNEq, expectRevert, BN } from "../Utils";

import { BOOTSTRAPPING_PERIOD } from "../Constants";
import { Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

describe("Comptroller", function () {
  let [owner, user, poolLP, poolBonding, circulator]: SignerWithAddress[] = [];
  let MockComptroller: ContractFactory;

  let dollar: Contract;
  let comptroller: Contract;

  before(async function () {
    [owner, user, poolLP, poolBonding, circulator] = await ethers.getSigners();
    MockComptroller = await ethers.getContractFactory("MockComptroller");
  });

  beforeEach(async function () {
    comptroller = await MockComptroller.connect(owner).deploy(poolLP.address, poolBonding.address, {
      gasLimit: 8000000,
    });
    dollar = await ethers.getContractAt("Dollar", await comptroller.dollar());
  });

  describe("mintToAccount", function () {
    beforeEach(async function () {
      await comptroller.mintToAccountE(circulator.address, BN(10000));
    });

    describe("bootstrapping", function () {
      describe("on single call", function () {
        beforeEach(async function () {
          await comptroller.mintToAccountE(user.address, BN(100));
        });

        it("mints new Dollar tokens", async function () {
          expectBNEq(await dollar.totalSupply(), BN(10100));
          expectBNEq(await dollar.balanceOf(comptroller.address), BN(0));
          expectBNEq(await dollar.balanceOf(user.address), BN(100));
        });
      });

      describe("multiple calls", function () {
        beforeEach(async function () {
          await comptroller.mintToAccountE(user.address, BN(100));
          await comptroller.mintToAccountE(user.address, BN(200));
        });

        it("mints new Dollar tokens", async function () {
          expectBNEq(await dollar.totalSupply(), BN(10300));
          expectBNEq(await dollar.balanceOf(comptroller.address), BN(0));
          expectBNEq(await dollar.balanceOf(user.address), BN(300));
        });
      });
    });

    describe("bootstrapped", function () {
      this.timeout(30000);

      beforeEach(async function () {
        for (let i = 0; i < BOOTSTRAPPING_PERIOD + 1; i++) {
          await comptroller.incrementEpochE();
        }
      });

      describe("on single call", function () {
        beforeEach(async function () {
          await comptroller.mintToAccountE(user.address, BN(100));
        });

        it("mints new Dollar tokens", async function () {
          expectBNEq(await dollar.totalSupply(), BN(10100));
          expectBNEq(await dollar.balanceOf(comptroller.address), BN(0));
          expectBNEq(await dollar.balanceOf(user.address), BN(100));
        });
      });

      describe("multiple calls", function () {
        beforeEach(async function () {
          await comptroller.mintToAccountE(user.address, BN(100));
          await comptroller.mintToAccountE(user.address, BN(200));
        });

        it("mints new Dollar tokens", async function () {
          expectBNEq(await dollar.totalSupply(), BN(10300));
          expectBNEq(await dollar.balanceOf(comptroller.address), BN(0));
          expectBNEq(await dollar.balanceOf(user.address), BN(300));
        });
      });
    });
  });

  describe("burnFromAccount", function () {
    beforeEach(async function () {
      await comptroller.mintToAccountE(circulator.address, BN(10000));

      await comptroller.mintToE(user.address, BN(1000));
      await dollar.connect(user).approve(comptroller.address, BN(1000));
    });
  });
});
