// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../libraries/math/SafeMath.sol";
import "../libraries/token/IERC20.sol";
import "../libraries/token/SafeERC20.sol";
import "../libraries/utils/ReentrancyGuard.sol";
import "../libraries/utils/Address.sol";

import "./interfaces/IRewardTracker.sol";
import "../tokens/interfaces/IMintable.sol";
import "../tokens/interfaces/IWETH.sol";
import "../core/interfaces/ISgxLpManager.sol";
import "../access/Governable.sol";

contract RewardRouter is ReentrancyGuard, Governable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Address for address payable;

    bool public isInitialized;

    address public weth;

    address public sgx;
    address public esSgx;
    address public bnSgx;

    address public sgxlp; // SGX Liquidity Provider token

    address public stakedSgxTracker;
    address public bonusSgxTracker;
    address public feeSgxTracker;

    address public stakedSgxLpTracker;
    address public feeSgxLpTracker;

    address public sgxlpManager;

    event StakeSgx(address account, uint256 amount);
    event UnstakeSgx(address account, uint256 amount);

    event StakeSgxLp(address account, uint256 amount);
    event UnstakeSgxLp(address account, uint256 amount);

    receive() external payable {
        require(msg.sender == weth, "Router: invalid sender");
    }

    function initialize(
        address _weth,
        address _sgx,
        address _esSgx,
        address _bnSgx,
        address _sgxlp,
        address _stakedSgxTracker,
        address _bonusSgxTracker,
        address _feeSgxTracker,
        address _feeSgxLpTracker,
        address _stakedSgxLpTracker,
        address _sgxlpManager
    ) external onlyGov {
        require(!isInitialized, "RewardRouter: already initialized");
        isInitialized = true;

        weth = _weth;

        sgx = _sgx;
        esSgx = _esSgx;
        bnSgx = _bnSgx;

        sgxlp = _sgxlp;

        stakedSgxTracker = _stakedSgxTracker;
        bonusSgxTracker = _bonusSgxTracker;
        feeSgxTracker = _feeSgxTracker;

        feeSgxLpTracker = _feeSgxLpTracker;
        stakedSgxLpTracker = _stakedSgxLpTracker;

        sgxlpManager = _sgxlpManager;
    }

    // to help users who accidentally send their tokens to this contract
    function withdrawToken(
        address _token,
        address _account,
        uint256 _amount
    ) external onlyGov {
        IERC20(_token).safeTransfer(_account, _amount);
    }

    function batchStakeSgxForAccount(
        address[] memory _accounts,
        uint256[] memory _amounts
    ) external nonReentrant onlyGov {
        address _sgx = sgx;
        for (uint256 i = 0; i < _accounts.length; i++) {
            _stakeSgx(msg.sender, _accounts[i], _sgx, _amounts[i]);
        }
    }

    function stakeSgxForAccount(address _account, uint256 _amount)
        external
        nonReentrant
        onlyGov
    {
        _stakeSgx(msg.sender, _account, sgx, _amount);
    }

    function stakeSgx(uint256 _amount) external nonReentrant {
        _stakeSgx(msg.sender, msg.sender, sgx, _amount);
    }

    function stakeEsSgx(uint256 _amount) external nonReentrant {
        _stakeSgx(msg.sender, msg.sender, esSgx, _amount);
    }

    function unstakeSgx(uint256 _amount) external nonReentrant {
        _unstakeSgx(msg.sender, sgx, _amount);
    }

    function unstakeEsSgx(uint256 _amount) external nonReentrant {
        _unstakeSgx(msg.sender, esSgx, _amount);
    }

    function mintAndStakeSgxLp(
        address _token,
        uint256 _amount,
        uint256 _minSgusd,
        uint256 _minSgxLp
    ) external nonReentrant returns (uint256) {
        require(_amount > 0, "RewardRouter: invalid _amount");

        address account = msg.sender;
        uint256 sgxlpAmount = ISgxLpManager(sgxlpManager).addLiquidityForAccount(
            account,
            account,
            _token,
            _amount,
            _minSgusd,
            _minSgxLp
        );
        IRewardTracker(feeSgxLpTracker).stakeForAccount(
            account,
            account,
            sgxlp,
            sgxlpAmount
        );
        IRewardTracker(stakedSgxLpTracker).stakeForAccount(
            account,
            account,
            feeSgxLpTracker,
            sgxlpAmount
        );

        emit StakeSgxLp(account, sgxlpAmount);

        return sgxlpAmount;
    }

    function mintAndStakeSgxLpETH(uint256 _minSgusd, uint256 _minSgxLp)
        external
        payable
        nonReentrant
        returns (uint256)
    {
        require(msg.value > 0, "RewardRouter: invalid msg.value");

        IWETH(weth).deposit{value: msg.value}();
        IERC20(weth).approve(sgxlpManager, msg.value);

        address account = msg.sender;
        uint256 sgxlpAmount = ISgxLpManager(sgxlpManager).addLiquidityForAccount(
            address(this),
            account,
            weth,
            msg.value,
            _minSgusd,
            _minSgxLp
        );

        IRewardTracker(feeSgxLpTracker).stakeForAccount(
            account,
            account,
            sgxlp,
            sgxlpAmount
        );
        IRewardTracker(stakedSgxLpTracker).stakeForAccount(
            account,
            account,
            feeSgxLpTracker,
            sgxlpAmount
        );

        emit StakeSgxLp(account, sgxlpAmount);

        return sgxlpAmount;
    }

    function unstakeAndRedeemSgxLp(
        address _tokenOut,
        uint256 _sgxlpAmount,
        uint256 _minOut,
        address _receiver
    ) external nonReentrant returns (uint256) {
        require(_sgxlpAmount > 0, "RewardRouter: invalid _sgxlpAmount");

        address account = msg.sender;
        IRewardTracker(stakedSgxLpTracker).unstakeForAccount(
            account,
            feeSgxLpTracker,
            _sgxlpAmount,
            account
        );
        IRewardTracker(feeSgxLpTracker).unstakeForAccount(
            account,
            sgxlp,
            _sgxlpAmount,
            account
        );
        uint256 amountOut = ISgxLpManager(sgxlpManager).removeLiquidityForAccount(
            account,
            _tokenOut,
            _sgxlpAmount,
            _minOut,
            _receiver
        );

        emit UnstakeSgxLp(account, _sgxlpAmount);

        return amountOut;
    }

    function unstakeAndRedeemSgxLpETH(
        uint256 _sgxlpAmount,
        uint256 _minOut,
        address payable _receiver
    ) external nonReentrant returns (uint256) {
        require(_sgxlpAmount > 0, "RewardRouter: invalid _sgxlpAmount");

        address account = msg.sender;
        IRewardTracker(stakedSgxLpTracker).unstakeForAccount(
            account,
            feeSgxLpTracker,
            _sgxlpAmount,
            account
        );
        IRewardTracker(feeSgxLpTracker).unstakeForAccount(
            account,
            sgxlp,
            _sgxlpAmount,
            account
        );
        uint256 amountOut = ISgxLpManager(sgxlpManager).removeLiquidityForAccount(
            account,
            weth,
            _sgxlpAmount,
            _minOut,
            address(this)
        );

        IWETH(weth).withdraw(amountOut);

        _receiver.sendValue(amountOut);

        emit UnstakeSgxLp(account, _sgxlpAmount);

        return amountOut;
    }

    function claim() external nonReentrant {
        address account = msg.sender;

        IRewardTracker(feeSgxTracker).claimForAccount(account, account);
        IRewardTracker(feeSgxLpTracker).claimForAccount(account, account);

        IRewardTracker(stakedSgxTracker).claimForAccount(account, account);
        IRewardTracker(stakedSgxLpTracker).claimForAccount(account, account);
    }

    function claimEsSgx() external nonReentrant {
        address account = msg.sender;

        IRewardTracker(stakedSgxTracker).claimForAccount(account, account);
        IRewardTracker(stakedSgxLpTracker).claimForAccount(account, account);
    }

    function claimFees() external nonReentrant {
        address account = msg.sender;

        IRewardTracker(feeSgxTracker).claimForAccount(account, account);
        IRewardTracker(feeSgxLpTracker).claimForAccount(account, account);
    }

    function compound() external nonReentrant {
        _compound(msg.sender);
    }

    function compoundForAccount(address _account)
        external
        nonReentrant
        onlyGov
    {
        _compound(_account);
    }

    function batchCompoundForAccounts(address[] memory _accounts)
        external
        nonReentrant
        onlyGov
    {
        for (uint256 i = 0; i < _accounts.length; i++) {
            _compound(_accounts[i]);
        }
    }

    function _compound(address _account) private {
        _compoundSgx(_account);
        _compoundSgxLp(_account);
    }

    function _compoundSgx(address _account) private {
        uint256 esSgxAmount = IRewardTracker(stakedSgxTracker).claimForAccount(
            _account,
            _account
        );
        if (esSgxAmount > 0) {
            _stakeSgx(_account, _account, esSgx, esSgxAmount);
        }

        uint256 bnSgxAmount = IRewardTracker(bonusSgxTracker).claimForAccount(
            _account,
            _account
        );
        if (bnSgxAmount > 0) {
            IRewardTracker(feeSgxTracker).stakeForAccount(
                _account,
                _account,
                bnSgx,
                bnSgxAmount
            );
        }
    }

    function _compoundSgxLp(address _account) private {
        uint256 esSgxAmount = IRewardTracker(stakedSgxLpTracker).claimForAccount(
            _account,
            _account
        );
        if (esSgxAmount > 0) {
            _stakeSgx(_account, _account, esSgx, esSgxAmount);
        }
    }

    function _stakeSgx(
        address _fundingAccount,
        address _account,
        address _token,
        uint256 _amount
    ) private {
        require(_amount > 0, "RewardRouter: invalid _amount");

        IRewardTracker(stakedSgxTracker).stakeForAccount(
            _fundingAccount,
            _account,
            _token,
            _amount
        );
        IRewardTracker(bonusSgxTracker).stakeForAccount(
            _account,
            _account,
            stakedSgxTracker,
            _amount
        );
        IRewardTracker(feeSgxTracker).stakeForAccount(
            _account,
            _account,
            bonusSgxTracker,
            _amount
        );

        emit StakeSgx(_account, _amount);
    }

    function _unstakeSgx(
        address _account,
        address _token,
        uint256 _amount
    ) private {
        require(_amount > 0, "RewardRouter: invalid _amount");

        uint256 balance = IRewardTracker(stakedSgxTracker).stakedAmounts(
            _account
        );

        IRewardTracker(feeSgxTracker).unstakeForAccount(
            _account,
            bonusSgxTracker,
            _amount,
            _account
        );
        IRewardTracker(bonusSgxTracker).unstakeForAccount(
            _account,
            stakedSgxTracker,
            _amount,
            _account
        );
        IRewardTracker(stakedSgxTracker).unstakeForAccount(
            _account,
            _token,
            _amount,
            _account
        );

        uint256 bnSgxAmount = IRewardTracker(bonusSgxTracker).claimForAccount(
            _account,
            _account
        );
        if (bnSgxAmount > 0) {
            IRewardTracker(feeSgxTracker).stakeForAccount(
                _account,
                _account,
                bnSgx,
                bnSgxAmount
            );
        }

        uint256 stakedBnSgx = IRewardTracker(feeSgxTracker).depositBalances(
            _account,
            bnSgx
        );
        if (stakedBnSgx > 0) {
            uint256 reductionAmount = stakedBnSgx.mul(_amount).div(balance);
            IRewardTracker(feeSgxTracker).unstakeForAccount(
                _account,
                bnSgx,
                reductionAmount,
                _account
            );
            IMintable(bnSgx).burn(_account, reductionAmount);
        }

        emit UnstakeSgx(_account, _amount);
    }
}
