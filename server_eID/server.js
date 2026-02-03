const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { ethers } = require('ethers');
const snarkjs = require('snarkjs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PYTHON_HELPER = __dirname + '/server-helper.py';


// Helper function to call Python script
async function callPythonHelper(command, args = []) {
  const argString = args.join(' ');
  const cmd = `arch -x86_64 /usr/bin/python3 "${PYTHON_HELPER}" ${command} ${argString}`;
  
  console.log(`Executing: ${cmd.substring(0, 100)}...`);
  
  try {
    const { stdout, stderr } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
    
    if (stderr && !stderr.includes('public key:') && !stderr.includes('public numbers:')) {
      console.error('Python helper stderr:', stderr);
    }
    
    return JSON.parse(stdout);
  } catch (error) {
    console.error('Python helper error:', error);
    throw new Error(`Python helper failed: ${error.message}`);
  }
}

function parseBirthYear(personalCode) {
  const genderDigit = parseInt(personalCode[0]);
  const yearPart = parseInt(personalCode.substring(1, 3));
  
  let century;
  if (genderDigit <= 2) century = 1800;
  else if (genderDigit <= 4) century = 1900;
  else century = 2000;
  
  return century + yearPart;
}

// Helper to convert public key to field elements for ZK
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


app.post('/sign-userop', async (req, res) => {
  let pin = '853344'; // Default PIN, can be modified to accept from req.body
  try {
    const { userOpHash, pin = '853344' } = req.body;

    if (!userOpHash) {
      return res.status(400).json({ error: 'userOpHash is required' });
    }

    console.log('\n--- Signing User Operation Hash ---');
    console.log('UserOp Hash:', userOpHash);

    const hashToSign =  userOpHash.slice(2) // remove 0x prefix if present

    const args = [hashToSign, pin];
    const result = await callPythonHelper('sign', args);

    if (result.error) {
      console.error('Error:', result.error);
      return res.status(500).json(result);
    }
    console.log('Signature created successfully');
    console.log('Raw signature:', result.signature);

    const parsed = parseDERToSolidityFormat(result.DER_signature);

    res.json({
      signature: result.signature,
      DER_signature: result.DER_signature,
      messageHash: result.messageHash,
      parsed,
    });
  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

function parseDERToSolidityFormat(derHex) {
  // Remove '0x' if present
  if (derHex.startsWith('0x')) {
    derHex = derHex.slice(2);
  }

  const bytes = [];
  for (let i = 0; i < derHex.length; i += 2) {
    bytes.push(parseInt(derHex.substring(i, i + 2), 16));
  }

  let index = 0;
  if (bytes[index++] !== 0x30) throw new Error('Invalid DER signature');
  
  const totalLength = bytes[index++];
  
  // Parse R
  if (bytes[index++] !== 0x02) throw new Error('Invalid R INTEGER tag');
  const rLength = bytes[index++];
  const rBytes = bytes.slice(index, index + rLength);
  index += rLength;
  
  // Parse S
  if (bytes[index++] !== 0x02) throw new Error('Invalid S INTEGER tag');
  const sLength = bytes[index++];
  const sBytes = bytes.slice(index, index + sLength);
  
  // Remove leading zero if present
  const rValue = rBytes[0] === 0 ? rBytes.slice(1) : rBytes;
  const sValue = sBytes[0] === 0 ? sBytes.slice(1) : sBytes;
  
  // Convert to hex
  const r = '0x' + rValue.map(b => b.toString(16).padStart(2, '0')).join('');
  const s = '0x' + sValue.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Split into high/low (128-bit high, 256-bit low)
  const rPadded = r.slice(2).padStart(96, '0'); // 48 bytes = 96 hex chars
  const sPadded = s.slice(2).padStart(96, '0');
  
  const rHigh = '0x' + rPadded.slice(0, 32);    // First 16 bytes (128 bits)
  const rLow = '0x' + rPadded.slice(32);         // Last 32 bytes (256 bits)
  const sHigh = '0x' + sPadded.slice(0, 32);
  const sLow = '0x' + sPadded.slice(32);
  
  return {
    rHigh,
    rLow,
    sHigh,
    sLow,
  };
}


// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const result = await callPythonHelper('health');
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      error: error.message 
    });
  }
});

// Get public key from certificate endpoint
app.get('/get-public-key', async (req, res) => {
  try {
    console.log('\n--- Getting public key from certificate ---');
    
    const result = await callPythonHelper('get-pubkey');
    
    if (result.error) {
      console.error('✗ Error:', result.error);
      return res.status(500).json(result);
    }
    
    console.log('✓ Public key retrieved');
    console.log('Public key (96 bytes):', result.publicKey.substring(0, 50) + '...');
    
    res.json(result);
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get certificate endpoint
app.get('/certificate', async (req, res) => {
  try {
    console.log('\n--- Getting certificate ---');
    const result = await callPythonHelper('cert');
    
    if (result.error) {
      console.error('✗ Error:', result.error);
      return res.status(500).json(result);
    }
    
    console.log('✓ Certificate retrieved');
    res.json(result);
  } catch (error) {
    console.error('✗ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Sign message endpoint
app.post('/sign', async (req, res) => {
  try {
    const { message, pin } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    console.log('\n--- Signing message ---');
    console.log('Message:', message.substring(0, 50) + (message.length > 50 ? '...' : ''));
    console.log('Note: Card reader will prompt for PIN');
    
    // Call Python helper (PIN is hardcoded in Python helper for now)
    console.log(message)
    const args = [message, pin];
    const result = await callPythonHelper('sign', args);
    
    if (result.error) {
      console.error('✗ Error:', result.error);
      return res.status(500).json(result);
    }
    
    console.log('Signature created');
    console.log('Raw signature:', result.signature.substring(0, 30) + '...');
    if (result.DER_signature) {
      console.log('DER signature:', result.DER_signature.substring(0, 30) + '...');
    }
    res.json(result);
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Verify signature endpoint (using ecdsa library - verify2)
app.post('/verify', async (req, res) => {
  try {
    const { message, signature, publicKey } = req.body;
    
    if (!message || !signature) {
      return res.status(400).json({ error: 'Message and signature are required' });
    }
    
    console.log('\n--- Verifying signature (ecdsa library) ---');
    console.log('Message:', message.substring(0, 50) + (message.length > 50 ? '...' : ''));
    console.log('Signature:', signature.substring(0, 30) + '...');
    
    // Call Python helper with verify2 (ecdsa library)
    const args = publicKey 
      ? [message, signature, publicKey]
      : [message, signature];
    const result = await callPythonHelper('verify2', args);
    
    if (result.valid) {
      console.log('✓ Signature is VALID');
    } else {
      console.log('✗ Signature is INVALID');
      if (result.error) {
        console.log('  Reason:', result.error);
      }
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Verify signature endpoint (using cryptography library - verify)
app.post('/verify-crypto', async (req, res) => {
  try {
    const { message, signature, certificate } = req.body;
    
    if (!message || !signature) {
      return res.status(400).json({ error: 'Message and signature are required' });
    }
    
    console.log('\n--- Verifying signature (cryptography library) ---');
    console.log('Message:', message.substring(0, 50) + (message.length > 50 ? '...' : ''));
    console.log('Signature:', signature.substring(0, 30) + '...');
    
    // Call Python helper with verify (cryptography library)
    const args = certificate 
      ? [JSON.stringify(message), signature, certificate]
      : [JSON.stringify(message), signature];
    const result = await callPythonHelper('verify', args);
    
    if (result.valid) {
      console.log('✓ Signature is VALID');
    } else {
      console.log('✗ Signature is INVALID');
      if (result.error) {
        console.log('  Reason:', result.error);
      }
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/personal', async (req, res) => {
  try {
    console.log('\n--- Getting personal data ---');
    const result = await callPythonHelper('personal');
    
    if (result.error) {
      console.error('✗ Error:', result.error);
      return res.status(500).json(result);
    }
    
    console.log('✓ Personal data retrieved');
    console.log('Name:', result.personalData?.name || 'N/A');
    console.log('Personal Code:', result.personalData?.personalCode || 'N/A');
    
    res.json(result);
  } catch (error) {
    console.error('✗ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get data objects endpoint
app.get('/data-objects', async (req, res) => {
  try {
    console.log('\n--- Reading data objects ---');
    const result = await callPythonHelper('data');
    
    if (result.error) {
      console.error('✗ Error:', result.error);
      return res.status(500).json(result);
    }
    
    console.log('✓ Found', result.count, 'data objects');
    res.json(result);
  } catch (error) {
    console.error('✗ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get public key endpoint
app.get('/publickey', async (req, res) => {
  try {
    console.log('\n--- Getting public key ---');
    
    // Get certificate first
    const certResult = await callPythonHelper('cert');
    if (certResult.error) {
      return res.status(500).json({ error: certResult.error });
    }
    
    // Parse certificate to get public key
    // This is done in Python helper's get_public_key_from_cert function
    // For now, return certificate and client can extract public key
    res.json({
      certificate: certResult.certificate,
      message: "Parse certificate to extract public key coordinates"
    });
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// verify that certificate is signed by Lithuanian government CA
app.post('/verify-certificate', async (req, res) => {
  try {
    console.log('\n--- Verifying eID certificate signature ---');
    
    const result = await callPythonHelper('verify-cert');
    
    if (result.error) {
      console.error('✗ Certificate verification failed:', result.error);
      return res.status(500).json(result);
    }
    
    console.log('✓ Certificate signature is VALID');
    console.log('  Issued by:', result.issuer || 'Lithuanian Government CA');
    
    res.json(result);
  } catch (error) {
    console.error('✗ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Main ZK proof generation endpoint
app.post('/create-account-proof', async (req, res) => {
  try {
      console.log('\n' + '='.repeat(60));
      console.log('ZK Age Verification - Account Creation');
      console.log('='.repeat(60) + '\n');
      
      // Step 1: Verify Certificate
      console.log('🔐 Step 1/5: Verifying certificate...');
      const certVerify = await callPythonHelper('verify-cert');
      
      if (!certVerify.valid) {
          console.error(' Certificate validation FAILED');
          return res.status(403).json({ 
              error: 'INVALID_CERTIFICATE',
              message: certVerify.error || 'Certificate validation failed'
          });
      }
      console.log(' Certificate is valid');
      console.log(`  Issuer: ${certVerify.issuer}`);
      console.log(`  Valid until: ${certVerify.not_valid_after}\n`);
      
      // Step 2: Get Personal Data
      console.log('📋 Step 2/5: Extracting personal data...');
      const personalData = await callPythonHelper('personal');
      
      if (personalData.error) {
          return res.status(500).json({ 
              error: 'Failed to extract personal data',
              details: personalData.error 
          });
      }
      
      const personalCode = personalData.personalData.personalCode;
      const name = personalData.personalData.name;
      
      console.log(`  Name: ${name}`);
      console.log(`  Personal Code: ${personalCode}`);
      
      // Step 3: Parse Birth Year & Check Age
      console.log('\n🎂 Step 3/5: Verifying age...');
      const birthYear = parseBirthYear(personalCode);
      const currentYear = new Date().getFullYear();
      const age = currentYear - birthYear;
      
      console.log(`  Birth Year: ${birthYear} (from personal code)`);
      console.log(`  Current Year: ${currentYear}`);
      console.log(`  Age: ${age} years old`);
      
      if (age < 18) {
          console.error(`✗ Age verification FAILED (${age} < 18)`);
          return res.status(403).json({ 
              error: 'AGE_VERIFICATION_FAILED',
              message: 'Must be 18 years or older',
              age: age 
          });
      }
      console.log('✓ Age requirement met (18+)\n');
      
      // Step 4: Get Public Key
      console.log('🔑 Step 4/5: Extracting public key...');
      const pubKeyResult = await callPythonHelper('get-pubkey');
      
      if (pubKeyResult.error) {
          return res.status(500).json({ 
              error: 'Failed to extract public key',
              details: pubKeyResult.error 
          });
      }
      
      const publicKeyHex = pubKeyResult.publicKey; // 0x + 96 bytes
      console.log(`  Public Key: ${publicKeyHex.substring(0, 20)}... (${pubKeyResult.length} bytes)`);
      console.log('✓ Public key extracted\n');
      
      // Step 5: Generate ZK Proof
      console.log('🎯 Step 5/5: Generating zero-knowledge proof...');
      console.log('  This proves age >= 18 WITHOUT revealing birth year');
      
      const pkFields = publicKeyToFieldElements(publicKeyHex);
      
      const input = {
          birthYear: birthYear.toString(),
          publicKeyX: pkFields.x,
          publicKeyY: pkFields.y,
          currentYear: currentYear.toString()
      };
      
      console.log('  Generating proof (may take 3-5 seconds)...');
      const startTime = Date.now();
      
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
          input,
          path.join(__dirname, '../ZK/age-verification_js/age-verification.wasm'),
          path.join(__dirname, '../ZK/build/age_verification_final.zkey')
      );
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(`✓ Proof generated in ${elapsed}s`);
      console.log(`\n📤 Public (on-chain): Public Key Hash`);
      console.log(`🔒 Private (secret): Birth year, name, personal code`);
      
      // Format for Solidity
      const formattedProof = {
          a: [proof.pi_a[0], proof.pi_a[1]],
          b: [
              [proof.pi_b[0][1], proof.pi_b[0][0]],
              [proof.pi_b[1][1], proof.pi_b[1][0]]
          ],
          c: [proof.pi_c[0], proof.pi_c[1]]
      };
      
      console.log('\n✅ Account creation proof ready!');
      console.log('='.repeat(60) + '\n');
      
      res.json({
          success: true,
          proof: formattedProof,
          publicSignals: publicSignals,
          publicKey: publicKeyHex, // Full 0x + 96 bytes (will be prefixed with 0x04 on-chain)
          metadata: {
              age: age,
              name: name,
              proofGenerationTime: `${elapsed}s`
          }
      });
      
  } catch (error) {
      console.error('\n✗ Error:', error.message);
      console.error(error.stack);
      res.status(500).json({ 
          error: 'Proof generation failed',
          message: error.message 
      });
  }
});


// Start server
const PORT = 9000;
app.listen(PORT, () => {
  console.log('\n========================================');
  console.log(`eID Signing Server running on http://localhost:${PORT}`);
  console.log('========================================\n');
  console.log('✅ Using Python helper with ecdsa library');
  console.log('✅ Node.js stays native ARM64\n');
  console.log('Available endpoints:');
  console.log(`  GET  http://localhost:${PORT}/health`);
  console.log(`  GET  http://localhost:${PORT}/certificate`);
  console.log(`  GET  http://localhost:${PORT}/publickey`);
  console.log(`  POST http://localhost:${PORT}/sign`);
  console.log(`  POST http://localhost:${PORT}/verify          (ecdsa library - recommended)`);
  console.log(`  POST http://localhost:${PORT}/verify-crypto   (cryptography library)`);
  console.log('\nMake sure:');
  console.log('  1. Dependencies installed:');
  console.log('     arch -x86_64 /usr/bin/python3 -m pip install --user PyKCS11 ecdsa cryptography');
  console.log('  2. mCard Toolbox is running');
  console.log('  3. Card reader is connected');
  console.log('  4. eID card is inserted');
  console.log('  5. PIN is set in server-helper.py (default: 853344)\n');
  console.log('Test with: curl http://localhost:9000/health\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  process.exit(0);
});