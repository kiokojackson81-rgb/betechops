declare module 'jsonwebtoken' {
  export function sign(payload: any, secretOrPrivateKey: string, options?: any): string
  export type SignOptions = any
  const jwt: { sign: typeof sign }
  export default jwt
}
