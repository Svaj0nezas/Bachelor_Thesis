// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/Create2.sol";
import "../accounts/Level1Account.sol";

contract Level1Factory {
    IEntryPoint public immutable entryPoint;

    event Level1AccountCreated(address indexed account, address indexed owner, uint256 salt);

    constructor(IEntryPoint _entryPoint) {
        entryPoint = _entryPoint;
    }

    function createAccount(address owner, uint256 salt) public returns (Level1Account account) {
        // Calculate what the address WOULD be
        address addr = getAddress(owner, salt);
        
        // Get the code size at that address
        uint256 codeSize = addr.code.length;
        
        // If code exists, account is already deployed
        if (codeSize > 0) {
            return Level1Account(payable(addr));
        }

        // Deploy using CREATE2
        // The bytecode includes constructor arguments (entryPoint, owner)
        account = new Level1Account{salt: bytes32(salt)}(entryPoint, owner);
        
        emit Level1AccountCreated(address(account), owner, salt);
    }

    function getAddress(address owner, uint256 salt) public view returns (address) {
        return Create2.computeAddress(
            bytes32(salt),
            keccak256(
                abi.encodePacked(
                    type(Level1Account).creationCode,
                    abi.encode(entryPoint, owner)
                )
            )
        );
    }
}