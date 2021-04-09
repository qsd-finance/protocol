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
import "./Comptroller.sol";
import "../external/Require.sol";
import "../external/Decimal.sol";
import "../Constants.sol";

contract Regulator is Comptroller {
    using SafeMath for uint256;
    using Decimal for Decimal.D256;

    event SupplyIncrease(
        uint256 indexed epoch,
        uint256 price,
        uint256 newRedeemable,
        uint256 lessDebt,
        uint256 newBonded,
        uint256 newBusd //##J
    );
    event SupplyDecrease(uint256 indexed epoch, uint256 price, uint256 newDebt);
    event SupplyNeutral(uint256 indexed epoch);

    bytes32 private constant FILE = "Permission";

    function step() internal {
        Decimal.D256 memory price = oracleCapture();
        Decimal.D256 memory expansionPrice = Constants.getExpansionPrice(); //##
        Decimal.D256 memory bottomPegPrice = Constants.getBottomPegPrice(); //##

        // Update epoch TWAP state variable
        Setters.setEpochTwap(price.value);

        if (price.greaterThan(expansionPrice)) {
            setExpansionState(true);

            Setters.resetEpochsAtPeg();

            // Expand supply
            growSupply(price);
        } else if (price.greaterThan(bottomPegPrice) && price.lessThan(expansionPrice)) {
            setExpansionState(false);

            // We're at peg, increase the counter
            Setters.incrementEpochsAtPeg();

            Comptroller.distributeBusdRewards();
        } else {
            setExpansionState(false);

            // Not a peg, reset counter
            Setters.resetEpochsAtPeg();

            // Distribute governance tokens to stakers
            distributeGovernanceTokens();
        }

        return;
    }

    function growSupply(Decimal.D256 memory price) private {
        Decimal.D256 memory expansionPrice = Constants.getExpansionPrice(); //##
        uint256 expansionRate = Constants.getExpansionRate(); //##J
        Decimal.D256 memory priceMinusExpansion = price.sub(expansionPrice); //##J
        Decimal.D256 memory delta = limit(priceMinusExpansion.div(expansionRate)); //##J //## limit(price.sub(Decimal.one()), price);
        uint256 newSupply = delta.mul(totalNet()).asUint256();
        (uint256 newRedeemable, uint256 newBonded, uint256 newBusd) = increaseSupply(newSupply);
        emit SupplyIncrease(epoch(), price.value, newRedeemable, 0, newBonded, newBusd);
    }

    function limit(Decimal.D256 memory delta) private view returns (Decimal.D256 memory) {
        Decimal.D256 memory supplyChangeLimit = Constants.getSupplyChangeLimit();
        return delta.greaterThan(supplyChangeLimit) ? supplyChangeLimit : delta;
    }

    function oracleCapture() public returns (Decimal.D256 memory) {
        //#J changed to internal function to match inherited
        (Decimal.D256 memory price, bool valid) = oracle().capture();

        if (!valid) {
            return Decimal.one();
        }

        return price;
    }

    function oracleCaptureP() public returns (Decimal.D256 memory) {
        Require.that(msg.sender == poolBonding(), FILE, "Not pool bonding");

        return oracleCapture();
    }
}
