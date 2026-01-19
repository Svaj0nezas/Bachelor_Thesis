'use client';

import { useState } from 'react';

export default function TestPasskey() {
  const [output, setOutput] = useState('Click the button to test...');

  const testPasskey = async () => {
    setOutput('Creating passkey...\nTouch ID should prompt now...');
    
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

      const response = credential.response as AuthenticatorAttestationResponse;
      const publicKey = response.getPublicKey();
      const algorithm = response.getPublicKeyAlgorithm();
      
      if (!publicKey) {
        throw new Error('No public key returned');
      }
      
      setOutput(`✅ SUCCESS!

Credential ID: ${credential.id}

Algorithm: ${algorithm} (should be -7 for ES256)

Public Key Length: ${publicKey.byteLength} bytes

Public Key (hex):
${Array.from(new Uint8Array(publicKey))
  .map(b => b.toString(16).padStart(2, '0'))
  .join('')}

✅ Your Mac's Touch ID works!
✅ Algorithm is ES256 (P-256)
✅ Ready for Level 2!`);
      
    } catch (error: any) {
      setOutput(`❌ ERROR: ${error.name}

${error.message}

Make sure:
- You clicked the button (not console)
- Touch the sensor when prompted
- Using Safari or Chrome
- Your Mac has Touch ID`);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Touch ID Test</h1>
        
        <button
          onClick={testPasskey}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 mb-6"
        >
          👆 Test Touch ID
        </button>
        
        <pre className="bg-gray-100 p-6 rounded-lg whitespace-pre-wrap">
          {output}
        </pre>
      </div>
    </div>
  );
}
