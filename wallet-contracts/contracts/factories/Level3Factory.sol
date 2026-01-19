// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/Create2.sol";
import "../accounts/Level3Account.sol";

/**
 * @title Level3Factory
 * @notice Factory for deploying Level3Account instances with eID public keys
 */
contract Level3Factory {
    IP384Verifier public immutable verifier;
    IEntryPoint public immutable entryPoint;
    
    event AccountCreated(
        address indexed account,
        uint128 pkXHigh,
        uint256 pkXLow,
        uint128 pkYHigh,
        uint256 pkYLow,
        uint256 salt
    );
    
    constructor(IEntryPoint _entryPoint, IP384Verifier _verifier) {
        entryPoint = _entryPoint;
        verifier = _verifier;
    }
    
    /**
     * @dev Create a new Level3Account with eID public key
     * @notice Uses CREATE2 for deterministic address generation
     * @notice Will revert if account already exists at the computed address
     * @param pkXHigh High 128 bits of public key X coordinate
     * @param pkXLow Low 256 bits of public key X coordinate
     * @param pkYHigh High 128 bits of public key Y coordinate
     * @param pkYLow Low 256 bits of public key Y coordinate
     * @param salt Unique salt for CREATE2
     */
    function createAccount(
        uint128 pkXHigh,
        uint256 pkXLow,
        uint128 pkYHigh,
        uint256 pkYLow,
        uint256 salt
    ) external returns (Level3Account) {
        // Deploy directly with CREATE2
        // This will automatically revert if an account already exists at this address
        Level3Account account = new Level3Account{salt: bytes32(salt)}(
            entryPoint,
            verifier,
            pkXHigh,
            pkXLow,
            pkYHigh,
            pkYLow
        );
        
        emit AccountCreated(
            address(account),
            pkXHigh,
            pkXLow,
            pkYHigh,
            pkYLow,
            salt
        );
        
        return account;
    }
    
    /**
     * @dev Calculate counterfactual address for CREATE2
     * @notice WARNING: This function performs expensive cryptographic operations
     * @notice It is intended for off-chain use only or verification purposes
     * @notice For production, compute addresses off-chain to avoid timeouts
     */
    function getAddress(
        uint128 pkXHigh,
        uint256 pkXLow,
        uint128 pkYHigh,
        uint256 pkYLow,
        uint256 salt
    ) public view returns (address) {
        return Create2.computeAddress(
            bytes32(salt),
            keccak256(
                abi.encodePacked(
                    type(Level3Account).creationCode,
                    abi.encode(
                        entryPoint,
                        verifier,
                        pkXHigh,
                        pkXLow,
                        pkYHigh,
                        pkYLow
                    )
                )
            )
        );
    }
}