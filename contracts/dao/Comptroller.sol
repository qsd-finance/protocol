/*
    Copyright 2020 Empty Set Squad <emptysetsquad@protonmail.com>

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./Setters.sol";
import "./IERC20Mintable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../external/Require.sol";
import "../external/UniswapV2Library.sol";
import "../external/UniswapV2Router.sol";
import "../oracle/Oracle.sol";

contract Comptroller is Setters {
    using SafeMath for uint256;

    bytes32 private constant FILE = "Comptroller";

    using SafeERC20 for IERC20;

    IUniswapV2Router02 private constant router = IUniswapV2Router02(0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F); //## pcs router

    event busdDistributed(uint256 sentToPoolBonding, uint256 sentToPoolLP);

    function mintToAccount(address account, uint256 amount) internal {
        dollar().mint(account, amount);
        balanceCheck();
    }

    function increaseSupply(uint256 newSupply)
        internal
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        // QSD #B

        // Take 25% and sell it for BUSD //##J
        // The rest go off the remaining supply //##J
        uint256 bankSupply = newSupply.div(4);
        uint256 remainingSupply = newSupply.sub(bankSupply);

        uint256 qsdMinted = mintToDAOBank(bankSupply);
        uint256 boughtAmount = buyBusd(qsdMinted);

        // 0-a. Pay out to Pool (LP)
        uint256 poolLPReward = remainingSupply.mul(Constants.getPoolLPRatio()).div(100);
        mintToPoolLP(poolLPReward);

        // 0-b. Pay out to Pool (Bonding)
        uint256 poolBondingReward = remainingSupply.mul(Constants.getPoolBondingRatio()).div(100);
        mintToPoolBonding(poolBondingReward);

        // 0-c. Pay out to Treasury
        uint256 treasuryReward = remainingSupply.mul(Constants.getTreasuryRatio()).div(100);
        mintToTreasury(treasuryReward);

        // 0-d. Pay out to Gov Stakers
        uint256 govStakerReward = remainingSupply.mul(Constants.getGovStakingRatio()).div(100);
        mintToPoolGov(govStakerReward);

        balanceCheck();
        return (0, remainingSupply, boughtAmount);
    }

    function distributeBusdRewards() internal {
        // Get BUSD address
        address busdAddress = Constants.getDaiAddress();

        IERC20 BUSD = IERC20(busdAddress);

        uint256 balance = BUSD.balanceOf(address(this));

        uint256 epochsAtPeg = Getters.epochsAtPeg();

        // balance * [((epochsatpeg - 1) ** 1.25) * (0.75.div(100)) + (4.div(100))]
        uint256 distributionRate =
            ((epochsAtPeg.sub(1))**(uint256(1).add((uint256(1).div(4))))).mul((uint256(75).div(1))).add((uint256(400)));

        uint256 busdToDistribute = balance.mul(distributionRate).div(10000);

        if (busdToDistribute > 0) {
            uint256 transferToPoolBonding = busdToDistribute.mul(Constants.getBusdPoolBondingRatio()).div(100);
            uint256 transferToPoolLP = busdToDistribute.mul(Constants.getBusdPoolLpRatio()).div(100);

            bool poolBondingOutcome = BUSD.transfer(poolBonding(), transferToPoolBonding);
            bool lpOutcome = BUSD.transfer(poolLP(), transferToPoolLP);

            if (poolBondingOutcome && lpOutcome) {
                emit busdDistributed(transferToPoolBonding, transferToPoolLP);
            }
        }
    }

    function distributeGovernanceTokens() internal {
        // Assume blocktime is 15 seconds
        uint256 blocksPerEpoch = Constants.getCurrentEpochStrategy().period.div(15);
        uint256 govTokenToMint = blocksPerEpoch.mul(Constants.getGovernanceTokenPerBlock());

        uint256 maxSupply = Constants.getGovernanceTokenMaxSupply();
        uint256 totalSupply = governance().totalSupply();

        // Maximum of 999,999,999 tokens
        if (totalSupply.add(govTokenToMint) >= maxSupply) {
            govTokenToMint = maxSupply.sub(totalSupply);
        }

        // Mint Governance token to pool bonding
        mintGovTokensToPoolBonding(govTokenToMint);
    }

    function balanceCheck() private {
        Require.that(
            dollar().balanceOf(address(this)) >= totalBonded().add(totalStaged()),
            FILE,
            "Inconsistent balances"
        );
    }

    /**
     * Dollar functions
     */

    function mintToDAO(uint256 amount) private {
        if (amount > 0) {
            dollar().mint(address(this), amount);
            incrementTotalBonded(amount);
        }
    }

    function mintToDAOBank(uint256 amount) private returns (uint256) {
        if (amount > 0) {
            dollar().mint(address(this), amount);
            return amount;
        }
    }

    function mintToPoolLP(uint256 amount) private {
        if (amount > 0) {
            dollar().mint(poolLP(), amount);
        }
    }

    function mintToPoolBonding(uint256 amount) private {
        if (amount > 0) {
            dollar().mint(poolBonding(), amount);
        }
    }

    function mintToPoolGov(uint256 amount) private {
        if (amount > 0) {
            dollar().mint(poolGov(), amount);
        }
    }

    function mintToTreasury(uint256 amount) private {
        if (amount > 0) {
            dollar().mint(Constants.getTreasuryAddress(), amount);
        }
    }

    /**
     * Governance token functions
     */

    function mintGovTokensToPoolBonding(uint256 amount) private {
        if (amount > 0) {
            IERC20Mintable(address(governance())).mint(poolBonding(), amount);
        }
    }

    /**
     * BUSD functions
     */

    function buyBusd(uint256 dollarAmount) internal returns (uint256) {
        // Buy busd for bank reserves
        IUniswapV2Pair pair = IUniswapV2Pair(_state.provider.uniPairAddress);

        address dai = Setters.dai();
        address dollar = pair.token0() == dai ? pair.token1() : pair.token0();

        address[] memory path = new address[](2);
        path[0] = dollar;
        path[1] = dai;

        IERC20(dollar).safeApprove(address(router), 0);
        IERC20(dollar).safeApprove(address(router), uint256(-1));
        uint256[] memory outputs = router.swapExactTokensForTokens(dollarAmount, 0, path, address(this), now + 60);

        uint256 boughtAmount = outputs[1];

        return boughtAmount;
    }
}
