/**
 * P-384 Utilities for eID Signature Handling
 */

export interface PublicKeyParts {
    xHigh: string;
    xLow: string;
    yHigh: string;
    yLow: string;
  }
  
  export interface SignatureParts {
    rHigh: string;
    rLow: string;
    sHigh: string;
    sLow: string;
  }
  
  /**
   * Split a 384-bit value (48 bytes) into high (128 bits) and low (256 bits)
   */
  export function split384Bit(hexValue: string): { high: string; low: string } {
    // Remove 0x prefix if present
    let hex = hexValue.startsWith('0x') ? hexValue.slice(2) : hexValue;
    
    // Pad to 96 hex chars (48 bytes)
    hex = hex.padStart(96, '0');
    
    // Split: first 32 hex chars (16 bytes / 128 bits) = high
    //        remaining 64 hex chars (32 bytes / 256 bits) = low
    const high = '0x' + hex.slice(0, 32);
    const low = '0x' + hex.slice(32);
    
    return { high, low };
  }
  
  /**
   * Parse 96-byte public key (x || y) into 4 parts for Solidity
   */
  export function parsePublicKey(publicKeyHex: string): PublicKeyParts {
    // Remove 0x prefix
    const hex = publicKeyHex.startsWith('0x') ? publicKeyHex.slice(2) : publicKeyHex;
    
    if (hex.length !== 192) {
      throw new Error(`Invalid public key length: ${hex.length}, expected 192 hex chars (96 bytes)`);
    }
    
    // First 48 bytes (96 hex chars) = X coordinate
    const xHex = '0x' + hex.slice(0, 96);
    const x = split384Bit(xHex);
    
    // Last 48 bytes (96 hex chars) = Y coordinate
    const yHex = '0x' + hex.slice(96, 192);
    const y = split384Bit(yHex);
    
    return {
      xHigh: x.high,
      xLow: x.low,
      yHigh: y.high,
      yLow: y.low,
    };
  }
  
  /**
   * Parse 96-byte raw signature (r || s) into 4 parts for Solidity
   */
  export function parseSignature(signatureHex: string): SignatureParts {
    // Remove 0x prefix
    const hex = signatureHex.startsWith('0x') ? signatureHex.slice(2) : signatureHex;
    
    if (hex.length !== 192) {
      throw new Error(`Invalid signature length: ${hex.length}, expected 192 hex chars (96 bytes)`);
    }
    
    // First 48 bytes (96 hex chars) = R component
    const rHex = '0x' + hex.slice(0, 96);
    const r = split384Bit(rHex);
    
    // Last 48 bytes (96 hex chars) = S component
    const sHex = '0x' + hex.slice(96, 192);
    const s = split384Bit(sHex);
    
    return {
      rHigh: r.high,
      rLow: r.low,
      sHigh: s.high,
      sLow: s.low,
    };
  }
  
  /**
   * Encode signature parts for UserOperation.signature field
   */
  export function encodeSignature(sig: SignatureParts): string {
    // ABI encode as: (uint128, uint128, uint128, uint128)
    const { ethers } = require('ethers');
    
    return ethers.utils.defaultAbiCoder.encode(
      ['uint128', 'uint128', 'uint128', 'uint128'],
      [sig.rHigh, sig.rLow, sig.sHigh, sig.sLow]
    );
  }
  
  /**
   * Get public key from eID server
   */
  export async function getPublicKeyFromEID(
    serverUrl: string = 'http://localhost:9000'
  ): Promise<PublicKeyParts> {
    const response = await fetch(`${serverUrl}/get-public-key`);
    
    if (!response.ok) {
      throw new Error(`Failed to get public key: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    return parsePublicKey(data.publicKey);
  }
  
  /**
   * Sign message with eID
   */
  export async function signWithEID(
    message: string,
    pin: string,
    serverUrl: string = 'http://localhost:9000'
  ): Promise<SignatureParts> {
    const response = await fetch(`${serverUrl}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, pin }),
    });
    
    if (!response.ok) {
      throw new Error(`Signing failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    // Parse the raw signature (r || s)
    return parseSignature(data.signature);
  }
  
  /**
   * Format address for display
   */
  export function formatAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  
  /**
   * Test all utilities with your actual public key
   */
  export function testUtilities() {
    const testPubKey = '0x7ad6879aacf91a8fb6cc1e9a7728a87845e880bef444eeeac67a678d25079520baeee625f312471cb0f297f757818c4aafec8a5365283858c954953e55df30ca29bdf699ac73bc995af1a2a02d37168850128617a22fb0f783531a4cd33fadec';
    
    console.log('Testing P-384 utilities...');
    console.log('Original public key:', testPubKey);
    
    const parts = parsePublicKey(testPubKey);
    console.log('\nParsed public key parts:');
    console.log('xHigh:', parts.xHigh);
    console.log('xLow: ', parts.xLow);
    console.log('yHigh:', parts.yHigh);
    console.log('yLow: ', parts.yLow);
    
    return parts;
  }