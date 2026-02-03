// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@account-abstraction/contracts/core/BaseAccount.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "../interfaces/IP384Verifier.sol";

/**
 * @title Level4Account
 * @notice ERC-4337 Account using Lithuanian eID P-384 signatures with ZK age verification
 * @dev Identical to Level3Account - age verification happens at factory level
 */
contract Level4Account is BaseAccount {
    // P-384 public key from eID certificate (384 bits split into 4 parts)
    uint256 internal constant SIG_VALIDATION_FAILED = 1;
    uint256 public immutable pkXHigh;
    uint256 public immutable pkXLow;
    uint256 public immutable pkYHigh;
    uint256 public immutable pkYLow;

    bool public useFastVerification;
    
    IP384Verifier public immutable verifier;
    IEntryPoint private immutable _entryPoint;
    
    uint256 private _nonce;
    
    event Level4AccountInitialized(
        IEntryPoint indexed entryPoint,
        address indexed verifier,
        uint256 pkXHigh,
        uint256 pkXLow,
        uint256 pkYHigh,
        uint256 pkYLow
    );
    
    event TransactionExecuted(
        address indexed target,
        uint256 value,
        bytes data,
        bool success
    );

    constructor(
        IEntryPoint anEntryPoint,
        IP384Verifier _verifier,
        uint256 _pkXHigh,
        uint256 _pkXLow,
        uint256 _pkYHigh,
        uint256 _pkYLow
    ) {
        _entryPoint = anEntryPoint;
        verifier = _verifier;
        pkXHigh = _pkXHigh;
        pkXLow = _pkXLow;
        pkYHigh = _pkYHigh;
        pkYLow = _pkYLow;

        useFastVerification = _canUseFastVerification();
        
        emit Level4AccountInitialized(
            anEntryPoint,
            address(_verifier),
            _pkXHigh,
            _pkXLow,
            _pkYHigh,
            _pkYLow
        );
    }

    function _canUseFastVerification() internal view returns (bool) {
        // Check if generator and this specific public key are precomputed
        return verifier.generatorPrecomputed() && 
               verifier.isPrecomputedKey(pkXHigh, pkXLow, pkYHigh, pkYLow);
    }

    function enableFastVerification() external returns (bool) {
        require(_canUseFastVerification(), "Fast verification not available");
        useFastVerification = true;
        return useFastVerification;
    }

    function disableFastVerification() external returns (bool) {
        useFastVerification = false;
        return useFastVerification;
    }

    
    /// @inheritdoc BaseAccount
    function entryPoint() public view override returns (IEntryPoint) {
        return _entryPoint;
    }
    
    function getNonce() public view override returns (uint256) {
        return _nonce;
    }
    
    /**
     * @dev Validate eID signature on UserOperation
     * @notice Decodes P-384 signature and verifies against stored public key
     */
    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal override returns (uint256 validationData) {
        // Decode signature: (rHigh, rLow, sHigh, sLow)
        (uint256 rHigh, uint256 rLow, uint256 sHigh, uint256 sLow) = 
            abi.decode(userOp.signature, (uint256, uint256, uint256, uint256));

         uint256 messageHash = uint256(userOpHash);

          bool valid;
        
        if (useFastVerification) {
            // Fast path: uses precomputed tables (~80% gas savings)
            valid = verifier.verifyFast(
                messageHash,
                rHigh, rLow, sHigh, sLow
            );
        } else {
            // Standard path: works for any public key
            valid = verifier.verify_external(
                pkXHigh, pkXLow, pkYHigh, pkYLow,
                messageHash,
                rHigh, rLow, sHigh, sLow
            );
        }
        
        if (valid) {
            _nonce++;
            return 0; // Signature valid
        }
        
        return SIG_VALIDATION_FAILED;
    }
    
    /**
     * @dev Execute a transaction (only via EntryPoint)
     * @param dest Target contract address
     * @param value Amount of ETH to send
     * @param func Calldata for the transaction
     */
    function execute(
        address dest,
        uint256 value,
        bytes calldata func
    ) external override{
        _requireFromEntryPoint();
        _call(dest, value, func);
    }
    
    /**
     * @dev Execute a batch of transactions
     */
    function executeBatch(
        address[] calldata dest,
        uint256[] calldata value,
        bytes[] calldata func
    ) external {
        _requireFromEntryPoint();
        require(
            dest.length == value.length && value.length == func.length,
            "Length mismatch"
        );
        
        for (uint256 i = 0; i < dest.length; i++) {
            _call(dest[i], value[i], func[i]);
        }
    }
    
    /**
     * @dev Internal call function
     */
    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value: value}(data);
        
        emit TransactionExecuted(target, value, data, success);
        
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }
    
    /**
     * @dev Receive ETH
     */
    receive() external payable {}
    
    /**
     * @dev Fallback function
     */
    fallback() external payable {}
}