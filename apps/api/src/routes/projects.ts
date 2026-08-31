import {Router} from 'express'; import {z} from 'zod'; import bcrypt from 'bcryptjs'; import {db} from '../lib/db.js'; import {auth} from '../lib/auth.js'; import {uniqueSlug} from '../lib/slug.js'; import {TemplateSchema} from '@memora/shared';
const r=Router(); r.use(auth);
const projectInput=z.object({templateId:z.string(),name:z.string().min(1).max(160),data:z.record(z.unknown()).default({}),customization:z.record(z.unknown()).default({}),revealMethod:z.enum(['NORMAL','QR','PIN','LETTER','GIFT','PUZZLE']).default('NORMAL')});
r.post('/',async(req,res)=>{const p=projectInput.safeParse(req.body);if(!p.success)return res.status(400).json({error:'Invalid project'});const u=(req as any).user;const t=await db.template.findUnique({where:{id:p.data.templateId}});if(!t||!t.published)return res.status(404).json({error:'Template not found'});const project=await db.project.create({data:{userId:u.id,templateId:t.id,name:p.data.name,data:p.data.data,customization:p.data.customization,revealMethod:p.data.revealMethod}});res.status(201).json({project})});
r.get('/',async(req,res)=>{const u=(req as any).user;const projects=await db.project.findMany({where:{userId:u.id},include:{template:true,website:true,orders:{orderBy:{createdAt:'desc'},take:1}},orderBy:{updatedAt:'desc'}});res.json({items:projects})});
r.get('/:id',async(req,res)=>{const u=(req as any).user;const project=await db.project.findFirst({where:{id:req.params.id,userId:u.id},include:{template:true,media:{orderBy:{sortOrder:'asc'}},website:true,orders:true}});if(!project)return res.status(404).json({error:'Project not found'});res.json({project})});
r.patch('/:id',async(req,res)=>{const u=(req as any).user;const p=projectInput.partial().safeParse(req.body);if(!p.success)return res.status(400).json({error:'Invalid project'});const existing=await db.project.findFirst({where:{id:req.params.id,userId:u.id}});if(!existing)return res.status(404).json({error:'Project not found'});const project=await db.$transaction(async tx=>{await tx.projectRevision.create({data:{projectId:existing.id,data:existing.data,customization:existing.customization,status:existing.status}});return tx.project.update({where:{id:existing.id},data:p.data})});res.json({project})});
r.post('/:id/finalize',async(req,res)=>{const u=(req as any).user;const p=await db.project.findFirst({where:{id:req.params.id,userId:u.id},include:{template:true}});if(!p)return res.status(404).json({error:'Project not found'});const schema=TemplateSchema.parse(p.template.schema);const missing=schema.fields.filter((f:any)=>f.required && (p.data as any)?.[f.id]===undefined || f.required && String((p.data as any)?.[f.id]??'').trim()==='').map((f:any)=>f.label);if(missing.length)return res.status(400).json({error:`Please complete: ${missing.join(', ')}`});const project=await db.project.update({where:{id:p.id},data:{status:'FINALIZED',finalizedAt:new Date()}});res.json({project})});
r.post('/:id/publish',async(req,res)=>{const u=(req as any).user;const p=await db.project.findFirst({where:{id:req.params.id,userId:u.id},include:{orders:{include:{plan:true}}}});if(!p)return res.status(404).json({error:'Project not found'});const paid=p.orders.some(o=>o.status==='PAID');if(!paid)return res.status(402).json({error:'Payment required'});if(p.status!=='FINALIZED')return res.status(409).json({error:'Project must be finalized'});const slug=await uniqueSlug(req.body?.slug||p.name);const paidOrder=p.orders.find(o=>o.status==='PAID');const expirationDays=(paidOrder?.plan?.limits as any)?.expirationDays;const expiresAt=typeof expirationDays==='number'?new Date(Date.now()+expirationDays*86400000):null;const site=await db.publishedSite.upsert({where:{projectId:p.id},update:{status:'ACTIVE',revealMethod:p.revealMethod,expiresAt},create:{projectId:p.id,slug,revealMethod:p.revealMethod,expiresAt}});await db.project.update({where:{id:p.id},data:{status:'PUBLISHED',publishedAt:new Date()}});res.json({site,url:`${process.env.APP_URL||'http://localhost:5173'}/r/${site.slug}`})});

r.patch('/:id/reveal',async(req,res)=>{
 const u=(req as any).user;
 const p=z.object({method:z.enum(['NORMAL','QR','PIN','LETTER','GIFT','PUZZLE']),pin:z.string().min(4).max(64).optional(),puzzleQuestion:z.string().max(240).optional(),puzzleAnswer:z.string().max(240).optional(),letterTitle:z.string().max(160).optional(),letterIntro:z.string().max(500).optional()}).safeParse(req.body);
 if(!p.success)return res.status(400).json({error:'Invalid reveal settings'});
 const project=await db.project.findFirst({where:{id:req.params.id,userId:u.id},include:{website:true}});
 if(!project)return res.status(404).json({error:'Project not found'});
 await db.project.update({where:{id:project.id},data:{revealMethod:p.data.method}}); if(project.website) await db.publishedSite.update({where:{id:project.website.id},data:{revealMethod:p.data.method}});
 if(['PIN','PUZZLE','LETTER','GIFT'].includes(p.data.method)){
  if(!project.website)return res.status(409).json({error:'Publish the website before configuring its reveal'});
  const pinHash=p.data.pin?await bcrypt.hash(p.data.pin,12):undefined;
  const puzzleAnswerHash=p.data.puzzleAnswer?await bcrypt.hash(p.data.puzzleAnswer.trim().toLowerCase(),12):undefined;
  await db.siteAccessRule.upsert({
   where:{siteId:project.website.id},
   update:{pinHash,puzzleQuestion:p.data.puzzleQuestion,puzzleAnswerHash,letterTitle:p.data.letterTitle,letterIntro:p.data.letterIntro},
   create:{siteId:project.website.id,pinHash,puzzleQuestion:p.data.puzzleQuestion,puzzleAnswerHash,letterTitle:p.data.letterTitle,letterIntro:p.data.letterIntro}
  });
 }
 res.json({ok:true});
});
export default r;
