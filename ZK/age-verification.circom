pragma circom 2.0.0;

include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/poseidon.circom";

template AgeVerification() {
    // PRIVATE INPUTS (from verified certificate)
    signal input birthYear;
    signal input publicKeyX;
    signal input publicKeyY;
    
    // PUBLIC INPUTS
    signal input currentYear;
    
    // PUBLIC OUTPUT
    signal output publicKeyHash;
    
    // Constraint 1: Calculate age
    signal age;
    age <== currentYear - birthYear;
    
    // Constraint 2: Verify age >= 18
    component ageCheck = GreaterEqThan(8);
    ageCheck.in[0] <== age;
    ageCheck.in[1] <== 18;
    
    signal isOver18;
    isOver18 <== ageCheck.out;
    
    // Constraint 3: Must be over 18
    isOver18 === 1;
    
    // Constraint 4: Bind to public key
    component hasher = Poseidon(2);
    hasher.inputs[0] <== publicKeyX;
    hasher.inputs[1] <== publicKeyY;
    
    publicKeyHash <== hasher.out;
}

component main {public [currentYear]} = AgeVerification();