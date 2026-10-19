import * as THREE from 'three';
import { BLOCKS, PLACEABLE, makeAtlas, generate, get, set, CH, W } from './world.js';
import { createMesher } from './mesh.js';

generate();

const renderer = new THREE.WebGLRenderer({antialias:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const SKY = 0x87ceeb;
const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 40, 110);
const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.05, 300);
camera.rotation.order = 'YXZ';
addEventListener('resize',()=>{ renderer.setSize(innerWidth,innerHeight); camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); });

const mesher = createMesher(scene, makeAtlas());
mesher.rebuildAll();

// ---- Spieler ----
const player = {pos:new THREE.Vector3(W/2+0.5,0,W/2+0.5), vel:new THREE.Vector3(), onGround:false, fly:false};
{ let y=CH-1; while (y>0 && !get(Math.floor(player.pos.x),y,Math.floor(player.pos.z))) y--; player.pos.y = y+2; }
const PW=0.3, PH=1.8, EYE=1.62;
const solid = (x,y,z)=>{ const b = get(Math.floor(x),Math.floor(y),Math.floor(z)); return b!==0 && b!==7; };
function collides(p){
  for (const dx of [-PW,PW]) for (const dz of [-PW,PW]) for (const dy of [0.01,0.9,PH-0.01])
    if (solid(p.x+dx,p.y+dy,p.z+dz)) return true;
  return false;
}

// ---- Eingabe ----
const keys = {};
let locked=false, yaw=0, pitch=0, sel=0, lastSpace=0;
const info = document.getElementById('info');
info.onclick = ()=>renderer.domElement.requestPointerLock();
document.addEventListener('pointerlockchange',()=>{
  locked = document.pointerLockElement===renderer.domElement;
  info.style.display = locked ? 'none' : 'flex';
});
document.addEventListener('mousemove',e=>{
  if (!locked) return;
  yaw -= e.movementX*0.0022;
  pitch = Math.max(-1.55, Math.min(1.55, pitch - e.movementY*0.0022));
});
addEventListener('keydown',e=>{
  keys[e.code] = true;
  if (e.code==='Space' && !e.repeat){
    const t = performance.now();
    if (t-lastSpace < 300){ player.fly = !player.fly; player.vel.y = 0; }
    lastSpace = t;
  }
  if (/^Digit[1-6]$/.test(e.code)) select(+e.code.slice(5)-1);
});
addEventListener('keyup',e=>{ keys[e.code] = false; });
addEventListener('wheel',e=>select((sel + (e.deltaY>0?1:-1) + PLACEABLE.length) % PLACEABLE.length));

const hb = document.getElementById('hotbar');
PLACEABLE.forEach((id,i)=>{
  const d = document.createElement('div');
  d.className = 'slot'; d.style.background = BLOCKS[id].top;
  d.textContent = (i+1)+' '+BLOCKS[id].name;
  hb.appendChild(d);
});
function select(i){ sel = i; [...hb.children].forEach((c,j)=>c.classList.toggle('sel', j===i)); }
select(0);

// ---- Raycast (DDA) ----
function raycast(maxD=6){
  const o = camera.position, d = new THREE.Vector3(); camera.getWorldDirection(d);
  let x=Math.floor(o.x), y=Math.floor(o.y), z=Math.floor(o.z);
  const sx=Math.sign(d.x), sy=Math.sign(d.y), sz=Math.sign(d.z);
  const td = (p,s,v)=> v===0 ? Infinity : Math.abs(((s>0?Math.floor(p)+1:Math.floor(p))-p)/v);
  let tx=td(o.x,sx,d.x), ty=td(o.y,sy,d.y), tz=td(o.z,sz,d.z), t=0;
  const dx=Math.abs(1/d.x), dy=Math.abs(1/d.y), dz=Math.abs(1/d.z);
  let nx=0, ny=0, nz=0;
  while (t<=maxD){
    const b = get(x,y,z);
    if (b && b!==7) return {x,y,z,nx,ny,nz};
    if (tx<ty && tx<tz){ x+=sx; t=tx; tx+=dx; nx=-sx; ny=0; nz=0; }
    else if (ty<tz){ y+=sy; t=ty; ty+=dy; nx=0; ny=-sy; nz=0; }
    else { z+=sz; t=tz; tz+=dz; nx=0; ny=0; nz=-sz; }
  }
  return null;
}
const box = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002,1.002,1.002)),
  new THREE.LineBasicMaterial({color:0x000000}));
box.visible = false; scene.add(box);

document.addEventListener('mousedown',e=>{
  if (!locked) return;
  const h = raycast(); if (!h) return;
  if (e.button===0){ set(h.x,h.y,h.z,0); mesher.rebuildAround(h.x,h.z); }
  else if (e.button===2){
    const px=h.x+h.nx, py=h.y+h.ny, pz=h.z+h.nz;
    if (py<0 || py>=CH) return;
    set(px,py,pz,PLACEABLE[sel]);
    if (collides(player.pos)){ set(px,py,pz,0); return; }
    mesher.rebuildAround(px,pz);
  }
});
document.addEventListener('contextmenu',e=>e.preventDefault());

// ---- Physik ----
function step(dt){
  const speed = player.fly ? 10 : 4.5;
  const f = (keys.KeyW?1:0)-(keys.KeyS?1:0), s = (keys.KeyD?1:0)-(keys.KeyA?1:0);
  const len = Math.hypot(f,s) || 1;
  player.vel.x = (-Math.sin(yaw)*f + Math.cos(yaw)*s)/len*speed;
  player.vel.z = (-Math.cos(yaw)*f - Math.sin(yaw)*s)/len*speed;
  const inWater = get(Math.floor(player.pos.x),Math.floor(player.pos.y+0.5),Math.floor(player.pos.z))===7;
  if (player.fly) player.vel.y = ((keys.Space?1:0)-(keys.ShiftLeft?1:0))*speed;
  else {
    player.vel.y -= (inWater?8:28)*dt;
    if (inWater){ player.vel.y = Math.max(player.vel.y,-3); if (keys.Space) player.vel.y = 3.5; player.vel.x*=0.6; player.vel.z*=0.6; }
    else if (keys.Space && player.onGround) player.vel.y = 8.5;
  }
  player.onGround = false;
  for (const ax of ['x','y','z']){
    const old = player.pos[ax];
    player.pos[ax] += player.vel[ax]*dt;
    if (collides(player.pos)){
      player.pos[ax] = old;
      if (ax==='y'){ if (player.vel.y<0) player.onGround = true; player.vel.y = 0; }
    }
  }
  if (player.pos.y < -20){ player.pos.set(W/2+0.5,CH,W/2+0.5); player.vel.set(0,0,0); }
  player.pos.x = Math.max(0.5, Math.min(W-0.5, player.pos.x));
  player.pos.z = Math.max(0.5, Math.min(W-0.5, player.pos.z));
}

const clock = new THREE.Clock();
(function loop(){
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (locked) step(dt);
  camera.position.set(player.pos.x, player.pos.y+EYE, player.pos.z);
  camera.rotation.set(pitch, yaw, 0);
  const c = camera.position;
  const uw = get(Math.floor(c.x),Math.floor(c.y),Math.floor(c.z))===7;
  const col = uw ? 0x1a3a8a : SKY;
  scene.fog.color.set(col); scene.background.set(col);
  scene.fog.near = uw?1:40; scene.fog.far = uw?20:110;
  const h = locked ? raycast() : null;
  box.visible = !!h; if (h) box.position.set(h.x+0.5,h.y+0.5,h.z+0.5);
  renderer.render(scene, camera);
})();
