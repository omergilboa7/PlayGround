import * as THREE from './three.module.js';

/* ============================================================
   RED FRONTIER 3D — an original western open-world homage.
   All art + code procedural. No third-party assets.
   ============================================================ */
const $ = id => document.getElementById(id);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const lerp = (a,b,t)=>a+(b-a)*t;
const rand = (a,b)=>a+Math.random()*(b-a);
const randi = (a,b)=>Math.floor(rand(a,b+1));
const dist2d = (a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const TAU = Math.PI*2;

// ---------- tiny procedural audio ----------
const AudioSys = {
  ctx:null, master:null,
  init(){ if(this.ctx) return; try{
    this.ctx = new (window.AudioContext||window.webkitAudioContext)();
    this.master = this.ctx.createGain(); this.master.gain.value=0.5;
    this.master.connect(this.ctx.destination);
    this.wind();
  }catch(e){} },
  env(node,t0,a,peak,dur){ const g=node.gain; g.setValueAtTime(0.0001,t0); g.exponentialRampToValueAtTime(peak,t0+a); g.exponentialRampToValueAtTime(0.0001,t0+dur); },
  noiseBuf(dur=0.5){ const sr=this.ctx.sampleRate, b=this.ctx.createBuffer(1,sr*dur,sr), d=b.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; return b; },
  shot(){ if(!this.ctx) return; const t=this.ctx.currentTime;
    const src=this.ctx.createBufferSource(); src.buffer=this.noiseBuf(0.35);
    const f=this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.setValueAtTime(3200,t); f.frequency.exponentialRampToValueAtTime(220,t+0.22);
    const g=this.ctx.createGain(); this.env(g,t,0.004,0.9,0.3);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t); src.stop(t+0.35);
    const o=this.ctx.createOscillator(); o.type='square'; o.frequency.setValueAtTime(160,t); o.frequency.exponentialRampToValueAtTime(45,t+0.18);
    const g2=this.ctx.createGain(); this.env(g2,t,0.003,0.5,0.2); o.connect(g2); g2.connect(this.master); o.start(t); o.stop(t+0.22); },
  enemyShot(){ if(!this.ctx) return; const t=this.ctx.currentTime;
    const src=this.ctx.createBufferSource(); src.buffer=this.noiseBuf(0.25);
    const f=this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=1400;
    const g=this.ctx.createGain(); this.env(g,t,0.005,0.35,0.25);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t); },
  click(){ if(!this.ctx) return; const t=this.ctx.currentTime; const o=this.ctx.createOscillator(); o.type='square'; o.frequency.value=1200;
    const g=this.ctx.createGain(); this.env(g,t,0.002,0.15,0.06); o.connect(g); g.connect(this.master); o.start(t); o.stop(t+0.07); },
  reload(){ this.click(); setTimeout(()=>this.click(),140); setTimeout(()=>this.click(),300); },
  hit(){ if(!this.ctx) return; const t=this.ctx.currentTime; const o=this.ctx.createOscillator(); o.type='sawtooth';
    o.frequency.setValueAtTime(700,t); o.frequency.exponentialRampToValueAtTime(180,t+0.12);
    const g=this.ctx.createGain(); this.env(g,t,0.004,0.4,0.14); o.connect(g); g.connect(this.master); o.start(t); o.stop(t+0.15); },
  hurt(){ if(!this.ctx) return; const t=this.ctx.currentTime; const o=this.ctx.createOscillator(); o.type='sawtooth';
    o.frequency.setValueAtTime(220,t); o.frequency.exponentialRampToValueAtTime(70,t+0.3);
    const g=this.ctx.createGain(); this.env(g,t,0.005,0.6,0.32); o.connect(g); g.connect(this.master); o.start(t); o.stop(t+0.33); },
  coin(){ if(!this.ctx) return; const t=this.ctx.currentTime; [880,1320].forEach((fr,i)=>{ const o=this.ctx.createOscillator(); o.type='sine'; o.frequency.value=fr;
    const g=this.ctx.createGain(); this.env(g,t+i*0.09,0.005,0.35,0.12); o.connect(g); g.connect(this.master); o.start(t+i*0.09); o.stop(t+i*0.09+0.13); }); },
  whistle(){ if(!this.ctx) return; const t=this.ctx.currentTime; const o=this.ctx.createOscillator(); o.type='sine';
    o.frequency.setValueAtTime(900,t); o.frequency.linearRampToValueAtTime(1400,t+0.15); o.frequency.linearRampToValueAtTime(1100,t+0.3);
    const g=this.ctx.createGain(); this.env(g,t,0.02,0.3,0.35); o.connect(g); g.connect(this.master); o.start(t); o.stop(t+0.4); },
  gallop(){ if(!this.ctx) return; const t=this.ctx.currentTime; const src=this.ctx.createBufferSource(); src.buffer=this.noiseBuf(0.12);
    const f=this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=500;
    const g=this.ctx.createGain(); this.env(g,t,0.005,0.22,0.11); src.connect(f); f.connect(g); g.connect(this.master); src.start(t); },
  wind(){ const src=this.ctx.createBufferSource(); src.buffer=this.noiseBuf(4); src.loop=true;
    const f=this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=320;
    const g=this.ctx.createGain(); g.gain.value=0.05; src.connect(f); f.connect(g); g.connect(this.master); src.start(); }
};

// ---------- game state ----------
const G = {
  mode:'title', paused:false, dead:false, won:false,
  time:0, timeScale:1, dayT:0.32, // 0..1 (0.32 ~= morning)
  money:120, honor:0, wanted:0, wantedTimer:0, kills:0, bountiesDone:0, pelts:0,
  hp:100, maxHp:100, stam:100, deadeye:100, deadeyeOn:false, deadeyeCD:0,
  ammo:6, magSize:6, reloading:0,
  riding:false, aiming:false, sprinting:false,
  yaw:0.15, pitch:-0.16, camDist:8,
  killsThisRun:0, shotsFired:0,
  missionIndex:0, missionStage:'go-sheriff', // go-sheriff -> bounty loop -> done
  shake:0, slowmo:1,
};

// ---------- three setup ----------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({canvas, antialias:false, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d6);
scene.fog = new THREE.Fog(0xd8c49a, 70, 560);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth/window.innerHeight, 0.1, 1200);
camera.position.set(0,4,10);

const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a6b45, 0.95); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.9); sun.position.set(80,120,40); scene.add(sun);
const moonL = new THREE.DirectionalLight(0x8fa8ff, 0.0); moonL.position.set(-60,80,-40); scene.add(moonL);

window.addEventListener('resize', ()=>{
  camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- colliders ----------
const colliders = []; // {x,z,r}
function addCollider(x,z,r){ colliders.push({x,z,r}); }
function collide(pos, radius=0.7){
  for(const c of colliders){
    const dx=pos.x-c.x, dz=pos.z-c.z, d=Math.hypot(dx,dz), min=c.r+radius;
    if(d<min && d>0.0001){ pos.x=c.x+dx/d*min; pos.z=c.z+dz/d*min; }
  }
  const R=430; const d0=Math.hypot(pos.x,pos.z);
  if(d0>R){ pos.x*=R/d0; pos.z*=R/d0; }
}

// ---------- materials ----------
const M = {
  sand: new THREE.MeshLambertMaterial({color:0xd9b380}),
  sandDark: new THREE.MeshLambertMaterial({color:0xb98d55}),
  wood: new THREE.MeshLambertMaterial({color:0x7a5230}),
  woodDark: new THREE.MeshLambertMaterial({color:0x4e3319}),
  rock: new THREE.MeshLambertMaterial({color:0x9a7b62}),
  mesa: new THREE.MeshLambertMaterial({color:0xb25a32}),
  mesaTop: new THREE.MeshLambertMaterial({color:0xc98a52}),
  cactus: new THREE.MeshLambertMaterial({color:0x3f7d33}),
  pine: new THREE.MeshLambertMaterial({color:0x2e5b2e}),
  trunk: new THREE.MeshLambertMaterial({color:0x5a3a22}),
  clothRed: new THREE.MeshLambertMaterial({color:0x8e2f22}),
  clothBlue: new THREE.MeshLambertMaterial({color:0x2c4a72}),
  clothBrown: new THREE.MeshLambertMaterial({color:0x6b4a2a}),
  skin: new THREE.MeshLambertMaterial({color:0xd9a066}),
  black: new THREE.MeshLambertMaterial({color:0x1a120c}),
  horseBrown: new THREE.MeshLambertMaterial({color:0x6e4525}),
  horseBlack: new THREE.MeshLambertMaterial({color:0x2b1d12}),
  horseWhite: new THREE.MeshLambertMaterial({color:0xcfc3b0}),
  white: new THREE.MeshLambertMaterial({color:0xf3e9d2}),
  gold: new THREE.MeshLambertMaterial({color:0xffc93c, emissive:0x7a5200}),
  red: new THREE.MeshLambertMaterial({color:0xb03024}),
  canvasTent: new THREE.MeshLambertMaterial({color:0xd8c49a}),
  iron: new THREE.MeshLambertMaterial({color:0x3a3a3f}),
};

// ---------- world: ground ----------
function makeGround(){
  const geo = new THREE.PlaneGeometry(900,900,72,72);
  geo.rotateX(-Math.PI/2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count*3);
  const c1 = new THREE.Color(0xd9b380), c2 = new THREE.Color(0xc49a5e),
        c3 = new THREE.Color(0xb08148), c4 = new THREE.Color(0x9a7a4a);
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i), z=pos.getZ(i);
    const n = Math.sin(x*0.05)*Math.cos(z*0.043)+Math.sin(x*0.013+z*0.021)*0.7;
    const n2 = Math.sin(x*0.35)*Math.sin(z*0.31);
    let c = c1.clone();
    if(n>0.5) c.lerp(c2,0.6); else if(n<-0.4) c.lerp(c3,0.55);
    if(n2>0.75) c.lerp(c4,0.35);
    // town dirt area
    if(Math.abs(x)<26 && Math.abs(z)<75) c.lerp(new THREE.Color(0xa97e4e),0.55);
    // roads to camps
    colors[i*3]=c.r; colors[i*3+1]=c.g; colors[i*3+2]=c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors,3));
  const mat = new THREE.MeshLambertMaterial({vertexColors:true});
  const m = new THREE.Mesh(geo,mat); m.position.y=0; scene.add(m);
  // main street strip
  const road = new THREE.Mesh(new THREE.PlaneGeometry(9,150), new THREE.MeshLambertMaterial({color:0x8a6742}));
  road.rotation.x=-Math.PI/2; road.position.set(0,0.02,0); scene.add(road);
}
makeGround();

// ---------- sky: sun disc, stars, clouds, birds ----------
const skyGroup = new THREE.Group(); scene.add(skyGroup);
const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(9,12,12), new THREE.MeshBasicMaterial({color:0xfff3c0, fog:false}));
skyGroup.add(sunMesh);
const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(6,12,12), new THREE.MeshBasicMaterial({color:0xe8eeff, fog:false}));
skyGroup.add(moonMesh);
let starPts=null;
{
  const n=400, p=new Float32Array(n*3);
  for(let i=0;i<n;i++){ const th=rand(0,TAU), ph=rand(0.05,Math.PI/2.2), r=800;
    p[i*3]=Math.cos(th)*Math.cos(ph)*r; p[i*3+1]=Math.sin(ph)*r; p[i*3+2]=Math.sin(th)*Math.cos(ph)*r; }
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p,3));
  starPts=new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:2.2,sizeAttenuation:false,fog:false,transparent:true,opacity:0}));
  scene.add(starPts);
}
const clouds=[];
for(let i=0;i<12;i++){
  const c=new THREE.Mesh(new THREE.PlaneGeometry(rand(40,90),rand(10,20)),
    new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.75,fog:false,depthWrite:false}));
  c.position.set(rand(-500,500),rand(90,170),rand(-500,500));
  c.userData.v=rand(0.6,1.8); clouds.push(c); scene.add(c);
}
const birds=[];
for(let i=0;i<6;i++){
  const b=new THREE.Mesh(new THREE.ConeGeometry(0.35,1.6,4), new THREE.MeshBasicMaterial({color:0x201510}));
  b.userData={t:rand(0,TAU),r:rand(40,120),h:rand(25,55),s:rand(0.2,0.5)}; birds.push(b); scene.add(b);
}

// ---------- mesas / mountains backdrop ----------
function mesa(x,z,r,h){
  const g=new THREE.Group();
  const base=new THREE.Mesh(new THREE.CylinderGeometry(r*0.62,r,h,h*0.5? 7:7), M.mesa,); base.position.y=h/2;
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(r*0.64,r*0.62,3,7), M.mesaTop); cap.position.y=h+1;
  g.add(base,cap); g.position.set(x,0,z); scene.add(g); addCollider(x,z,r*0.95);
}
[[-320,-180,70,60],[280,-260,90,75],[-260,260,80,55],[330,220,65,70],[0,-420,110,85],[-420,40,90,65],[420,-40,80,60],[150,380,70,50],[-180,-360,60,48]].forEach(([x,z,r,h])=>mesa(x,z,r,h));
function mountain(x,z,r,h,color=0x8a5f52){
  const m=new THREE.Mesh(new THREE.ConeGeometry(r,h,5), new THREE.MeshLambertMaterial({color}));
  m.position.set(x,h/2-2,z); scene.add(m);
}
[[-500,-300,160,170],[500,-350,180,190],[-480,350,170,160],[520,330,150,175],[0,520,200,180]].forEach(([x,z,r,h])=>mountain(x,z,r,h));

// ---------- scattered nature (instanced where easy) ----------
const dummy = new THREE.Object3D();
function scatterInstanced(geo, mat, spots){
  const im = new THREE.InstancedMesh(geo, mat, spots.length);
  spots.forEach((s,i)=>{ dummy.position.set(s.x, s.y||0, s.z); dummy.rotation.y=s.ry||0;
    const sc=s.s||1; dummy.scale.set(sc,sc,sc); dummy.updateMatrix(); im.setMatrixAt(i,dummy.matrix); });
  im.instanceMatrix.needsUpdate=true; scene.add(im); return im;
}
const cactusSpots=[], rockSpots=[], pineSpots=[], grassSpots=[];
for(let i=0;i<130;i++){ const x=rand(-400,400), z=rand(-400,400);
  if(Math.abs(x)<30&&Math.abs(z)<80) continue; if(Math.hypot(x,z)>420) continue;
  cactusSpots.push({x,z,ry:rand(0,TAU),s:rand(0.7,1.6)}); addCollider(x,z,0.9); }
for(let i=0;i<170;i++){ const x=rand(-410,410), z=rand(-410,410);
  if(Math.abs(x)<28&&Math.abs(z)<78) continue;
  rockSpots.push({x,z,ry:rand(0,TAU),s:rand(0.5,2.2)}); }
for(let i=0;i<70;i++){ const x=rand(-400,400), z=rand(-400,400);
  if(Math.hypot(x,z)<90) continue;
  pineSpots.push({x,z,ry:rand(0,TAU),s:rand(0.8,1.7)}); addCollider(x,z,1.1); }
for(let i=0;i<380;i++){ const x=rand(-400,400), z=rand(-400,400);
  if(Math.abs(x)<26&&Math.abs(z)<78) continue; grassSpots.push({x,z:y0(x,z),ry:rand(0,TAU),s:rand(0.5,1.2)}); }
function y0(){ return 0; }
// cactus = trunk + arms (build 3 instanced meshes)
{
  const trunkG=new THREE.CylinderGeometry(0.55,0.65,5,7); trunkG.translate(0,2.5,0);
  scatterInstanced(trunkG, M.cactus, cactusSpots.map(s=>({...s, y:0})));
  const armG=new THREE.CylinderGeometry(0.35,0.35,2.2,6); armG.translate(0,1.1,0);
  const arms=cactusSpots.flatMap(s=>[{x:s.x+0.8,z:s.z,y:1.6,s:s.s,ry:0},{x:s.x-0.8,z:s.z,y:2.2,s:s.s,ry:0}]);
  const im2=scatterInstanced(armG, M.cactus, arms);
  im2.rotation.z=0;
}
scatterInstanced(new THREE.DodecahedronGeometry(1,0), M.rock, rockSpots);
scatterInstanced(new THREE.ConeGeometry(1.8,5,6), M.pine, pineSpots.map(s=>({...s,y:3.4})));
scatterInstanced(new THREE.CylinderGeometry(0.25,0.35,1.6,5), M.trunk, pineSpots.map(s=>({...s,y:0.8})));
scatterInstanced(new THREE.ConeGeometry(0.5,1.1,4), new THREE.MeshLambertMaterial({color:0xa8894a}), grassSpots);

// individual animated-free props: fences, lamps, tracks
const lampLights=[];
function lamp(x,z){
  const g=new THREE.Group();
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.16,5,6), M.iron); pole.position.y=2.5; g.add(pole);
  const bulb=new THREE.Mesh(new THREE.SphereGeometry(0.4,8,8), new THREE.MeshBasicMaterial({color:0xffd98a})); bulb.position.y=5.2; g.add(bulb);
  const pl=new THREE.PointLight(0xffb45c,0,26,1.8); pl.position.y=5.2; g.add(pl); lampLights.push({light:pl,bulb});
  g.position.set(x,0,z); scene.add(g); addCollider(x,z,0.5);
}
function fenceRun(x1,z1,x2,z2){
  const len=Math.hypot(x2-x1,z2-z1), n=Math.max(2,Math.floor(len/3));
  for(let i=0;i<=n;i++){ const t=i/n, x=lerp(x1,x2,t), z=lerp(z1,z2,t);
    const p=new THREE.Mesh(new THREE.BoxGeometry(0.25,1.3,0.25), M.woodDark); p.position.set(x,0.65,z); scene.add(p); }
  const ang=Math.atan2(x2-x1,z2-z1);
  for(const h of [0.6,1.05]){ const rail=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,len), M.wood);
    rail.position.set((x1+x2)/2,h,(z1+z2)/2); rail.rotation.y=ang+Math.PI/2; rail.rotation.y=-ang; scene.add(rail); }
}

// ---------- town: Dusty Gulch ----------
const townGroup=new THREE.Group(); scene.add(townGroup);
function building(x,z,w,h,d,color,sign){
  const g=new THREE.Group();
  const base=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), new THREE.MeshLambertMaterial({color})); base.position.y=h/2; g.add(base);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(w+1,h*0.22,d+1), M.woodDark); roof.position.y=h+h*0.11; g.add(roof);
  const door=new THREE.Mesh(new THREE.PlaneGeometry(1.6,2.6), M.black); door.position.set(0,1.3,d/2+0.02); g.add(door);
  for(let i=-1;i<=1;i++){ if(Math.abs(i)>w/4) continue;
    const win=new THREE.Mesh(new THREE.PlaneGeometry(1,1), new THREE.MeshBasicMaterial({color:0xffe9a8})); win.position.set(i*(w/3),h*0.62,d/2+0.02); g.add(win); }
  // false-front parapet
  const parapet=new THREE.Mesh(new THREE.BoxGeometry(w+0.4,1.4,0.3), new THREE.MeshLambertMaterial({color})); parapet.position.set(0,h+0.9,d/2); g.add(parapet);
  if(sign){ const cv=document.createElement('canvas'); cv.width=256; cv.height=64; const c=cv.getContext('2d');
    c.fillStyle='#2a1a0c'; c.fillRect(0,0,256,64); c.fillStyle='#ffd76e'; c.font='bold 30px Georgia'; c.textAlign='center'; c.fillText(sign,128,42);
    const tex=new THREE.CanvasTexture(cv);
    const sp=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w-1,7),1.4), new THREE.MeshBasicMaterial({map:tex})); sp.position.set(0,h-0.4,d/2+0.35); g.add(sp); }
  // porch
  const porch=new THREE.Mesh(new THREE.BoxGeometry(w+2,0.25,2.4), M.wood); porch.position.set(0,0.35,d/2+1.4); g.add(porch);
  g.position.set(x,0,z); if(x<0) g.rotation.y=Math.PI/2; else g.rotation.y=-Math.PI/2;
  townGroup.add(g); addCollider(x,z,Math.max(w,d)*0.62);
  return g;
}
building(-14,-52, 9,5,8, 0x9a6b42,'SALOON');
building( 14,-40, 9,5.5,8, 0x8a5a3a,'BANK');
building(-14,-24, 8,4.5,7, 0xa88a5a,'STORE');
building( 14,-12, 8,5,8, 0x7a6a8a,'SHERIFF');
building(-14,  4, 9,5,8, 0x96704a,'HOTEL');
building( 14, 20, 8,4.5,7, 0x8a6b42,'STABLE');
building(-14, 36, 7,6,7, 0xe8dcc2,'CHAPEL');
building( 14, 48, 8,4.5,8, 0x7a5230,'GUNSMITH');
// church steeple
{
  const st=new THREE.Mesh(new THREE.ConeGeometry(1.6,3.4,4), M.woodDark); st.position.set(-14,9.2,36); st.rotation.y=Math.PI/4; townGroup.add(st);
  const cross=new THREE.Mesh(new THREE.BoxGeometry(0.2,1.6,0.2), M.woodDark); cross.position.set(-14,11.5,36); townGroup.add(cross);
}
// water tower
{
  const g=new THREE.Group();
  for(const [lx,lz] of [[-2,-2],[2,-2],[-2,2],[2,2]]){ const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.25,9,6), M.woodDark); leg.position.set(lx,4.5,lz); g.add(leg); }
  const tank=new THREE.Mesh(new THREE.CylinderGeometry(3,3,4,10), new THREE.MeshLambertMaterial({color:0x7a5a3a})); tank.position.y=11; g.add(tank);
  const cone=new THREE.Mesh(new THREE.ConeGeometry(3.4,2,10), M.woodDark); cone.position.y=14; g.add(cone);
  g.position.set(24,0,-58); scene.add(g); addCollider(24,-58,4);
}
// train tracks (straight, decorative) + handcar
{
  for(let z=-300;z<300;z+=2.4){ const tie=new THREE.Mesh(new THREE.BoxGeometry(2.6,0.15,0.6), M.woodDark); tie.position.set(-42,0.08,z); scene.add(tie); }
  for(const dx of [-0.8,0.8]){ const rail=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.18,600), M.iron); rail.position.set(-42+dx,0.25,0); scene.add(rail); }
}
// lamps along street
for(const z of [-56,-32,-8,16,40,60]){ lamp(-6.5,z); lamp(6.5,z+6); }
// fences around town + ranch
fenceRun(-30,-70,30,-70); fenceRun(-30,70,30,70);
fenceRun(30,-70,60,-40); fenceRun(-30,-70,-60,-40);
fenceRun(40,60,90,40); fenceRun(-40,60,-90,40);
// campfire in town center plaza + stagecoach
const fireParticles=[];
let campfire;
{
  campfire=new THREE.Group();
  for(let i=0;i<5;i++){ const log=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.18,1.8,6), M.woodDark);
    log.rotation.z=Math.PI/2; log.rotation.y=i/5*TAU; log.position.y=0.25; campfire.add(log); }
  const stones=new THREE.Mesh(new THREE.TorusGeometry(1.1,0.25,6,10), M.rock); stones.rotation.x=Math.PI/2; stones.position.y=0.15; campfire.add(stones);
  const flame=new THREE.Mesh(new THREE.ConeGeometry(0.6,1.6,7), new THREE.MeshBasicMaterial({color:0xff8c2e,transparent:true,opacity:0.9}));
  flame.position.y=1.1; flame.name='flame'; campfire.add(flame);
  const pl=new THREE.PointLight(0xff8c3a,1.4,20,1.6); pl.position.y=1.6; campfire.add(pl); campfire.userData.light=pl;
  campfire.position.set(0,0,64); scene.add(campfire);
}
function stagecoach(x,z,ry){
  const g=new THREE.Group();
  const cab=new THREE.Mesh(new THREE.BoxGeometry(2.6,2,4), M.clothRed); cab.position.y=1.9; g.add(cab);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(2.8,0.25,4.2), M.woodDark); roof.position.y=3; g.add(roof);
  for(const [wx,wz] of [[-1.4,1.4],[1.4,1.4],[-1.4,-1.4],[1.4,-1.4]]){
    const w=new THREE.Mesh(new THREE.TorusGeometry(0.8,0.14,6,14), M.woodDark); w.position.set(wx,0.8,wz); g.add(w); }
  g.position.set(x,0,z); g.rotation.y=ry; scene.add(g); addCollider(x,z,3);
}
stagecoach(10,58,0.4); stagecoach(-52,20,1.2);

// ---------- character builders ----------
function mat(color){ return new THREE.MeshLambertMaterial({color}); }
function makeCowboy(coat=0x4a3220, hatC=0x2e1f12, skinC=0xd9a066){
  const g=new THREE.Group();
  const legMat=mat(0x2e2620);
  const legL=new THREE.Mesh(new THREE.BoxGeometry(0.32,1,0.32), legMat); legL.position.set(-0.22,0.5,0); g.add(legL);
  const legR=legL.clone(); legR.position.x=0.22; g.add(legR);
  const torso=new THREE.Mesh(new THREE.BoxGeometry(0.85,1.05,0.5), mat(coat)); torso.position.y=1.5; g.add(torso);
  const armL=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.95,0.26), mat(coat)); armL.position.set(-0.58,1.5,0); g.add(armL);
  const armR=armL.clone(); armR.position.x=0.58; g.add(armR);
  const gun=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,0.55), M.black); gun.position.set(0.58,1.05,0.3); g.add(gun);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.32,10,8), mat(skinC)); head.position.y=2.3; g.add(head);
  const brim=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,0.08,12), mat(hatC)); brim.position.y=2.52; g.add(brim);
  const top=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.33,0.35,10), mat(hatC)); top.position.y=2.72; g.add(top);
  g.userData={legL,legR,armL,armR,head};
  return g;
}
function makeHorse(color=0x6e4525){
  const g=new THREE.Group(); const hm=mat(color);
  const body=new THREE.Mesh(new THREE.BoxGeometry(1,1,2.4), hm); body.position.y=1.45; g.add(body);
  const neck=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.9,0.6), hm); neck.position.set(0,2,1.2); neck.rotation.x=0.5; g.add(neck);
  const head=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.5,0.9), hm); head.position.set(0,2.4,1.7); g.add(head);
  const earG=new THREE.ConeGeometry(0.1,0.3,4);
  const e1=new THREE.Mesh(earG,hm); e1.position.set(-0.15,2.7,1.5); g.add(e1);
  const e2=e1.clone(); e2.position.x=0.15; g.add(e2);
  const mane=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.7,1), M.black); mane.position.set(0,2.2,1.05); mane.rotation.x=0.5; g.add(mane);
  const tail=new THREE.Mesh(new THREE.BoxGeometry(0.16,1,0.16), M.black); tail.position.set(0,1.7,-1.25); tail.rotation.x=-0.4; g.add(tail);
  const saddle=new THREE.Mesh(new THREE.BoxGeometry(1.1,0.25,1), M.woodDark); saddle.position.set(0,2.05,0); g.add(saddle);
  const legs=[];
  for(const [lx,lz] of [[-0.35,0.85],[0.35,0.85],[-0.35,-0.85],[0.35,-0.85]]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(0.26,1.4,0.26), hm); leg.position.set(lx,0.7,lz); g.add(leg); legs.push(leg); }
  g.userData={legs,head,tail};
  return g;
}
function makeDeer(){
  const g=new THREE.Group(); const hm=mat(0x9a6b42);
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.7,1.5), hm); body.position.y=1; g.add(body);
  const neck=new THREE.Mesh(new THREE.BoxGeometry(0.25,0.7,0.3), hm); neck.position.set(0,1.5,0.7); g.add(neck);
  const head=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.32,0.55), hm); head.position.set(0,1.9,0.8); g.add(head);
  for(const s of [-1,1]){ const ant=new THREE.Mesh(new THREE.ConeGeometry(0.05,0.5,4), M.woodDark); ant.position.set(s*0.15,2.25,0.75); g.add(ant); }
  const legs=[];
  for(const [lx,lz] of [[-0.2,0.55],[0.2,0.55],[-0.2,-0.55],[0.2,-0.55]]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(0.14,1,0.14), hm); leg.position.set(lx,0.5,lz); g.add(leg); legs.push(leg); }
  g.userData={legs};
  return g;
}
// ---------- player / horse / entities ----------
const player = { mesh:makeCowboy(0x7a2e22, 0x2e1f12), pos:new THREE.Vector3(0,0,52), yaw:0, speed:0, walkPhase:0, meshYaw:0 };
player.mesh.position.copy(player.pos); scene.add(player.mesh);
const horse = { mesh:makeHorse(), pos:new THREE.Vector3(2,0,53.5), yaw:0, speed:0, phase:0, follow:true };
horse.mesh.position.copy(horse.pos); scene.add(horse.mesh);

const enemies=[], animals=[], pickups=[], tracers=[], hitsparks=[];
function spawnBandit(x,z,camp=null){
  const mesh=makeCowboy(Math.random()<0.5?0x5a2a2a:0x3a3a32, 0x1a1a1a);
  mesh.position.set(x,0,z); scene.add(mesh);
  const e={mesh,pos:new THREE.Vector3(x,0,z),hp:60,state:'idle',t:rand(0,3),wx:x,wz:z,walkPhase:rand(0,6),shootCD:rand(1,2.5),camp,dead:false,deathT:0,speed:rand(3.4,4.4)};
  enemies.push(e); return e;
}
function spawnLawman(x,z){
  const mesh=makeCowboy(0x2c4a72, 0x1a1a22); mesh.position.set(x,0,z); scene.add(mesh);
  const e={mesh,pos:new THREE.Vector3(x,0,z),hp:80,state:'idle',t:rand(0,3),wx:x,wz:z,walkPhase:rand(0,6),shootCD:rand(1,2),camp:null,dead:false,deathT:0,law:true,speed:4.6};
  enemies.push(e); return e;
}
function spawnAnimal(kind,x,z){
  const mesh = kind==='rabbit'
    ? new THREE.Mesh(new THREE.SphereGeometry(0.32,8,6), mat(0xb09a7a))
    : makeDeer();
  if(kind==='rabbit') mesh.position.set(x,0.3,z); else mesh.position.set(x,0,z);
  scene.add(mesh);
  const a={mesh,pos:new THREE.Vector3(x,0,z),kind,hp:kind==='rabbit'?15:35,wx:x,wz:z,t:rand(0,4),walkPhase:rand(0,6),dead:false,flee:0};
  animals.push(a); return a;
}
const CAMPS=[{x:120,z:-80,name:'Twin Rocks Camp'},{x:-150,z:-140,name:'Coyote Canyon Camp'},{x:60,z:220,name:'Rattlesnake Ridge Camp'},{x:-220,z:120,name:'Dead Oak Camp'}];
CAMPS.forEach(c=>{
  const tent=new THREE.Mesh(new THREE.ConeGeometry(2.4,3,6), M.canvasTent); tent.position.set(c.x,1.5,c.z); scene.add(tent);
  addCollider(c.x,c.z,2.6);
  const fl=new THREE.Mesh(new THREE.ConeGeometry(0.5,1.2,6), new THREE.MeshBasicMaterial({color:0xff8c2e})); fl.position.set(c.x+3,0.7,c.z+2); scene.add(fl); c.flame=fl;
  for(let i=0;i<3;i++) spawnBandit(c.x+rand(-8,8), c.z+rand(-8,8), c);
});
for(let i=0;i<4;i++) spawnBandit(rand(-20,20), rand(-60,60));
spawnLawman(-8,-14); spawnLawman(8,-10); spawnLawman(0,30);
for(let i=0;i<9;i++){ const x=rand(-300,300),z=rand(-300,300); if(Math.hypot(x,z)<60) continue; spawnAnimal('deer',x,z); }
for(let i=0;i<6;i++) spawnAnimal('rabbit',rand(-120,120),rand(-120,120));
// gold nuggets + tonics
const pickupKinds=['gold','tonic'];
for(let i=0;i<14;i++){
  const kind = i<8?'gold':'tonic';
  const mesh = kind==='gold'
    ? new THREE.Mesh(new THREE.OctahedronGeometry(0.45), M.gold)
    : new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.25,0.7,8), new THREE.MeshLambertMaterial({color:0x2e8e4e}));
  const x=rand(-260,260), z=rand(-260,260);
  if(Math.abs(x)<30&&Math.abs(z)<80){ i--; continue; }
  mesh.position.set(x,0.8,z); scene.add(mesh);
  pickups.push({mesh,kind,taken:false,phase:rand(0,TAU)});
}
// tracers pool
const tracerGeo=new THREE.BoxGeometry(0.08,0.08,1);
function fireTracer(from,dir,len,color=0xffe28a){
  const m=new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.95}));
  m.position.copy(from).addScaledVector(dir,len/2);
  m.lookAt(m.position.clone().add(dir)); m.scale.z=len;
  m.userData.life=0.09; scene.add(m); tracers.push(m);
}
function muzzle(pos){
  const m=new THREE.Mesh(new THREE.SphereGeometry(0.35,8,6), new THREE.MeshBasicMaterial({color:0xfff2b0,transparent:true,opacity:1}));
  m.position.copy(pos); m.userData.life=0.07; scene.add(m); hitsparks.push(m);
  const l=new THREE.PointLight(0xffc86e,2.5,12,1.8); l.position.copy(pos); l.userData.life=0.07; scene.add(l); hitsparks.push(l);
}
function blood(pos){
  for(let i=0;i<8;i++){
    const m=new THREE.Mesh(new THREE.SphereGeometry(0.12,5,4), new THREE.MeshBasicMaterial({color:0xa31616}));
    m.position.copy(pos); m.position.y+=rand(0.5,1.5);
    m.userData={life:rand(0.3,0.6),vx:rand(-4,4),vy:rand(1,6),vz:rand(-4,4)};
    scene.add(m); hitsparks.push(m);
  }
}
// ---------- input ----------
const keys={};
let pointerLocked=false;
addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
  keys[e.code]=true;
  if(e.code==='KeyE') tryInteract();
  if(e.code==='KeyR') startReload();
  if(e.code==='KeyQ') toggleDeadeye();
  if(e.code==='KeyB') bribe();
  if(e.code==='KeyM') whistleHorse();
  if(e.code==='KeyP'){ if(G.mode==='play') pauseGame(); else if(G.mode==='pause') resumeGame(); }
  if(e.code==='Escape'&&G.mode==='pause') resumeGame();
  if(['Space','ArrowUp','ArrowDown'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup',e=>{ keys[e.code]=false; });
canvas.addEventListener('click',()=>{
  AudioSys.init();
  if(G.mode!=='play'||G.paused) return;
  if(!pointerLocked && !isTouch) canvas.requestPointerLock?.();
  shoot();
});
addEventListener('contextmenu',e=>{ if(G.mode==='play') e.preventDefault(); });
addEventListener('mousedown',e=>{ if(e.button===2){ G.aiming=true; } });
addEventListener('mouseup',e=>{ if(e.button===2){ G.aiming=false; } });
document.addEventListener('pointerlockchange',()=>{ pointerLocked=document.pointerLockElement===canvas; });
addEventListener('mousemove',e=>{
  if(!pointerLocked||G.mode!=='play'||G.paused) return;
  G.yaw-=e.movementX*0.0026;
  G.pitch=clamp(G.pitch-e.movementY*0.0022,-0.9,0.55);
});
// touch
const isTouch = matchMedia('(pointer:coarse)').matches;
const stick={x:0,y:0,id:null}, touchLook={id:null,lx:0,ly:0};
if(isTouch){
  const st=$('stick'), knob=$('stick-knob');
  const setKnob=(dx,dy)=>{ knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`; };
  st.addEventListener('touchstart',e=>{ const t=e.changedTouches[0]; stick.id=t.identifier; },{passive:true});
  addEventListener('touchmove',e=>{
    for(const t of e.changedTouches){
      if(t.identifier===stick.id){
        const r=st.getBoundingClientRect();
        let dx=t.clientX-(r.left+r.width/2), dy=t.clientY-(r.top+r.height/2);
        const m=Math.hypot(dx,dy); if(m>44){ dx*=44/m; dy*=44/m; }
        setKnob(dx,dy); stick.x=dx/44; stick.y=dy/44;
      } else if(t.identifier===touchLook.id){
        G.yaw-=(t.clientX-touchLook.lx)*0.005; G.pitch=clamp(G.pitch-(t.clientY-touchLook.ly)*0.004,-0.9,0.55);
        touchLook.lx=t.clientX; touchLook.ly=t.clientY;
      }
    }
  },{passive:true});
  addEventListener('touchend',e=>{ for(const t of e.changedTouches){ if(t.identifier===stick.id){ stick.id=null; stick.x=stick.y=0; setKnob(0,0);} if(t.identifier===touchLook.id) touchLook.id=null; } },{passive:true});
  canvas.addEventListener('touchstart',e=>{ const t=e.changedTouches[0]; touchLook.id=t.identifier; touchLook.lx=t.clientX; touchLook.ly=t.clientY; AudioSys.init(); },{passive:true});
  document.querySelectorAll('#touch-btns button').forEach(b=>{
    b.addEventListener('touchstart',e=>{ e.preventDefault(); const a=b.dataset.a;
      if(a==='fire') shoot(); if(a==='mount') tryInteract();
      if(a==='run') keys.ShiftLeft=!keys.ShiftLeft; if(a==='eye') toggleDeadeye(); },{passive:false});
  });
}
// ---------- actions ----------
function whistleHorse(){ AudioSys.whistle(); const p=activePos(); horse.pos.set(p.x+rand(-4,4),0,p.z+rand(-4,4)); horse.follow=true; toast('🐎 Your horse hears the call…'); }
function bribe(){
  if(G.wanted<=0){ toast('🤠 No bounty on your head.'); return; }
  if(G.money<50){ toast('❌ Need $50 to bribe the sheriff.'); return; }
  G.money-=50; G.wanted=0; G.honor+=2; AudioSys.coin(); toast('🤝 Sheriff paid off. Wanted cleared.');
}
function startReload(){
  if(G.reloading>0||G.ammo===G.magSize) return;
  G.reloading=1.4; AudioSys.reload();
}
function toggleDeadeye(){
  if(G.deadeyeOn){ G.deadeyeOn=false; $('deadeye-tint').classList.remove('on'); return; }
  if(G.deadeye<25||G.deadeyeCD>0) return;
  G.deadeyeOn=true; $('deadeye-tint').classList.add('on'); AudioSys.click();
  setTimeout(()=>{ G.deadeyeOn=false; $('deadeye-tint').classList.remove('on'); G.deadeyeCD=4; },5000);
}
function activePos(){ return G.riding?horse.pos:player.pos; }
function gunTip(){
  const p=activePos().clone(); p.y+=1.6;
  const d=new THREE.Vector3(Math.sin(G.yaw)*-1,0,Math.cos(G.yaw)*-1);
  return {p:p.addScaledVector(d,1.2), d};
}
function shoot(){
  if(G.reloading>0) return;
  if(G.ammo<=0){ AudioSys.click(); $('reload-hint').textContent='PRESS R'; startReload(); return; }
  G.ammo--; G.shotsFired++; AudioSys.shot(); G.shake=Math.min(1,G.shake+0.35);
  const {p,d}=gunTip();
  d.y+=G.pitch*0.6; d.normalize();
  muzzle(p); fireTracer(p,d,26);
  scareAnimals(p,40);
  const spread = G.deadeyeOn?0.004:(G.aiming?0.012:0.03);
  d.x+=rand(-spread,spread); d.y+=rand(-spread,spread); d.z+=rand(-spread,spread); d.normalize();
  const ray=new THREE.Raycaster(p,d,0,90);
  const targets=[];
  enemies.forEach(e=>{ if(!e.dead) targets.push(e.mesh); });
  animals.forEach(a=>{ if(!a.dead) targets.push(a.mesh); });
  const hits=ray.intersectObjects(targets,true);
  if(hits.length){
    let obj=hits[0].object, root=obj;
    while(root.parent&&root.parent!==scene) root=root.parent;
    const e=enemies.find(e=>e.mesh===root), a=animals.find(a=>a.mesh===root);
    const hp=hits[0].point;
    if(e){ damageEnemy(e, G.deadeyeOn?50:randi(34,55), hp); }
    else if(a){ damageAnimal(a, G.deadeyeOn?60:randi(25,45), hp); }
  }
  if(!G.riding) player.mesh.userData.armR.rotation.x=-1.2;
  setTimeout(()=>{ if(!G.riding) player.mesh.userData.armR.rotation.x=0; },120);
  if(Math.abs(player.pos.x)<30&&Math.abs(player.pos.z)<80&&G.wanted<3){ G.wanted=Math.min(5,G.wanted+0.6); }
  if(G.ammo===0) startReload();
  updateAmmo();
}
function damageEnemy(e,dmg,point){
  if(e.dead) return;
  e.hp-=dmg; blood(point||e.pos); AudioSys.hit(); hitmark();
  e.state='chase';
  if(e.hp<=0){
    e.dead=true; e.deathT=0; G.kills++; G.killsThisRun++;
    const reward=e.law?-40:randi(15,45);
    if(e.law){ G.honor-=8; G.wanted=Math.min(5,G.wanted+2); feed('🔵 Lawman down! Honor −8'); }
    else {
      G.money+=reward; G.honor+=e.camp?4:1; AudioSys.coin();
      feed(`💀 Outlaw dropped +$${reward}`);
      if(e.camp) checkCampCleared(e.camp);
    }
    updateHUD();
  }
}
function damageAnimal(a,dmg,point){
  if(a.dead) return; a.hp-=dmg; blood(point||a.pos); AudioSys.hit(); hitmark(); a.flee=6;
  if(a.hp<=0){ a.dead=true; G.pelts++; G.money+=randi(8,20); G.honor-=1; AudioSys.coin(); feed(`🦌 Pelt sold +$ · ${G.pelts} pelts`); updateHUD(); }
}
function scareAnimals(p,r){ animals.forEach(a=>{ if(!a.dead&&dist2d(a.pos,p)<r) a.flee=6; }); }
// ---------- missions ----------
const BOUNTIES=[
  {camp:0, name:'"Black Jack" Ketchum', reward:150},
  {camp:1, name:'"Rattlesnake" Rosa', reward:220},
  {camp:2, name:'"Deadeye" Dalton', reward:300},
  {camp:3, name:'Baron "Hangman" Hodge', reward:450},
];
function sheriffPos(){ return {x:14,z:-12}; }
function currentTarget(){
  if(G.missionStage==='go-sheriff') return {x:sheriffPos().x,z:sheriffPos().z,label:'Sheriff'};
  if(G.missionStage==='bounty'&&G.missionIndex<BOUNTIES.length){ const c=CAMPS[BOUNTIES[G.missionIndex].camp]; return {x:c.x,z:c.z,label:c.name}; }
  return null;
}
function missionText(){
  if(G.missionStage==='go-sheriff') return 'Talk to the Sheriff in Dusty Gulch — follow the ★ marker (ride the road south).';
  if(G.missionStage==='bounty'&&G.missionIndex<BOUNTIES.length){
    const b=BOUNTIES[G.missionIndex];
    return `Bounty ${G.missionIndex+1}/4: Eliminate ${b.name} at ${CAMPS[b.camp].name}. Reward $${b.reward}.`;
  }
  return 'All bounties claimed — you are a Legend. Roam, hunt, survive.';
}
function checkCampCleared(camp){
  if(G.missionStage!=='bounty'||G.missionIndex>=BOUNTIES.length) return;
  const b=BOUNTIES[G.missionIndex];
  if(CAMPS[b.camp]!==camp) return;
  const alive=enemies.filter(e=>!e.dead&&e.camp===camp).length;
  if(alive===0){
    G.money+=b.reward; G.honor+=10; G.bountiesDone++; AudioSys.coin();
    banner(`BOUNTY CLAIMED`,`${b.name} — +$${b.reward}`);
    feed(`★ Bounty ${G.missionIndex+1}/4 complete +$${b.reward}`);
    G.missionIndex++;
    if(G.missionIndex>=BOUNTIES.length){
      G.missionStage='done'; G.won=true;
      $('win-stats').textContent=`$${G.money} earned · ${G.kills} outlaws · ${G.pelts} pelts · Honor ${honorName()}`;
      setTimeout(()=>{ $('win-screen').classList.remove('hidden'); },1600);
    } else {
      const nb=BOUNTIES[G.missionIndex];
      banner('NEW BOUNTY',`${nb.name} — ${CAMPS[nb.camp].name} · $${nb.reward}`);
    }
    updateHUD();
  }
}
function talkToSheriff(){
  if(G.missionStage!=='go-sheriff') return;
  G.missionStage='bounty'; AudioSys.coin();
  const b=BOUNTIES[0];
  banner('FIRST BOUNTY',`${b.name} — ${CAMPS[b.camp].name}`);
  toast('★ New bounty pinned to your compass');
  updateHUD();
}
function tryInteract(){
  if(G.mode!=='play'||G.paused) return;
  AudioSys.init();
  const p=player.pos;
  if(!G.riding && dist2d(p,horse.pos)<4.5){ mountHorse(); return; }
  if(G.riding){ dismountHorse(); return; }
  // sheriff talk
  if(G.missionStage==='go-sheriff'&&Math.hypot(p.x-sheriffPos().x,p.z-sheriffPos().z)<6){ talkToSheriff(); return; }
  // loot dead
  for(const e of enemies){ if(e.dead&&!e.looted&&dist2d(p,e.pos)<2.4){ e.looted=true; const l=randi(5,25); G.money+=l; AudioSys.coin(); feed(`💰 Looted +$${l}`); updateHUD(); return; } }
  // pickups
  for(const k of pickups){ if(!k.taken&&dist2d(p,k.mesh.position)<2.4){
    k.taken=true; scene.remove(k.mesh);
    if(k.kind==='gold'){ G.money+=randi(20,50); AudioSys.coin(); feed('✨ Gold nugget sold +$'); }
    else { G.hp=Math.min(G.maxHp,G.hp+45); toast('💚 Health tonic +45'); }
    updateHUD(); return; } }
}
function mountHorse(){ G.riding=true; AudioSys.whistle(); toast('🐎 Mounted — Shift to gallop'); }
function dismountHorse(){ G.riding=false; player.pos.set(horse.pos.x+1.2,0,horse.pos.z+0.5); }
// ---------- HUD ----------
function feed(t){ const kf=$('killfeed'); const d=document.createElement('div'); d.textContent=t; kf.prepend(d); while(kf.children.length>4) kf.lastChild.remove(); setTimeout(()=>d.remove(),7000); }
let toastT=null;
function toast(t){ const el=$('toast'); el.textContent=t; el.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove('show'),2600); }
function banner(title,sub){ $('mb-title').textContent=title; $('mb-sub').textContent=sub||'';
  const b=$('mission-banner'); b.classList.add('show'); clearTimeout(b._t); b._t=setTimeout(()=>b.classList.remove('show'),3200); }
function hitmark(){ const h=$('hitmarker'); h.classList.remove('show'); void h.offsetWidth; h.classList.add('show'); }
function honorName(){ if(G.honor>=25) return 'Legend'; if(G.honor>=10) return 'Hero'; if(G.honor>=0) return 'Neutral'; if(G.honor>=-10) return 'Outlaw'; return 'Desperado'; }
function updateAmmo(){
  let s=''; for(let i=0;i<G.magSize;i++) s+=`<span class="${i<G.ammo?'':'spent'}">▮</span>`;
  $('ammo-pips').innerHTML=s;
  $('reload-hint').textContent = G.reloading>0 ? 'RELOADING…' : (G.ammo===0?'PRESS R':'');
}
function updateHUD(){
  $('hp-fill').style.width=(G.hp/G.maxHp*100)+'%';
  $('st-fill').style.width=G.stam+'%';
  $('de-fill').style.width=G.deadeye+'%';
  $('money').textContent='$'+G.money;
  $('honor').textContent='🤠 Honor: '+honorName();
  $('wanted').textContent='★'.repeat(Math.round(G.wanted))+'☆'.repeat(5-Math.round(G.wanted));
  $('obj-text').textContent=missionText();
  updateAmmo();
}
// minimap
const mm=$('minimap').getContext('2d');
function drawMinimap(){
  const S=180,C=90,R=70;
  mm.clearRect(0,0,S,S);
  mm.fillStyle='#211507'; mm.beginPath(); mm.arc(C,C,88,0,TAU); mm.fill();
  const p=activePos();
  const w2m=(dx,dz)=>[C+dx*0.35, C+dz*0.35];
  // town
  mm.fillStyle='#8a6b3a';
  let [tx,ty]=w2m(-p.x,-p.z); mm.fillRect(tx-8,ty-14,16,28);
  // camps red
  mm.fillStyle='#c0392b';
  CAMPS.forEach(c=>{ const [x,y]=w2m(c.x-p.x,c.z-p.z); if(Math.hypot(x-C,y-C)<80){ mm.beginPath(); mm.arc(x,y,4,0,TAU); mm.fill(); } });
  // target star
  const t=currentTarget();
  if(t){ const [x,y]=w2m(t.x-p.x,t.z-p.z); const cl=Math.max(Math.abs(x-C),Math.abs(y-C));
    const cx=cl>75?C+(x-C)/cl*75:x, cy=cl>75?C+(y-C)/cl*75:y;
    mm.fillStyle='#ffd76e'; mm.font='14px serif'; mm.fillText('★',cx-6,cy+5); }
  // horse
  const [hx,hy]=w2m(horse.pos.x-p.x,horse.pos.z-p.z);
  if(Math.hypot(hx-C,hy-C)<80){ mm.fillStyle='#fff'; mm.font='12px serif'; mm.fillText('🐎',hx-6,hy+4); }
  // enemies nearby
  enemies.forEach(e=>{ if(e.dead) return; const [x,y]=w2m(e.pos.x-p.x,e.pos.z-p.z);
    if(Math.hypot(x-C,y-C)<80){ mm.fillStyle=e.law?'#5ca9ff':'#ff6b5b'; mm.beginPath(); mm.arc(x,y,2.5,0,TAU); mm.fill(); } });
  // player arrow
  mm.save(); mm.translate(C,C); mm.rotate(Math.atan2(Math.sin(G.yaw)*-1,Math.cos(G.yaw)*-1)*-1+Math.PI);
  mm.fillStyle='#ffd76e'; mm.beginPath(); mm.moveTo(0,-8); mm.lineTo(5,6); mm.lineTo(-5,6); mm.closePath(); mm.fill(); mm.restore();
  // north
  mm.fillStyle='#e8cf9a'; mm.font='11px monospace'; mm.fillText('N',C-4,14);
}
// compass
function drawCompass(){
  const el=$('compass-strip');
  const pts=[['N',0],['NE',45],['E',90],['SE',135],['S',180],['SW',225],['W',270],['NW',315]];
  let deg=((-G.yaw*180/Math.PI)%360+360)%360;
  let s='';
  const t=currentTarget();
  let targetDeg=null;
  if(t){ const p=activePos(); targetDeg=((Math.atan2(-(t.x-p.x),-(t.z-p.z))*180/Math.PI)+360)%360; }
  for(let d=-120;d<480;d+=15){
    const a=((d%360)+360)%360;
    const x=(d-deg)*2.2+210;
    if(x<-20||x>440) continue;
    const card=pts.find(q=>q[1]===a);
    s+=`<span style="position:absolute;left:${x}px;color:${card?'#ffd76e':'#8a7a5a'}">${card?card[0]:'·'}</span>`;
    if(targetDeg!==null){ let diff=((targetDeg-a)+540)%360-180; if(Math.abs(diff)<4) s+=`<span style="position:absolute;left:${x}px;top:12px;color:#ff5b4d">★</span>`; }
  }
  el.innerHTML=s;
}
// ---------- per-frame updates ----------
function animCowboy(mesh,phase,moving){
  const u=mesh.userData; if(!u.legL) return;
  const a=moving?Math.sin(phase)*0.55:0;
  u.legL.rotation.x=a; u.legR.rotation.x=-a;
  u.armL.rotation.x=-a*0.7; if(Math.abs(u.armR.rotation.x+1.2)>0.01) u.armR.rotation.x=a*0.7;
  mesh.position.y+=Math.abs(Math.sin(phase))*0.06;
}
function animHorse(mesh,phase,speed){
  const legs=mesh.userData.legs; if(!legs) return;
  const a=Math.sin(phase)*(speed>10?0.7:0.45);
  legs[0].rotation.x=a; legs[3].rotation.x=a; legs[1].rotation.x=-a; legs[2].rotation.x=-a;
  mesh.userData.tail.rotation.x=-0.4+Math.sin(phase*0.5)*0.2;
}
let gallopT=0;
function updatePlayer(dt){
  const sprint=(keys.ShiftLeft||keys.ShiftRight||keys.Shift);
  G.sprinting=!!sprint;
  let ix=0,iz=0;
  if(keys.KeyW||keys.ArrowUp) iz+=1; if(keys.KeyS||keys.ArrowDown) iz-=1;
  if(keys.KeyA||keys.ArrowLeft) ix-=1; if(keys.KeyD||keys.ArrowRight) iz+=0, ix+=1;
  ix+=stick.x; iz-=stick.y;
  const m=Math.hypot(ix,iz); if(m>1){ ix/=m; iz/=m; }
  if(G.riding){
    const maxSp = sprint&&G.stam>1?17:9;
    const target = iz*maxSp;
    horse.speed=lerp(horse.speed,target,1-Math.pow(0.02,dt));
    if(Math.abs(horse.speed)>0.5&&iz!==0) horse.yaw=lerpAngle(horse.yaw,G.yaw+Math.PI+(ix*0.5),dt*3);
    else if(Math.abs(horse.speed)<1) horse.yaw=lerpAngle(horse.yaw,G.yaw+Math.PI,dt*2);
    horse.pos.x+=Math.sin(horse.yaw)*-1*horse.speed*dt*-1;
    horse.pos.z+=Math.cos(horse.yaw)*-1*horse.speed*dt*-1;
    collide(horse.pos,1.1);
    horse.pos.y=0;
    horse.phase+=dt*(2+Math.abs(horse.speed)*0.9);
    animHorse(horse.mesh,horse.phase,Math.abs(horse.speed));
    horse.mesh.position.copy(horse.pos); horse.mesh.rotation.y=horse.yaw;
    player.pos.copy(horse.pos); player.mesh.visible=false;
    if(Math.abs(horse.speed)>10){ G.stam=Math.max(0,G.stam-dt*9); gallopT+=dt; if(gallopT>0.28){ gallopT=0; AudioSys.gallop(); } }
    else G.stam=Math.min(100,G.stam+dt*7);
    // auto-follow off when riding
    // interact prompt near nothing
    $('interact-prompt').style.display='none';
  } else {
    player.mesh.visible=true;
    const run = sprint&&G.stam>1;
    const maxSp = run?9:5.2;
    // camera-relative
    const sin=Math.sin(G.yaw), cos=Math.cos(G.yaw);
    const wx=(ix*cos-iz*sin)*maxSp, wz=(-ix*sin-iz*cos)*maxSp*-1;
    // simpler: forward = -sin,-cos
    const fx=-sin, fz=-cos, rx=-fz, rz=fx;
    const vx=(rx*ix+fx*iz)*maxSp, vz=(rz*ix+fz*iz)*maxSp;
    player.pos.x+=vx*dt; player.pos.z+=vz*dt;
    collide(player.pos,0.7);
    player.speed=Math.hypot(vx,vz);
    if(player.speed>0.5){ player.meshYaw=lerpAngle(player.meshYaw,Math.atan2(vx,vz),dt*10); }
    player.walkPhase+=dt*(2+player.speed*1.4);
    animCowboy(player.mesh,player.walkPhase,player.speed>0.5);
    player.mesh.position.copy(player.pos); player.mesh.rotation.y=player.meshYaw;
    if(run&&player.speed>1) G.stam=Math.max(0,G.stam-dt*11); else G.stam=Math.min(100,G.stam+dt*9);
    // horse follow
    if(horse.follow&&!G.riding){
      const d=dist2d(horse.pos,player.pos);
      if(d>9){ const a=Math.atan2(horse.pos.x-player.pos.x,horse.pos.z-player.pos.z);
        horse.yaw=lerpAngle(horse.yaw,a,dt*2);
        horse.pos.x-=Math.sin(horse.yaw)*dt*8.5; horse.pos.z-=Math.cos(horse.yaw)*dt*8.5;
        horse.phase+=dt*9; animHorse(horse.mesh,horse.phase,7);
        horse.mesh.position.copy(horse.pos); horse.mesh.rotation.y=horse.yaw;
      }
    }
    // interact prompt
    let prompt='';
    if(dist2d(player.pos,horse.pos)<4.5) prompt='Press <b>E</b> — Mount horse 🐎';
    else if(G.missionStage==='go-sheriff'&&Math.hypot(player.pos.x-sheriffPos().x,player.pos.z-sheriffPos().z)<6) prompt='Press <b>E</b> — Talk to Sheriff ★';
    else {
      for(const e of enemies){ if(e.dead&&!e.looted&&dist2d(player.pos,e.pos)<2.4){ prompt='Press <b>E</b> — Loot 💰'; break; } }
      if(!prompt) for(const k of pickups){ if(!k.taken&&dist2d(player.pos,k.mesh.position)<2.6){ prompt=k.kind==='gold'?'Press <b>E</b> — Take gold ✨':'Press <b>E</b> — Drink tonic 💚'; break; } }
    }
    const ip=$('interact-prompt');
    if(prompt){ ip.innerHTML=prompt; ip.style.display='block'; } else ip.style.display='none';
  }
  if(G.reloading>0){ G.reloading-=dt; if(G.reloading<=0){ G.ammo=G.magSize; updateAmmo(); } }
  if(G.deadeyeOn){ G.deadeye=Math.max(0,G.deadeye-dt*14); if(G.deadeye<=0){ toggleDeadeye(); } }
  else { G.deadeye=Math.min(100,G.deadeye+dt*4); G.deadeyeCD=Math.max(0,G.deadeyeCD-dt); }
  G.wantedTimer+=dt;
  if(G.wanted>0&&G.wantedTimer>6){ G.wantedTimer=0; G.wanted=Math.max(0,G.wanted-0.5); }
}
function lerpAngle(a,b,t){ let d=(b-a+Math.PI*3)%TAU-Math.PI; return a+d*Math.min(1,t); }
function updateEnemies(dt){
  const pp=activePos();
  // respawn wild bandits slowly
  if(enemies.filter(e=>!e.dead&&!e.law&&!e.camp).length<3&&Math.random()<dt*0.05){
    const a=rand(0,TAU), r=rand(60,120);
    spawnBandit(clamp(pp.x+Math.cos(a)*r,-300,300), clamp(pp.z+Math.sin(a)*r,-300,300));
  }
  for(const e of enemies){
    if(e.dead){ e.deathT+=dt; e.mesh.rotation.x=Math.min(Math.PI/2,e.deathT*4); if(e.deathT>25&&!e.law&&!e.camp){ scene.remove(e.mesh); e.gone=true; } continue; }
    const d=dist2d(e.pos,pp);
    const aggroR = e.law ? (G.wanted>0?90:8) : (e.camp? 70 : 45);
    const shooting = (d<aggroR&&(e.camp||e.law? (e.camp||G.wanted>0||G.killsThisRun>0||d<20) : (d<30||e.state==='chase')));
    if(shooting) e.state='chase'; else if(d>aggroR+25) e.state='idle';
    if(e.state==='chase'){
      const a=Math.atan2(pp.x-e.pos.x,pp.z-e.pos.z);
      e.mesh.rotation.y=a;
      if(d>(e.law?18:22)){ e.pos.x+=Math.sin(a)*e.speed*dt; e.pos.z+=Math.cos(a)*e.speed*dt; collide(e.pos,0.7); e.walkPhase+=dt*9; animCowboy(e.mesh,e.walkPhase,true); }
      e.shootCD-=dt*(G.deadeyeOn?0.35:1);
      if(e.shootCD<=0&&d<55){
        e.shootCD=rand(1.2,2.8);
        AudioSys.enemyShot();
        const from=e.pos.clone(); from.y=1.6;
        const dir=pp.clone().add(new THREE.Vector3(0,1.2,0)).sub(from).normalize();
        dir.x+=rand(-0.06,0.06); dir.y+=rand(-0.03,0.03); dir.z+=rand(-0.06,0.06);
        fireTracer(from,dir.normalize(),d,0xff7a5c);
        if(Math.random()<(e.law?0.35:0.28)) damagePlayer(randi(6,14));
      }
    } else {
      e.t+=dt;
      if(e.t>rand(3,6)){ e.t=0; e.wx=e.pos.x+rand(-12,12); e.wz=e.pos.z+rand(-12,12); }
      const dx=e.wx-e.pos.x, dz=e.wz-e.pos.z, dd=Math.hypot(dx,dz);
      if(dd>1){ const a=Math.atan2(dx,dz); e.mesh.rotation.y=a; e.pos.x+=Math.sin(a)*1.6*dt; e.pos.z+=Math.cos(a)*1.6*dt; e.walkPhase+=dt*5; animCowboy(e.mesh,e.walkPhase,true); }
      else animCowboy(e.mesh,e.walkPhase,false);
    }
    e.mesh.position.copy(e.pos);
  }
  for(let i=enemies.length-1;i>=0;i--) if(enemies[i].gone) enemies.splice(i,1);
}
function updateAnimals(dt){
  const pp=activePos();
  for(const a of animals){
    if(a.dead){ a.mesh.rotation.x=Math.min(Math.PI/2,(a.mesh.rotation.x||0)+dt*4); continue; }
    const d=dist2d(a.pos,pp);
    if(d<18) a.flee=4;
    a.t-=dt;
    if(a.flee>0){
      a.flee-=dt;
      const ang=Math.atan2(a.pos.x-pp.x,a.pos.z-pp.z);
      const sp=a.kind==='rabbit'?9:8;
      a.pos.x+=Math.sin(ang)*sp*dt; a.pos.z+=Math.cos(ang)*sp*dt;
      a.mesh.rotation.y=ang; a.walkPhase+=dt*12;
      if(a.mesh.userData.legs) a.mesh.userData.legs.forEach((l,i)=>l.rotation.x=Math.sin(a.walkPhase+i*Math.PI)*0.7);
    } else {
      if(a.t<=0){ a.t=rand(2,6); a.wx=a.pos.x+rand(-20,20); a.wz=a.pos.z+rand(-20,20); }
      const dx=a.wx-a.pos.x,dz=a.wz-a.pos.z,dd=Math.hypot(dx,dz);
      if(dd>1.5){ const ang=Math.atan2(dx,dz); a.mesh.rotation.y=ang;
        a.pos.x+=Math.sin(ang)*1.5*dt; a.pos.z+=Math.cos(ang)*1.5*dt; a.walkPhase+=dt*5;
        if(a.mesh.userData.legs) a.mesh.userData.legs.forEach((l,i)=>l.rotation.x=Math.sin(a.walkPhase+i*Math.PI)*0.4);
      }
    }
    if(a.kind==='rabbit'){ a.mesh.position.set(a.pos.x,0.3+Math.abs(Math.sin(a.walkPhase*0.7))*0.25,a.pos.z); }
    else a.mesh.position.copy(a.pos);
    collide(a.pos,0.5);
  }
}
function damagePlayer(dmg){
  if(G.dead||G.mode!=='play') return;
  G.hp-=dmg; AudioSys.hurt(); G.shake=Math.min(1,G.shake+0.3);
  const f=$('damage-flash'); f.style.opacity=0.9; setTimeout(()=>f.style.opacity=0,180);
  if(G.hp<=0){ G.hp=0; die(); }
  updateHUD();
}
function die(){
  G.dead=true; G.mode='dead';
  document.exitPointerLock?.();
  $('dead-sub').textContent=`The frontier claims another soul. Outlaws: ${G.kills} · Bounties: ${G.bountiesDone}/4`;
  $('dead-screen').classList.remove('hidden');
}
function respawn(){
  G.money=Math.max(0,G.money-20); G.hp=G.maxHp; G.stam=100; G.ammo=G.magSize; G.wanted=0;
  G.dead=false; G.mode='play';
  player.pos.set(0,0,52); horse.pos.set(2,0,53.5);
  $('dead-screen').classList.add('hidden'); updateHUD(); toast('🩺 Patched up by the doctor (-$20)');
}
function updateCamera(dt){
  const target=G.riding?horse.pos:player.pos;
  const wantDist=G.aiming?4.2:(G.riding?9.5:8);
  G.camDist=lerp(G.camDist,wantDist,dt*4);
  const cx=target.x+Math.sin(G.yaw)*Math.cos(G.pitch)*G.camDist;
  const cz=target.z+Math.cos(G.yaw)*Math.cos(G.pitch)*G.camDist;
  const cy=target.y+2.1-Math.sin(G.pitch)*G.camDist;
  camera.position.lerp(new THREE.Vector3(cx,Math.max(1.2,cy),cz),1-Math.pow(0.0001,dt));
  const look=target.clone(); look.y+=G.riding?2.2:1.8;
  if(G.aiming){ look.x+=Math.sin(G.yaw)*-8; look.z+=Math.cos(G.yaw)*-8; }
  camera.lookAt(look);
  if(G.shake>0){ G.shake=Math.max(0,G.shake-dt*2.2);
    camera.position.x+=rand(-1,1)*G.shake*0.25; camera.position.y+=rand(-1,1)*G.shake*0.25; }
  $('crosshair').classList.toggle('aim',G.aiming);
}
function updateSky(dt){
  G.dayT=(G.dayT+dt/480)%1; // 8-min day
  const t=G.dayT;
  const sunA=t*TAU-Math.PI/2;
  const se=Math.sin(sunA);
  sunMesh.position.set(Math.cos(sunA)*600,Math.sin(sunA)*500,120);
  moonMesh.position.set(-Math.cos(sunA)*600,-Math.sin(sunA)*500,-120);
  const day=clamp(se*1.6+0.25,0,1);
  const dusk=clamp(1-Math.abs(se)*3,0,1);
  const sky=new THREE.Color().setHSL(0.58-day*0.06, lerp(0.15,0.55,day), lerp(0.06,0.62,day)+dusk*0.08);
  if(dusk>0) sky.lerp(new THREE.Color(0xe8734a),dusk*0.45);
  scene.background=sky; scene.fog.color.copy(sky).lerp(new THREE.Color(0xd8c49a),0.4);
  sun.intensity=lerp(0.05,1.9,day); sun.color.setHSL(0.11,dusk*0.7,lerp(0.75,0.92,day));
  hemi.intensity=lerp(0.25,0.95,day);
  moonL.intensity=lerp(0.35,0,day);
  starPts.material.opacity=lerp(0.9,0,day);
  const night=1-day;
  lampLights.forEach(l=>{ const on=night>0.25; l.light.visible=on; if(on) l.light.intensity=night*2.2; l.bulb.material.color.setHex(night>0.3?0xffd98a:0x8a7a5a); });
  if(campfire){ campfire.userData.light.intensity=1.2+Math.sin(G.time*9)*0.3+night*0.8;
    const f=campfire.getObjectByName('flame'); if(f){ f.scale.y=1+Math.sin(G.time*11)*0.2; } }
  CAMPS.forEach(c=>{ if(c.flame){ c.flame.scale.y=1+Math.sin(G.time*10+c.x)*0.25; } });
  clouds.forEach(c=>{ c.position.x+=c.userData.v*dt*3; if(c.position.x>550) c.position.x=-550; c.lookAt(camera.position); c.material.opacity=lerp(0.12,0.75,day); });
  birds.forEach(b=>{ const u=b.userData; u.t+=dt*u.s; b.position.set(Math.cos(u.t)*u.r, u.h+Math.sin(G.time+u.r)*2, Math.sin(u.t)*u.r); b.rotation.y=-u.t; });
  const hh=Math.floor(t*24), mmn=Math.floor((t*24-hh)*60);
  $('clock').textContent=`${se>0?'☀':'🌙'} ${String(hh).padStart(2,'0')}:${String(mmn).padStart(2,'0')}`;
}
// ---------- menus ----------
function pauseGame(){ if(G.mode!=='play') return; G.mode='pause'; G.paused=true; document.exitPointerLock?.(); $('pause-screen').classList.remove('hidden'); }
function resumeGame(){ if(G.mode!=='pause') return; G.mode='play'; G.paused=false; $('pause-screen').classList.add('hidden'); }
$('play-btn').addEventListener('click',()=>{ AudioSys.init(); G.mode='play'; $('title-screen').classList.add('hidden'); banner('RED FRONTIER','Bring justice to Dusty Gulch — find the Sheriff ★'); updateHUD(); });
$('resume-btn').addEventListener('click',resumeGame);
$('restart-btn').addEventListener('click',()=>location.reload());
$('respawn-btn').addEventListener('click',respawn);
$('keep-btn').addEventListener('click',()=>$('win-screen').classList.add('hidden'));
addEventListener('pointerdown',()=>AudioSys.init(),{once:true});
// ---------- main loop ----------
const clock=new THREE.Clock();
let hudT=0, mmT=0, fpsLow=0;
function loop(){
  requestAnimationFrame(loop);
  let dt=Math.min(clock.getDelta(),0.05);
  G.time+=dt;
  const targetScale=G.deadeyeOn?0.35:1;
  G.slowmo=lerp(G.slowmo,targetScale,dt*6);
  const gdt=dt*G.slowmo;
  if(G.mode==='play'&&!G.paused&&!G.dead){
    updatePlayer(gdt); updateEnemies(gdt); updateAnimals(gdt);
    // pickups spin
    pickups.forEach(k=>{ if(!k.taken){ k.phase+=dt*2; k.mesh.rotation.y+=dt*2; k.mesh.position.y=0.8+Math.sin(k.phase)*0.15; } });
    // fx
    for(let i=tracers.length-1;i>=0;i--){ tracers[i].userData.life-=dt; tracers[i].material.opacity=Math.max(0,tracers[i].userData.life/0.09); if(tracers[i].userData.life<=0){ scene.remove(tracers[i]); tracers.splice(i,1); } }
    for(let i=hitsparks.length-1;i>=0;i--){ const m=hitsparks[i];
      if(m.userData.vx!==undefined){ m.userData.life-=dt; m.position.x+=m.userData.vx*dt; m.position.y+=m.userData.vy*dt; m.position.z+=m.userData.vz*dt; m.userData.vy-=12*dt;
        if(m.userData.life<=0){ scene.remove(m); hitsparks.splice(i,1); } }
      else { m.userData.life-=dt; if(m.material) m.material.opacity=Math.max(0,m.userData.life/0.07); if(m.userData.life<=0){ scene.remove(m); hitsparks.splice(i,1); } } }
  }
  updateCamera(dt); updateSky(dt);
  hudT+=dt; if(hudT>0.25){ hudT=0; if(G.mode==='play') updateHUD(); }
  mmT+=dt; if(mmT>0.12){ mmT=0; if(G.mode!=='title'){ drawMinimap(); drawCompass(); } }
  renderer.render(scene,camera);
  if(!window.__rf) window.__rf={};
  const fps=Math.round(1/Math.max(dt,0.001));
  if(fps<22){ fpsLow+=dt; if(fpsLow>5){ renderer.setPixelRatio(1); fpsLow=-9999; } } else fpsLow=Math.max(0,fpsLow-dt);
  window.__rf.fps=fps; window.__rf.mode=G.mode;
  window.__rf.player={pos:{x:player.pos.x,z:player.pos.z},riding:G.riding,hp:G.hp,ammo:G.ammo,money:G.money}; window.__rf.enemies=enemies;
}
updateHUD();
$('loading').style.display='none';
loop();