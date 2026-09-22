// 选股王/高端版 广告×成交 分析面板 — 渲染层 v3（产品优先）
const RED='#E60025', GREEN='#187a2e', BLUE='#2C5F8A', GRAY='#888';
let DATA=null, refDate=null, PROD='新开升级';   // 全局：先明确产品
const charts={};
const CH_MAIN=['普通广告','APP弹窗广告','APP通知栏推送','PC弹窗推送'];
const CHS=['普通广告','APP弹窗广告','APP通知栏推送','PC弹窗推送','PC小弹窗'];

const pad=n=>String(n).padStart(2,'0');
const fmtD=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseD=s=>{const[a,b,c]=s.split('-').map(Number);return new Date(a,b-1,c);};
const addD=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
const addM=(d,n)=>{const x=new Date(d);x.setMonth(x.getMonth()+n);return x;};
const addY=(d,n)=>{const x=new Date(d);x.setFullYear(x.getFullYear()+n);return x;};
const num=v=>(v==null?0:v);
const diffColor=d=>d>0?RED:(d<0?GREEN:'#444');
const dfmt=(d,isPct)=>d==null?'—':((d>0?'+':'')+(isPct?d.toFixed(2)+'pp':d));
const pct=(a,b)=>(b?a/b*100:null);
const pk=()=>PROD==='选股王'?'xg':'xk';
const ROLE={cur:'#E60025',prev:'#E08A00',old:'#c9ced6'};   // 本期/环比上期/更早
function roleBars(vals){ const n=vals.length; return vals.map((v,i)=>({value:v,itemStyle:{color:i===n-1?ROLE.cur:(i===n-2?ROLE.prev:ROLE.old)}})); }
// 同一张图上的三段分区背景带：更早(灰) / 环比上期(橙) / 本期(红)
function roleMarkArea(labels){
  const n=labels.length; if(n<2) return null;
  const d=[];
  if(n>=3) d.push([{xAxis:labels[0],itemStyle:{color:'rgba(140,140,140,0.08)'},
                   label:{show:true,position:'insideTop',formatter:'更早（非环比）',fontSize:9,color:'#999'}},{xAxis:labels[n-3]}]);
  d.push([{xAxis:labels[n-2],itemStyle:{color:'rgba(224,138,0,0.16)'},
           label:{show:true,position:'insideTop',formatter:'环比上期',fontSize:9,color:'#E08A00'}},{xAxis:labels[n-2]}]);
  d.push([{xAxis:labels[n-1],itemStyle:{color:'rgba(230,0,37,0.16)'},
           label:{show:true,position:'insideTop',formatter:'本期',fontSize:9,color:'#E60025'}},{xAxis:labels[n-1]}]);
  return {silent:true, data:d};
}

// ---------- 时间粒度 ----------
function period(gran,ref){
  const maxd=parseD(DATA.updated);
  let start,end,prevStart,yStart,label,prevLabel,yLabel;
  if(gran==='day'){ start=end=new Date(ref); prevStart=addD(start,-1); yStart=addY(start,-1);
    label=fmtD(start); prevLabel=fmtD(prevStart); yLabel=fmtD(yStart); }
  else if(gran==='week'){ const w=(ref.getDay()+6)%7; start=addD(ref,-w); end=addD(start,6); prevStart=addD(start,-7); yStart=addY(start,-1); }
  else if(gran==='rweek'){ end=new Date(ref); start=addD(end,-6); prevStart=addD(start,-7); yStart=addY(start,-1); }
  else if(gran==='month'){ start=new Date(ref.getFullYear(),ref.getMonth(),1); end=new Date(ref.getFullYear(),ref.getMonth()+1,0);
    prevStart=addM(start,-1); yStart=addY(start,-1);
    label=`${start.getFullYear()}-${pad(start.getMonth()+1)}`; prevLabel=`${prevStart.getFullYear()}-${pad(prevStart.getMonth()+1)}`; yLabel=`${yStart.getFullYear()}-${pad(yStart.getMonth()+1)}`; }
  else { const q=Math.floor(ref.getMonth()/3); start=new Date(ref.getFullYear(),q*3,1); end=new Date(ref.getFullYear(),q*3+3,0);
    prevStart=addM(start,-3); yStart=addY(start,-1); label=`${start.getFullYear()}Q${q+1}`;
    const ps=addM(start,-3); prevLabel=`${ps.getFullYear()}Q${Math.floor(ps.getMonth()/3)+1}`; yLabel=`${yStart.getFullYear()}Q${q+1}`; }
  if(end>maxd) end=maxd; if(start>end) start=end;
  const days=Math.round((end-start)/86400000)+1;
  const prevEnd=addD(prevStart,days-1), yEnd=addD(yStart,days-1);
  if(gran==='week'||gran==='rweek'){ label=`${fmtD(start)}~${fmtD(end)}`; prevLabel=`${fmtD(prevStart)}~${fmtD(prevEnd)}`; yLabel=`${fmtD(yStart)}~${fmtD(yEnd)}`; }
  return {s:fmtD(start),e:fmtD(end),ps:fmtD(prevStart),pe:fmtD(prevEnd),ys:fmtD(yStart),ye:fmtD(yEnd),label,prevLabel,yLabel,days};
}
function periodsBack(gran,ref,n){
  const out=[];
  for(let i=n-1;i>=0;i--){ let r=new Date(ref);
    if(gran==='day') r=addD(ref,-i); else if(gran==='week'||gran==='rweek') r=addD(ref,-7*i);
    else if(gran==='month') r=addM(ref,-i); else r=addM(ref,-3*i);
    out.push({p:period(gran,r),r}); }
  return out;
}
const shortLabel=(gran,p)=>(gran==='month'||gran==='quarter')?p.label:p.label.slice(5).replace('~','–');

// ---------- 聚合 ----------
function sumBI55(s,e){ let xk=0,xg=0; for(const[d,v] of Object.entries(DATA.bi55_daily)) if(d>=s&&d<=e){xk+=v.xk;xg+=v.xg;} return {xk,xg}; }
function sumDev(s,e,key){ const o={}; for(const[d,v] of Object.entries(DATA.bi55_device_daily)) if(d>=s&&d<=e){ const m=v[key]||{}; for(const[k,c] of Object.entries(m)) o[k]=(o[k]||0)+c; } return o; }
function adsSum(s,e,ch){ let r={show:0,acc:0,mb:0,ord:0,deal:0}; for(const[d,v] of Object.entries(DATA.ads_daily)) if(d>=s&&d<=e){ const c=v[PROD]&&v[PROD][ch]; if(c){r.show+=num(c.show);r.acc+=num(c.acc);r.mb+=num(c.mb);r.ord+=num(c.ord);r.deal+=num(c.deal);} } return r; }
function qiSum(s,e,key){ let n=0,use=0; for(const[d,v] of Object.entries(DATA.qiwei_daily||{})) if(d>=s&&d<=e&&v[key]){ n+=v[key].n; use+=v[key].use; } return {n,use}; }
const curGran=()=>document.getElementById('gran').value;

function opt(id,o){ const el=document.getElementById(id); if(!el) return; if(!charts[id]) charts[id]=echarts.init(el); charts[id].setOption(o,true); }
function disposePref(prefix){ Object.keys(charts).forEach(k=>{ if(k.indexOf(prefix)===0){ charts[k].dispose(); delete charts[k]; } }); }

// ---------- 首页 ----------
const CH_COLOR={'普通广告':'#1A9E8F','APP弹窗广告':'#2C5F8A','APP通知栏推送':'#E08A00','PC弹窗推送':'#7A4FBF','PC小弹窗':'#A98BD6'};
const CH_NAME={'普通广告':'普通广告','APP弹窗广告':'APP弹窗','APP通知栏推送':'PUSH','PC弹窗推送':'PC弹窗','PC小弹窗':'小弹窗'};
function homeRowsForCh(ch,p){
  const a=adsSum(p.s,p.e,ch), b=adsSum(p.ps,p.pe,ch);
  const out=[['曝光', a.show, b.show, false],['点击人数', a.acc, b.acc, false]];
  if(a.show||b.show){ out.push(['点击率CTR', (a.show?a.acc/a.show*100:null), (b.show?b.acc/b.show*100:null), true]); }
  out.push(['点击购买', a.mb, b.mb, false]);
  return out;
}
function renderHome(){
  const p=period('week',refDate), k=pk();
  document.getElementById('homeSub').innerHTML=`产品：<b class="prodName">${PROD}</b> ｜ 本周 <b>${p.label}</b> vs 上周 <b>${p.prevLabel}</b>（固定周·周一~周日）`;
  const c=sumBI55(p.s,p.e), pv=sumBI55(p.ps,p.pe);
  const q=qiSum(p.s,p.e,k), qp=qiSum(p.ps,p.pe,k);
  const items=[
    {t:'单量', cur:c[k], prev:pv[k], color:RED},
    {t:'APP弹窗 点击', cur:adsSum(p.s,p.e,'APP弹窗广告').acc, prev:adsSum(p.ps,p.pe,'APP弹窗广告').acc, color:CH_COLOR['APP弹窗广告']},
    {t:'PC弹窗 点击', cur:adsSum(p.s,p.e,'PC弹窗推送').acc, prev:adsSum(p.ps,p.pe,'PC弹窗推送').acc, color:CH_COLOR['PC弹窗推送']},
    {t:'普通广告 点击', cur:adsSum(p.s,p.e,'普通广告').acc, prev:adsSum(p.ps,p.pe,'普通广告').acc, color:CH_COLOR['普通广告']},
    {t:'PUSH 点击', cur:adsSum(p.s,p.e,'APP通知栏推送').acc, prev:adsSum(p.ps,p.pe,'APP通知栏推送').acc, color:CH_COLOR['APP通知栏推送']},
    {t:'企微素材 新增', cur:q.n, prev:qp.n, color:GREEN},
  ];
  document.getElementById('homeKpis').innerHTML=items.map(x=>{
    const d=x.cur-x.prev;
    return `<div class="kpi" style="border-top:3px solid ${x.color}"><div class="t">${x.t}</div><div class="v">${x.cur}</div>
      <div class="d" style="color:${diffColor(d)}">变化 ${dfmt(d,false)} <span style="color:#999">上周 ${x.prev}</span></div></div>`;
  }).join('');

  const groups=[
    {name:'单量', color:RED, rows:[['单量', c[k], pv[k], false]]},
    {name:'APP弹窗', color:CH_COLOR['APP弹窗广告'], rows:homeRowsForCh('APP弹窗广告',p)},
    {name:'PC弹窗（含小弹窗）', color:CH_COLOR['PC弹窗推送'], rows:homeRowsForCh('PC弹窗推送',p)},
    {name:'PUSH（APP通知栏推送）', color:CH_COLOR['APP通知栏推送'], rows:homeRowsForCh('APP通知栏推送',p)},
    {name:'普通广告（无曝光）', color:CH_COLOR['普通广告'], rows:homeRowsForCh('普通广告',p)},
    {name:'企微素材（杨婷）', color:GREEN, rows:[['新增条数', q.n, qp.n, false],['使用次数', q.use, qp.use, false]]},
  ];
  let h='<table><tr><th class="l">指标</th><th>本周</th><th>上周</th><th>变化</th></tr>';
  groups.forEach(g=>{
    h+=`<tr><td colspan="4" class="l" style="background:${g.color}18;color:${g.color};font-weight:700;border-left:6px solid ${g.color}">${g.name}</td></tr>`;
    g.rows.forEach(r=>{
      const nm=r[0], cur=r[1], prev=r[2], isP=r[3];
      const val=v=>v==null?'无数据':(isP?v.toFixed(2)+'%':v);
      const d=(cur!=null&&prev!=null)?cur-prev:null;
      h+=`<tr><td class="l" style="border-left:6px solid ${g.color};padding-left:14px">${nm}</td><td>${val(cur)}</td><td>${val(prev)}</td>`
        +`<td style="color:${diffColor(d==null?0:d)};font-weight:600">${dfmt(d,isP)}</td></tr>`;
    });
  });
  h+='</table>';
  document.getElementById('homeTable').innerHTML=h;

  // 单量趋势（近12周）
  const pb=periodsBack('week',refDate,12);
  const hLbl=pb.map(x=>shortLabel('week',x.p)), hVal=pb.map(x=>sumBI55(x.p.s,x.p.e)[k]);
  opt('homeAmtTrend',{ tooltip:{trigger:'axis'}, grid:{left:40,right:20,top:30,bottom:45},
    xAxis:{type:'category',data:hLbl,axisLabel:{fontSize:9,rotate:45}},
    yAxis:{type:'value'}, series:[{type:'bar',data:roleBars(hVal),label:{show:true,position:'top',fontSize:9},markArea:roleMarkArea(hLbl)}]});
  // 各渠道本周点击（按渠道配色）
  const chKeys=['普通广告','APP弹窗广告','APP通知栏推送','PC弹窗推送'];
  const labels=['普通广告','APP弹窗','PUSH(通知栏)','PC弹窗'];
  const vals=chKeys.map(ch=>adsSum(p.s,p.e,ch).acc);
  opt('homeAdChart',{ tooltip:{trigger:'axis'}, grid:{left:70,right:40,top:20,bottom:30},
    xAxis:{type:'value'}, yAxis:{type:'category',data:labels},
    series:[{type:'bar',data:vals.map((v,i)=>({value:v,itemStyle:{color:CH_COLOR[chKeys[i]]}})),label:{show:true,position:'right',fontSize:10}}]});
}

// ---------- 单量 ----------
function renderAmount(){
  const gran=curGran(), p=period(gran,refDate), k=pk();
  document.getElementById('periodLabel').textContent=`本期 ${p.label}（${p.days}天）`;
  document.getElementById('prodName1').textContent=PROD;
  const c=sumBI55(p.s,p.e)[k], pv=sumBI55(p.ps,p.pe)[k], yo=sumBI55(p.ys,p.ye)[k];
  document.getElementById('kpis').innerHTML=`
    <div class="kpi"><div class="t">本期单量（${p.label}）</div><div class="v">${c}</div><div class="d" style="color:#888">${PROD}</div></div>
    <div class="kpi"><div class="t">环比 ${p.prevLabel}</div><div class="v">${pv}</div><div class="d" style="color:${diffColor(c-pv)}">变化 ${dfmt(c-pv,false)}</div></div>
    <div class="kpi"><div class="t">同比 ${p.yLabel}</div><div class="v">${yo}</div><div class="d" style="color:${diffColor(c-yo)}">变化 ${dfmt(c-yo,false)}</div></div>`;

  const n=gran==='day'?14:(gran==='quarter'?8:12);
  const pb=periodsBack(gran,refDate,n);
  const labels=pb.map(x=>shortLabel(gran,x.p));
  const vals=pb.map(x=>sumBI55(x.p.s,x.p.e)[k]);
  opt('amtTrend',{ tooltip:{trigger:'axis'}, grid:{left:40,right:20,top:30,bottom:48},
    xAxis:{type:'category',data:labels,axisLabel:{fontSize:10,rotate:labels.length>12?45:0}},
    yAxis:{type:'value'}, series:[{type:'bar',data:roleBars(vals),label:{show:true,position:'top',fontSize:9},markArea:roleMarkArea(labels)}]});
  opt('amtMom',{ tooltip:{trigger:'axis'}, grid:{left:40,right:20,top:20,bottom:30},
    xAxis:{type:'category',data:['本期','环比期']}, yAxis:{type:'value'},
    series:[{type:'bar',data:[{value:c,itemStyle:{color:ROLE.cur}},{value:pv,itemStyle:{color:ROLE.prev}}],label:{show:true,position:'top',fontSize:11}}]});
  opt('amtYoy',{ tooltip:{trigger:'axis'}, grid:{left:40,right:20,top:20,bottom:30},
    xAxis:{type:'category',data:['本期','同比期']}, yAxis:{type:'value'},
    series:[{type:'bar',data:[{value:c,itemStyle:{color:ROLE.cur}},{value:yo,itemStyle:{color:'#7A4FBF'}}],label:{show:true,position:'top',fontSize:11}}]});

  const dv=sumDev(p.s,p.e,k), devs=DATA.devices;
  opt('devChart',{ tooltip:{trigger:'axis'}, grid:{left:55,right:20,top:20,bottom:30},
    xAxis:{type:'value'}, yAxis:{type:'category',data:devs},
    series:[{type:'bar',data:devs.map(d=>dv[d]||0),itemStyle:{color:RED},label:{show:true,position:'right',fontSize:10}}]});

  renderTargets(p,k);
}
function renderTargets(p,k){
  const t=DATA.targets||{}, el=document.getElementById('targets');
  const ym=p.s.slice(0,7), yr=p.s.slice(0,4);
  const row=(name,cur,tgt)=>{ if(!tgt) return `<div style="margin-bottom:10px"><b>${name}</b>：<span style="color:#999">目标未配置（targets.json）</span></div>`;
    const pv=Math.min(100,cur/tgt*100);
    return `<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between"><b>${name}</b><span>${cur} / ${tgt} = <b>${(cur/tgt*100).toFixed(1)}%</b></span></div>
      <div class="bar"><i style="width:${pv}%;background:${cur/tgt>=1?GREEN:RED}"></i></div></div>`; };
  let h='<div class="sub">月度目标（'+ym+' 至今）</div>';
  h+=row(PROD, sumBI55(ym+'-01',p.e)[k], t.monthly&&t.monthly[ym]&&t.monthly[ym][k]);
  h+='<div class="sub" style="margin-top:12px">年度目标（'+yr+' 累计至今）</div>';
  h+=row(PROD, sumBI55(yr+'-01-01',p.e)[k], t.yearly&&t.yearly[yr]&&t.yearly[yr][k]);
  el.innerHTML=h;
}

// ---------- 广告 ----------
function adTds(ch,isSmall){
  const p=period(curGran(),refDate), c=adsSum(p.s,p.e,ch), pv=adsSum(p.ps,p.pe,ch);
  const ctr=pct(c.acc,c.show), ctrp=pct(pv.acc,pv.show), bu=pct(c.mb,c.acc), bup=pct(pv.mb,pv.acc);
  const cell=(v,d,isPct)=>`${v}<br><span style="font-size:11px;color:${diffColor(d)}">${dfmt(d,isPct)}</span>`;
  return `<td>${cell(c.show||'无数据', c.show-pv.show,false)}</td>`
    +`<td>${cell(c.acc, c.acc-pv.acc,false)}</td>`
    +`<td>${cell(ctr==null?'无数据':ctr.toFixed(2)+'%', (ctr!=null&&ctrp!=null)?ctr-ctrp:null,true)}</td>`
    +`<td>${cell(c.mb, c.mb-pv.mb,false)}</td>`
    +`<td>${cell(bu==null?'无数据':bu.toFixed(2)+'%', (bu!=null&&bup!=null)?bu-bup:null,true)}</td>`
    +`<td>${cell(c.ord, c.ord-pv.ord,false)}</td>`
    +`<td>${cell(c.deal, c.deal-pv.deal,false)}</td>`;
}
function renderAd(){
  const gran=curGran(), p=period(gran,refDate);
  document.getElementById('prodName2').textContent=PROD;
  document.getElementById('adSub').textContent=`产品：${PROD} ｜ 本期 ${p.label} vs 上期 ${p.prevLabel}（广告仅环比）`;
  // 总表
  let html='<table><tr><th class="l">渠道</th><th>曝光</th><th>点击人数</th><th>点击率CTR</th><th>点击购买</th><th>购买率</th><th>订单提交</th><th>成交(归因)</th></tr>';
  CHS.forEach(ch=>{ const col=CH_COLOR[ch]||'#A98BD6'; html+=`<tr><td class="l" style="border-left:6px solid ${col};color:${col};font-weight:600">${ch}</td>`+adTds(ch)+'</tr>'; });
  html+='</table>';
  document.getElementById('adTable').innerHTML=html;

  // 分渠道独立块
  disposePref('adch-');
  const wrap=document.getElementById('adChannels'); wrap.innerHTML='';
  CH_MAIN.forEach((ch,ci)=>{
    const col=CH_COLOR[ch]||BLUE;
    const card=document.createElement('div'); card.className='card'; card.style.borderTop=`3px solid ${col}`;
    let tb='<table><tr><th class="l">项目</th><th>曝光</th><th>点击人数</th><th>点击率CTR</th><th>点击购买</th><th>购买率</th><th>订单提交</th><th>成交(归因)</th></tr>';
    tb+=`<tr><td class="l" style="border-left:5px solid ${col}">${PROD}</td>`+adTds(ch)+'</tr>';
    if(ch==='PC弹窗推送') tb+=`<tr><td class="l" style="border-left:5px solid ${CH_COLOR['PC小弹窗']};color:#999">└ 小弹窗 650×300</td>`+adTds('PC小弹窗')+'</tr>';
    tb+='</table>';
    card.innerHTML=`<h2 style="border-left:6px solid ${col};padding-left:8px;color:${col}">渠道：${ch} <span style="font-weight:400;color:#888;font-size:12px">本期 ${p.label} vs 上期 ${p.prevLabel}</span></h2>${tb}<div id="adch-${ci}" style="height:230px;margin-top:10px"></div>`;
    wrap.appendChild(card);
  });
  const nT=gran==='quarter'?8:(gran==='day'?14:12);
  CH_MAIN.forEach((ch,ci)=>{
    const pb=periodsBack(gran,refDate,nT);
    const lbs=pb.map(x=>shortLabel(gran,x.p));
    const series=pb.map(x=>{ const c=adsSum(x.p.s,x.p.e,ch); return ch==='普通广告'? c.acc : (c.show?+(c.acc/c.show*100).toFixed(2):null); });
    opt('adch-'+ci,{ tooltip:{trigger:'axis'}, grid:{left:45,right:20,top:28,bottom:40},
      xAxis:{type:'category',data:lbs,axisLabel:{fontSize:9}},
      yAxis:{type:'value',name:(ch==='普通广告'?'点击人数':'CTR %(点击率)')},
      series:[{type:'bar',data:roleBars(series),label:{show:true,position:'top',fontSize:8,formatter:p=>p.value==null?'':p.value},markArea:roleMarkArea(lbs)}]});
  });
}

// ---------- 跳转链接 ----------
function normUrl(u){ if(!u) return '(无链接)';
  try{ const x=new URL(u); const segs=x.pathname.replace(/\/+$/,'').split('/').filter(Boolean);
    return (x.hostname.replace(/^www\./,'')+'/'+segs.slice(-2).join('/')).slice(0,46); }
  catch(e){ return u.split('?')[0].slice(-46); } }
function renderLink(){
  const p=period(curGran(),refDate);
  document.getElementById('prodName3').textContent=PROD;
  document.getElementById('linkSub').textContent=`产品：${PROD} ｜ 本期 ${p.label} ｜ 按跳转链接归一聚合`;
  const M={};
  for(const r of DATA.ads_rows){
    if(r.d<p.s||r.d>p.e||r.g!==PROD) continue;
    const key=normUrl(DATA.ad_creatives[r.i]&&DATA.ad_creatives[r.i].url);
    const o=M[key]||(M[key]={show:0,acc:0,mb:0,ord:0});
    o.show+=num(r.show);o.acc+=num(r.acc);o.mb+=num(r.mb);o.ord+=num(r.ord);
  }
  const arr=Object.entries(M).map(([k,v])=>({k,...v,ctr:pct(v.acc,v.show),bu:pct(v.mb,v.acc)})).filter(x=>x.acc>0);
  const byBu=[...arr].sort((a,b)=>(b.bu||0)-(a.bu||0)).slice(0,14);
  opt('linkChart',{ tooltip:{trigger:'axis'}, grid:{left:200,right:40,top:16,bottom:30},
    xAxis:{type:'value',name:'购买率 %'}, yAxis:{type:'category',data:byBu.map(x=>x.k).reverse(),axisLabel:{fontSize:10}},
    series:[{type:'bar',data:byBu.map(x=>x.bu==null?0:+x.bu.toFixed(2)).reverse(),itemStyle:{color:RED},label:{show:true,position:'right',fontSize:10,formatter:'{c}%'}}]});
  const all=[...arr].sort((a,b)=>b.show-a.show).slice(0,25);
  const totAcc=arr.reduce((s,x)=>s+num(x.acc),0), totMb=arr.reduce((s,x)=>s+num(x.mb),0);
  const avgBu=totAcc?totMb/totAcc*100:null;
  let h='<table><tr><th class="l">链接(归一)</th><th>曝光</th><th>点击</th><th>CTR</th><th>点击购买</th><th>购买率</th><th>订单</th><th class="l">问题</th></tr>';
  for(const x of all){
    const probs=[];
    if(x.ctr!=null&&x.ctr<1&&x.acc>0) probs.push('曝光大CTR极低');
    if(x.acc>=100&&x.ord===0) probs.push('有点击零订单');
    if(avgBu&&x.acc>=100&&x.bu!=null&&x.bu<=avgBu*0.5) probs.push('购买率偏低');
    h+=`<tr><td class="l" style="font-size:11px">${x.k}</td><td>${x.show}</td><td>${x.acc}</td><td>${x.ctr==null?'—':x.ctr.toFixed(2)+'%'}</td><td>${x.mb}</td><td>${x.bu==null?'—':x.bu.toFixed(2)+'%'}</td><td>${x.ord}</td><td class="l" style="color:${probs.length?RED:'#999'};font-size:11px">${probs.join('；')||'正常'}</td></tr>`;
  }
  h+='</table>';
  document.getElementById('linkTable').innerHTML=h;
}

// ---------- 素材 ----------
function creativeKey(r){ return r.i||('T:'+r.t); }
const M_LBL={ctr:'点击率',acc:'点击人数',mb:'点击购买人数',ord:'订单提交数'};
function materialRank(ch,p,metric){
  let m=metric;
  if(m==='ctr' && ch==='普通广告') m='acc';      // 普通广告无曝光，CTR 不可用
  const M={};
  for(const r of DATA.ads_rows){
    if(r.d<p.s||r.d>p.e||r.g!==PROD||r.t!==ch) continue;
    const wd=parseD(r.d).getDay(); if(wd===0||wd===6) continue;
    const kk=creativeKey(r);
    const o=M[kk]||(M[kk]={show:0,acc:0,mb:0,ord:0,i:r.i});
    o.show+=num(r.show);o.acc+=num(r.acc);o.mb+=num(r.mb);o.ord+=num(r.ord);
  }
  const arr=Object.entries(M).map(([k,v])=>({k,...v,ctr:pct(v.acc,v.show),bu:pct(v.mb,v.acc)}));
  let cand, keyfn;
  if(m==='ctr'){
    const shows=arr.map(x=>x.show).sort((a,b)=>a-b), med=shows.length?shows[Math.floor(shows.length/2)]:0;
    const minShow=Math.max(200,med*0.2);
    cand=arr.filter(x=>x.show>=minShow && x.acc>=5);   // 加点击下限，避免小样本虚高
    keyfn=x=>x.ctr||0;
  } else if(m==='acc'){ cand=arr; keyfn=x=>x.acc; }
  else if(m==='mb'){ cand=arr; keyfn=x=>x.mb; }
  else { cand=arr; keyfn=x=>x.ord; }
  cand.sort((a,b)=>keyfn(b)-keyfn(a));
  return {top:cand.slice(0,5), bottom:cand.slice(-5).reverse(), metric:m};
}
function matCard(x,metric){
  const meta=DATA.ad_creatives[x.i]||{};
  const img=x.i?`<img src="${x.i}" loading="lazy" onerror="this.style.display='none'">`:'';
  const val=metric==='ctr'?(x.ctr==null?'—':x.ctr.toFixed(2)+'%'):(metric==='acc'?x.acc:metric==='mb'?x.mb:x.ord);
  return `<div class="mc">${img}<div class="bd"><div class="ti">${(meta.title||'—').slice(0,24)}</div>
    <div class="row"><span>${M_LBL[metric]}</span><span class="hi">${val}</span></div>
    <div class="row"><span>曝光/点击</span><span>${x.show}/${x.acc}</span></div>
    <div class="row"><span>点击购买/订单</span><span>${x.mb}/${x.ord}</span></div></div></div>`; }
function renderMaterial(){
  const p=period(curGran(),refDate), metric=document.getElementById('matSort').value;
  document.getElementById('prodName4').textContent=PROD;
  document.getElementById('matSub').textContent=`产品：${PROD} ｜ 本期 ${p.label} ｜ 仅工作日 ｜ 排序依据：${M_LBL[metric]}`;
  let topH='',botH='';
  CH_MAIN.forEach(ch=>{
    const rk=materialRank(ch,p,metric);
    if(!rk.top.length&&!rk.bottom.length) return;
    const used=M_LBL[rk.metric], note=(rk.metric!==metric)?`（该渠道无曝光，改按${used}）`:'';
    const col=CH_COLOR[ch]||BLUE;
    topH+=`<div class="sub" style="margin:14px 0 6px;font-weight:700;border-left:6px solid ${col};padding-left:8px;color:${col}">${ch} · 高${used}前5${note}</div><div class="mcards">${rk.top.map(x=>matCard(x,rk.metric)).join('')||'<span style="color:#999">样本不足</span>'}</div>`;
    botH+=`<div class="sub" style="margin:14px 0 6px;font-weight:700;border-left:6px solid ${col};padding-left:8px;color:${col}">${ch} · 低${used}前5</div><div class="mcards">${rk.bottom.map(x=>matCard(x,rk.metric)).join('')||'<span style="color:#999">样本不足</span>'}</div>`;
  });
  document.getElementById('matTop').innerHTML=topH||'<span style="color:#999">该期无足够素材数据</span>';
  document.getElementById('matBottom').innerHTML=botH;
}

// ---------- 活动/规律 + 企微素材 ----------
function renderQiList(key,elId,p){
  const arr=((DATA.qiwei_materials||{})[key]||[]).filter(x=>x[0]>=p.s&&x[0]<=p.e);
  const el=document.getElementById(elId);
  if(!arr.length){ el.innerHTML='<span style="color:#999">本期无素材</span>'; return; }
  const s=[...arr].sort((a,b)=>b[1]-a[1]);
  const top=s.slice(0,3), bot=s.slice(-3).reverse();
  const li=(x,cls)=>`<div style="display:flex;gap:6px;font-size:12px;padding:3px 0;border-bottom:1px solid #f2f3f5">
      <span style="color:${cls};font-weight:700;min-width:34px">${x[1]}次</span>
      <span style="color:#888;min-width:44px">${x[0].slice(5)}</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(x[2]||'').replace(/"/g,'')}">${x[2]||'—'}</span></div>`;
  el.innerHTML=`<div style="font-size:11px;color:#a01526;margin:2px 0">引用次数 TOP3</div>`+top.map(x=>li(x,RED)).join('')
    +`<div style="font-size:11px;color:#187a2e;margin:6px 0 2px">引用次数 BOTTOM3</div>`+bot.map(x=>li(x,GREEN)).join('');
}
function renderEvent(){
  const p=period(curGran(),refDate), ym=p.s.slice(0,7);
  // 企微素材（两个栏目）
  document.getElementById('qiSub').textContent=`本期 ${p.label}（${p.days}天）｜ 栏目：升级高端版 / 选股王 ｜ 创建人：杨婷`;
  const qxk=qiSum(p.s,p.e,'xk'), qxg=qiSum(p.s,p.e,'xg');
  const qxkp=qiSum(p.ps,p.pe,'xk'), qxgp=qiSum(p.ps,p.pe,'xg');
  const dAvg=(u,dd)=>(u/dd).toFixed(1);
  const qrow=(name,c,cp,col)=>`<tr><td class="l" style="border-left:6px solid ${col};color:${col};font-weight:600">${name}</td><td>${c.n}</td><td>${c.use}</td><td>${dAvg(c.use,p.days)}</td>
     <td style="color:${diffColor(c.n-cp.n)}">${dfmt(c.n-cp.n,false)}</td>
     <td style="color:${diffColor(c.use-cp.use)}">${dfmt(c.use-cp.use,false)}</td></tr>`;
  let qh='<table><tr><th class="l">栏目</th><th>新增素材</th><th>引用次数</th><th>日均引用次数</th><th>新增环比</th><th>引用环比</th></tr>';
  qh+=qrow('升级高端版（新开升级）', qxk, qxkp, '#C2185B');
  qh+=qrow('选股王', qxg, qxgp, '#2C5F8A');
  qh+='</table>';
  document.getElementById('qiTable').innerHTML=qh;
  renderQiList('xk','qiXkList',p); renderQiList('xg','qiXgList',p);
  // 企微每日新增（近30天）
  const days=[]; for(let i=29;i>=0;i--){ days.push(fmtD(addD(refDate,-i))); }
  const qxkD=days.map(d=>((DATA.qiwei_daily||{})[d]||{}).xk?DATA.qiwei_daily[d].xk.n:0);
  const qxgD=days.map(d=>((DATA.qiwei_daily||{})[d]||{}).xg?DATA.qiwei_daily[d].xg.n:0);
  opt('qiChart',{ tooltip:{trigger:'axis'}, legend:{data:['升级高端版','选股王'],top:0}, grid:{left:40,right:20,top:30,bottom:40},
    xAxis:{type:'category',data:days.map(d=>d.slice(5)),axisLabel:{fontSize:9}},
    yAxis:{type:'value',name:'新增素材数'},
    series:[{name:'升级高端版',type:'bar',data:qxkD,itemStyle:{color:'#C2185B'}},{name:'选股王',type:'bar',data:qxgD,itemStyle:{color:'#2C5F8A'}}]});
  // 彩蛋
  let h='<table><tr><th class="l">彩蛋档期</th><th class="l">力度</th><th>天数</th><th>新开升级单量</th><th>日均</th><th>选股王日均</th><th>较同月基线</th></tr>';
  DATA.caidan.forEach(c=>{ h+=`<tr><td class="l">${c.name}</td><td class="l">${c.desc}</td><td>${c.n}</td><td>${c.xk}</td><td>${c.xk_avg.toFixed(2)}</td><td>${c.xg_avg.toFixed(2)}</td><td style="color:${diffColor(c.diff)};font-weight:bold">${dfmt(c.diff,true)}</td></tr>`; });
  h+='</table>'; document.getElementById('caidanTable').innerHTML=h;
  const last=DATA.caidan[DATA.caidan.length-1];
  opt('caidanChart',{ tooltip:{trigger:'axis'}, legend:{data:['新开升级','选股王'],top:0}, grid:{left:40,right:40,top:30,bottom:30},
    xAxis:{type:'category',data:last.daily.map(d=>d.d)}, yAxis:[{type:'value',name:'新开升级'},{type:'value',name:'选股王',position:'right',splitLine:{show:false}}],
    series:[{name:'新开升级',type:'bar',data:last.daily.map(d=>d.xk),itemStyle:{color:RED}},
      {name:'选股王',type:'line',yAxisIndex:1,data:last.daily.map(d=>d.xg),itemStyle:{color:BLUE}}]});
  // 规律
  let dz=[],wz=[];
  const dd=Object.entries(DATA.bi55_daily).filter(([d])=>d.startsWith(ym)).sort((a,b)=>a[0].localeCompare(b[0]));
  for(const[d,v] of dd){ const wd=parseD(d).getDay(), we=(wd===0||wd===6);
    if(we&&v.xk===0&&v.xg===0) dz.push(d.slice(5)); if(!we&&v[pk()]===0) wz.push(d.slice(5)); }
  let ph=`<div>月份：<b>${ym}</b>｜共 ${dd.length} 天 ｜ 产品：<b>${PROD}</b></div>
    <div class="ok" style="margin-top:8px">双零周末（常态）：${dz.length?dz.join('、'):'无'}</div>`;
  ph += wz.length ? `<div class="warn">⚠️ 工作日零单（须预警）：${wz.join('、')}</div>` : `<div class="ok">本月工作日均有单。</div>`;
  document.getElementById('pattern').innerHTML=ph;
}

// ---------- 主渲染 ----------
function renderAll(){ renderHome(); renderAmount(); renderAd(); renderLink(); renderMaterial(); renderEvent(); }
function init(){
  document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('on',x===b));
    document.querySelectorAll('main section').forEach(s=>s.classList.toggle('on',s.id==='tab-'+b.dataset.t));
    Object.values(charts).forEach(c=>c.resize());
  });
  document.querySelectorAll('#prodBar .pb').forEach(b=>b.onclick=()=>{
    PROD=b.dataset.p;
    document.querySelectorAll('#prodBar .pb').forEach(x=>x.classList.toggle('on',x===b));
    renderAll();
  });
  document.getElementById('gran').onchange=renderAll;
  document.getElementById('matSort').onchange=renderMaterial;
  document.getElementById('refDate').onchange=()=>{ refDate=parseD(document.getElementById('refDate').value); renderAll(); };
}
fetch('data/dashboard.json').then(r=>r.json()).then(d=>{
  DATA=d;
  document.getElementById('meta').textContent=`数据源：${d.source}｜${d.note}`;
  document.getElementById('updatedBadge').textContent='数据更新于 '+d.updated;
  // 默认基准日=最近一个完整周（周日为周末）；避免周一打开时本周才刚开始
  let rd=parseD(d.updated); while(rd.getDay()!==0) rd=addD(rd,-1);
  refDate=rd;
  document.getElementById('refDate').value=fmtD(rd);
  init(); renderAll();
  window.addEventListener('resize',()=>Object.values(charts).forEach(c=>c.resize()));
}).catch(e=>{ document.getElementById('meta').textContent='数据加载失败：'+e; });
