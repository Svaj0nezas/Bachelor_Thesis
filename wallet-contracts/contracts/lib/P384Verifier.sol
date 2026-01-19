// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../interfaces/IP384Verifier.sol";

interface ICurve384 {
    function verify_external(
        uint256 pkXHigh,
        uint256 pkXLow,
        uint256 pkYHigh,
        uint256 pkYLow,
        uint256 m,
        uint256 rhi,
        uint256 rlo,
        uint256 shi,
        uint256 slo
    ) external view returns (bool);
    
    function verify_fast(
        uint256 m,
        uint256 rhi,
        uint256 rlo,
        uint256 shi,
        uint256 slo
    ) external view returns (bool);
    
    function precomputeGen() external;
    
    function precomputePub(
        uint256 xhi,
        uint256 xlo,
        uint256 yhi,
        uint256 ylo
    ) external;
}

contract P384Verifier is IP384Verifier {
    ICurve384 private immutable _curve384;
    
    // Track precomputation state (just for reference/queries)
    uint256 public override precomputedPkXHigh;
    uint256 public override precomputedPkXLow;
    uint256 public override precomputedPkYHigh;
    uint256 public override precomputedPkYLow;
    bool public override pubkeyPrecomputed;
    bool public override generatorPrecomputed;


    constructor(address _curve384Address) {
        require(_curve384Address != address(0), "Invalid Curve384 address");
        _curve384 = ICurve384(_curve384Address);
    }

    /**
     * @dev Get the Curve384 contract address
     */
    function curve384() external view override returns (address) {
        return address(_curve384);
    }

    /**
     * @dev Precompute generator table on Curve384 and mark as done
     */
    function precomputeGenerator() external override {
        require(!generatorPrecomputed, "Already precomputed");
        _curve384.precomputeGen();
        generatorPrecomputed = true;
        emit GeneratorPrecomputed();
    }

    /**
     * @dev Precompute public key table on Curve384 and mark as done
     */
    function precomputePublicKey(
        uint256 pkXHigh,
        uint256 pkXLow,
        uint256 pkYHigh,
        uint256 pkYLow
    ) external override {
        _curve384.precomputePub(pkXHigh, pkXLow, pkYHigh, pkYLow);
        
        precomputedPkXHigh = pkXHigh;
        precomputedPkXLow = pkXLow;
        precomputedPkYHigh = pkYHigh;
        precomputedPkYLow = pkYLow;
        pubkeyPrecomputed = true;
        
        emit PubkeyPrecomputed(pkXHigh, pkXLow, pkYHigh, pkYLow);
    }

    /**
     * @dev Fast verification - calls Curve384's precomputed tables
     * No checks here - caller is responsible for ensuring it's appropriate to use
     */
    function verifyFast(
        uint256 messageHash,
        uint256 rHigh,
        uint256 rLow,
        uint256 sHigh,
        uint256 sLow
    ) external view override returns (bool) {
        return _curve384.verify_fast(messageHash, rHigh, rLow, sHigh, sLow);
    }

    /**
     * @dev Standard verification - works for any public key
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
    ) external view override returns (bool) {
        return _curve384.verify_external(
            pkXHigh, pkXLow, pkYHigh, pkYLow,
            messageHash,
            rHigh, rLow, sHigh, sLow
        );
    }
    
    /**
     * @dev Check if a given public key matches the precomputed one
     */
    function isPrecomputedKey(
        uint256 pkXHigh,
        uint256 pkXLow,
        uint256 pkYHigh,
        uint256 pkYLow
    ) external view override returns (bool) {
        return pubkeyPrecomputed &&
               pkXHigh == precomputedPkXHigh &&
               pkXLow == precomputedPkXLow &&
               pkYHigh == precomputedPkYHigh &&
               pkYLow == precomputedPkYLow;
    }
}