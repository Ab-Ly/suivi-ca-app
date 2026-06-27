import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getAccessTokenFromRefreshToken(clientId: string, clientSecret: string, refreshToken: string) {
  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);
  params.append("refresh_token", refreshToken);
  params.append("grant_type", "refresh_token");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google OAuth token refresh failed: ${response.status} - ${text}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  // CORS Preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { name, fileBase64, mimeType } = await req.json()

    if (!fileBase64) {
      throw new Error("Missing fileBase64 content")
    }

    // Decode base64 to binary bytes
    const binaryString = atob(fileBase64)
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    // Get config from Environment Variables (Supabase Secrets)
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")
    const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN")
    const folderId = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID")

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error("Missing OAuth2 credentials on Supabase (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN)")
    }
    if (!folderId) {
      throw new Error("Missing GOOGLE_DRIVE_FOLDER_ID secret on Supabase")
    }

    // Authenticate and get accessToken using refresh token
    const accessToken = await getAccessTokenFromRefreshToken(clientId, clientSecret, refreshToken)

    // Build google drive upload multipart request
    const metadata = {
      name: name || "Sauvegarde_Caisse.xlsx",
      parents: [folderId],
    }

    const boundary = "-------drive_upload_boundary_31415926"
    const delimiter = `\r\n--${boundary}\r\n`
    const closeDelim = `\r\n--${boundary}--`

    const encoder = new TextEncoder()
    const part1 = encoder.encode(
      `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`
    )
    const part2Header = encoder.encode(
      `${delimiter}Content-Type: ${mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}\r\n\r\n`
    )
    const part2Body = bytes
    const part3 = encoder.encode(closeDelim)

    // Combine everything into a single payload buffer
    const body = new Uint8Array(
      part1.byteLength + part2Header.byteLength + part2Body.byteLength + part3.byteLength
    )
    body.set(part1, 0)
    body.set(part2Header, part1.byteLength)
    body.set(part2Body, part1.byteLength + part2Header.byteLength)
    body.set(part3, part1.byteLength + part2Header.byteLength + part2Body.byteLength)

    // Post to Google Drive API
    const googleResponse = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
          "Content-Length": body.byteLength.toString(),
        },
        body,
      }
    )

    if (!googleResponse.ok) {
      const errorText = await googleResponse.text()
      throw new Error(`Google Drive API upload failed: ${googleResponse.status} - ${errorText}`)
    }

    const driveResult = await googleResponse.json()

    return new Response(
      JSON.stringify({ success: true, fileId: driveResult.id, name: driveResult.name }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
