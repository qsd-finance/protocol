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

    // event StepOutcome(string message);

    bytes32 private constant FILE = "Permission";

    function step() internal {
        Decimal.D256 memory price = oracleCapture();
<<<<<<< HEAD
        Decimal.D256 memory expansionPrice = Constants.getExpansionPrice(); //##
        Decimal.D256 memory bottomPegPrice = Constants.getBottomPegPrice(); //##

        // Update epoch TWAP state variable
        Setters.setEpochTwap(price.value);

        if (price.greaterThan(expansionPrice)) {
            setExpansionState(true);
            // Reset epochsAtPeg to 0
            Setters.resetEpochsAtPeg();

            string memory message = "price greater than expansion";

=======
        Decimal.D256 memory expansionPrice = Constants.getExpansionPrice();   //##

        //if (price.greaterThan(Decimal.one())) {
        //if (price.greaterThan(Decimal.one().mul(100).div(98))) {   //##
        if (price.greaterThan(expansionPrice)) {   //##
>>>>>>> 7239dd778b860df4c8f986c46fc9eb0642883098
            // Expand supply
            growSupply(price);

<<<<<<< HEAD
            // emit StepOutcome(message);
        } else if (price.greaterThan(bottomPegPrice) && price.lessThan(expansionPrice)) {
            setExpansionState(false);
            // We're at peg, increase the counter
            Setters.incrementEpochsAtPeg();

            string memory message = "price greater than bottom and less than expansion";

            Comptroller.distributeBusdRewards();

            // emit StepOutcome(message);
        } else {
            setExpansionState(false);
            // Not a peg, reset counter
            Setters.resetEpochsAtPeg();

            string memory message = "price less than peg";

=======
        //if (price.lessThan(Decimal.one())) {
        //if (price.lessThan(Decimal.one().mul(100).div(98))) {    //##
        if (price.lessThan(expansionPrice)) {    //##
>>>>>>> 7239dd778b860df4c8f986c46fc9eb0642883098
            // Distribute governance tokens to stakers
            distributeGovernanceTokens();

            // emit StepOutcome(message);
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

        /*if (bootstrappingAt(epoch().sub(1))) {
            return Constants.getBootstrappingPrice();
        }*/
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
