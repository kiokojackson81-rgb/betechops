declare module 'jsonwebtoken' {
  export type Secret = string | Buffer

  export interface SignOptions {
    algorithm?: string
    expiresIn?: string | number
    [key: string]: unknown
  }

  export function sign(payload: string | object | Buffer, secretOrPrivateKey: Secret, options?: SignOptions): string

  const jwt: { sign: typeof sign }
  export default jwt
}
