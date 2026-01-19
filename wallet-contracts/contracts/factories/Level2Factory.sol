// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/Create2.sol";
import "../accounts/Level2Account.sol";

contract Level2Factory {
    IEntryPoint public immutable entryPoint;
    
    event Level2AccountCreated(
        address indexed account,
        uint256 publicKeyX,
        uint256 publicKeyY,
        uint256 salt
    );
    
    constructor(IEntryPoint _entryPoint) {
        entryPoint = _entryPoint;
    }
    
    function createAccount(
        uint256 publicKeyX,
        uint256 publicKeyY,
        uint256 salt
    ) public returns (Level2Account account) {
        address addr = getAddress(publicKeyX, publicKeyY, salt);
        uint256 codeSize = addr.code.length;

        if (codeSize > 0) {
            return Level2Account(payable(addr));
        }

        account = new Level2Account{salt: bytes32(salt)}(
            entryPoint,
            publicKeyX,
            publicKeyY
        );
        
        emit Level2AccountCreated(address(account), publicKeyX, publicKeyY, salt);
        
        return account;
    }
    
    function getAddress(
        uint256 publicKeyX,
        uint256 publicKeyY,
        uint256 salt
    ) public view returns (address) {
        return Create2.computeAddress(
            bytes32(salt),
            keccak256(
                abi.encodePacked(
                    type(Level2Account).creationCode,
                    abi.encode(entryPoint, publicKeyX, publicKeyY)
                )
            )
        );
    }
}