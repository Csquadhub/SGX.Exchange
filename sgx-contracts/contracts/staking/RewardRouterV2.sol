// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../libraries/math/SafeMath.sol";
import "../libraries/token/IERC20.sol";
import "../libraries/token/SafeERC20.sol";
import "../libraries/utils/ReentrancyGuard.sol";
import "../libraries/utils/Address.sol";

import "./interfaces/IRewardTracker.sol";
import "./interfaces/IVester.sol";
import "../tokens/interfaces/IMintable.sol";
import "../tokens/interfaces/IWETH.sol";
import "../core/interfaces/ISgxLpManager.sol";
import "../access/Governable.sol";

contract RewardRouterV2 is ReentrancyGuard, Governable {
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

    address public sgxVester;
    address public sgxlpVester;

    mapping (address => address) public pendingReceivers;

    event StakeSgx(address account, address token, uint256 amount);
    event UnstakeSgx(address account, address token, uint256 amount);

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
        address _sgxlpManager,
        address _sgxVester,
        address _sgxlpVester
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

        sgxVester = _sgxVester;
        sgxlpVester = _sgxlpVester;
    }

    // to help users who accidentally send their tokens to this contract
    function withdrawToken(address _token, address _account, uint256 _amount) external onlyGov {
        IERC20(_token).safeTransfer(_account, _amount);
    }

    function batchStakeSgxForAccount(address[] memory _accounts, uint256[] memory _amounts) external nonReentrant onlyGov {
        address _sgx = sgx;
        for (uint256 i = 0; i < _accounts.length; i++) {
            _stakeSgx(msg.sender, _accounts[i], _sgx, _amounts[i]);
        }
    }

    function stakeSgxForAccount(address _account, uint256 _amount) external nonReentrant onlyGov {
        _stakeSgx(msg.sender, _account, sgx, _amount);
    }

    function stakeSgx(uint256 _amount) external nonReentrant {
        _stakeSgx(msg.sender, msg.sender, sgx, _amount);
    }

    function stakeEsSgx(uint256 _amount) external nonReentrant {
        _stakeSgx(msg.sender, msg.sender, esSgx, _amount);
    }

    function unstakeSgx(uint256 _amount) external nonReentrant {
        _unstakeSgx(msg.sender, sgx, _amount, true);
    }

    function unstakeEsSgx(uint256 _amount) external nonReentrant {
        _unstakeSgx(msg.sender, esSgx, _amount, true);
    }

    function mintAndStakeSgxLp(address _token, uint256 _amount, uint256 _minSgusd, uint256 _minSgxLp) external nonReentrant returns (uint256) {
        require(_amount > 0, "RewardRouter: invalid _amount");

        address account = msg.sender;
        uint256 sgxlpAmount = ISgxLpManager(sgxlpManager).addLiquidityForAccount(account, account, _token, _amount, _minSgusd, _minSgxLp);
        IRewardTracker(feeSgxLpTracker).stakeForAccount(account, account, sgxlp, sgxlpAmount);
        IRewardTracker(stakedSgxLpTracker).stakeForAccount(account, account, feeSgxLpTracker, sgxlpAmount);

        emit StakeSgxLp(account, sgxlpAmount);

        return sgxlpAmount;
    }

    function mintAndStakeSgxLpETH(uint256 _minSgusd, uint256 _minSgxLp) external payable nonReentrant returns (uint256) {
        require(msg.value > 0, "RewardRouter: invalid msg.value");

        IWETH(weth).deposit{value: msg.value}();
        IERC20(weth).approve(sgxlpManager, msg.value);

        address account = msg.sender;
        uint256 sgxlpAmount = ISgxLpManager(sgxlpManager).addLiquidityForAccount(address(this), account, weth, msg.value, _minSgusd, _minSgxLp);

        IRewardTracker(feeSgxLpTracker).stakeForAccount(account, account, sgxlp, sgxlpAmount);
        IRewardTracker(stakedSgxLpTracker).stakeForAccount(account, account, feeSgxLpTracker, sgxlpAmount);

        emit StakeSgxLp(account, sgxlpAmount);

        return sgxlpAmount;
    }

    function unstakeAndRedeemSgxLp(address _tokenOut, uint256 _sgxlpAmount, uint256 _minOut, address _receiver) external nonReentrant returns (uint256) {
        require(_sgxlpAmount > 0, "RewardRouter: invalid _sgxlpAmount");

        address account = msg.sender;
        IRewardTracker(stakedSgxLpTracker).unstakeForAccount(account, feeSgxLpTracker, _sgxlpAmount, account);
        IRewardTracker(feeSgxLpTracker).unstakeForAccount(account, sgxlp, _sgxlpAmount, account);
        uint256 amountOut = ISgxLpManager(sgxlpManager).removeLiquidityForAccount(account, _tokenOut, _sgxlpAmount, _minOut, _receiver);

        emit UnstakeSgxLp(account, _sgxlpAmount);

        return amountOut;
    }

    function unstakeAndRedeemSgxLpETH(uint256 _sgxlpAmount, uint256 _minOut, address payable _receiver) external nonReentrant returns (uint256) {
        require(_sgxlpAmount > 0, "RewardRouter: invalid _sgxlpAmount");

        address account = msg.sender;
        IRewardTracker(stakedSgxLpTracker).unstakeForAccount(account, feeSgxLpTracker, _sgxlpAmount, account);
        IRewardTracker(feeSgxLpTracker).unstakeForAccount(account, sgxlp, _sgxlpAmount, account);
        uint256 amountOut = ISgxLpManager(sgxlpManager).removeLiquidityForAccount(account, weth, _sgxlpAmount, _minOut, address(this));

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

    function compoundForAccount(address _account) external nonReentrant onlyGov {
        _compound(_account);
    }

    function handleRewards(
        bool _shouldClaimSgx,
        bool _shouldStakeSgx,
        bool _shouldClaimEsSgx,
        bool _shouldStakeEsSgx,
        bool _shouldStakeMultiplierPoints,
        bool _shouldClaimWeth,
        bool _shouldConvertWethToEth
    ) external nonReentrant {
        address account = msg.sender;

        uint256 sgxAmount = 0;
        if (_shouldClaimSgx) {
            uint256 sgxAmount0 = IVester(sgxVester).claimForAccount(account, account);
            uint256 sgxAmount1 = IVester(sgxlpVester).claimForAccount(account, account);
            sgxAmount = sgxAmount0.add(sgxAmount1);
        }

        if (_shouldStakeSgx && sgxAmount > 0) {
            _stakeSgx(account, account, sgx, sgxAmount);
        }

        uint256 esSgxAmount = 0;
        if (_shouldClaimEsSgx) {
            uint256 esSgxAmount0 = IRewardTracker(stakedSgxTracker).claimForAccount(account, account);
            uint256 esSgxAmount1 = IRewardTracker(stakedSgxLpTracker).claimForAccount(account, account);
            esSgxAmount = esSgxAmount0.add(esSgxAmount1);
        }

        if (_shouldStakeEsSgx && esSgxAmount > 0) {
            _stakeSgx(account, account, esSgx, esSgxAmount);
        }

        if (_shouldStakeMultiplierPoints) {
            uint256 bnSgxAmount = IRewardTracker(bonusSgxTracker).claimForAccount(account, account);
            if (bnSgxAmount > 0) {
                IRewardTracker(feeSgxTracker).stakeForAccount(account, account, bnSgx, bnSgxAmount);
            }
        }

        if (_shouldClaimWeth) {
            if (_shouldConvertWethToEth) {
                uint256 weth0 = IRewardTracker(feeSgxTracker).claimForAccount(account, address(this));
                uint256 weth1 = IRewardTracker(feeSgxLpTracker).claimForAccount(account, address(this));

                uint256 wethAmount = weth0.add(weth1);
                IWETH(weth).withdraw(wethAmount);

                payable(account).sendValue(wethAmount);
            } else {
                IRewardTracker(feeSgxTracker).claimForAccount(account, account);
                IRewardTracker(feeSgxLpTracker).claimForAccount(account, account);
            }
        }
    }

    function batchCompoundForAccounts(address[] memory _accounts) external nonReentrant onlyGov {
        for (uint256 i = 0; i < _accounts.length; i++) {
            _compound(_accounts[i]);
        }
    }

    function signalTransfer(address _receiver) external nonReentrant {
        require(IERC20(sgxVester).balanceOf(msg.sender) == 0, "RewardRouter: sender has vested tokens");
        require(IERC20(sgxlpVester).balanceOf(msg.sender) == 0, "RewardRouter: sender has vested tokens");

        _validateReceiver(_receiver);
        pendingReceivers[msg.sender] = _receiver;
    }

    function acceptTransfer(address _sender) external nonReentrant {
        require(IERC20(sgxVester).balanceOf(_sender) == 0, "RewardRouter: sender has vested tokens");
        require(IERC20(sgxlpVester).balanceOf(_sender) == 0, "RewardRouter: sender has vested tokens");

        address receiver = msg.sender;
        require(pendingReceivers[_sender] == receiver, "RewardRouter: transfer not signalled");
        delete pendingReceivers[_sender];

        _validateReceiver(receiver);
        _compound(_sender);

        uint256 stakedSgx = IRewardTracker(stakedSgxTracker).depositBalances(_sender, sgx);
        if (stakedSgx > 0) {
            _unstakeSgx(_sender, sgx, stakedSgx, false);
            _stakeSgx(_sender, receiver, sgx, stakedSgx);
        }

        uint256 stakedEsSgx = IRewardTracker(stakedSgxTracker).depositBalances(_sender, esSgx);
        if (stakedEsSgx > 0) {
            _unstakeSgx(_sender, esSgx, stakedEsSgx, false);
            _stakeSgx(_sender, receiver, esSgx, stakedEsSgx);
        }

        uint256 stakedBnSgx = IRewardTracker(feeSgxTracker).depositBalances(_sender, bnSgx);
        if (stakedBnSgx > 0) {
            IRewardTracker(feeSgxTracker).unstakeForAccount(_sender, bnSgx, stakedBnSgx, _sender);
            IRewardTracker(feeSgxTracker).stakeForAccount(_sender, receiver, bnSgx, stakedBnSgx);
        }

        uint256 esSgxBalance = IERC20(esSgx).balanceOf(_sender);
        if (esSgxBalance > 0) {
            IERC20(esSgx).transferFrom(_sender, receiver, esSgxBalance);
        }

        uint256 sgxlpAmount = IRewardTracker(feeSgxLpTracker).depositBalances(_sender, sgxlp);
        if (sgxlpAmount > 0) {
            IRewardTracker(stakedSgxLpTracker).unstakeForAccount(_sender, feeSgxLpTracker, sgxlpAmount, _sender);
            IRewardTracker(feeSgxLpTracker).unstakeForAccount(_sender, sgxlp, sgxlpAmount, _sender);

            IRewardTracker(feeSgxLpTracker).stakeForAccount(_sender, receiver, sgxlp, sgxlpAmount);
            IRewardTracker(stakedSgxLpTracker).stakeForAccount(receiver, receiver, feeSgxLpTracker, sgxlpAmount);
        }

        IVester(sgxVester).transferStakeValues(_sender, receiver);
        IVester(sgxlpVester).transferStakeValues(_sender, receiver);
    }

    function _validateReceiver(address _receiver) private view {
        require(IRewardTracker(stakedSgxTracker).averageStakedAmounts(_receiver) == 0, "RewardRouter: stakedSgxTracker.averageStakedAmounts > 0");
        require(IRewardTracker(stakedSgxTracker).cumulativeRewards(_receiver) == 0, "RewardRouter: stakedSgxTracker.cumulativeRewards > 0");

        require(IRewardTracker(bonusSgxTracker).averageStakedAmounts(_receiver) == 0, "RewardRouter: bonusSgxTracker.averageStakedAmounts > 0");
        require(IRewardTracker(bonusSgxTracker).cumulativeRewards(_receiver) == 0, "RewardRouter: bonusSgxTracker.cumulativeRewards > 0");

        require(IRewardTracker(feeSgxTracker).averageStakedAmounts(_receiver) == 0, "RewardRouter: feeSgxTracker.averageStakedAmounts > 0");
        require(IRewardTracker(feeSgxTracker).cumulativeRewards(_receiver) == 0, "RewardRouter: feeSgxTracker.cumulativeRewards > 0");

        require(IVester(sgxVester).transferredAverageStakedAmounts(_receiver) == 0, "RewardRouter: sgxVester.transferredAverageStakedAmounts > 0");
        require(IVester(sgxVester).transferredCumulativeRewards(_receiver) == 0, "RewardRouter: sgxVester.transferredCumulativeRewards > 0");

        require(IRewardTracker(stakedSgxLpTracker).averageStakedAmounts(_receiver) == 0, "RewardRouter: stakedSgxLpTracker.averageStakedAmounts > 0");
        require(IRewardTracker(stakedSgxLpTracker).cumulativeRewards(_receiver) == 0, "RewardRouter: stakedSgxLpTracker.cumulativeRewards > 0");

        require(IRewardTracker(feeSgxLpTracker).averageStakedAmounts(_receiver) == 0, "RewardRouter: feeSgxLpTracker.averageStakedAmounts > 0");
        require(IRewardTracker(feeSgxLpTracker).cumulativeRewards(_receiver) == 0, "RewardRouter: feeSgxLpTracker.cumulativeRewards > 0");

        require(IVester(sgxlpVester).transferredAverageStakedAmounts(_receiver) == 0, "RewardRouter: sgxVester.transferredAverageStakedAmounts > 0");
        require(IVester(sgxlpVester).transferredCumulativeRewards(_receiver) == 0, "RewardRouter: sgxVester.transferredCumulativeRewards > 0");

        require(IERC20(sgxVester).balanceOf(_receiver) == 0, "RewardRouter: sgxVester.balance > 0");
        require(IERC20(sgxlpVester).balanceOf(_receiver) == 0, "RewardRouter: sgxlpVester.balance > 0");
    }

    function _compound(address _account) private {
        _compoundSgx(_account);
        _compoundSgxLp(_account);
    }

    function _compoundSgx(address _account) private {
        uint256 esSgxAmount = IRewardTracker(stakedSgxTracker).claimForAccount(_account, _account);
        if (esSgxAmount > 0) {
            _stakeSgx(_account, _account, esSgx, esSgxAmount);
        }

        uint256 bnSgxAmount = IRewardTracker(bonusSgxTracker).claimForAccount(_account, _account);
        if (bnSgxAmount > 0) {
            IRewardTracker(feeSgxTracker).stakeForAccount(_account, _account, bnSgx, bnSgxAmount);
        }
    }

    function _compoundSgxLp(address _account) private {
        uint256 esSgxAmount = IRewardTracker(stakedSgxLpTracker).claimForAccount(_account, _account);
        if (esSgxAmount > 0) {
            _stakeSgx(_account, _account, esSgx, esSgxAmount);
        }
    }

    function _stakeSgx(address _fundingAccount, address _account, address _token, uint256 _amount) private {
        require(_amount > 0, "RewardRouter: invalid _amount");

        IRewardTracker(stakedSgxTracker).stakeForAccount(_fundingAccount, _account, _token, _amount);
        IRewardTracker(bonusSgxTracker).stakeForAccount(_account, _account, stakedSgxTracker, _amount);
        IRewardTracker(feeSgxTracker).stakeForAccount(_account, _account, bonusSgxTracker, _amount);

        emit StakeSgx(_account, _token, _amount);
    }

    function _unstakeSgx(address _account, address _token, uint256 _amount, bool _shouldReduceBnSgx) private {
        require(_amount > 0, "RewardRouter: invalid _amount");

        uint256 balance = IRewardTracker(stakedSgxTracker).stakedAmounts(_account);

        IRewardTracker(feeSgxTracker).unstakeForAccount(_account, bonusSgxTracker, _amount, _account);
        IRewardTracker(bonusSgxTracker).unstakeForAccount(_account, stakedSgxTracker, _amount, _account);
        IRewardTracker(stakedSgxTracker).unstakeForAccount(_account, _token, _amount, _account);

        if (_shouldReduceBnSgx) {
            uint256 bnSgxAmount = IRewardTracker(bonusSgxTracker).claimForAccount(_account, _account);
            if (bnSgxAmount > 0) {
                IRewardTracker(feeSgxTracker).stakeForAccount(_account, _account, bnSgx, bnSgxAmount);
            }

            uint256 stakedBnSgx = IRewardTracker(feeSgxTracker).depositBalances(_account, bnSgx);
            if (stakedBnSgx > 0) {
                uint256 reductionAmount = stakedBnSgx.mul(_amount).div(balance);
                IRewardTracker(feeSgxTracker).unstakeForAccount(_account, bnSgx, reductionAmount, _account);
                IMintable(bnSgx).burn(_account, reductionAmount);
            }
        }

        emit UnstakeSgx(_account, _token, _amount);
    }
}
