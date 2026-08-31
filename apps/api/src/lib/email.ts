export interface EmailProvider { send(to:string,subject:string,text:string):Promise<void> }
export const emailProvider:EmailProvider={async send(to,subject,text){console.log(`[email:${to}] ${subject}\n${text}`)}};
