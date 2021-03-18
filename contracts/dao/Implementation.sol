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
        _state.epoch.current = 300;      //##
        _state.epoch.inExpansion = false;    //##
    }

    function initializeOracle() public {
        require(address(dollar()) != address(0), "dollar not initialized!");
        require(address(_state.provider.oracle) == address(0), "oracle initialized!");
        Oracle oracle = new Oracle(address(dollar()));
        oracle.setup();
        
        _state.provider.oracle = IOracle(address(oracle));
    }

    function initializeTokenAddresses(IDollar dollar, IERC20 gov) public {
        require(address(_state.provider.dollar) == address(0), "dollar initialized!");
        require(address(_state.provider.governance) == address(0), "governance initialized!");

        _state.provider.dollar = dollar;
        _state.provider.governance = gov;
    }

    function initializePoolAddresses(
        address poolBonding,
        address poolLP,
        address poolGov
    ) public {
        require(_state.provider.poolBonding == address(0), "pool bonding initialized!");
        require(_state.provider.poolLP == address(0), "pool LP initialized!");
        require(_state.provider.poolGov == address(0), "pool gov initialized!");

        _state.provider.poolBonding = poolBonding;
        _state.provider.poolLP = poolLP;
        _state.provider.poolGov = poolGov;
    }

    function epochInExpansion() public view returns (bool) {
        return _state.epoch.inExpansion;
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
