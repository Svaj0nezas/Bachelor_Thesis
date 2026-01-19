// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@account-abstraction/contracts/core/BaseAccount.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";

/**
 * @title Level1Account
 * @notice ERC-4337 account that validates signatures using the owner's EOA
 * @dev Basic account abstraction implementation
 * 
 * Security Model:
 * - Single owner (EOA address)
 * - Owner signs UserOperation with their private key
 * - Only owner can execute transactions through this account
 */


contract Level1Account is BaseAccount {

    uint256 internal constant SIG_VALIDATION_FAILED = 1;
    IEntryPoint private immutable _entryPoint;
    address public immutable owner;

    event Level1AccountInitialized(IEntryPoint indexed entryPoint, address indexed owner);
    event TransactionExecuted(address indexed target, uint256 value, bytes data);
    
    constructor(IEntryPoint anEntryPoint, address anOwner) {
        _entryPoint = anEntryPoint;
        owner = anOwner;
        emit Level1AccountInitialized(anEntryPoint, anOwner);
    }
    /**
     * @notice Return the EntryPoint this account uses
     * @dev Required by BaseAccount interface
     */
    function entryPoint() public view virtual override returns (IEntryPoint) {
        return _entryPoint;
    }

    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal virtual override returns (uint256 validationData) {
        // Step 1: Add Ethereum signed message prefix
        // This is standard for Ethereum signatures
        bytes32 hash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", userOpHash)
        );
        
        // Step 2: Recover the signer from the signature
        bytes calldata signature = userOp.signature;
        address signer = _recoverSigner(hash, signature);
        
        // Step 3: Check if signer is our owner
        if (signer != owner) {
            return SIG_VALIDATION_FAILED;
        }
        
        return 0; // Valid!
    }

    function _recoverSigner(
        bytes32 hash,
        bytes calldata signature
    ) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");
        
        bytes32 r = bytes32(signature[0:32]);
        bytes32 s = bytes32(signature[32:64]);
        uint8 v = uint8(signature[64]);
        
        // Use Ethereum's built-in ecrecover
        return ecrecover(hash, v, r, s);
    }

    function execute(address dest, uint256 value, bytes calldata func) external override{
        _requireFromEntryPoint();
        _call(dest, value, func);
        emit TransactionExecuted(dest, value, func);
    }
    
    
    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            // Bubble up the revert reason
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }
    
    
    receive() external payable {}

}

