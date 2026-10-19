import * as THREE from 'three';

export const BLOCKS = {
  1:{name:'Gras',   top:'#5aa83c', side:'#7a5a3a', bottom:'#7a5a3a'},
  2:{name:'Erde',   top:'#7a5a3a', side:'#7a5a3a', bottom:'#7a5a3a'},
  3:{name:'Stein',  top:'#8a8a8a', side:'#8a8a8a', bottom:'#8a8a8a'},
  4:{name:'Holz',   top:'#a9824a', side:'#6b4a26', bottom:'#a9824a'},
  5:{name:'Blätter',top:'#2f7d2f', side:'#2f7d2f', bottom:'#2f7d2f'},
  6:{name:'Sand',   top:'#e3d79b', side:'#e3d79b', bottom:'#e3d79b'},
  7:{name:'Wasser', top:'#3a6fe0', side:'#3a6fe0', bottom:'#3a6fe0'},
};
export const PLACEABLE = [1,2,3,4,5,6];

function rng(seed){ return () => ((seed = (seed*1664525 + 1013904223) >>> 0) / 4294967296); }

// ---- Textur-Atlas ----
const TILE = 16, tiles = [];
export const atlasKeys = {};
for (const id in BLOCKS) for (const f of ['top','side','bottom']) { atlasKeys[id+f] = tiles.length; tiles.push([id,f]); }
export const NT = tiles.length;
export function makeAtlas(){
  const cv = document.createElement('canvas'); cv.width = TILE*NT; cv.height = TILE;
  const cx = cv.getContext('2d');
  tiles.forEach(([id,f],i)=>{
    const r = rng(i*977+13);
    const base = new THREE.Color(BLOCKS[id][f]);
    for (let y=0;y<TILE;y++) for (let x=0;x<TILE;x++){
      const k = 0.85 + r()*0.3;
      let c = base.clone().multiplyScalar(k);
      if (id==='1' && f==='side' && y<4) c = new THREE.Color(BLOCKS[1].top).multiplyScalar(k);
      if (id==='4' && f==='side' && x%5===0) c.multiplyScalar(0.8);
      cx.fillStyle = '#'+c.getHexString(); cx.fillRect(i*TILE+x, y, 1, 1);
    }
  });
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---- Weltdaten ----
export const CS = 16, CH = 40, WC = 6, W = CS*WC, SEA = 12;
const data = new Uint8Array(W*CH*W);
const idx = (x,y,z)=>(x*CH+y)*W+z;
export const get = (x,y,z)=> (x<0||z<0||x>=W||z>=W||y<0||y>=CH) ? 0 : data[idx(x,y,z)];
export const set = (x,y,z,v)=>{ if (x>=0&&z>=0&&x<W&&z<W&&y>=0&&y<CH) data[idx(x,y,z)] = v; };

const perm = new Float32Array(256*256);
{ const r = rng(42); for (let i=0;i<perm.length;i++) perm[i] = r(); }
const pn = (x,z)=>perm[((x&255)<<8)|(z&255)];
const sm = t=>t*t*(3-2*t);
function noise(x,z){
  const xi=Math.floor(x), zi=Math.floor(z), xf=sm(x-xi), zf=sm(z-zi);
  const a=pn(xi,zi), b=pn(xi+1,zi), c=pn(xi,zi+1), d=pn(xi+1,zi+1);
  return (a+(b-a)*xf)*(1-zf) + (c+(d-c)*xf)*zf;
}
const height = (x,z)=>Math.floor(4 + (noise(x/40,z/40)*0.6 + noise(x/18,z/18)*0.3 + noise(x/7,z/7)*0.1)*22);

export function generate(){
  const r = rng(7);
  for (let x=0;x<W;x++) for (let z=0;z<W;z++){
    const h = Math.min(height(x,z), CH-8);
    for (let y=0;y<=h;y++){
      let b = 3;
      if (y===h) b = h<=SEA+1 ? 6 : 1;
      else if (y>h-4) b = h<=SEA+1 ? 6 : 2;
      set(x,y,z,b);
    }
    for (let y=h+1;y<=SEA;y++) set(x,y,z,7);
  }
  for (let i=0;i<150;i++){
    const x = 3+Math.floor(r()*(W-6)), z = 3+Math.floor(r()*(W-6));
    let y = CH-1; while (y>0 && !get(x,y,z)) y--;
    if (get(x,y,z)!==1) continue;
    const th = 4+Math.floor(r()*2);
    for (let t=1;t<=th;t++) set(x,y+t,z,4);
    for (let dx=-2;dx<=2;dx++) for (let dz=-2;dz<=2;dz++) for (let dy=th-1;dy<=th+1;dy++){
      if (Math.abs(dx)+Math.abs(dz)+(dy-th+1)>4) continue;
      if (!get(x+dx,y+dy,z+dz)) set(x+dx,y+dy,z+dz,5);
    }
    set(x,y+th+1,z,5);
  }
}
