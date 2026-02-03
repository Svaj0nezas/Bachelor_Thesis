// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/Create2.sol";
import "../accounts/Level4Account.sol";

// Auto-generated ZK verifier interface
interface IGroth16Verifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[2] calldata _pubSignals
    ) external view returns (bool);
}

/**
 * @title Level4FactoryWithZK
 * @notice Factory for deploying age-verified Level4Account instances
 * @dev Requires ZK proof of age >= 18 before account creation
 */
contract Level4FactoryWithZK {
    IP384Verifier public immutable p384Verifier;
    IEntryPoint public immutable entryPoint;
    IGroth16Verifier public immutable ageVerifier;
    
    // Prevent proof reuse
    mapping(bytes32 => bool) public usedProofs;
    
    event AccountCreated(
        address indexed account,
        uint128 pkXHigh,
        uint256 pkXLow,
        uint128 pkYHigh,
        uint256 pkYLow,
        uint256 salt,
        uint256 indexed publicKeyHash
    );
    
    event ProofUsed(bytes32 indexed proofHash);
    
    constructor(
        IEntryPoint _entryPoint,
        IP384Verifier _p384Verifier,
        IGroth16Verifier _ageVerifier
    ) {
        entryPoint = _entryPoint;
        p384Verifier = _p384Verifier;
        ageVerifier = _ageVerifier;
    }
    
    /**
     * @notice Create a new age-verified Level4Account
     * @dev Verifies ZK proof before deploying account
     * @param pkXHigh High 128 bits of public key X coordinate
     * @param pkXLow Low 256 bits of public key X coordinate
     * @param pkYHigh High 128 bits of public key Y coordinate
     * @param pkYLow Low 256 bits of public key Y coordinate
     * @param salt Unique salt for CREATE2
     * @param a Groth16 proof component A
     * @param b Groth16 proof component B
     * @param c Groth16 proof component C
     * @param publicSignals Public outputs from circuit [publicKeyHash]
     */
    function createAccountWithAgeProof(
        uint128 pkXHigh,
        uint256 pkXLow,
        uint128 pkYHigh,
        uint256 pkYLow,
        uint256 salt,
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[2] calldata publicSignals
    ) external returns (Level4Account) {
        // 1. Verify the ZK proof (age >= 18)
        require(
            ageVerifier.verifyProof(a, b, c, publicSignals),
            "Age verification failed"
        );
        
        // 2. Prevent proof reuse
        bytes32 proofHash = keccak256(abi.encode(a, b, c, publicSignals));
        require(!usedProofs[proofHash], "Proof already used");
        usedProofs[proofHash] = true;
        emit ProofUsed(proofHash);
        
        // 3. Deploy account (same as Level3)
        Level4Account account = new Level4Account{salt: bytes32(salt)}(
            entryPoint,
            p384Verifier,
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
            salt,
            publicSignals[0] // publicKeyHash from proof
        );
        
        return account;
    }
    
    /**
     * @notice Calculate counterfactual address
     * @dev Same as Level3Factory
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
                    type(Level4Account).creationCode,
                    abi.encode(
                        entryPoint,
                        p384Verifier,
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