// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@account-abstraction/contracts/core/BaseAccount.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {WebAuthn} from "../lib/webauthn-sol/WebAuthn.sol";

contract Level2Account is BaseAccount {
    uint256 internal constant SIG_VALIDATION_FAILED = 1;
    
    IEntryPoint private immutable _entryPoint;
    uint256 public immutable publicKeyX;
    uint256 public immutable publicKeyY;
    
    event Level2AccountInitialized(
        IEntryPoint indexed entryPoint,
        uint256 publicKeyX,
        uint256 publicKeyY
    );
    
    constructor(
        IEntryPoint anEntryPoint,
        uint256 _publicKeyX,
        uint256 _publicKeyY
    ) {
        _entryPoint = anEntryPoint;
        publicKeyX = _publicKeyX;
        publicKeyY = _publicKeyY;
        
        emit Level2AccountInitialized(anEntryPoint, _publicKeyX, _publicKeyY);
    }
    
    function entryPoint() public view virtual override returns (IEntryPoint) {
        return _entryPoint;
    }
    
    /**
     * Validate WebAuthn signature
     * 
     * Signature format:
     * [authenticatorDataLength (2 bytes)]
     * [authenticatorData (variable)]
     * [clientDataJSONLength (2 bytes)]
     * [clientDataJSON (variable)]
     * [challengeIndex (2 bytes)]
     * [typeIndex (2 bytes)]
     * [r (32 bytes)]
     * [s (32 bytes)]
     */
    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal virtual override returns (uint256 validationData) {
        bytes calldata signature = userOp.signature;
        
        // Decode signature components
        (
            bytes memory authenticatorData,
            string memory clientDataJSON,
            uint256 challengeIndex,
            uint256 typeIndex,
            uint256 r,
            uint256 s
        ) = _decodeWebAuthnSignature(signature);
        
        // Use the WebAuthn library - just call it like a function!
        bool isValid = WebAuthn.verify({
            challenge: abi.encodePacked(userOpHash),
            requireUV: true, // Require user verification (Touch ID)
            webAuthnAuth: WebAuthn.WebAuthnAuth({
                authenticatorData: authenticatorData,
                clientDataJSON: clientDataJSON,
                challengeIndex: challengeIndex,
                typeIndex: typeIndex,
                r: r,
                s: s
            }),
            x: publicKeyX,
            y: publicKeyY
        });
        
        return isValid ? 0 : SIG_VALIDATION_FAILED;
    }
    
    /**
     * Decode WebAuthn signature components from calldata
     */
    function _decodeWebAuthnSignature(
        bytes calldata signature
    ) internal pure returns (
        bytes memory authenticatorData,
        string memory clientDataJSON,
        uint256 challengeIndex,
        uint256 typeIndex,
        uint256 r,
        uint256 s
    ) {
        uint256 offset = 0;
        
        // Read authenticatorData length (2 bytes)
        uint16 authDataLen = uint16(bytes2(signature[offset:offset+2]));
        offset += 2;
        
        // Read authenticatorData
        authenticatorData = signature[offset:offset+authDataLen];
        offset += authDataLen;
        
        // Read clientDataJSON length (2 bytes)
        uint16 clientDataLen = uint16(bytes2(signature[offset:offset+2]));
        offset += 2;
        
        // Read clientDataJSON
        clientDataJSON = string(signature[offset:offset+clientDataLen]);
        offset += clientDataLen;
        
        // Read challengeIndex (2 bytes)
        challengeIndex = uint16(bytes2(signature[offset:offset+2]));
        offset += 2;
        
        // Read typeIndex (2 bytes)
        typeIndex = uint16(bytes2(signature[offset:offset+2]));
        offset += 2;
        
        // Read r (32 bytes)
        r = uint256(bytes32(signature[offset:offset+32]));
        offset += 32;
        
        // Read s (32 bytes)
        s = uint256(bytes32(signature[offset:offset+32]));
    }
    
    function execute(address dest, uint256 value, bytes calldata func) external override {
        _requireFromEntryPoint();
        _call(dest, value, func);
    }
    
    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }
    
    receive() external payable {}
}