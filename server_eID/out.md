// eid-signing-server.js
// Local server that connects to mCard Toolbox via PKCS#11

const express = require('express');
const cors = require('cors');
const pkcs11js = require('pkcs11js');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// IMPORTANT: Update this path for your system
const PKCS11_PATHS = {
  win32: 'C:\\Program Files\\mCard Toolbox\\mcard-pkcs11.dll',
  darwin: '/Library/mCard/lib/mcard-pkcs11.so',
  linux: '/usr/lib/mcard-pkcs11.so'
};

const PKCS11_LIB = PKCS11_PATHS[process.platform] || PKCS11_PATHS.linux;

console.log(`Using PKCS#11 library: ${PKCS11_LIB}`);

let pkcs11 = new pkcs11js.PKCS11();

try {
  pkcs11.load(PKCS11_LIB);
  console.log('✓ PKCS#11 library loaded successfully');
} catch (error) {
  console.error('✗ Failed to load PKCS#11 library:', error.message);
  console.error('\nPlease update PKCS11_PATHS in the script with the correct path');
  console.error('Common locations:');
  console.error('  Windows: C:\\Program Files\\mCard Toolbox\\mcard-pkcs11.dll');
  console.error('  Mac: /Library/mCard Toolbox/mcard-pkcs11.dylib');
  console.error('  Linux: /usr/lib/mcard-pkcs11.so or ~/.mcard/mcard-pkcs11.so');
  process.exit(1);
}

// Helper function to find card and open session
async function openCardSession() {
  try {
    // Initialize PKCS#11
    pkcs11.C_Initialize();
    
    // Get slots
    const slots = pkcs11.C_GetSlotList(true);
    console.log(`Found ${slots.length} slots with tokens`);
    
    if (slots.length === 0) {
      throw new Error('No card detected. Please insert your eID card.');
    }
    
    // Get slot info
    const slotInfo = pkcs11.C_GetSlotInfo(slots[0]);
    console.log('Slot:', Buffer.from(slotInfo.slotDescription).toString().trim());
    
    // Get token info
    const tokenInfo = pkcs11.C_GetTokenInfo(slots[0]);
    console.log('Token:', Buffer.from(tokenInfo.label).toString().trim());
    
    // Open session
    const session = pkcs11.C_OpenSession(
      slots[0],
      pkcs11js.CKF_SERIAL_SESSION | pkcs11js.CKF_RW_SESSION
    );
    
    return { session, slot: slots[0] };
    
  } catch (error) {
    throw new Error(`Failed to open card session: ${error.message}`);
  }
}

// Helper function to close session
function closeSession(session) {
  try {
    pkcs11.C_CloseSession(session);
    pkcs11.C_Finalize();
  } catch (error) {
    console.error('Error closing session:', error.message);
  }
}

// Endpoint: Get certificate from card
app.get('/certificate', async (req, res) => {
  let session = null;
  
  try {
    console.log('\n--- Getting certificate ---');
    
    const { session: sess } = await openCardSession();
    session = sess;
    
    // Find certificate
    const template = [
      { type: pkcs11js.CKA_CLASS, value: pkcs11js.CKO_CERTIFICATE },
      { type: pkcs11js.CKA_CERTIFICATE_TYPE, value: pkcs11js.CKC_X_509 }
    ];
    
    pkcs11.C_FindObjectsInit(session, template);
    const objects = pkcs11.C_FindObjects(session, 10);
    pkcs11.C_FindObjectsFinal(session);
    
    console.log(`Found ${objects.length} certificates`);
    
    if (objects.length === 0) {
      throw new Error('No certificate found on card');
    }
    
    // Get certificate data
    const certData = pkcs11.C_GetAttributeValue(session, objects[0], [
      { type: pkcs11js.CKA_VALUE }
    ])[0].value;
    
    // Parse certificate to get public key
    const cert = require('crypto').X509Certificate
      ? new require('crypto').X509Certificate(certData)
      : null;
    
    const response = {
      certificate: '0x' + certData.toString('hex'),
      certificateBase64: certData.toString('base64')
    };
    
    if (cert) {
      response.subject = cert.subject;
      response.issuer = cert.issuer;
      response.validFrom = cert.validFrom;
      response.validTo = cert.validTo;
      response.publicKey = cert.publicKey.export({ type: 'spki', format: 'der' }).toString('hex');
    }
    
    closeSession(session);
    
    console.log('✓ Certificate retrieved');
    res.json(response);
    
  } catch (error) {
    if (session) closeSession(session);
    console.error('✗ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Sign data with card
app.post('/sign', async (req, res) => {
  let session = null;
  
  try {
    const { message, pin } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    console.log('\n--- Signing message ---');
    console.log('Message:', message.substring(0, 50) + '...');
    
    const { session: sess } = await openCardSession();
    session = sess;
    
    // Login with PIN if provided
    if (pin) {
      console.log('Logging in with PIN...');
      pkcs11.C_Login(session, pkcs11js.CKU_USER, Buffer.from(pin));
      console.log('✓ Login successful');
    } else {
      console.log('⚠ No PIN provided - card may prompt for PIN');
    }
    
    // Find private key for signing
    const template = [
      { type: pkcs11js.CKA_CLASS, value: pkcs11js.CKO_PRIVATE_KEY },
      { type: pkcs11js.CKA_SIGN, value: true }
    ];
    
    pkcs11.C_FindObjectsInit(session, template);
    const objects = pkcs11.C_FindObjects(session, 10);
    pkcs11.C_FindObjectsFinal(session);
    
    console.log(`Found ${objects.length} signing keys`);
    
    if (objects.length === 0) {
      throw new Error('No signing key found on card');
    }
    
    // Get key attributes
    const keyAttrs = pkcs11.C_GetAttributeValue(session, objects[0], [
      { type: pkcs11js.CKA_KEY_TYPE },
      { type: pkcs11js.CKA_LABEL }
    ]);
    
    const keyType = keyAttrs[0].value.readUInt32LE(0);
    const keyLabel = keyAttrs[1].value.toString();
    console.log('Key type:', keyType === pkcs11js.CKK_EC ? 'ECDSA' : 'Unknown');
    console.log('Key label:', keyLabel);
    
    // Hash the message with SHA-384
    const messageBuffer = Buffer.from(message, 'utf8');
    const hash = crypto.createHash('sha384').update(messageBuffer).digest();
    console.log('Message hash (SHA-384):', hash.toString('hex'));
    
    // Sign with ECDSA
    const mechanism = { mechanism: pkcs11js.CKM_ECDSA };
    pkcs11.C_SignInit(session, mechanism, objects[0]);
    const signature = pkcs11.C_Sign(session, hash);
    
    console.log('✓ Signature created');
    console.log('Signature length:', signature.length, 'bytes');
    
    // Logout and close
    if (pin) {
      pkcs11.C_Logout(session);
    }
    closeSession(session);
    
    res.json({
      signature: '0x' + signature.toString('hex'),
      signatureBase64: signature.toString('base64'),
      messageHash: '0x' + hash.toString('hex'),
      algorithm: 'ecdsa-with-SHA384'
    });
    
  } catch (error) {
    if (session) {
      try {
        pkcs11.C_Logout(session);
      } catch (e) {}
      closeSession(session);
    }
    console.error('✗ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  try {
    // Quick check if PKCS#11 is working
    pkcs11.C_Initialize();
    const slots = pkcs11.C_GetSlotList(true);
    pkcs11.C_Finalize();
    
    res.json({
      status: 'ok',
      cardsDetected: slots.length,
      pkcs11Library: PKCS11_LIB
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// Start server
const PORT = 9000;
app.listen(PORT, () => {
  console.log('\n========================================');
  console.log(`eID Signing Server running on http://localhost:${PORT}`);
  console.log('========================================\n');
  console.log('Available endpoints:');
  console.log(`  GET  http://localhost:${PORT}/health`);
  console.log(`  GET  http://localhost:${PORT}/certificate`);
  console.log(`  POST http://localhost:${PORT}/sign`);
  console.log('\nMake sure:');
  console.log('  1. mCard Toolbox is running');
  console.log('  2. Card reader is connected');
  console.log('  3. eID card is inserted');
  console.log('\nTest with: curl http://localhost:9000/health\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  process.exit(0);
});