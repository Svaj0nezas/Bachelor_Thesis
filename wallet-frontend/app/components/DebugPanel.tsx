'use client';

interface DebugPanelProps {
  data: {
    userOpHash?: string;
    authenticatorData?: Uint8Array;
    clientDataJSON?: string;
    challengeIndex?: number;
    typeIndex?: number;
    r?: bigint;
    s?: bigint;
    signature?: string;
  };
}

export function DebugPanel({ data }: DebugPanelProps) {
  if (!data.userOpHash) return null;

  const bytesToHex = (bytes: Uint8Array) => {
    return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  return (
    <div className="mt-8 p-6 bg-gray-900 text-white rounded-lg font-mono text-xs">
      <h3 className="text-lg font-bold mb-4 text-yellow-400">Debug Info</h3>
      
      <div className="space-y-4">
        <div>
          <div className="text-gray-400">UserOpHash (Challenge):</div>
          <div className="break-all bg-gray-800 p-2 rounded">{data.userOpHash}</div>
        </div>

        {data.authenticatorData && (
          <div>
            <div className="text-gray-400">AuthenticatorData ({data.authenticatorData.length} bytes):</div>
            <div className="break-all bg-gray-800 p-2 rounded">
              {bytesToHex(data.authenticatorData)}
            </div>
          </div>
        )}

        {data.clientDataJSON && (
          <>
            <div>
              <div className="text-gray-400">ClientDataJSON ({data.clientDataJSON.length} chars):</div>
              <div className="break-all bg-gray-800 p-2 rounded whitespace-pre-wrap">
                {data.clientDataJSON}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-gray-400">Challenge Index:</div>
                <div className="bg-gray-800 p-2 rounded">{data.challengeIndex}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Points to: {data.clientDataJSON.substring(data.challengeIndex || 0, (data.challengeIndex || 0) + 50)}...
                </div>
              </div>

              <div>
                <div className="text-gray-400">Type Index:</div>
                <div className="bg-gray-800 p-2 rounded">{data.typeIndex}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Points to: {data.clientDataJSON.substring(data.typeIndex || 0, (data.typeIndex || 0) + 30)}...
                </div>
              </div>
            </div>
          </>
        )}

        {data.r && data.s && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-gray-400">Signature r:</div>
              <div className="break-all bg-gray-800 p-2 rounded">
                0x{data.r.toString(16)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Length: {data.r.toString(16).length / 2} bytes
              </div>
            </div>

            <div>
              <div className="text-gray-400">Signature s:</div>
              <div className="break-all bg-gray-800 p-2 rounded">
                0x{data.s.toString(16)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Length: {data.s.toString(16).length / 2} bytes
              </div>
            </div>
          </div>
        )}

        {data.signature && (
          <div>
            <div className="text-gray-400">Full Encoded Signature:</div>
            <div className="break-all bg-gray-800 p-2 rounded">
              {data.signature.slice(0, 100)}...
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Total length: {(data.signature.length - 2) / 2} bytes
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-gray-700">
          <div className="text-yellow-400 font-bold mb-2">Validation Checks:</div>
          <div className="space-y-1 text-sm">
            <div className={data.r && data.r.toString(16).length === 64 ? "text-green-400" : "text-red-400"}>
               r is 32 bytes: {data.r && data.r.toString(16).length === 64 ? "✓" : "❌"}
            </div>
            <div className={data.s && data.s.toString(16).length === 64 ? "text-green-400" : "text-red-400"}>
               s is 32 bytes: {data.s && data.s.toString(16).length === 64 ? "✓" : "❌"}
            </div>
            <div className={data.clientDataJSON?.includes('"type":"webauthn.get"') ? "text-green-400" : "text-red-400"}>
               Contains "type":"webauthn.get": {data.clientDataJSON?.includes('"type":"webauthn.get"') ? "✓" : "❌"}
            </div>
            <div className={data.clientDataJSON?.includes('"challenge":"') ? "text-green-400" : "text-red-400"}>
               Contains "challenge": {data.clientDataJSON?.includes('"challenge":"') ? "✓" : "❌"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}