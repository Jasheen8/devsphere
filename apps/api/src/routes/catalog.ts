import {Router} from 'express'; import {auth} from '../lib/auth.js'; import {db} from '../lib/db.js';
const r=Router();
r.get('/categories',async(_req,res)=>res.json({items:await db.category.findMany({where:{published:true},orderBy:{sortOrder:'asc'}})}));
r.get('/templates',async(req,res)=>{const {category,style,search,featured}=req.query;const items=await db.template.findMany({where:{published:true,...(featured==='true'?{featured:true}:{}),...(category?{category:{slug:String(category)}}:{}),...(search?{OR:[{name:{contains:String(search),mode:'insensitive'}},{description:{contains:String(search),mode:'insensitive'}}]}:{})},include:{category:true},orderBy:{createdAt:'desc'}});res.json({items})});
r.get('/pricing',async(_req,res)=>res.json({items:await db.pricingPlan.findMany({where:{active:true},orderBy:{sortOrder:'asc'}})}));
r.get('/templates/:id',async(req,res)=>{const t=await db.template.findFirst({where:{OR:[{id:req.params.id},{slug:req.params.id}],published:true},include:{category:true}});if(!t)return res.status(404).json({error:'Template not found'});res.json({template:t})});

r.post('/templates/:id/favorite',auth,async(req,res)=>{const u=(req as any).user;const t=await db.template.findFirst({where:{OR:[{id:req.params.id},{slug:req.params.id}],published:true}});if(!t)return res.status(404).json({error:'Template not found'});await db.favorite.upsert({where:{userId_templateId:{userId:u.id,templateId:t.id}},update:{},create:{userId:u.id,templateId:t.id}});res.json({ok:true});});
r.delete('/templates/:id/favorite',auth,async(req,res)=>{const u=(req as any).user;const t=await db.template.findFirst({where:{OR:[{id:req.params.id},{slug:req.params.id}]}});if(!t)return res.status(404).json({error:'Template not found'});await db.favorite.deleteMany({where:{userId:u.id,templateId:t.id}});res.status(204).end();});
export default r;
