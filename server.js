import express from 'express';
import multer from 'multer';
import {rateLimit} from 'express-rate-limit';
import {randomBytes, timingSafeEqual, createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStorage} from './storage.js';
try { process.loadEnvFile(); } catch (e) { if(e.code!=='ENOENT') throw e; }
const app=express();
app.disable('x-powered-by');
// Sit behind a TLS-terminating proxy (Render, Railway, Fly, nginx) so secure
// cookies and client IPs are read from X-Forwarded-* headers.
if(process.env.TRUST_PROXY!=='false')app.set('trust proxy',1);
const DATA_DIR=process.env.DATA_DIR||'data';
const UPLOAD_DIR=process.env.UPLOAD_DIR||'uploads';
const dataFile=path.join(DATA_DIR,'content.json');
// The seed lives with the app; DATA_DIR may be an empty, freshly mounted disk.
const APP_ROOT=path.dirname(fileURLToPath(import.meta.url));
const bundledSeed=path.join(APP_ROOT,'data','default.json');
app.use(express.json({limit:'1mb'}));
const sessions=new Map();
const storage=createStorage({
  token:process.env.GITHUB_TOKEN,
  repo:process.env.GITHUB_REPO,
  branch:process.env.GITHUB_BRANCH||'arena/01a0e32e-3d-portfolio',
  dataDir:DATA_DIR,
  uploadDir:UPLOAD_DIR,
});
const password=process.env.ADMIN_PASSWORD;
const digest=s=>createHash('sha256').update(s).digest();
function auth(req,res,next){const token=req.headers.cookie?.split('; ').find(x=>x.startsWith('portfolio_session='))?.split('=')[1]; if(!token||!sessions.has(token)||sessions.get(token)<Date.now())return res.status(401).json({error:'Please sign in.'});next();}
app.get('/api/health',(req,res)=>res.json({ok:true,admin:Boolean(password)}));
app.get('/api/content',async(req,res)=>{try{res.json(await storage.read());}catch(error){console.error(error);res.status(500).json({error:'Could not read your content.'});}});
app.post('/api/login',rateLimit({windowMs:900000,limit:10,standardHeaders:true,legacyHeaders:false}), (req,res)=>{if(!password)return res.status(503).json({error:'Admin is not configured yet. Set ADMIN_PASSWORD on the server and restart to enable private access.'});if(typeof req.body.password!=='string'||!timingSafeEqual(digest(req.body.password),digest(password)))return res.status(401).json({error:'That password is not correct.'});const token=randomBytes(32).toString('hex');sessions.set(token,Date.now()+8*3600000);res.cookie('portfolio_session',token,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:8*3600000});res.json({ok:true});});
app.get('/api/session',auth,(req,res)=>res.json({ok:true}));
app.post('/api/logout',(req,res)=>{const token=req.headers.cookie?.split('; ').find(x=>x.startsWith('portfolio_session='))?.split('=')[1];sessions.delete(token);res.clearCookie('portfolio_session');res.json({ok:true});});
function validContent(d) {
  if (!d || typeof d !== 'object') return false;
  const textFields = ['name', 'headline', 'description', 'about', 'email', 'role'];
  if (textFields.some(k => typeof d[k] !== 'string') || !d.name.trim()) return false;
  if (['fullName', 'location', 'github', 'linkedin'].some(k => d[k] !== undefined && typeof d[k] !== 'string')) return false;
  if (['available', 'sampleContent'].some(k => d[k] !== undefined && typeof d[k] !== 'boolean')) return false;
  if (['github', 'linkedin'].some(k => d[k] && !/^https?:\/\//i.test(d[k]))) return false;
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return false;
  for (const key of ['skills', 'certifications', 'languages']) {
    if (d[key] === undefined && key !== 'skills') continue;
    if (!Array.isArray(d[key]) || d[key].some(s => typeof s !== 'string')) return false;
  }
  for (const key of ['experience', 'education']) {
    if (d[key] === undefined) continue;
    if (!Array.isArray(d[key]) || d[key].some(e => !e || ['title','organization','period','location','details'].some(k => typeof e[k] !== 'string'))) return false;
  }
  if (!Array.isArray(d.projects) || d.projects.some(p => !p || ['id','title','description','category','year','image','url','color','type'].some(k => typeof p[k] !== 'string'))) return false;
  return true;
}
app.put('/api/content', auth, async (req, res) => {
  const d = req.body;
  if (!validContent(d)) return res.status(400).json({error:'Please check all content fields, email, and profile links (use full https:// URLs).'});
  try {
    await storage.write(d);
    res.json({ok:true});
  } catch (error) {
    console.error(error);
    res.status(502).json({error: error.message || 'Could not save your changes.'});
  }
});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024}});
app.post('/api/upload',auth,upload.single('image'),async(req,res)=>{
  const b=req.file?.buffer;let ext;
  if(b?.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))ext='.png';
  else if(b?.[0]===255&&b?.[1]===216&&b?.[2]===255)ext='.jpg';
  else if(b?.toString('ascii',0,4)==='RIFF'&&b?.toString('ascii',8,12)==='WEBP')ext='.webp';
  if(!ext)return res.status(400).json({error:'Upload a PNG, JPEG, or WebP image.'});
  try {
    const name = await storage.putImage({data:b, extension:ext});
    res.json({url:'/uploads/'+name});
  } catch (error) {
    console.error(error);
    res.status(502).json({error: error.message || 'Could not upload that image.'});
  }
});
const imageCache=new Map();
app.get('/uploads/:name',async(req,res)=>{
  const name=req.params.name;
  if(!/^[a-f0-9]{32}\.(png|jpg|webp)$/.test(name))return res.sendStatus(404);
  res.set('X-Content-Type-Options','nosniff');
  res.set('Cache-Control','public, max-age=31536000, immutable');
  try{
    if(imageCache.has(name))return res.type(path.extname(name).slice(1)).send(imageCache.get(name));
    const bytes=await storage.getImage(name);
    if(!bytes)return res.sendStatus(404);
    if(imageCache.size>60)imageCache.clear();
    imageCache.set(name,bytes);
    res.type(path.extname(name).slice(1)).send(bytes);
  }catch(error){console.error(error);res.sendStatus(500);}
});
app.use('/api',(req,res)=>res.status(404).json({error:'Not found'}));
app.use((err,req,res,next)=>res.status(400).json({error:err.code==='LIMIT_FILE_SIZE'?'Image must be under 8 MB.':'Could not complete the request.'}));
if(process.env.NODE_ENV==='production'){app.use(express.static('dist'));app.get('/{*path}',(req,res)=>res.sendFile(path.resolve('dist/index.html')));}else{const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true,allowedHosts:true},appType:'spa'});app.use(vite.middlewares);}
// Storage must exist before accepting traffic. A local disk starts from the
// bundled defaults; GitHub storage fetches the published content.
await fs.mkdir(UPLOAD_DIR,{recursive:true});
await fs.mkdir(DATA_DIR,{recursive:true});
try{await fs.access(dataFile);}
catch{try{await fs.copyFile(bundledSeed,dataFile);}catch{/* storage layer falls back to the bundled defaults */}}
await storage.init();
const port=Number(process.env.PORT)||3000;
app.listen(port,'0.0.0.0',()=>console.log('Portfolio ready on port '+port+(!password?' · Admin locked: set ADMIN_PASSWORD to enable.':'')));
