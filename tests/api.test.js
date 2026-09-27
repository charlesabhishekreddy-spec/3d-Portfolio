import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

test('portfolio content and private admin lifecycle',async()=>{
 const root=process.cwd();const dir=await mkdtemp(path.join(tmpdir(),'portfolio-test-'));
 await mkdir(path.join(dir,'data'));await mkdir(path.join(dir,'uploads'));
 await copyFile(path.join(root,'data/default.json'),path.join(dir,'data/default.json'));
 const server=spawn(process.execPath,[path.join(root,'server.js')],{cwd:dir,env:{...process.env,NODE_ENV:'production',PORT:'3101',ADMIN_PASSWORD:'test-only-private-password'}});
 try{
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Server did not start')),15000);server.stdout.on('data',s=>{if(s.toString().includes('Portfolio ready')){clearTimeout(timeout);resolve();}});server.once('exit',code=>{clearTimeout(timeout);reject(Error('Server exited '+code));});});
  const api=(url,options={})=>fetch('http://127.0.0.1:3101/api/'+url,options);
  let r=await api('content');assert.equal(r.status,200);const content=await r.json();assert.equal(content.name,'Charles');assert.equal(content.sampleContent,false);assert.equal(content.projects.length,4);assert.equal(content.experience.length,5);assert.equal(content.education.length,2);assert.equal(content.languages.length,4);
  assert.equal((await api('session')).status,401);
  assert.equal((await api('content',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(content)})).status,401);
  assert.equal((await api('upload',{method:'POST'})).status,401);
  assert.equal((await api('login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'wrong'})})).status,401);
  r=await api('login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'test-only-private-password'})});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Strict/);
  const headers={Cookie:cookie.split(';')[0],'Content-Type':'application/json'};
  assert.equal((await api('session',{headers})).status,200);
  assert.equal((await api('content',{method:'PUT',headers,body:JSON.stringify({name:'broken'})})).status,400);
  for(const bad of [{experience:[{title:42}]},{education:'invalid'},{certifications:[null]},{languages:[{}]},{github:'javascript:alert(1)'},{email:'invalid'}]) assert.equal((await api('content',{method:'PUT',headers,body:JSON.stringify({...content,...bad})})).status,400);
  content.experience[0].details='Updated responsibilities';content.languages.push('Test language');
  content.name='Test studio';assert.equal((await api('content',{method:'PUT',headers,body:JSON.stringify(content)})).status,200);
  const published=await (await api('content')).json();assert.equal(published.name,'Test studio');assert.equal(published.experience[0].details,'Updated responsibilities');assert.ok(published.languages.includes('Test language'));
  let form=new FormData();form.append('image',new Blob(['<svg>not allowed</svg>'],{type:'image/svg+xml'}),'bad.svg');assert.equal((await api('upload',{method:'POST',headers:{Cookie:headers.Cookie},body:form})).status,400);
  form=new FormData();form.append('image',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9yQAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'test.png');r=await api('upload',{method:'POST',headers:{Cookie:headers.Cookie},body:form});assert.equal(r.status,200);const image=await r.json();assert.match(image.url,/^\/uploads\/[a-f0-9]+\.png$/);assert.equal((await fetch('http://127.0.0.1:3101'+image.url)).status,200);
  assert.equal((await api('logout',{method:'POST',headers})).status,200);assert.equal((await api('session',{headers})).status,401);
 }finally{server.kill();await new Promise(resolve=>server.once('exit',resolve));await rm(dir,{recursive:true,force:true});}
});

test('build requires a branch that contains the app', async () => {
  const {execFileSync} = await import('node:child_process');
  const root = process.cwd();
  // A host builds whatever branch is configured. If that branch has no
  // package.json the build dies with a bare npm ENOENT. Detect that here so the
  // cause is known up front rather than only in a host's build log.
  const files = execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD'], {cwd: root, encoding: 'utf8'});
  assert.ok(files.includes('package.json'), 'tracked branch must contain package.json or every host build fails with ENOENT');
  assert.ok(files.includes('server.js'), 'tracked branch must contain server.js');
  assert.ok(files.includes('render.yaml'), 'tracked branch must contain render.yaml');
  const blueprint = JSON.parse(JSON.stringify({}));
  const yaml = await import('node:fs/promises').then(fs => fs.readFile(root + '/render.yaml', 'utf8'));
  const branch = yaml.match(/^\s*branch:\s*(\S+)/m)?.[1];
  assert.ok(branch, 'render.yaml must pin the branch to build');
  assert.ok(!branch.includes('main') || yaml.includes('THE BRANCH MATTERS'), 'building main is only safe if documented');
  assert.equal(blueprint.services, undefined);
});
