import crypto from 'node:crypto'; import bcrypt from 'bcryptjs'; import type {Request,Response,NextFunction} from 'express'; import jwt from 'jsonwebtoken'; import {db} from './db.js';
const secret=process.env.SESSION_SECRET||'dev-only-change-me';
export async function hashPassword(p:string){return bcrypt.hash(p,12)} export async function verifyPassword(p:string,h:string){return bcrypt.compare(p,h)}
export function makeToken(userId:string){return jwt.sign({sub:userId},secret,{expiresIn:'7d'})}
export function setAuthCookie(res:Response,token:string){res.cookie('memora_session',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:7*86400000,path:'/'})}
export function clearAuthCookie(res:Response){res.clearCookie('memora_session',{path:'/'})}
export async function auth(req:Request,res:Response,next:NextFunction){try{const token=req.cookies?.memora_session;if(!token) return res.status(401).json({error:'Unauthorized'});const payload=jwt.verify(token,secret) as jwt.JwtPayload;const user=await db.user.findUnique({where:{id:String(payload.sub)}});if(!user||user.status!=='active') return res.status(401).json({error:'Unauthorized'});(req as any).user=user;next()}catch{return res.status(401).json({error:'Unauthorized'})}}
export function requireRole(...roles:string[]){return (req:Request,res:Response,next:NextFunction)=>{const user=(req as any).user;if(!user||!roles.includes(user.role)) return res.status(403).json({error:'Forbidden'});next()}}
export function randomHash(value:string){return crypto.createHash('sha256').update(value).digest('hex')}
