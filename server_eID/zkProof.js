const { generateAgeProof } = require('./scripts/eid-proof-generator');

async function createAccountWithZKProof() {
    console.log('Starting account creation with ZK age verification...\n');
    
    // ============================================
    // STEP 1: Read eID Card
    // ============================================
    console.log('📇 Step 1: Reading eID card...');
    const certificate = await readEIDCard();
    console.log('✅ Certificate read from card\n');
    
    // ============================================
    // STEP 2: Verify Government Signature
    // ============================================
    console.log('🔐 Step 2: Verifying government certificate signature...');
    console.log('   This proves the certificate is authentic');
    
    const isValid = await verifyGovernmentSignature(certificate);
    
    if (!isValid) {
        console.log('❌ Certificate signature is INVALID');
        throw new Error('INVALID_CERTIFICATE: Government signature verification failed');
    }
    
    console.log('✅ Certificate signature is VALID');
    console.log('   Certificate was issued by Lithuanian government ✓');
    console.log('   Certificate has not been tampered with ✓\n');
    
    // ============================================
    // STEP 3: Extract Data from VERIFIED Certificate
    // ============================================
    console.log('📊 Step 3: Extracting data from verified certificate...');
    
    // Extract personal number (e.g., "39801011234")
    const personalNumber = extractPersonalNumber(certificate);
    console.log(`   Personal Number: ${personalNumber}`);
    
    // Parse birth year from personal number
    // Format: GYYMMDDNNNC (G=gender, YY=year, MM=month, DD=day)
    const birthYear = parseBirthYear(personalNumber);
    console.log(`   Birth Year: ${birthYear} (extracted from personal number)`);
    
    // Extract P-384 public key
    const publicKey = extractPublicKey(certificate);
    console.log(`   Public Key: P-384 (${publicKey.x.length} bytes per coordinate)`);
    console.log('✅ Data extracted successfully\n');
    
    // ============================================
    // STEP 4: Generate ZK Proof
    // ============================================
    console.log('🎯 Step 4: Generating zero-knowledge proof...');
    console.log('   This will prove age >= 18 WITHOUT revealing birth year');
    
    const proofData = await generateAgeProof({
        birthYear,      // From verified certificate
        publicKey       // From verified certificate
    });
    
    console.log('✅ Account creation data ready for blockchain\n');
    
    return proofData;
}

function publicKeyToFieldElements(publicKeyHex) {
    // Remove 0x prefix
    const pkClean = publicKeyHex.startsWith('0x') ? publicKeyHex.slice(2) : publicKeyHex;
    
    // publicKeyHex is 96 bytes (192 hex chars): 48 bytes X + 48 bytes Y
    const xHex = pkClean.substring(0, 96);
    const yHex = pkClean.substring(96, 192);
    
    const xBigInt = BigInt('0x' + xHex);
    const yBigInt = BigInt('0x' + yHex);
    
    // BN254 field modulus
    const fieldModulus = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
    
    return {
        x: (xBigInt % fieldModulus).toString(),
        y: (yBigInt % fieldModulus).toString()
    };
}
