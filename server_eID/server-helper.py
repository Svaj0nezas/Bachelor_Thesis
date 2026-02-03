#!/usr/bin/env python3
"""
pkcs11-helper.py
Helper script to sign with eID card via PKCS#11
Runs under Rosetta (x86_64) to access mCard library
"""

import sys
import json
import hashlib
from PyKCS11 import *
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature, decode_dss_signature
from cryptography import x509
from cryptography.x509 import load_pem_x509_certificate
import ecdsa

PKCS11_LIB = "/Library/mCard/lib/mcard-pkcs11.so"

def get_public_key_from_cert():
    """Extract public key coordinates from certificate"""
    try:
        pkcs11 = PyKCS11Lib()
        pkcs11.load(PKCS11_LIB)
        
        slots = pkcs11.getSlotList(tokenPresent=True)
        if not slots:
            return None, "No card detected"
        
        session = pkcs11.openSession(slots[0], CKF_SERIAL_SESSION | CKF_RW_SESSION)
        certs = session.findObjects([(CKA_CLASS, CKO_CERTIFICATE)])
        
        if not certs:
            session.closeSession()
            return None, "No certificate found"
        
        cert_der = bytes(session.getAttributeValue(certs[0], [CKA_VALUE])[0])
        session.closeSession()
        
        cert = x509.load_der_x509_certificate(cert_der, default_backend())
        public_key = cert.public_key()
        print("public key: ", public_key, file=sys.stderr)
        
        # Get public key bytes (uncompressed format: x || y)
        public_numbers = public_key.public_numbers()
        print("public numbers: ", public_numbers, file=sys.stderr)
        
        # For P-384, x and y are 48 bytes each
        x_bytes = public_numbers.x.to_bytes(48, byteorder='big')
        y_bytes = public_numbers.y.to_bytes(48, byteorder='big')
        
        # Uncompressed format: x || y (no 0x04 prefix)
        public_key_bytes = x_bytes + y_bytes  # 96 bytes total
        
        return public_key_bytes, None
        
    except Exception as e:
        print(f"Error in get_public_key_from_cert: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return None, str(e)

def raw_to_der_signature(raw_sig_bytes):
    """Convert raw ECDSA signature (r||s) to DER format for P-384"""
    # P-384 has 48-byte r and s values
    if len(raw_sig_bytes) != 96:
        raise ValueError(f"Invalid raw signature length: {len(raw_sig_bytes)}, expected 96 for P-384")
    
    # Split into r and s
    r_bytes = raw_sig_bytes[:48]
    s_bytes = raw_sig_bytes[48:]
    
    # Convert to integers
    r = int.from_bytes(r_bytes, byteorder='big')
    s = int.from_bytes(s_bytes, byteorder='big')
    
    # Encode as DER
    der_sig = encode_dss_signature(r, s)
    return der_sig

def is_der_signature(sig_bytes):
    """Check if signature is in DER format"""
    # DER signatures start with 0x30 (SEQUENCE tag)
    return len(sig_bytes) > 0 and sig_bytes[0] == 0x30

def sign_message(message, pin=853344):
    """Sign a message with eID card"""
    try:
        # Load PKCS#11 library
        pkcs11 = PyKCS11Lib()
        pkcs11.load(PKCS11_LIB)
        
        # Get card slots (use high-level API)
        slots = pkcs11.getSlotList(tokenPresent=True)
        if not slots:
            return {"error": "No card detected"}
        
        # Open session (use high-level API)
        session = pkcs11.openSession(slots[0], CKF_SERIAL_SESSION | CKF_RW_SESSION)
        
        # Login if PIN provided
        if pin:
            try: 
                session.login(pin)
            except Exception as e:
                session.closeSession()
                return {"error": f"Login failed: {str(e)}"}
            
        # Find signing key
        privKey = session.findObjects([(CKA_CLASS, CKO_PRIVATE_KEY), (CKA_SIGN, True)])[0]
        
        # Hash message with SHA-384, no need for level 3
        
        if message.startswith("0x"):
            message = message[2:]

        message_bytes = bytes.fromhex(message)   # 32 raw bytes
        # hash_value = hashlib.sha384(message_bytes).digest()
        
        # Sign with ECDSA
        signature = session.sign(privKey, message_bytes, Mechanism(CKM_ECDSA))
        
        # Cleanup
        if pin:
            session.logout()
        session.closeSession()
        
        # Return result
        sig_bytes = bytes(signature)
        
        
        # PKCS#11 returns raw signature (r||s), convert to DER
        der_signature = raw_to_der_signature(sig_bytes)
        
        return {
            "signature": "0x" + sig_bytes.hex(),
            "DER_signature": "0x" + der_signature.hex(),
            "algorithm": "ecdsa-with-SHA384"
        }
        
    except Exception as e:
        return {"error": str(e)}

def get_certificate():
    """Get certificate from card"""
    try:
        pkcs11 = PyKCS11Lib()
        pkcs11.load(PKCS11_LIB)
        
        slots = pkcs11.getSlotList(tokenPresent=True)
        if not slots:
            return {"error": "No card detected"}
        
        # Open session with R/W flags (more compatible)
        session = pkcs11.openSession(slots[0], CKF_SERIAL_SESSION | CKF_RW_SESSION)
        
        # Try to find certificate using simpler template
        try:
            certs = session.findObjects([(CKA_CLASS, CKO_CERTIFICATE)])
        except Exception as e:
            # If findObjects fails, try alternative approach
            session.closeSession()
            return {"error": f"Could not search for certificates: {str(e)}"}
        
        if not certs or len(certs) == 0:
            session.closeSession()
            return {"error": "No certificate found"}
        
        # Get certificate data
        try:
            cert_attrs = session.getAttributeValue(certs[0], [CKA_VALUE])
            cert_der = bytes(cert_attrs[0])
        except Exception as e:
            session.closeSession()
            return {"error": f"Could not read certificate: {str(e)}"}
        
        session.closeSession()
        
        return {
            "certificate": "0x" + cert_der.hex(),
            "certificateBase64": cert_der.hex()
        }
        
    except Exception as e:
        return {"error": str(e)}

def check_health():
    """Check if card is accessible"""
    try:
        pkcs11 = PyKCS11Lib()
        pkcs11.load(PKCS11_LIB)
        
        slots = pkcs11.getSlotList(tokenPresent=True)
        
        return {
            "status": "ok",
            "cardsDetected": len(slots),
            "pkcs11Library": PKCS11_LIB
        }
        
    except Exception as e:
        return {"status": "error", "error": str(e)}
    
def verify_signature(message, signature_hex, certificate_hex=None):
    """Verify ECDSA P-384 signature"""
    try:
        # If no certificate provided, try to read from card
        if not certificate_hex:
            cert_result = get_certificate()
            if "error" in cert_result:
                return {"valid": False, "error": "Could not get certificate: " + cert_result["error"]}
            certificate_hex = cert_result["certificate"]
        
        # Remove 0x prefix if present
        if certificate_hex.startswith("0x"):
            certificate_hex = certificate_hex[2:]
        if signature_hex.startswith("0x"):
            signature_hex = signature_hex[2:]
        
        # Parse certificate
        cert_bytes = bytes.fromhex(certificate_hex)
        cert = x509.load_der_x509_certificate(cert_bytes, default_backend())
        
        # Get public key from certificate
        public_key = cert.public_key()
        
        # Verify it's an EC key with P-384
        if not isinstance(public_key, ec.EllipticCurvePublicKey):
            return {"valid": False, "error": "Certificate does not contain EC public key"}
        
        if not isinstance(public_key.curve, ec.SECP384R1):
            return {"valid": False, "error": f"Wrong curve: {public_key.curve.name}, expected secp384r1"}
        
        # Hash the message with SHA-384
        message_bytes = message.encode('utf-8')
        hash_value = hashlib.sha384(message_bytes).digest()
        
        # Parse signature bytes
        signature_bytes = bytes.fromhex(signature_hex)
        
        # Auto-detect format and convert if needed
        if is_der_signature(signature_bytes):
            # Already DER format
            der_signature = signature_bytes
            sig_format = "DER"
        else:
            # Raw format (r||s), convert to DER
            try:
                der_signature = raw_to_der_signature(signature_bytes)
                sig_format = "RAW (converted to DER)"
            except ValueError as e:
                return {"valid": False, "error": f"Invalid signature format: {str(e)}"}
        
        # Verify signature
        try:
            public_key.verify(
                der_signature,
                hash_value,
                ec.ECDSA(hashes.SHA384())
            )
            return {
                "valid": True,
                "message": message,
                "messageHash": "0x" + hash_value.hex(),
                "signature": "0x" + signature_hex,
                "signatureDER": "0x" + der_signature.hex(),
                "signatureFormat": sig_format,
                "algorithm": "ecdsa-with-SHA384",
                "curve": "secp384r1 (P-384)"
            }
        except Exception as verify_error:
            return {
                "valid": False,
                "error": f"Signature verification failed: {str(verify_error)}",
                "message": message,
                "messageHash": "0x" + hash_value.hex()
            }
        
    except Exception as e:
        return {"valid": False, "error": str(e)}
    
def verify_signature2(message, signature_hex, public_key_hex=None):
    """Verify ECDSA P-384 signature using ecdsa library"""
    try:
        # Get public key
        if not public_key_hex:
            public_key_bytes, error = get_public_key_from_cert()
            if error:
                return {"valid": False, "error": f"Could not get public key: {error}"}
        else:
            # Remove 0x prefix
            if public_key_hex.startswith("0x"):
                public_key_hex = public_key_hex[2:]
            public_key_bytes = bytes.fromhex(public_key_hex)
        
        # Remove 0x prefix from signature
        if signature_hex.startswith("0x"):
            signature_hex = signature_hex[2:]
        signature_bytes = bytes.fromhex(signature_hex)
        
        # Check if signature is 96 bytes (raw format for P-384)
        if len(signature_bytes) != 96:
            return {
                "valid": False, 
                "error": f"Invalid signature length: {len(signature_bytes)} bytes, expected 96 for P-384"
            }
        
        # Check if public key is 96 bytes (x || y, 48 bytes each)
        if len(public_key_bytes) != 96:
            return {
                "valid": False,
                "error": f"Invalid public key length: {len(public_key_bytes)} bytes, expected 96 for P-384"
            }
        
        # Create VerifyingKey from public key bytes
        # ecdsa library: for P-384, pass x||y (96 bytes)
        vk = ecdsa.VerifyingKey.from_string(
            public_key_bytes, 
            curve=ecdsa.NIST384p,  # P-384 curve
            hashfunc=hashlib.sha384
        )
        
        # Hash the message
        message_bytes = message.encode('utf-8')
        hash_value = hashlib.sha384(message_bytes).digest()
        
        # Verify signature
        # ecdsa library expects raw signature (r || s)
        try:
            vk.verify(signature_bytes, message_bytes, hashfunc=hashlib.sha384)
            return {
                "valid": True,
                "message": message,
                "messageHash": "0x" + hash_value.hex(),
                "signature": "0x" + signature_hex,
                "publicKey": "0x" + public_key_bytes.hex(),
                "algorithm": "ecdsa-with-SHA384",
                "curve": "secp384r1 (P-384)"
            }
        except ecdsa.BadSignatureError as e:
            return {
                "valid": False,
                "error": f"Signature verification failed: {str(e)}",
                "message": message,
                "messageHash": "0x" + hash_value.hex()
            }
        
    except Exception as e:
        return {"valid": False, "error": str(e)}
        
def get_personal_data():
    """Extract personal data from eID card certificate"""
    try:
        pkcs11 = PyKCS11Lib()
        pkcs11.load(PKCS11_LIB)
        
        slots = pkcs11.getSlotList(tokenPresent=True)
        if not slots:
            return {"error": "No card detected"}
        
        session = pkcs11.openSession(slots[0], CKF_SERIAL_SESSION | CKF_RW_SESSION)
        certs = session.findObjects([(CKA_CLASS, CKO_CERTIFICATE)])
        
        if not certs:
            session.closeSession()
            return {"error": "No certificate found"}
        
        # Get certificate
        cert_der = bytes(session.getAttributeValue(certs[0], [CKA_VALUE])[0])
        cert = x509.load_der_x509_certificate(cert_der, default_backend())
        
        # Extract subject information
        subject = cert.subject
        
        # Parse common fields
        personal_data = {}
        
        # Common Name (usually contains full name)
        cn = subject.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME)
        if cn:
            personal_data["name"] = cn[0].value
        
        # Surname
        surname = subject.get_attributes_for_oid(x509.oid.NameOID.SURNAME)
        if surname:
            personal_data["surname"] = surname[0].value
        
        # Given Name
        given_name = subject.get_attributes_for_oid(x509.oid.NameOID.GIVEN_NAME)
        if given_name:
            personal_data["givenName"] = given_name[0].value
        
        # Serial Number (often contains personal code)
        serial = subject.get_attributes_for_oid(x509.oid.NameOID.SERIAL_NUMBER)
        if serial:
            personal_data["personalCode"] = serial[0].value
        
        # Country
        country = subject.get_attributes_for_oid(x509.oid.NameOID.COUNTRY_NAME)
        if country:
            personal_data["country"] = country[0].value
        
        # Organization
        org = subject.get_attributes_for_oid(x509.oid.NameOID.ORGANIZATION_NAME)
        if org:
            personal_data["organization"] = org[0].value
        
        # Certificate validity dates
        personal_data["validFrom"] = cert.not_valid_before.isoformat()
        personal_data["validUntil"] = cert.not_valid_after.isoformat()
        
        # Try to calculate age from personal code (Lithuanian format)
        if "personalCode" in personal_data:
            age = calculate_age_from_personal_code(personal_data["personalCode"])
            if age:
                personal_data["age"] = age
        
        # Get all subject attributes for debugging
        all_attributes = {}
        for attr in subject:
            all_attributes[attr.oid._name] = attr.value
        
        session.closeSession()
        
        return {
            "personalData": personal_data,
            "allSubjectAttributes": all_attributes,
            "certificateSerial": hex(cert.serial_number)
        }
        
    except Exception as e:
        return {"error": str(e)}

def calculate_age_from_personal_code(personal_code):
    """Calculate age from Lithuanian personal code"""
    try:
        # Lithuanian personal code format: GYYMMDDNNNC
        # G = gender and century (1-6)
        # YYMMDD = birth date
        # NNN = sequence number
        # C = checksum
        
        if len(personal_code) != 11:
            return None
        
        gender_century = int(personal_code[0])
        year = int(personal_code[1:3])
        month = int(personal_code[3:5])
        day = int(personal_code[5:7])
        
        # Determine century
        if gender_century in [1, 2]:
            year += 1800
        elif gender_century in [3, 4]:
            year += 1900
        elif gender_century in [5, 6]:
            year += 2000
        else:
            return None
        
        # Calculate age
        from datetime import date
        birth_date = date(year, month, day)
        today = date.today()
        age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
        
        return {
            "personalCode": personal_code,
            "birthDate": birth_date.isoformat(),
            "birthYear": year,
            "age": age
        }
        
    except:
        return None

def read_data_objects():
    """Read data objects from card (if any)"""
    try:
        pkcs11 = PyKCS11Lib()
        pkcs11.load(PKCS11_LIB)
        
        slots = pkcs11.getSlotList(tokenPresent=True)
        if not slots:
            return {"error": "No card detected"}
        
        session = pkcs11.openSession(slots[0], CKF_SERIAL_SESSION | CKF_RW_SESSION)
        
        # Search for all data objects
        data_objects = session.findObjects([(CKA_CLASS, CKO_DATA)])
        
        objects_data = []
        for obj in data_objects:
            try:
                # Get object attributes
                attrs = session.getAttributeValue(obj, [CKA_LABEL, CKA_VALUE])
                label = bytes(attrs[0]).decode('utf-8', errors='ignore') if attrs[0] else "Unknown"
                value = bytes(attrs[1]) if attrs[1] else b""
                
                objects_data.append({
                    "label": label,
                    "value": "0x" + value.hex(),
                    "valueText": value.decode('utf-8', errors='ignore') if value else ""
                })
            except:
                continue
        
        session.closeSession()
        
        return {
            "dataObjects": objects_data,
            "count": len(objects_data)
        }
        
    except Exception as e:
        return {"error": str(e)}
    
def verify_certificate():
    """Verify the certificate is valid (basic validation)"""
    try:
        # Get certificate from card
        cert_result = get_certificate()
        if "error" in cert_result:
            return {"valid": False, "error": cert_result["error"]}
        
        # Remove 0x prefix
        cert_hex = cert_result["certificate"]
        if cert_hex.startswith("0x"):
            cert_hex = cert_hex[2:]
        
        # Load certificate
        cert_bytes = bytes.fromhex(cert_hex)
        cert = x509.load_der_x509_certificate(cert_bytes, default_backend())
        
        # Basic validation checks
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        
        # Check if certificate is expired
        if now < cert.not_valid_before_utc:
            return {
                "valid": False, 
                "error": "Certificate not yet valid"
            }
        
        if now > cert.not_valid_after_utc:
            return {
                "valid": False,
                "error": "Certificate expired"
            }
        
        # Note: Full chain verification would require CA public key
        # For now, we trust that if cert is on the card, it's valid
        
        return {
            "valid": True,
            "issuer": cert.issuer.rfc4514_string(),
            "subject": cert.subject.rfc4514_string(),
            "not_valid_before": cert.not_valid_before_utc.isoformat(),
            "not_valid_after": cert.not_valid_after_utc.isoformat(),
            "serial_number": hex(cert.serial_number)
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc(file=sys.stderr)
        return {"valid": False, "error": str(e)}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "sign":
        if len(sys.argv) < 3:
            sys.exit(1)
        message = sys.argv[2]
        pin = sys.argv[3] if len(sys.argv) > 3 else None
        result = sign_message(message, pin)
        
    elif command == "cert":
        result = get_certificate()
        
    elif command == "health":
        result = check_health()
        
    elif command == "verify":
        if len(sys.argv) < 4:
            sys.exit(1)
        message = sys.argv[2]
        signature = sys.argv[3]
        certificate = sys.argv[4] if len(sys.argv) > 4 else None
        result = verify_signature(message, signature, certificate)
    elif command == "verify2":
        if len(sys.argv) < 4:
            sys.exit(1)
        message = sys.argv[2]
        signature = sys.argv[3]
        certificate = sys.argv[4] if len(sys.argv) > 4 else None
        result = verify_signature2(message, signature, certificate)
        
    elif command == "personal":  
        result = get_personal_data()
        
    elif command == "data":
        result = read_data_objects()
        
    elif command == "get-pubkey":
        public_key_bytes, error = get_public_key_from_cert()
        if error:
            result = {"error": error}
        else:
            result = {
                "publicKey": "0x" + public_key_bytes.hex(),  # 96 bytes (x || y)
                "length": len(public_key_bytes)
            }
    elif command == "verify-cert":
        result = verify_certificate()
    else:
        result = {"error": f"Unknown command: {command}"}
    
    print(json.dumps(result))