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
import "../oracle/Oracle.sol";
import "./Regulator.sol";
import "./Bonding.sol";
import "./Govern.sol";
import "../Constants.sol";

contract Implementation is State, Bonding, Regulator, Govern {
    using SafeMath for uint256;

    event Advance(uint256 indexed epoch, uint256 block, uint256 timestamp);
    event Incentivization(address indexed account, uint256 amount);

    function initialize() public initializer {
        _state.provider.poolBonding = address(0xfE043D4D1cDee351A62dDF3794f4266ee7E191e0);
        _state.provider.poolLP = address(0x542Ef49fbC1e22eE5348e646115745748A07b8b5);
        _state2.uniPairAddress = address(0x83ABc20d35Fc4C0ACF5d61f026107c94788373fA);

        // One-time treasury QSG mint
        uint256 govToMint = 3e21;

        IERC20Mintable(address(governance())).mint(Constants.getTreasuryAddress(), govToMint);
    }

    function epochInExpansion() public view returns (bool) {
        return _state.epoch.inExpansion;
    }

    function epochsAtPeg() public view returns (uint256) {
        return _state2.epochsAtPeg;
    }

    function getEpochTwap() public view returns (uint256) {
        return _state2.epochTwap;
    }

    function advance() external {
        // No -1 here as epoch only gets incremented on Bonding.step
        incentivize(msg.sender, Constants.getAdvanceIncentive());
        Bonding.step();
        Regulator.step();

        emit Advance(epoch(), block.number, block.timestamp);
    }

    function incentivize(address account, uint256 amount) private {
        mintToAccount(account, amount);
        emit Incentivization(account, amount);
    }
}
