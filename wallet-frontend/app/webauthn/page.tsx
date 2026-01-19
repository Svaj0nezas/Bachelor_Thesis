'use client';

import { useState } from 'react';

export default function TestTouchID() {
  const [output, setOutput] = useState('Click Step 1 first...');
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [publicKeyX, setPublicKeyX] = useState<string | null>(null);
  const [publicKeyY, setPublicKeyY] = useState<string | null>(null);

  const bytesToHex = (bytes: Uint8Array): string => {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  // FIXED DER PARSING
  const parseDERSignature = (derBytes: Uint8Array): { r: string; s: string } => {
    if (derBytes[0] !== 0x30) {
      throw new Error('Invalid DER signature: must start with 0x30');
    }
    
    let offset = 2; // Skip 0x30 and total length
    
    // Parse r
    if (derBytes[offset] !== 0x02) {
      throw new Error(`Invalid DER: expected 0x02 for r, got 0x${derBytes[offset].toString(16)}`);
    }
    offset++; // Skip 0x02
    
    const rLength = derBytes[offset];
    offset++; // Skip length byte
    
    let rStart = offset;
    // Skip leading zero if present (DER encoding for positive numbers)
    if (derBytes[rStart] === 0x00) {
      rStart++;
    }
    
    const rBytes = derBytes.slice(rStart, offset + rLength);
    offset += rLength; // Move past r
    
    // Parse s
    if (derBytes[offset] !== 0x02) {
      throw new Error(`Invalid DER: expected 0x02 for s, got 0x${derBytes[offset].toString(16)}`);
    }
    offset++; // Skip 0x02
    
    const sLength = derBytes[offset];
    offset++; // Skip length byte
    
    let sStart = offset;
    // Skip leading zero if present
    if (derBytes[sStart] === 0x00) {
      sStart++;
    }
    
    const sBytes = derBytes.slice(sStart, offset + sLength);
    
    return {
      r: '0x' + bytesToHex(rBytes),
      s: '0x' + bytesToHex(sBytes)
    };
  };

  const step1CreatePasskey = async () => {
    setOutput('Creating passkey...');

    try {
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: {
            name: "Test",
            id: window.location.hostname
          },
          user: {
            id: crypto.getRandomValues(new Uint8Array(16)),
            name: "test@example.com",
            displayName: "Test User"
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 }
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required"
          }
        }
      }) as PublicKeyCredential;

      const id = credential.id;
      setCredentialId(id);

      const response = credential.response as AuthenticatorAttestationResponse;
      const publicKey = response.getPublicKey();
      
      if (!publicKey) {
        throw new Error('No public key returned');
      }
      
      const publicKeyBytes = new Uint8Array(publicKey);

      // Parse SPKI
      let offset = -1;
      for (let i = 0; i < publicKeyBytes.length; i++) {
        if (publicKeyBytes[i] === 0x04) {
          offset = i + 1;
          break;
        }
      }

      const xBytes = publicKeyBytes.slice(offset, offset + 32);
      const yBytes = publicKeyBytes.slice(offset + 32, offset + 64);

      const x = bytesToHex(xBytes);
      const y = bytesToHex(yBytes);
      
      setPublicKeyX(x);
      setPublicKeyY(y);

      setOutput(`✅ Passkey created!

Credential ID: ${id}
Public Key X: 0x${x}
Public Key Y: 0x${y}

Now click Step 2 to sign a test hash.`);

    } catch (error: any) {
      setOutput(`❌ Error: ${error.message}`);
    }
  };

  const step2SignHash = async () => {
    if (!credentialId) {
      alert('Create passkey first (Step 1)');
      return;
    }

    setOutput('Signing with Touch ID...');

    // Test hash
    const testHash = '0x1f22d1efc5b497cf016877bfb7b8a4ce44c7daedb34ac65028799fd5983cecb2';
    const hashBytes = new Uint8Array(
      testHash.slice(2).match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );

    try {
      // Convert credential ID from base64url to bytes
      const base64 = credentialId.replace(/-/g, '+').replace(/_/g, '/');
      const credIdBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: hashBytes,
          rpId: window.location.hostname,
          allowCredentials: [{
            type: "public-key",
            id: credIdBytes
          }],
          userVerification: "required"
        }
      }) as PublicKeyCredential;

      const response = assertion.response as AuthenticatorAssertionResponse;

      // Get all components
      const authenticatorData = new Uint8Array(response.authenticatorData);
      const clientDataJSON = new TextDecoder().decode(response.clientDataJSON);
      const signature = new Uint8Array(response.signature);

      // Parse DER signature (FIXED!)
      const { r, s } = parseDERSignature(signature);

      // Calculate what was actually signed
      const clientDataHash = await crypto.subtle.digest('SHA-256', response.clientDataJSON);
      const clientDataHashArray = new Uint8Array(clientDataHash);
      
      const signedMessage = new Uint8Array(authenticatorData.length + clientDataHashArray.length);
      signedMessage.set(authenticatorData, 0);
      signedMessage.set(clientDataHashArray, authenticatorData.length);
      
      const messageHash = await crypto.subtle.digest('SHA-256', signedMessage);
      const messageHashHex = '0x' + bytesToHex(new Uint8Array(messageHash));

      setOutput(`🔍 TOUCH ID SIGNATURE ANALYSIS

=== WHAT WE ASKED TO SIGN ===
Challenge (Raw Hash): ${testHash}

=== WHAT TOUCH ID ACTUALLY SIGNED ===

1. AUTHENTICATOR DATA (${authenticatorData.length} bytes):
${bytesToHex(authenticatorData)}

2. CLIENT DATA JSON (${clientDataJSON.length} chars):
${clientDataJSON}

3. SHA-256(clientDataJSON):
${bytesToHex(clientDataHashArray)}

4. SIGNED MESSAGE (authData + clientDataHash):
${bytesToHex(signedMessage)}

5. SHA-256(SIGNED MESSAGE) - This is what the signature is for:
${messageHashHex}

=== SIGNATURE (r, s) ===
r: ${r}
s: ${s}

r length: ${(r.length - 2) / 2} bytes
s length: ${(s.length - 2) / 2} bytes

=== KEY INSIGHT ===

❌ Challenge we gave: ${testHash}
✅ Hash Touch ID signed: ${messageHashHex}

These are COMPLETELY DIFFERENT!

=== WHAT THIS MEANS ===

The signature (r, s) is valid for messageHash, NOT for the raw challenge!

To verify this in your contract, you need:
1. authenticatorData
2. clientDataJSON  
3. Reconstruct the message
4. Hash it with SHA-256
5. Verify signature against THAT hash

This is exactly what Base's WebAuthn.sol does! ✅`);

    } catch (error: any) {
      setOutput(`❌ Error: ${error.message}
      
${error.stack || ''}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">🔍 Touch ID Format Investigation</h1>

        <div className="space-y-4 mb-8 text-black">
          <button
            onClick={step1CreatePasskey}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold"
          >
            Step 1: Create Passkey
          </button>

          <button
            onClick={step2SignHash}
            className="bg-green-600  px-6 py-3 rounded-lg hover:bg-green-700 font-semibold ml-4 text-black"
          >
            Step 2: Sign Test Hash
          </button>
        </div>

        <h2 className="text-xl font-bold mb-4 text-black">Output:</h2>
        <pre className="bg-white p-6 rounded-lg border border-gray-200 whitespace-pre-wrap font-mono text-sm overflow-x-auto text-black">
          {output}
        </pre>
      </div>
    </div>
  );
}