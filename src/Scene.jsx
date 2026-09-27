import React,{useEffect,useRef,useState} from 'react';
import * as T from 'three';
export default function Scene({view='home',onSelect,paused=false}){
 const host=useRef();const state=useRef({view,paused,onSelect});state.current={view,paused,onSelect};const [failed,setFailed]=useState(false);
 useEffect(()=>{
  let renderer;try{renderer=new T.WebGLRenderer({antialias:true,alpha:true});}catch{setFailed(true);return;}
  const el=host.current;renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.setClearColor(0,0);el.appendChild(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(33,1,.1,100);camera.position.set(9,7.7,10);const look=new T.Vector3(0,1,0);
  scene.add(new T.HemisphereLight(0xffffff,0xb7aac5,3));const sun=new T.DirectionalLight(0xfff9ef,5);sun.position.set(-3,9,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8});sun.shadow.normalBias=.035;sun.shadow.radius=4;scene.add(sun);
  const room=new T.Group();scene.add(room);const mat=(c,r=.8)=>new T.MeshStandardMaterial({color:c,roughness:r});const white=mat('#f7f5f5'),lilac=mat('#c8bce2'),dark=mat('#4a435a'),wood=mat('#e7ded6'),green=mat('#a8b7a0');const clickable=[];
  function box(w,h,d,m,x,y,z,parent=room){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  function cyl(r1,r2,h,m,x,y,z,n=32,parent=room){const o=new T.Mesh(new T.CylinderGeometry(r1,r2,h,n),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  function tag(o,v){o.userData.view=v;clickable.push(o);return o;}
  // An open architectural miniature, resting on a lavender-edged plinth.
  box(6.1,.22,4.9,lilac,0,-.16,0);box(6,.16,4.8,white,0,0,0);box(6,3.3,.14,white,0,1.68,-2.35);box(.14,3.3,2.3,white,-2.93,1.68,-1.25);
  box(2.2,.035,1.5,mat('#e2ddec'),.45,.105,.8);
  // Desktop and tapered legs.
  tag(box(3.6,.17,1.5,wood,-.3,1.62,-.9),'projects');for(const x of [-1.83,1.23])for(const z of [-1.45,-.38])box(.11,1.5,.11,white,x,.82,z);
  box(3.55,.04,1.46,white,-.3,1.73,-.9);
  // Screen with a custom miniature interface.
  const cvs=document.createElement('canvas');cvs.width=768;cvs.height=480;const ctx=cvs.getContext('2d');ctx.fillStyle='#29263a';ctx.fillRect(0,0,768,480);ctx.fillStyle='#b9a4e7';ctx.font='20px sans-serif';ctx.fillText('SELECTED EXPLORATIONS   /   2026',45,52);ctx.fillStyle='#efebf5';ctx.font='bold 58px sans-serif';ctx.fillText('Make something',45,143);ctx.fillText('unexpected.',45,212);ctx.strokeStyle='#a892dc';ctx.lineWidth=2;for(let i=0;i<12;i++){ctx.beginPath();ctx.ellipse(545,342,55+i*11,36+i*4,-.45,0,Math.PI*2);ctx.stroke();}ctx.fillStyle='#ccc3df';ctx.font='17px sans-serif';ctx.fillText('AI  /  WEB  /  CYBERSECURITY  ↗',45,410);
  const screen=new T.Group();room.add(screen);screen.position.set(-.42,2.25,-1.23);tag(box(1.94,1.2,.1,dark,0,0,0,screen),'projects');const face=new T.Mesh(new T.PlaneGeometry(1.81,1.06),new T.MeshBasicMaterial({map:new T.CanvasTexture(cvs)}));face.position.set(0,0,.056);screen.add(face);tag(face,'projects');box(.1,.37,.1,dark,-.42,1.88,-1.23);box(.65,.045,.36,dark,-.42,1.77,-1.15);
  box(.94,.045,.34,mat('#d5d0de'),-.4,1.785,-.47);for(let i=0;i<10;i++)for(let j=0;j<3;j++)box(.065,.012,.065,white,-.8+i*.084,1.813,-.58+j*.09);cyl(.075,.08,.035,white,.39,1.79,-.43);
  // Books, mug, and a tiny plant.
  ['#b8a2d3','#e9e2d5','#a6b7a3'].forEach((c,i)=>tag(box(.55,.1,.4,mat(c),1,1.81+i*.11,-1.26),'skills'));
  cyl(.13,.11,.27,mat('#c3b5d9'),-1.72,1.9,-.63);const handle=new T.Mesh(new T.TorusGeometry(.09,.025,8,16),lilac);handle.position.set(-1.57,1.94,-.63);room.add(handle);
  // Soft rounded chair in front of desk.
  const chair=new T.Group();chair.position.set(.05,0,.69);room.add(chair);cyl(.47,.44,.16,lilac,0,.87,0,32,chair);const back=box(.9,.66,.14,lilac,0,1.24,.38,chair);back.rotation.x=-.12;cyl(.045,.045,.68,dark,0,.47,0,12,chair);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const leg=box(.48,.045,.045,dark,Math.sin(a)*.2,.16,Math.cos(a)*.2,chair);leg.rotation.y=-a+Math.PI/2;cyl(.06,.06,.09,dark,Math.sin(a)*.44,.12,Math.cos(a)*.44,10,chair);}
  // Art, shelf, and a sculptural lamp.
  box(.98,1.14,.06,wood,-1.82,2.28,-2.24);box(.85,1.01,.015,mat('#eee9f4'),-1.82,2.28,-2.198);const art=new T.Mesh(new T.CircleGeometry(.28,40),lilac);art.position.set(-1.82,2.4,-2.18);room.add(art);box(.55,.08,.02,mat('#a594bf'),-1.82,1.98,-2.18);
  box(1.3,.09,.36,wood,1.75,2.63,-2.1);for(let i=0;i<5;i++)tag(box(.13,.36+i%2*.12,.23,i%2?lilac:mat('#dcd4c7'),1.45+i*.15,2.86,-2.09),'skills');
  cyl(.22,.27,.1,dark,1.36,1.82,-.48);const stem=box(.045,.64,.045,dark,1.36,2.15,-.48);stem.rotation.z=-.23;cyl(.25,.1,.21,lilac,1.25,2.5,-.48);
  // Large low-poly plant.
  cyl(.28,.21,.54,mat('#dfd5cd'),2.22,.37,-1.5,7);for(let i=0;i<9;i++){const a=i*2.4;const leaf=new T.Mesh(new T.IcosahedronGeometry(.27,0),green);leaf.scale.set(.55,1.9,.55);leaf.position.set(2.22+Math.sin(a)*.27,.92+i%3*.22,-1.5+Math.cos(a)*.22);leaf.rotation.set(Math.cos(a)*.5,a,Math.sin(a)*.6);room.add(leaf);}
  // Floor books and orb.
  tag(box(.76,.16,.61,wood,-2.03,.2,.8),'about');tag(box(.67,.12,.56,lilac,-2.06,.34,.79),'about');cyl(.25,.25,.045,white,-2.02,.43,.8);const orb=new T.Mesh(new T.IcosahedronGeometry(.24,1),mat('#b8a6da',.35));orb.position.set(-2.02,.68,.8);room.add(orb);
  const floating=[];[[-3.5,2.5,.5,.34],[2.9,3.7,-.9,.26],[2.8,1.2,2.2,.22],[-1.2,4.5,-1,.15]].forEach(([x,y,z,s],i)=>{const m=new T.Mesh(new T.OctahedronGeometry(s),mat(i%2?'#d8cedf':'#aa95ce',.3));m.position.set(x,y,z);scene.add(m);floating.push({m,y});});
  const ring=new T.Mesh(new T.TorusGeometry(.48,.085,8,40),mat('#b7a4d3'));ring.position.set(3.55,2.25,-.3);ring.rotation.set(.5,.6,-.4);scene.add(ring);
  const positions=new Float32Array(150*3);for(let i=0;i<150;i++){positions[i*3]=(Math.random()-.5)*12;positions[i*3+1]=Math.random()*5-.6;positions[i*3+2]=(Math.random()-.5)*8;}const pg=new T.BufferGeometry();pg.setAttribute('position',new T.BufferAttribute(positions,3));const particles=new T.Points(pg,new T.PointsMaterial({color:'#b8a4d5',size:.026,transparent:true,opacity:.55}));scene.add(particles);
  const ray=new T.Raycaster(),pointer=new T.Vector2(),mouse={x:0,y:0};function move(e){const r=el.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);mouse.x=pointer.x;mouse.y=pointer.y;ray.setFromCamera(pointer,camera);el.style.cursor=ray.intersectObjects(clickable).length?'pointer':'grab';}function click(){ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(clickable)[0];if(hit)state.current.onSelect(hit.object.userData.view);}el.addEventListener('pointermove',move);el.addEventListener('click',click);
  const resize=()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};const ro=new ResizeObserver(resize);ro.observe(el);resize();let frame,t=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;function animate(){frame=requestAnimationFrame(animate);if(!state.current.paused&&!reduced)t+=.012;floating.forEach(({m,y},i)=>{m.position.y=y+Math.sin(t+i)*.12;m.rotation.y=t*.3+i;m.rotation.z=t*.2;});ring.rotation.z=t*.15;particles.rotation.y=t*.025;const selected=state.current.view;const target=selected==='projects'?new T.Vector3(5.2,4.9,7):selected==='skills'?new T.Vector3(7.5,5,5):selected==='about'?new T.Vector3(7,6,10):new T.Vector3(9,7.7,10);if(!reduced&&!state.current.paused){target.x+=mouse.x*.38;target.y+=mouse.y*.25;}camera.position.lerp(target,.035);camera.lookAt(look);renderer.render(scene,camera);}animate();return()=>{cancelAnimationFrame(frame);ro.disconnect();el.removeEventListener('pointermove',move);el.removeEventListener('click',click);scene.traverse(o=>{o.geometry?.dispose();if(o.material){o.material.map?.dispose();o.material.dispose();}});renderer.dispose();renderer.domElement.remove();};
 },[]);
 return <div ref={host} className="scene" aria-label="Interactive 3D workspace. Select the monitor for projects or books for skills.">{failed&&<div className="scene-fallback">◇<p>Your next idea starts here.</p><small>3D isn’t available on this device. Explore using the navigation below.</small></div>}</div>;
}
