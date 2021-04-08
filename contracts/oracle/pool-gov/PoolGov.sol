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
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../external/Require.sol";
import "../../Constants.sol";
import "../IDAO.sol";
import "../Permission.sol";
import "./PoolSetters.sol";
import "../../dao/IPoolGov.sol";

contract PoolGov is IPoolGov, PoolSetters, Permission {
    using SafeMath for uint256;

    constructor(
        IDAO _dao,
        IERC20 _stakingToken,
        IERC20 _rewardsToken
    ) public {
        _state.dao = _dao;
        _state.stakingToken = _stakingToken;
        _state.rewardsToken = _rewardsToken;
    }

    bytes32 private constant FILE = "PoolGov";

    mapping(address => uint256) public lockedUntil;

    event Deposit(address indexed account, uint256 value);
    event Withdraw(address indexed account, uint256 value);
    event Claim(address indexed account, uint256 value);
    event Bond(address indexed account, uint256 start, uint256 value);
    event Unbond(address indexed account, uint256 start, uint256 value, uint256 newClaimable);

    function deposit(uint256 value) external onlyFrozen(msg.sender) notPaused {
        stakingToken().transferFrom(msg.sender, address(this), value);
        incrementBalanceOfStaged(msg.sender, value);

        emit Deposit(msg.sender, value);
    }

    function withdraw(uint256 value) public onlyFrozen(msg.sender) validBalance {
        // When voting, dao can place a lock on the contract
        Require.that(epoch() > lockedUntil[msg.sender], FILE, "Locked till gov passes");

        stakingToken().transfer(msg.sender, value);
        decrementBalanceOfStaged(msg.sender, value, "Pool: insufficient staged balance");

        emit Withdraw(msg.sender, value);
    }

    function claim(uint256 value) external onlyFrozen(msg.sender) validBalance {
        rewardsToken().transfer(msg.sender, value);
        decrementBalanceOfClaimable(msg.sender, value, "Pool: insufficient claimable balance");

        emit Claim(msg.sender, value);
    }

    function bond(uint256 value) public notPaused validBalance {
        unfreeze(msg.sender);

        uint256 totalRewardedWithPhantom = totalRewarded().add(totalPhantom());
        uint256 newPhantom =
            totalBonded() == 0
                ? totalRewarded() == 0 ? Constants.getInitialStakeMultiple().mul(value) : 0
                : totalRewardedWithPhantom.mul(value).div(totalBonded());

        incrementBalanceOfBonded(msg.sender, value);
        incrementBalanceOfPhantom(msg.sender, newPhantom);
        decrementBalanceOfStaged(msg.sender, value, "Pool: insufficient staged balance");

        emit Bond(msg.sender, epoch().add(1), value);
    }

    function unbond(uint256 value) public validBalance {
        unfreeze(msg.sender);

        uint256 balanceOfBonded = balanceOfBonded(msg.sender);
        Require.that(balanceOfBonded > 0, FILE, "insufficient bonded balance");

        uint256 newClaimable = balanceOfRewarded(msg.sender).mul(value).div(balanceOfBonded);
        uint256 lessPhantom = balanceOfPhantom(msg.sender).mul(value).div(balanceOfBonded);

        incrementBalanceOfStaged(msg.sender, value);
        incrementBalanceOfClaimable(msg.sender, newClaimable);
        decrementBalanceOfBonded(msg.sender, value, "Pool: insufficient bonded balance");
        decrementBalanceOfPhantom(msg.sender, lessPhantom, "Pool: insufficient phantom balance");

        emit Unbond(msg.sender, epoch().add(1), value, newClaimable);
    }

    function emergencyWithdraw(address token, uint256 value) external onlyDao {
        IERC20(token).transfer(address(dao()), value);
    }

    function emergencyPause() external onlyDao {
        pause();
    }

    function statusOf(address user) public view returns (PoolAccount.Status) {
        if (epoch() <= lockedUntil[user]) {
            return PoolAccount.Status.Locked;
        }

        return PoolGetters.statusOf(user);
    }

    // Locks token in place i.e. they can't unbond it
    function placeLock(address account, uint256 newLock) external onlyDao {
        if (newLock > lockedUntil[account]) {
            lockedUntil[account] = newLock;
        }
    }

    function pokeRewards() external {
        uint256 balanceOfBonded = balanceOfBonded(msg.sender);
        unbond(balanceOfBonded);
        bond(balanceOfBonded); //_bond(balanceOfBonded);
    }
}
