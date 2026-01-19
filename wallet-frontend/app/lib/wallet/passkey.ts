// lib/wallet/passkey.ts

export interface PasskeyCredential {
    id: string;              // Credential ID (base64)
    publicKeyX: bigint;      // X coordinate
    publicKeyY: bigint;      // Y coordinate
  }
  
  export interface PasskeySignature {
    r: bigint;  // Signature r
    s: bigint;  // Signature s
  }

  export interface WebAuthnSignature {
    authenticatorData: Uint8Array;
    clientDataJSON: string;
    challengeIndex: number;
    typeIndex: number;
    r: bigint;
    s: bigint;
  }
  
  /**
   * Create a new passkey and extract public key coordinates
   */
  export async function createPasskey(username: string): Promise<PasskeyCredential> {
    console.log('🔐 Creating passkey for:', username);
    
    // Generate random challenge
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    
    try {
      // Call WebAuthn API
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          
          rp: {
            name: "ERC-4337 Level 2 Wallet",
            id: window.location.hostname,
          },
          
          user: {
            id: crypto.getRandomValues(new Uint8Array(16)),
            name: username,
            displayName: username,
          },
          
          pubKeyCredParams: [
            {
              type: "public-key",
              alg: -7, // ES256 (ECDSA with P-256)
            },
          ],
          
          authenticatorSelection: {
            authenticatorAttachment: "platform", // Use device's authenticator
            requireResidentKey: true,
            userVerification: "required", // Require biometric
          },
          
          timeout: 60000,
          attestation: "none",
        },
      }) as PublicKeyCredential;
      
      console.log('✅ Passkey created!');
      
      // Extract public key
      const response = credential.response as AuthenticatorAttestationResponse;
      const publicKeyBuffer = response.getPublicKey();
      
      if (!publicKeyBuffer) {
        throw new Error('No public key returned from authenticator');
      }
      
      const publicKeyBytes = new Uint8Array(publicKeyBuffer);
      console.log('Public key length:', publicKeyBytes.length, 'bytes');
      
      // Parse SPKI format to get X and Y
      const { x, y } = parseSPKIPublicKey(publicKeyBytes);
      
      return {
        id: credential.id,
        publicKeyX: x,
        publicKeyY: y,
      };
      
    } catch (error: any) {
      console.error('❌ Failed to create passkey:', error);
      throw new Error(`Passkey creation failed: ${error.message}`);
    }
  }
  
  /**
   * Sign a message hash with an existing passkey
   */
  export async function signWithPasskey(
    credentialId: string,
    messageHash: `0x${string}`
  ): Promise<WebAuthnSignature> {
    console.log('✍️ Signing with passkey:', credentialId);
    console.log('Message hash:', messageHash);
  
    // Convert credentialId from base64url to bytes
    const base64 = credentialId.replace(/-/g, '+').replace(/_/g, '/');
    const credentialIdBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  
    // Convert hash to bytes for challenge
    const challenge = hexToBytes(messageHash);
  
    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: challenge,
          rpId: window.location.hostname,
          allowCredentials: [
            {
              type: 'public-key',
              id: credentialIdBytes,
            },
          ],
          userVerification: 'required',
        },
      });
  
      if (!assertion) {
        throw new Error('No assertion returned');
      }
  
      const cred = assertion as PublicKeyCredential;
      const response = cred.response as AuthenticatorAssertionResponse;
  
      // Extract authenticatorData
      const authenticatorData = new Uint8Array(response.authenticatorData);
  
      // Extract clientDataJSON
      const clientDataJSON = new TextDecoder().decode(response.clientDataJSON);
  
      // Find challengeIndex - where "challenge":" appears
      const challengeIndex = clientDataJSON.indexOf('"challenge":"');
      if (challengeIndex === -1) {
        throw new Error('Challenge not found in clientDataJSON');
      }
  
      // Find typeIndex - where "type":" appears
      const typeIndex = clientDataJSON.indexOf('"type":"');
      if (typeIndex === -1) {
        throw new Error('Type not found in clientDataJSON');
      }
  
      // Parse DER signature
      const signature = new Uint8Array(response.signature);
      const { r, s } = parseDERSignature(signature);
  
      console.log('✅ Signature obtained!');
      console.log('Signature length:', signature.length, 'bytes');
      console.log('Parsed signature:');
      console.log('  r:', '0x' + r.toString(16));
      console.log('  s:', '0x' + s.toString(16));
      console.log('AuthenticatorData length:', authenticatorData.length);
      console.log('ClientDataJSON length:', clientDataJSON.length);
      console.log('ChallengeIndex:', challengeIndex);
      console.log('TypeIndex:', typeIndex);
  
      return {
        authenticatorData,
        clientDataJSON,
        challengeIndex,
        typeIndex,
        r,
        s,
      };
    } catch (error) {
      console.error('Passkey signing failed:', error);
      throw error;
    }
  }
  
  // Helper functions
  function parseSPKIPublicKey(publicKeyBytes: Uint8Array): { x: bigint; y: bigint } {
    console.log("=== SPKI PARSING DEBUG ===");
    console.log("Total length:", publicKeyBytes.length, "bytes");
    console.log("Full hex:", bytesToHex(publicKeyBytes));
    
    // Find 0x04
    let offset = -1;
    for (let i = 0; i < publicKeyBytes.length; i++) {
      if (publicKeyBytes[i] === 0x04) {
        offset = i + 1;
        console.log("Found 0x04 at position:", i);
        break;
      }
    }
    
    if (offset === -1) {
      throw new Error('Could not find uncompressed point indicator (0x04)');
    }
    
    const xBytes = publicKeyBytes.slice(offset, offset + 32);
    const yBytes = publicKeyBytes.slice(offset + 32, offset + 64);
    
    console.log("X bytes length:", xBytes.length);
    console.log("Y bytes length:", yBytes.length);
    console.log("X hex:", bytesToHex(xBytes));
    console.log("Y hex:", bytesToHex(yBytes));
    
    if (xBytes.length !== 32 || yBytes.length !== 32) {
      throw new Error(`Invalid key lengths: X=${xBytes.length}, Y=${yBytes.length}`);
    }
    
    const x = bytesToBigInt(xBytes);
    const y = bytesToBigInt(yBytes);
    
    console.log("X BigInt:", x.toString());
    console.log("Y BigInt:", y.toString());
    console.log("=========================");
    
    return { x, y };
  }
  
  function parseDERSignature(derBytes: Uint8Array): { r: bigint; s: bigint } {
    // Step 1: Verify it starts with 0x30 (SEQUENCE tag)
    if (derBytes[0] !== 0x30) {
      throw new Error('Invalid DER signature: must start with 0x30');
    }
    
    let offset = 2; // Skip 0x30 and total length
    
    // Step 2: Parse r
    if (derBytes[offset] !== 0x02) {
      throw new Error('Invalid DER signature: expected 0x02 for r');
    }
    offset++; // Skip 0x02
    
    const rLength = derBytes[offset];
    offset++; // Skip length byte
    
    // Skip leading zero if present (DER encoding adds 0x00 if high bit is set)
    let rStart = offset;
    if (derBytes[rStart] === 0x00) {
      rStart++;
    }
    
    const rBytes = derBytes.slice(rStart, offset + rLength);
    offset += rLength;
    
    // Step 3: Parse s
    if (derBytes[offset] !== 0x02) {
      throw new Error('Invalid DER signature: expected 0x02 for s');
    }
    offset++; // Skip 0x02
    
    const sLength = derBytes[offset];
    offset++; // Skip length byte
    
    // Skip leading zero if present
    let sStart = offset;
    if (derBytes[sStart] === 0x00) {
      sStart++;
    }
    
    const sBytes = derBytes.slice(sStart, offset + sLength);
    
    // Step 4: Convert to BigInt
    const r = bytesToBigInt(rBytes);
    const s = bytesToBigInt(sBytes);
    
    console.log('Parsed signature:');
    console.log('  r:', '0x' + bytesToHex(rBytes));
    console.log('  s:', '0x' + bytesToHex(sBytes));
    
    return { r, s };
  }

  function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  function bytesToBigInt(bytes: Uint8Array): bigint {
    const hex = bytesToHex(bytes);
    return BigInt('0x' + hex);
  }  

  function base64urlToBytes(base64url: string): Uint8Array {
    // Replace URL-safe chars
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    
    // Decode base64
    const binary = atob(base64);
    
    // Convert to Uint8Array
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    return bytes;
  }

  function hexToBytes(hex: string): Uint8Array {
    // Remove 0x prefix if present
    if (hex.startsWith('0x')) {
      hex = hex.slice(2);
    }
    
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    
    return bytes;
  }