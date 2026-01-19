// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IP384Verifier
 * @notice Interface for P-384 ECDSA signature verification
 */
interface IP384Verifier {
    event SignatureVerified(bool valid, uint256 messageHash);
    event GeneratorPrecomputed();
    event PubkeyPrecomputed(uint256 xHi, uint256 xLo, uint256 yHi, uint256 yLo);
    
    /**
     * @dev Verify a P-384 ECDSA signature
     */
    function verify_external(
        uint256 pkXHigh,
        uint256 pkXLow,
        uint256 pkYHigh,
        uint256 pkYLow,
        uint256 messageHash,
        uint256 rHigh,
        uint256 rLow,
        uint256 sHigh,
        uint256 sLow
    ) external view returns (bool valid);

    /**
     * @dev Fast verification using precomputed tables
     */
    function verifyFast(
        uint256 messageHash,
        uint256 rHigh,
        uint256 rLow,
        uint256 sHigh,
        uint256 sLow
    ) external view returns (bool); 
    
    /**
     * @dev Check if a given public key matches the precomputed one
     */
    function isPrecomputedKey(
        uint256 pkXHigh,
        uint256 pkXLow,
        uint256 pkYHigh,
        uint256 pkYLow
    ) external view returns (bool);

    /**
     * @dev Get the underlying Curve384 contract address
     */
    function curve384() external view returns (address);

    /**
     * @dev Precompute generator table (one-time setup)
     */
    function precomputeGenerator() external;
    
    /**
     * @dev Precompute public key table for a specific key
     */
    function precomputePublicKey(
        uint256 pkXHigh,
        uint256 pkXLow,
        uint256 pkYHigh,
        uint256 pkYLow
    ) external;

    /**
     * @dev Check if generator table is precomputed
     */
    function generatorPrecomputed() external view returns (bool);

    /**
     * @dev Check if a public key table is precomputed
     */
    function pubkeyPrecomputed() external view returns (bool);

    /**
     * @dev Get precomputed public key components
     */
    function precomputedPkXHigh() external view returns (uint256);
    function precomputedPkXLow() external view returns (uint256);
    function precomputedPkYHigh() external view returns (uint256);
    function precomputedPkYLow() external view returns (uint256);
}