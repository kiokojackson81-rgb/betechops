import { randomBytes } from 'crypto'

// POST /oauth/token
// Accepts application/x-www-form-urlencoded body with:
// - grant_type=refresh_token
// - client_id
// - refresh_token
// If environment variables OAUTH_CLIENT_ID / OAUTH_REFRESH_TOKEN are set,
// they are used to validate incoming values. On success returns JSON:
// { access_token, token_type: 'Bearer', expires_in }
export async function POST(req: Request) {
  const contentType = (req.headers.get('content-type') || '').toLowerCase()

  if (!contentType.includes('application/x-www-form-urlencoded')) {
    return new Response(
      JSON.stringify({ error: 'invalid_request', error_description: 'Content-Type must be application/x-www-form-urlencoded' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const text = await req.text()
  const params = new URLSearchParams(text)
  const grant_type = params.get('grant_type')
  const client_id = params.get('client_id')
  const refresh_token = params.get('refresh_token')

  if (!grant_type || !client_id || !refresh_token) {
    return new Response(
      JSON.stringify({ error: 'invalid_request', error_description: 'Missing required parameters' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (grant_type !== 'refresh_token') {
    return new Response(
      JSON.stringify({ error: 'unsupported_grant_type', error_description: 'Only grant_type=refresh_token is supported' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Optional validation against environment variables. If the env var is not set
  // we allow any value (useful for local/dev). This avoids hard failures when
  // env is not configured, but in production you should set the expected values.
  const expectedClient = process.env.OAUTH_CLIENT_ID
  const expectedRefresh = process.env.OAUTH_REFRESH_TOKEN

  if (expectedClient && client_id !== expectedClient) {
    return new Response(
      JSON.stringify({ error: 'invalid_client', error_description: 'client_id is invalid' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
  if (expectedRefresh && refresh_token !== expectedRefresh) {
    return new Response(
      JSON.stringify({ error: 'invalid_grant', error_description: 'refresh_token is invalid' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Generate an opaque access token. This is intentionally simple: an unguessable
  // opaque string and an expires_in integer. If you need JWTs, replace this
  // implementation with your signed token generator.
  const token = randomBytes(28).toString('base64url')
  const expiresIn = parseInt(process.env.OAUTH_EXPIRES_IN || '3600', 10)

  const body = {
    access_token: token,
    token_type: 'Bearer',
    expires_in: expiresIn,
  }

  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}
