/* KPI DELTA - lapis tambahan: delta TMA vs -1 jam, volume vs kemarin, panah warna, sparkline mini */
function kpiSrc(){return (typeof getBaseDataset==="function")?getBaseDataset():REAL_DATA;}
function kpiTs(r){return new Date(r.tanggal+"T"+r.jam+":00").getTime();}
function kpiNear(d,t){let best=null,bd=1e18;for(let i=0;i<d.length;i++){const x=Math.abs(kpiTs(d[i])-t);if(x<bd){bd=x;best=d[i];}}return best;}
function sparkSVG(vals,color){if(!vals||vals.length<2)return "";const mn=Math.min.apply(null,vals),mx=Math.max.apply(null,vals),rg=(mx-mn)||1;
const pts=vals.map(function(v,i){return (i/(vals.length-1)*100).toFixed(1)+","+(26-((v-mn)/rg)*22-2).toFixed(1);}).join(" ");return "<svg viewBox='0 0 100 28' preserveAspectRatio='none' style='width:100%;height:28px;display:block'><polyline points='"+pts+"' fill='none' stroke='"+color+"' stroke-width='1.6' vector-effect='non-scaling-stroke'/></svg>";}
function kpiCardOf(id){const el=document.getElementById(id);if(!el)return null;let p=el;for(let i=0;i<6&&p;i++){p=p.parentElement;if(p&&p.className&&String(p.className).indexOf("bg-surface-card")>=0)return p;}return el.parentElement;}
function kpiEnsure(card,key){let box=card.querySelector("[data-delta="+key+"]");if(!box){box=document.createElement("div");box.setAttribute("data-delta",key);box.style.cssText="margin-top:6px;font-size:11px;font-weight:700;";card.appendChild(box);}
let sp=card.querySelector("[data-spark="+key+"]");if(!sp){sp=document.createElement("div");sp.setAttribute("data-spark",key);sp.style.cssText="margin-top:4px;opacity:.9;";card.appendChild(sp);}return {box:box,sp:sp};}
function kpiArrow(d,eps){if(Math.abs(d)<eps)return {s:"→",c:"#94a3b8"};return d>0?{s:"↑",c:"#f43f5e"}:{s:"↓",c:"#35e0a1"};}
function kpiUpdate(){const d=kpiSrc();if(!d||!d.length)return;const asc=d.slice().sort(function(a,b){return kpiTs(a)-kpiTs(b);});const last=asc[asc.length-1];const t=kpiTs(last);
const r1=kpiNear(asc,t-3600000),r24=kpiNear(asc,t-86400000);const cElv=kpiCardOf("kpi-elv"),cVol=kpiCardOf("kpi-vol");if(!cElv||!cVol)return;
const e1=kpiEnsure(cElv,"elv");const dE=r1?(last.elevasi-r1.elevasi):null;const aE=kpiArrow(dE||0,0.005);e1.box.innerHTML="<span style='color:"+aE.c+"'>"+aE.s+" "+(dE==null?"-":Math.abs(dE).toFixed(2).replace(".",","))+" m</span> <span style='color:#94a3b8;font-weight:600'>vs -1 jam</span>";
e1.sp.innerHTML=sparkSVG(asc.slice(-24).map(function(r){return r.elevasi;}),"#4cd7f6");
const e2=kpiEnsure(cVol,"vol");const dV=r24?(last.vol-r24.vol):null;const aV=kpiArrow(dV||0,0.5);e2.box.innerHTML="<span style='color:"+aV.c+"'>"+aV.s+" "+(dV==null?"-":Math.abs(dV).toFixed(0).replace(".",","))+" m³</span> <span style='color:#94a3b8;font-weight:600'>vs kemarin</span>";
e2.sp.innerHTML=sparkSVG(asc.slice(-24).map(function(r){return r.vol;}),"#7aa2f7");}
const _isK=initStats;initStats=function(){_isK();kpiUpdate();};setInterval(kpiUpdate,60000);document.addEventListener("DOMContentLoaded",function(){setTimeout(kpiUpdate,300);});
