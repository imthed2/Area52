const { useState, useEffect, useMemo, useRef } = React;

// THEME / UTIL
const ACCENT = "#B9FF3F";
const fmt = (n)=> n<1000?String(n):(()=>{const u=["K","M","B","T","Q"];let i=-1,x=n;while(x>=1000&&i<u.length-1){x/=1000;i++}return `${x.toFixed(2)}${u[i]}`})();
const computeCost=(b,s,o)=>Math.floor(b*Math.pow(s,o));
const prestigeGain=(e)=>Math.floor(Math.sqrt(e/50000));
const HOLD_INTERVAL_MS=60;

// DATA
const UPGRADES=[
  {id:"alien-tech",title:"ALIEN TECH UPGRADE",subtitle:"+1 ENERGY PER TAP",type:"click",baseCost:50,costScale:1.22,amountPerBuy:1},
  {id:"bots",title:"AREA 52 BOTS",subtitle:"+1 / SEC",type:"auto",baseCost:120,costScale:1.28,amountPerBuy:1},
  {id:"cold-filtration",title:"COLD FILTRATION",subtitle:"+5 / SEC",type:"auto",baseCost:750,costScale:1.35,amountPerBuy:5},
  {id:"molecular-isolation",title:"MOLECULAR ISOLATION",subtitle:"+10% GLOBAL MULT",type:"mult",baseCost:2000,costScale:1.6,amountPerBuy:0.1},
];
const RESEARCH_TREE=[
  {id:"tap-boost",title:"Tap Amplifier",desc:"+10% tap power",cost:5,effect:(s)=>({...s,tapBoost:(s.tapBoost||0)+0.1})},
  {id:"auto-boost",title:"Automation Protocols",desc:"+10% auto/sec",cost:5,effect:(s)=>({...s,autoBoost:(s.autoBoost||0)+0.1})},
  {id:"mult-boost",title:"Quantum Multipliers",desc:"+5% global mult",cost:8,effect:(s)=>({...s,multBoost:(s.multBoost||0)+0.05})},
];
const CONTRACTS=[
  {id:"c1",goal:"Generate 10K Energy",req:(s)=>s.energy>=10000,reward:{rp:1}},
  {id:"c2",goal:"Buy 5 upgrades",req:(s)=>Object.values(s.owned).reduce((a,b)=>a+b,0)>=5,reward:{rp:2}},
];

function SectionTitle({children}){ return <div className="section-title"><div className="dot"></div><h2>{children}</h2></div>; }
function Pill({children}){ return <div className="pill">{children}</div>; }
function ProgressBar({value}){ const v=Math.max(0,Math.min(100,value||0)); const striped=v>0&&v<100; return <div className="progress"><span className={`fill${striped?" striped":""}`} style={{width:v+"%"}}/></div>; }

function App(){
  const [energy,setEnergy]=useState(0),[clickPower,setClickPower]=useState(1),[autoPerSec,setAutoPerSec]=useState(0),[mult,setMult]=useState(1),[owned,setOwned]=useState({}),[rp,setRp]=useState(0),[prestiges,setPrestiges]=useState(0);
  const [research,setResearch]=useState({tapBoost:0,autoBoost:0,multBoost:0});
  const [completedContracts,setCompletedContracts]=useState([]);
  const [displayEnergy,setDisplayEnergy]=useState(0);
  const holdRef = useRef(null);
  const animRef = useRef(null);
  const btnRef = useRef(null);
  const badgeRefs = useRef({});
  const particleLayerRef = useRef(null);
  const lastParticleRef = useRef(0);

  // self-tests (console)
  useEffect(()=>{try{
    console.assert(computeCost(100,1.2,0)===100,"cost n0");
    console.assert(computeCost(100,1.2,1)===120,"cost n1");
    console.assert(prestigeGain(50000)===1,"prest 50k");
  }catch(e){}},[]);

  // load/save v2
  useEffect(()=>{ const raw=localStorage.getItem("area52-pwa-save-v2");
    if(raw){ try{ const s=JSON.parse(raw);
      setEnergy(s.energy??0); setClickPower(s.clickPower??1);
      setAutoPerSec(s.autoPerSec??0); setMult(s.mult??1);
      setOwned(s.owned??{}); setRp(s.rp??0); setPrestiges(s.prestiges??0);
      setResearch(s.research??{tapBoost:0,autoBoost:0,multBoost:0});
      setCompletedContracts(s.completedContracts??[]);
    }catch(e){} } },[]);
  useEffect(()=>{ localStorage.setItem("area52-pwa-save-v2", JSON.stringify({energy,clickPower,autoPerSec,mult,owned,rp,prestiges,research,completedContracts})); },
    [energy,clickPower,autoPerSec,mult,owned,rp,prestiges,research,completedContracts]);
  useEffect(()=>{ particleLayerRef.current=document.getElementById('particles'); },[]);
  useEffect(()=>{
    const from=displayEnergy;
    const to=energy;
    if(from===to) return;
    cancelAnimationFrame(animRef.current);
    const diff=to-from;
    if(Math.abs(diff)<5){ setDisplayEnergy(to); return; }
    const duration=Math.min(240,Math.max(120,Math.abs(diff)));
    const start=performance.now();
    const step=(now)=>{
      const p=Math.min(1,(now-start)/duration);
      const eased=1-Math.pow(1-p,3);
      setDisplayEnergy(from+diff*eased);
      if(p<1) animRef.current=requestAnimationFrame(step);
    };
    animRef.current=requestAnimationFrame(step);
  },[energy]);
  useEffect(()=>()=>cancelAnimationFrame(animRef.current),[]);

  // passive income
  useEffect(()=>{ const t=setInterval(()=>{ setEnergy(e=>e+Math.floor(autoPerSec*(1+research.autoBoost)*(1+rp*0.02+research.multBoost+(mult-1)))) },1000);
    return ()=>clearInterval(t);
  },[autoPerSec,mult,rp,research]);

  const totalMult=useMemo(()=>1+rp*0.02+research.multBoost+(mult-1),[rp,mult,research]);
  const spawnParticles=()=>{
    const layer=particleLayerRef.current,btn=btnRef.current; if(!layer||!btn) return;
    const now=performance.now(); if(now-lastParticleRef.current<100) return; lastParticleRef.current=now;
    const rect=btn.getBoundingClientRect(); const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
    const count=6+Math.floor(Math.random()*5);
    for(let i=0;i<count;i++){
      const p=document.createElement('span'); p.className='particle';
      p.style.left=(cx+(Math.random()*40-20))+'px';
      p.style.top=(cy+(Math.random()*10-5))+'px';
      const ang=Math.random()*Math.PI-Math.PI/2,dist=20+Math.random()*40;
      p.style.setProperty('--tx',`${Math.cos(ang)*dist}px`);
      p.style.setProperty('--ty',`${Math.sin(ang)*dist-60}px`);
      p.style.setProperty('--dur',`${400+Math.random()*300}ms`);
      layer.appendChild(p);
      p.addEventListener('animationend',()=>p.remove(),{once:true});
    }
  };
  const handleTap=()=>{ setEnergy(e=>e+Math.floor(clickPower*(1+research.tapBoost)*totalMult)); spawnParticles(); };

  // hold-to-tap
  const startHold=(ev)=>{ev?.preventDefault?.(); btnRef.current?.classList.add('is-holding'); if(holdRef.current) return; holdRef.current=setInterval(()=>handleTap(),HOLD_INTERVAL_MS)};
  const stopHold=()=>{btnRef.current?.classList.remove('is-holding'); if(holdRef.current){clearInterval(holdRef.current); holdRef.current=null;}};

  const getOwned=(id)=>owned[id]||0;
  const costOf=(u)=>computeCost(u.baseCost,u.costScale,getOwned(u.id));
  const buy=(u)=>{ const c=costOf(u); if(energy<c) return;
    setEnergy(e=>e-c); setOwned(o=>({...o,[u.id]:(o[u.id]||0)+1}));
    if(u.type==="click")setClickPower(v=>v+u.amountPerBuy);
    if(u.type==="auto")setAutoPerSec(v=>v+u.amountPerBuy);
    if(u.type==="mult")setMult(v=>v+u.amountPerBuy);
    const b=badgeRefs.current[u.id];
    if(b){ b.classList.add('flash'); b.addEventListener('animationend',()=>b.classList.remove('flash'),{once:true}); }
  };

  const canPrestige=energy>=50000;
  const doPrestige=()=>{ if(!canPrestige) return;
    const g=prestigeGain(energy);
    setRp(x=>x+g); setPrestiges(p=>p+1);
    setEnergy(0); setClickPower(1); setAutoPerSec(0); setMult(1); setOwned({});
  };

  const progressToPrestige=Math.min(100,(energy/50000)*100);
  const claimContract=(c)=>{ if(completedContracts.includes(c.id)) return;
    if(c.req({energy,owned})){ if(c.reward.rp) setRp(rp+c.reward.rp); setCompletedContracts([...completedContracts,c.id]); }
  };
  const buyResearch=(node)=>{ if(rp<node.cost) return; setRp(rp-node.cost); setResearch(node.effect(research)); };

  return (
    <div className="container">
      <h1>AREA 52: SECRET PROGRAM</h1>
      <p style={{opacity:.8,maxWidth:420,margin:"12px auto 0"}}>
        Tap to gather alien energy, fund secret experiments and unlock forbidden tech.
      </p>

      <div className="harvest-zone" style={{marginTop:18, display:"flex", flexDirection:"column", alignItems:"center", gap:12}}>
        <div className="spotlight"></div>
        <div className="energy-big">{fmt(Math.floor(displayEnergy))}<span className="energy-unit">E</span></div>
        <button id="harvest-btn" ref={btnRef} className="btn"
          onClick={handleTap}
          onMouseDown={startHold} onMouseUp={stopHold} onMouseLeave={stopHold}
          onTouchStart={startHold} onTouchEnd={stopHold}
        >👽 Harvest Energy</button>

        <div style={{display:"flex", flexWrap:"wrap", gap:12, justifyContent:"center"}}>
          <Pill>Click Power: <span style={{color:ACCENT, marginLeft:8}}>{fmt(clickPower)}×</span></Pill>
          <Pill>Auto/sec: <span style={{color:ACCENT, marginLeft:8}}>{fmt(Math.floor(autoPerSec*totalMult))}</span></Pill>
          <Pill>Global Mult: <span style={{color:ACCENT, marginLeft:8}}>{totalMult.toFixed(2)}×</span></Pill>
        </div>
      </div>

      {/* Upgrades close to main button */}
      <SectionTitle>UPGRADES</SectionTitle>
      <div className="grid cols-3">
        {UPGRADES.map(u=>{ const cost=costOf(u); const can=energy>=cost; return (
          <div key={u.id} className={`card${can?"":" disabled"}`}>
            <div className="content">
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
                <div>
                  <div style={{letterSpacing:".25em", textTransform:"uppercase", fontSize:14}}>{u.title}</div>
                  <div style={{opacity:.7, fontSize:12}}>{u.subtitle}</div>
                </div>
                <span ref={el=>badgeRefs.current[u.id]=el} className="badge">Owned: {getOwned(u.id)}</span>
              </div>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:12}}>
                <div style={{opacity:.8, fontSize:14}}>Cost: <span style={{color:ACCENT}}>{fmt(cost)}</span></div>
                <button className="btn btn-outline" disabled={!can} onClick={()=>buy(u)}>Add — {fmt(cost)}</button>
              </div>
            </div>
          </div>
        );})}
      </div>

      {/* Prestige */}
      <div className="card" style={{marginTop:18}}>
        <div className="content">
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <div style={{width:20,height:20,border:"1px solid #fff",borderRadius:4}}></div>
            <div style={{letterSpacing:".25em", textTransform:"uppercase"}}>Declassify (Prestige)</div>
            <div style={{marginLeft:"auto"}} className="badge">RP: {rp} • Runs: {prestiges}</div>
          </div>
          <div style={{marginTop:8, opacity:.8, fontSize:14}}>Reset and trade built-up Energy for <b>Research Points</b> that permanently boost all gains.</div>
          <div style={{marginTop:12}}><ProgressBar value={progressToPrestige} /></div>
          <div style={{marginTop:6, opacity:.7, fontSize:12}}>Next RP at <span style={{color:ACCENT}}>50,000</span> energy. Current: {fmt(Math.floor(displayEnergy))}</div>
          <div style={{marginTop:12}}>
            <button className="btn btn-outline" disabled={!canPrestige} onClick={doPrestige}>Declassify now</button>
          </div>
        </div>
      </div>

      {/* Research Tree */}
      <SectionTitle>RESEARCH TREE</SectionTitle>
      <div className="grid cols-3">
        {RESEARCH_TREE.map(n=>(
          <div key={n.id} className="card">
            <div className="content">
              <div style={{letterSpacing:".2em", textTransform:"uppercase", fontSize:14}}>{n.title}</div>
              <div style={{opacity:.7, fontSize:12}}>{n.desc}</div>
              <div style={{marginTop:6}}>Cost: {n.cost} RP</div>
              <button className="btn btn-outline" disabled={rp<n.cost} onClick={()=>buyResearch(n)} style={{marginTop:8}}>Unlock</button>
            </div>
          </div>
        ))}
      </div>

      {/* Contracts */}
      <SectionTitle>DAILY CONTRACTS</SectionTitle>
      <div className="grid cols-2">
        {CONTRACTS.map(c=>(
          <div key={c.id} className="card">
            <div className="content">
              <div style={{letterSpacing:".2em", textTransform:"uppercase", fontSize:14}}>{c.goal}</div>
              <div style={{opacity:.7, fontSize:12}}>Reward: {c.reward.rp} RP</div>
              <button className="btn btn-outline" disabled={completedContracts.includes(c.id)||!c.req({energy,owned})} onClick={()=>claimContract(c)} style={{marginTop:8}}>
                {completedContracts.includes(c.id) ? "Completed" : "Claim"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{height:40}}></div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
