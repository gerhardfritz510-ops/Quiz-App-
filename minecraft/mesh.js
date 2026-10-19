import * as THREE from 'three';
import { get, atlasKeys, NT, CS, CH, WC } from './world.js';

const FACES = [
  {d:[1,0,0],  s:'side',   l:0.8, v:[[1,0,1],[1,0,0],[1,1,0],[1,1,1]]},
  {d:[-1,0,0], s:'side',   l:0.8, v:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]]},
  {d:[0,1,0],  s:'top',    l:1.0, v:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]]},
  {d:[0,-1,0], s:'bottom', l:0.5, v:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]]},
  {d:[0,0,1],  s:'side',   l:0.9, v:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]]},
  {d:[0,0,-1], s:'side',   l:0.9, v:[[1,0,0],[0,0,0],[0,1,0],[1,1,0]]},
];
const UV = [[0,0],[1,0],[1,1],[0,1]];

export function createMesher(scene, atlas){
  const matSolid = new THREE.MeshBasicMaterial({map:atlas, vertexColors:true});
  const matWater = new THREE.MeshBasicMaterial({map:atlas, vertexColors:true, transparent:true, opacity:0.65, depthWrite:false});
  const chunks = new Map();

  function buildChunk(ci, cj){
    const key = ci+','+cj;
    (chunks.get(key)||[]).forEach(m=>{ scene.remove(m); m.geometry.dispose(); });
    const out = [0,1].map(()=>({p:[],u:[],c:[],i:[]}));
    for (let x=ci*CS; x<(ci+1)*CS; x++) for (let z=cj*CS; z<(cj+1)*CS; z++) for (let y=0; y<CH; y++){
      const b = get(x,y,z); if (!b) continue;
      const water = b===7, o = out[water?1:0];
      for (const f of FACES){
        const n = get(x+f.d[0], y+f.d[1], z+f.d[2]);
        if (water ? n!==0 : (n!==0 && n!==7)) continue;
        const t = atlasKeys[b+f.s], base = o.p.length/3;
        for (let k=0;k<4;k++){
          const v = f.v[k];
          o.p.push(x+v[0], y+v[1]-(water&&v[1]?0.1:0), z+v[2]);
          o.u.push((t + UV[k][0]*0.98 + 0.01)/NT, UV[k][1]);
          o.c.push(f.l,f.l,f.l);
        }
        o.i.push(base,base+1,base+2, base,base+2,base+3);
      }
    }
    const meshes = [];
    out.forEach((o,i)=>{
      if (!o.i.length) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(o.p,3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(o.u,2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(o.c,3));
      g.setIndex(o.i);
      const m = new THREE.Mesh(g, i?matWater:matSolid);
      if (i) m.renderOrder = 1;
      scene.add(m); meshes.push(m);
    });
    chunks.set(key, meshes);
  }
  function rebuildAll(){ for (let i=0;i<WC;i++) for (let j=0;j<WC;j++) buildChunk(i,j); }
  function rebuildAround(x,z){
    const a = Math.floor(x/CS), b = Math.floor(z/CS);
    buildChunk(a,b);
    if (x%CS===0 && a>0) buildChunk(a-1,b);
    if (x%CS===CS-1 && a<WC-1) buildChunk(a+1,b);
    if (z%CS===0 && b>0) buildChunk(a,b-1);
    if (z%CS===CS-1 && b<WC-1) buildChunk(a,b+1);
  }
  return { rebuildAll, rebuildAround };
}
