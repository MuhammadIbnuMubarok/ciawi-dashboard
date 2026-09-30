var XLSX = require("./xlsx.full.min.js");
var fs = require("fs");
var wb = XLSX.readFile(process.argv[2], { dense: true });
var OUT = { meta: { sumber: process.argv[2], sheets: wb.SheetNames.slice(), generated: new Date().toISOString(), elvTopMainDam: null }, instrumen: [], hujan: [], seri: {}, grafik: [] };
var rep = [];
var ORDER = ["PPU1","PPD2","PPU3","PPD4","PTU1","PTA2","PTD3","PTD4","PTU5","PTA6","PTD7","PTU8","PTD9"];
var INSTRE = /^(PP|PT|OS)[A-Z]?\d*$/;
function pad(n){ return (n<10?"0":"")+n; }
function parseDate(v, mode){
  if (v===null||v===undefined||v==="") return null;
  if (typeof v==="number"){ var t=new Date(Math.round((v-25569)*86400)*1000); return t.toISOString().slice(0,10); }
  var s=String(v).trim(); var m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/); if(!m) return null;
  var a=+m[1], b=+m[2], y=+m[3]; if(y<100) y+=2000;
  var dd, mm;
  if (a>12){ dd=a; mm=b; } else if (b>12){ dd=b; mm=a; } else if (mode==="us"){ mm=a; dd=b; } else { dd=a; mm=b; }
  if(mm<1||mm>12||dd<1||dd>31) return null;
  return y+"-"+pad(mm)+"-"+pad(dd);
}
wb.SheetNames.forEach(function(name){
  var D = XLSX.utils.sheet_to_json(wb.Sheets[name], { header:1, dense:true, blankrows:false, raw:true });
  var nR=0,nW=0,nI=0,nS=0;
  for (var i=0;i<D.length;i++){
    var r=D[i]; if(!r||!r.length) continue;
    var c0=r[0], c1=r[1];
    if (String(c0).match(/^\d{1,2}\/\d{1,2}\/\d{2}$/) && typeof c1==="number"){ var dr=parseDate(c0,"us"); if(dr){ OUT.hujan.push({tanggal:dr, mm:c1}); nR++; continue; } }
    if (typeof c0==="number" && typeof c1==="string" && INSTRE.test(c1.trim()) && r.length>=10){ OUT.instrumen.push({ kode:c1.trim(), sta:c0, elevTip:+r[2]||null, elevTop:+r[3]||null, overborden:+r[4]||null, tekanan:+r[5]||null, elvTekanan:+r[6]||null, ru:+r[7]||null, elvIjin:+r[8]||null, ket:String(r[9]||""), sheet:name }); nI++; continue; }
    var ser=0; for(var k=0;k<Math.min(r.length,25);k++){ if(typeof r[k]==="number" && r[k]>40000 && r[k]<60000) ser++; else break; }
    if (ser>=10){ var pts=[]; for(var q=ser;q<r.length;q++){ if(typeof r[q]==="number") pts.push([parseDate(r[q-ser],"id"), +r[q].toFixed(3)]); } if(pts.length){ OUT.grafik.push({sheet:name, n:pts.length, first:pts[0], last:pts[pts.length-1]}); } nS++; continue; }
    if (typeof c0==="number" && Math.abs(c0-551.367)<0.01){ OUT.meta.elvTopMainDam=551.367; continue; }
    for (var j=0;j<r.length;j++){
      var sv=String(r[j]||"");
      if (!sv.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) continue;
      var d4=parseDate(r[j],"id"); if(!d4) continue;
      var nums=[], waktu="", cuaca="";
      for(var q2=j+1;q2<Math.min(r.length,j+45);q2++){
        var v2=r[q2];
        if (typeof v2==="number"){ nums.push(v2); }
        else if (typeof v2==="string"){ if(v2.match(/^\d{1,2}:\d{2}$/)) waktu=v2; else if(v2.trim()&&v2.trim().length<12&&!v2.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) cuaca=v2.trim(); }
        if (nums.length>=13) break;
      }
      if (nums.length>=8){ for(var c3=0;c3<ORDER.length&&c3<nums.length;c3++){ var code=ORDER[c3]; (OUT.seri[code]=OUT.seri[code]||[]).push([d4, nums[c3]]); } OUT.seri["_waktu_"+d4]=waktu; OUT.seri["_cuaca_"+d4]=cuaca; nW++; }
    }
  }
  rep.push(name+": hujan="+nR+" interpretasi="+nI+" barisBacaan="+nW+" seriGrafik="+nS);
});
OUT.hujan.sort(function(a,b){ return a.tanggal<b.tanggal?-1:1; });
Object.keys(OUT.seri).forEach(function(k){ if(k.charAt(0)!=="_"&&Array.isArray(OUT.seri[k])) OUT.seri[k].sort(function(a,b){ return a[0]<b[0]?-1:1; }); });
fs.writeFileSync(process.argv[3], JSON.stringify(OUT), "utf8");
rep.push("TOTAL: sheet="+wb.SheetNames.length+" hujan="+OUT.hujan.length+" instrumen="+OUT.instrumen.length+" kodeSeri="+Object.keys(OUT.seri).filter(function(k){return k.charAt(0)!=="_";}).length+" grafik="+OUT.grafik.length);
fs.writeFileSync("probe-report.txt", rep.join("\n"), "utf8");
console.log(rep.join("\n"));