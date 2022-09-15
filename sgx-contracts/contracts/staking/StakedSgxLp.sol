// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../libraries/math/SafeMath.sol";
import "../libraries/token/IERC20.sol";

import "../core/interfaces/ISgxLpManager.sol";

import "./interfaces/IRewardTracker.sol";
import "./interfaces/IRewardTracker.sol";

// provide a way to transfer staked SGXLP tokens by unstaking from the sender
// and staking for the receiver
// tests in RewardRouterV2.js
contract StakedSgxLp {
    using SafeMath for uint256;

    string public constant name = "StakedSgxLp";
    string public constant symbol = "sSGXLP";
    uint8 public constant decimals = 18;

    address public sgxlp;
    ISgxLpManager public sgxlpManager;
    address public stakedSgxLpTracker;
    address public feeSgxLpTracker;

    mapping (address => mapping (address => uint256)) public allowances;

    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(
        address _sgxlp,
        ISgxLpManager _sgxlpManager,
        address _stakedSgxLpTracker,
        address _feeSgxLpTracker
    ) public {
        sgxlp = _sgxlp;
        sgxlpManager = _sgxlpManager;
        stakedSgxLpTracker = _stakedSgxLpTracker;
        feeSgxLpTracker = _feeSgxLpTracker;
    }

    function allowance(address _owner, address _spender) external view returns (uint256) {
        return allowances[_owner][_spender];
    }

    function approve(address _spender, uint256 _amount) external returns (bool) {
        _approve(msg.sender, _spender, _amount);
        return true;
    }

    function transfer(address _recipient, uint256 _amount) external returns (bool) {
        _transfer(msg.sender, _recipient, _amount);
        return true;
    }

    function transferFrom(address _sender, address _recipient, uint256 _amount) external returns (bool) {
        uint256 nextAllowance = allowances[_sender][msg.sender].sub(_amount, "StakedSgxLp: transfer amount exceeds allowance");
        _approve(_sender, msg.sender, nextAllowance);
        _transfer(_sender, _recipient, _amount);
        return true;
    }

    function balanceOf(address _account) external view returns (uint256) {
        IRewardTracker(stakedSgxLpTracker).depositBalances(_account, sgxlp);
    }

    function totalSupply() external view returns (uint256) {
        IERC20(stakedSgxLpTracker).totalSupply();
    }

    function _approve(address _owner, address _spender, uint256 _amount) private {
        require(_owner != address(0), "StakedSgxLp: approve from the zero address");
        require(_spender != address(0), "StakedSgxLp: approve to the zero address");

        allowances[_owner][_spender] = _amount;

        emit Approval(_owner, _spender, _amount);
    }

    function _transfer(address _sender, address _recipient, uint256 _amount) private {
        require(_sender != address(0), "StakedSgxLp: transfer from the zero address");
        require(_recipient != address(0), "StakedSgxLp: transfer to the zero address");

        require(
            sgxlpManager.lastAddedAt(_sender).add(sgxlpManager.cooldownDuration()) <= block.timestamp,
            "StakedSgxLp: cooldown duration not yet passed"
        );

        IRewardTracker(stakedSgxLpTracker).unstakeForAccount(_sender, feeSgxLpTracker, _amount, _sender);
        IRewardTracker(feeSgxLpTracker).unstakeForAccount(_sender, sgxlp, _amount, _sender);

        IRewardTracker(feeSgxLpTracker).stakeForAccount(_sender, _recipient, sgxlp, _amount);
        IRewardTracker(stakedSgxLpTracker).stakeForAccount(_recipient, _recipient, feeSgxLpTracker, _amount);
    }
}
