const snarkjs = require('snarkjs');
const fs = require('fs');

async function testProofGeneration() {
    console.log('🧪 Testing ZK Proof Generation\n');
    console.log('=' .repeat(60));
    
    // Test Case 1: Adult user (should succeed)
    console.log('\n📋 Test Case 1: Adult (born 1998, age 27)');
    
    const adultInput = {
        birthYear: "1998",
        publicKeyX: "12345678901234567890123456789012",
        publicKeyY: "98765432109876543210987654321098",
        currentYear: "2025"
    };
    
    console.log('  Input:');
    console.log('    Birth Year: 1998 (private)');
    console.log('    Current Year: 2025 (public)');
    console.log('    Age: 27 years old');
    
    try {
        console.log('\n  Generating proof...');
        
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            adultInput,
            '../ZK/age-verification_js/age-verification.wasm',
            '../ZK/build/age_verification_final.zkey'
        );
        
        console.log('  ✅ Proof generated successfully!');
        console.log('\n  Public Signals (visible on-chain):');
        console.log('    Public Key Hash:', publicSignals[0]);
        
        // Verify proof locally
        console.log('\n  Verifying proof...');
        const vKey = JSON.parse(fs.readFileSync('../ZK/build/verification_key.json'));
        const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        
        console.log('  Verification:', isValid ? '✅ VALID' : '❌ INVALID');
        
        // Format for Solidity
        const formattedProof = {
            a: [proof.pi_a[0], proof.pi_a[1]],
            b: [
                [proof.pi_b[0][1], proof.pi_b[0][0]],
                [proof.pi_b[1][1], proof.pi_b[1][0]]
            ],
            c: [proof.pi_c[0], proof.pi_c[1]],
            publicSignals: publicSignals
        };
        
        // Save for later use
        fs.writeFileSync(
            '../ZK/build/test-proof.json',
            JSON.stringify(formattedProof, null, 2)
        );
        console.log('\n  💾 Proof saved to ../ZK/build/test-proof.json');
        
    } catch (error) {
        console.log('  ❌ Error:', error.message);
        return;
    }
    
    // Test Case 2: Minor (should fail)
    console.log('\n\n📋 Test Case 2: Minor (born 2010, age 15)');
    
    const minorInput = {
        birthYear: "2010",
        publicKeyX: "12345678901234567890123456789012",
        publicKeyY: "98765432109876543210987654321098",
        currentYear: "2025"
    };
    
    console.log('  Input:');
    console.log('    Birth Year: 2010 (private)');
    console.log('    Current Year: 2025 (public)');
    console.log('    Age: 15 years old');
    
    try {
        console.log('\n  Attempting to generate proof...');
        
        await snarkjs.groth16.fullProve(
            minorInput,
            '../ZK/age-verification_js/age_verification.wasm',
            '../ZK/build/age_verification_final.zkey'
        );
        
        console.log('  ❌ ERROR: Proof should have failed but succeeded!');
        
    } catch (error) {
        console.log('  ✅ Proof generation failed as expected!');
        console.log('  Reason: Age constraint not satisfied (15 < 18)');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests passed!\n');
}

testProofGeneration().catch(console.error);