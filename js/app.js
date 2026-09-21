// 选股王/高端版 广告×成交 分析面板 — 渲染层 v2
const RED = '#E60025', GREEN = '#187a2e', BLUE = '#2C5F8A', GRAY = '#888';
let DATA = null;
let refDate = null;
const charts = {};
const CHS = ['普通广告','APP弹窗广告','APP通知栏推送','PC弹窗推送','PC小弹窗'];

const pad = n => String(n).padStart(2,'0');
const fmtD = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseD = s => { const [a,b,c]=s.split('-').map(Number); return new Date(a,b-1,c); };
const addD = (d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const addM = (d,n)=>{ const x=new Date(d); x.setMonth(x.getMonth()+n); return x; };
const addY = (d,n)=>{ const x=new Date(d); x.setFullYear(x.getFullYear()+n); return x; };
const num = v => (v==null?0:v);
const diffColor = d => d>0?RED:(d<0?GREEN:'#444');
const dfmt = (d,isPct)=> d==null?'—':((d>0?'+':'')+(isPct?d.toFixed(2)+'pp':d));
const pct = (a,b)=> (b? a/b*100 : null);

// ---------- 时间粒度引擎 ----------
function period(gran, ref){
  const maxd = parseD(DATA.updated);
  let start, end, prevStart, yStart, label, prevLabel, yLabel;
  if(gran==='day'){
    start=end=new Date(ref); prevStart=addD(start,-1); yStart=addY(start,-1);
    label=fmtD(start); prevLabel=fmtD(prevStart); yLabel=fmtD(yStart);
  } else if(gran==='week'){                          // 固定周：周一~周日
    const w=(ref.getDay()+6)%7; start=addD(ref,-w); end=addD(start,6);
    prevStart=addD(start,-7); yStart=addY(start,-1);
  } else if(gran==='rweek'){                         // 滚动周：最近7天
    end=new Date(ref); start=addD(end,-6); prevStart=addD(start,-7); yStart=addY(start,-1);
  } else if(gran==='month'){
    start=new Date(ref.getFullYear(),ref.getMonth(),1); end=new Date(ref.getFullYear(),ref.getMonth()+1,0);
    prevStart=addM(start,-1); yStart=addY(start,-1);
    label=`${start.getFullYear()}-${pad(start.getMonth()+1)}`; prevLabel=`${prevStart.getFullYear()}-${pad(prevStart.getMonth()+1)}`; yLabel=`${yStart.getFullYear()}-${pad(yStart.getMonth()+1)}`;
  } else {                                            // quarter
    const q=Math.floor(ref.getMonth()/3); start=new Date(ref.getFullYear(),q*3,1); end=new Date(ref.getFullYear(),q*3+3,0);
    prevStart=addM(start,-3); yStart=addY(start,-1);
    label=`${start.getFullYear()}Q${q+1}`;
    const ps=addM(start,-3); prevLabel=`${ps.getFullYear()}Q${Math.floor(ps.getMonth()/3)+1}`;
    yLabel=`${yStart.getFullYear()}Q${q+1}`;
  }
  if(end>maxd) end=maxd;
  if(start>end) start=end;
  const days = Math.round((end-start)/86400000)+1;
  const prevEnd = addD(prevStart,days-1), yEnd = addD(yStart,days-1);
  if(gran==='week'||gran==='rweek'){
    label=`${fmtD(start)}~${fmtD(end)}`; prevLabel=`${fmtD(prevStart)}~${fmtD(prevEnd)}`; yLabel=`${fmtD(yStart)}~${fmtD(yEnd)}`;
  }
  return {s:fmtD(start),e:fmtD(end),ps:fmtD(prevStart),pe:fmtD(prevEnd),ys:fmtD(yStart),ye:fmtD(yEnd),label,prevLabel,yLabel,days};
}
function periodsBack(gran, ref, n){
  const out=[];
  for(let i=n-1;i>=0;i--){
    let r=new Date(ref);
    if(gran==='day') r=addD(ref,-i);
    else if(gran==='week'||gran==='rweek') r=addD(ref,-7*i);
    else if(gran==='month') r=addM(ref,-i);
    else r=addM(ref,-3*i);
    out.push({p:period(gran,r),r});
  }
  return out;
}
function shortLabel(gran,p){
  if(gran==='month') return p.label;
  if(gran==='quarter') return p.label;
  return p.label.slice(5).replace('~','–');
}

// ---------- 聚合 ----------
function sumBI55(s,e){ let xk=0,xg=0; for(const[d,v] of Object.entries(DATA.bi55_daily)) if(d>=s&&d<=e){xk+=v.xk;xg+=v.xg;} return {xk,xg}; }
function sumDev(s,e){ const o={xk:{},xg:{}}; for(const[d,v] of Object.entries(DATA.bi55_device_daily)) if(d>=s&&d<=e){ for(const g of ['xk','xg']) for(const[dev,c] of Object.entries(v[g])) o[g][dev]=(o[g][dev]||0)+c; } return o; }
function adsSum(s,e,group,ch){
  let r={show:0,acc:0,mb:0,ord:0,deal:0};
  const gs = group && group!=='全部' ? [group] : ['选股王','新开升级'];
  for(const[d,v] of Object.entries(DATA.ads_daily)) if(d>=s&&d<=e){ for(const g of gs){ const c=v[g]&&v[g][ch]; if(!c) continue; r.show+=num(c.show);r.acc+=num(c.acc);r.mb+=num(c.mb);r.ord+=num(c.ord);r.deal+=num(c.deal); } }
  return r;
}
function curGran(){ return document.getElementById('gran').value; }
function curGrp(){ return document.getElementById('grp').value; }

// ---------- 单量 ----------
function renderAmount(){
  const gran=curGran(), p=period(gran,refDate);
  document.getElementById('periodLabel').textContent=`本期 ${p.label}（${p.days}天）`;
  const c=sumBI55(p.s,p.e), pv=sumBI55(p.ps,p.pe), yo=sumBI55(p.ys,p.ye);
  const el=document.getElementById('kpis');
  const card=(title,val,diff,sub)=>`<div class="kpi"><div class="t">${title}</div><div class="v">${val}</div>
     <div class="d" style="color:${diff==null?'#888':diffColor(diff)}">${diff==null?'—':'变化 '+dfmt(diff,false)} <span style="color:#999">${sub}</span></div></div>`;
  el.innerHTML =
    card(`本期新开升级（${p.label}）`, c.xk, c.xk-pv.xk, `环比 ${p.prevLabel}（同比 ${p.yLabel}: ${yo.xk}）`)
  + card(`本期选股王（${p.label}）`, c.xg, c.xg-pv.xg, `环比 ${p.prevLabel}（同比 ${p.yLabel}: ${yo.xg}）`)
  + card('本期合计', c.xk+c.xg, (c.xk+c.xg)-(pv.xk+pv.xg), `环比 ${p.prevLabel}`)
  + `<div class="kpi"><div class="t">新开升级占比</div><div class="v">${((c.xk/(c.xk+c.xg||1))*100).toFixed(1)}%</div><div class="d" style="color:#888">新开升级 / 合计</div></div>`;

  // 趋势
  const n = gran==='day'?14:(gran==='quarter'?8:12);
  const pb = periodsBack(gran, refDate, n);
  const labels=pb.map(x=>shortLabel(gran,x.p));
  const xks=pb.map(x=>sumBI55(x.p.s,x.p.e).xk), xgs=pb.map(x=>sumBI55(x.p.s,x.p.e).xg);
  opt('amtTrend',{ tooltip:{trigger:'axis'}, legend:{data:['新开升级','选股王'],top:0},
    grid:{left:40,right:20,top:30,bottom:40}, xAxis:{type:'category',data:labels,axisLabel:{fontSize:10}},
    yAxis:{type:'value'}, series:[
      {name:'新开升级',type:'bar',data:xks,itemStyle:{color:'#c9ced6'}},
      {name:'选股王',type:'line',data:xgs,itemStyle:{color:BLUE},smooth:true}]});

  // 本期 vs 环比 vs 同比
  opt('amtCmp',{ tooltip:{trigger:'axis'}, legend:{data:['新开升级','选股王'],top:0},
    grid:{left:40,right:20,top:30,bottom:30}, xAxis:{type:'category',data:['本期','环比期','同比期']},
    yAxis:{type:'value'}, series:[
      {name:'新开升级',type:'bar',data:[c.xk,pv.xk,yo.xk],itemStyle:{color:RED}},
      {name:'选股王',type:'bar',data:[c.xg,pv.xg,yo.xg],itemStyle:{color:BLUE}}]});

  // 端分布
  const dv=sumDev(p.s,p.e);
  const devs=DATA.devices, dxk=devs.map(d=>dv.xk[d]||0), dxg=devs.map(d=>dv.xg[d]||0);
  opt('devChart',{ tooltip:{trigger:'axis'}, legend:{data:['新开升级','选股王'],top:0},
    grid:{left:50,right:20,top:30,bottom:30}, xAxis:{type:'value'}, yAxis:{type:'category',data:devs},
    series:[{name:'新开升级',type:'bar',stack:'t',data:dxk,itemStyle:{color:RED}},
            {name:'选股王',type:'bar',stack:'t',data:dxg,itemStyle:{color:BLUE}}]});

  // 目标达成
  renderTargets(p);
}
function renderTargets(p){
  const t=DATA.targets||{}, el=document.getElementById('targets');
  const ym=p.s.slice(0,7), yr=p.s.slice(0,4);
  const row=(name,cur,tgt)=>{
    if(!tgt) return `<div style="margin-bottom:10px"><b>${name}</b>：<span style="color:#999">目标未配置（在 targets.json 填写）</span></div>`;
    const pctv=Math.min(100, cur/tgt*100);
    return `<div style="margin-bottom:12px"><div class="row" style="display:flex;justify-content:space-between"><b>${name}</b><span>${cur} / ${tgt} = <b>${(cur/tgt*100).toFixed(1)}%</b></span></div>
      <div class="bar"><i style="width:${pctv}%;background:${cur/tgt>=1?GREEN:RED}"></i></div></div>`;
  };
  const m=t.monthly&&t.monthly[ym], y=t.yearly&&t.yearly[yr];
  const mc=sumBI55(ym+'-01',p.e);
  let html='<div class="sub">月度目标（'+ym+' 至今）</div>';
  html+=row('新开升级', mc.xk, m&&m.xk);
  html+=row('选股王', mc.xg, m&&m.xg);
  html+='<div class="sub" style="margin-top:12px">年度目标（'+yr+' 累计至今）</div>';
  const yc=sumBI55(yr+'-01-01', p.e);
  html+=row('新开升级', yc.xk, y&&y.xk);
  html+=row('选股王', yc.xg, y&&y.xg);
  el.innerHTML=html;
}

// ---------- 广告 ----------
function renderAd(){
  const gran=curGran(), p=period(gran,refDate);
  document.getElementById('adSub').textContent=`本期 ${p.label} vs 上期 ${p.prevLabel}（广告仅环比，不做同比）`;
  let html='<table><tr><th class="l">分组</th><th class="l">渠道</th><th>曝光(去重)</th><th>点击人数</th><th>点击率CTR</th><th>点击购买</th><th>购买率</th><th>订单提交</th><th>成交(归因)</th></tr>';
  for(const g of ['选股王','新开升级']){
    CHS.forEach((ch,i)=>{
      const c=adsSum(p.s,p.e,g,ch), pv=adsSum(p.ps,p.pe,g,ch);
      const ctr=pct(c.acc,c.show), ctrp=pct(pv.acc,pv.show), bu=pct(c.mb,c.acc), bup=pct(pv.mb,pv.acc);
      const cell=(v,d,isPct)=>`${v==null?'无数据':v}<br><span style="font-size:11px;color:${diffColor(d)}">${dfmt(d,isPct)}</span>`;
      html+=`<tr><td class="l" ${i===0?'rowspan="5" style="font-weight:bold;vertical-align:middle"':''}>${i===0?g:''}</td>`
        +`<td class="l" ${ch==='PC小弹窗'?'style="color:#999"':''}>${ch}</td>`
        +`<td>${cell(c.show||'无数据', c.show-pv.show,false)}</td>`
        +`<td>${cell(c.acc, c.acc-pv.acc,false)}</td>`
        +`<td>${cell(ctr==null?'无数据':ctr.toFixed(2)+'%', (ctr!=null&&ctrp!=null)?ctr-ctrp:null,true)}</td>`
        +`<td>${cell(c.mb, c.mb-pv.mb,false)}</td>`
        +`<td>${cell(bu==null?'无数据':bu.toFixed(2)+'%', (bu!=null&&bup!=null)?bu-bup:null,true)}</td>`
        +`<td>${cell(c.ord, c.ord-pv.ord,false)}</td>`
        +`<td>${cell(c.deal, c.deal-pv.deal,false)}</td></tr>`;
    });
  }
  html+='</table>';
  document.getElementById('adTable').innerHTML=html;

  // CTR 图（分组×渠道 本期）
  const gsel=curGrp(); const gs = gsel==='全部'?['选股王','新开升级']:[gsel];
  opt('adCtrChart',{ tooltip:{trigger:'axis'}, legend:{data:gs,top:0}, grid:{left:45,right:20,top:30,bottom:60},
    xAxis:{type:'category',data:CHS.slice(0,4),axisLabel:{fontSize:10,interval:0}},
    yAxis:{type:'value',name:'CTR %'}, series:gs.map((g,gi)=>({name:g,type:'bar',
      data:CHS.slice(0,4).map(ch=>{const c=adsSum(p.s,p.e,g,ch);const v=pct(c.acc,c.show);return v==null?null:+v.toFixed(2);}),
      itemStyle:{color:gi===0?RED:BLUE}}))});
  // PC 拆分
  opt('adPcChart',{ tooltip:{trigger:'axis'}, legend:{data:gs,top:0}, grid:{left:45,right:20,top:30,bottom:40},
    xAxis:{type:'category',data:['PC大弹窗','PC小弹窗(650×300)']}, yAxis:{type:'value',name:'CTR %'},
    series:gs.map((g,gi)=>({name:g,type:'bar',data:['PC弹窗推送','PC小弹窗'].map(ch=>{const c=adsSum(p.s,p.e,g,ch);const v=pct(c.acc,c.show);return v==null?null:+v.toFixed(2);}),itemStyle:{color:gi===0?RED:BLUE}}))});
}

// ---------- 跳转链接 ----------
function normUrl(u){
  if(!u) return '(无链接)';
  try{ const x=new URL(u); let path=x.pathname.replace(/\/+$/,''); const segs=path.split('/').filter(Boolean);
    const tail=segs.slice(-2).join('/')||''; return (x.hostname.replace(/^www\./,'')+'/'+tail).slice(0,46); }
  catch(e){ return u.split('?')[0].slice(-46); }
}
function renderLink(){
  const p=period(curGran(),refDate), gsel=curGrp();
  document.getElementById('linkSub').textContent=`本期 ${p.label}｜分组 ${gsel}｜按跳转链接归一聚合（去query、取末两段路径）`;
  const M={};
  for(const r of DATA.ads_rows){
    if(r.d<p.s||r.d>p.e) continue;
    if(gsel!=='全部' && r.g!==gsel) continue;
    const key=normUrl(DATA.ad_creatives[r.i]&&DATA.ad_creatives[r.i].url);
    const o=M[key]||(M[key]={show:0,acc:0,mb:0,ord:0});
    o.show+=num(r.show);o.acc+=num(r.acc);o.mb+=num(r.mb);o.ord+=num(r.ord);
  }
  const arr=Object.entries(M).map(([k,v])=>({k,...v,ctr:pct(v.acc,v.show),bu:pct(v.mb,v.acc)})).filter(x=>x.acc>0);
  arr.sort((a,b)=>(b.bu||0)-(a.bu||0));
  const top=arr.slice(0,14);
  opt('linkChart',{ tooltip:{trigger:'axis'}, grid:{left:200,right:40,top:16,bottom:30},
    xAxis:{type:'value',name:'购买率 %'}, yAxis:{type:'category',data:top.map(x=>x.k).reverse(),axisLabel:{fontSize:10}},
    series:[{type:'bar',data:top.map(x=>x.bu==null?0:+x.bu.toFixed(2)).reverse(),
      itemStyle:{color:RED},label:{show:true,position:'right',fontSize:10,formatter:'{c}%'}}]});

  // 表格 + 问题识别
  const all=arr.sort((a,b)=>b.show-a.show).slice(0,25);
  const avgBu = (arr.length? arr.reduce((s,x)=>s+num(x.mb),0)/Math.max(1,arr.reduce((s,x)=>s+num(x.acc),0))*100 : null);
  let h='<table><tr><th class="l">链接(归一)</th><th>曝光</th><th>点击</th><th>CTR</th><th>点击购买</th><th>购买率</th><th>订单</th><th class="l">问题</th></tr>';
  for(const x of all){
    const probs=[];
    if(x.show>0 && x.ctr!=null && x.ctr<1 && x.acc>0) probs.push('曝光大CTR极低');
    if(x.acc>=100 && x.ord===0) probs.push('有点击零订单');
    if(avgBu && x.acc>=100 && x.bu!=null && x.bu<=avgBu*0.5) probs.push('购买率偏低');
    h+=`<tr><td class="l" style="font-size:11px">${x.k}</td><td>${x.show}</td><td>${x.acc}</td><td>${x.ctr==null?'—':x.ctr.toFixed(2)+'%'}</td>`
      +`<td>${x.mb}</td><td>${x.bu==null?'—':x.bu.toFixed(2)+'%'}</td><td>${x.ord}</td>`
      +`<td class="l" style="color:${probs.length?RED:'#999'};font-size:11px">${probs.join('；')||'正常'}</td></tr>`;
  }
  h+='</table>';
  document.getElementById('linkTable').innerHTML=h;
}

// ---------- 素材 ----------
function creativeKey(r){ return r.i || ('T:'+((DATA.ad_creatives[r.i]&&DATA.ad_creatives[r.i].title)||r.t)); }
function materialRank(group,ch,p){
  const M={};
  for(const r of DATA.ads_rows){
    if(r.d<p.s||r.d>p.e) continue;
    if(group!=='全部' && r.g!==group) continue;
    if(r.t!==ch) continue;
    const wd=parseD(r.d).getDay(); if(wd===0||wd===6) continue;      // 剔除周末
    const k=creativeKey(r);
    const o=M[k]||(M[k]={show:0,acc:0,mb:0,ord:0,i:r.i,g:r.g});
    o.show+=num(r.show);o.acc+=num(r.acc);o.mb+=num(r.mb);o.ord+=num(r.ord);
  }
  const arr=Object.entries(M).map(([k,v])=>({k,...v,ctr:pct(v.acc,v.show),bu:pct(v.mb,v.acc)}));
  const shows=arr.map(x=>x.show).sort((a,b)=>a-b);
  const med=shows.length?shows[Math.floor(shows.length/2)]:0;
  const minShow=Math.max(200, med*0.2);
  const cand=arr.filter(x=>x.show>=minShow && x.show>0);
  cand.sort((a,b)=>(b.ctr||0)-(a.ctr||0));
  return {top:cand.slice(0,5), bottom:cand.slice(-5).reverse(), minShow:Math.round(minShow)};
}
function matCard(x){
  const meta=DATA.ad_creatives[x.i]||{};
  const img=x.i?`<img src="${x.i}" loading="lazy" onerror="this.style.display='none'">`:'';
  return `<div class="mc">${img}<div class="bd">
    <div class="ti">${(meta.title||'—').slice(0,24)}</div>
    <div class="row"><span>CTR</span><span class="hi">${x.ctr==null?'—':x.ctr.toFixed(2)+'%'}</span></div>
    <div class="row"><span>曝光/点击</span><span>${x.show}/${x.acc}</span></div>
    <div class="row"><span>点击购买/订单</span><span>${x.mb}/${x.ord}</span></div>
  </div></div>`;
}
function renderMaterial(){
  const p=period(curGran(),refDate), g=curGrp();
  document.getElementById('matSub').textContent=`本期 ${p.label}｜分组 ${g}｜仅工作日｜最小曝光阈值按渠道自适应（max(200,中位数×0.2)）；TOP 按 CTR 降序、BOTTOM 升序`;
  let topH='', botH='';
  for(const ch of ['普通广告','APP弹窗广告','APP通知栏推送','PC弹窗推送']){
    const rk=materialRank(g,ch,p);
    if(!rk.top.length && !rk.bottom.length) continue;
    topH+=`<div class="sub" style="margin:12px 0 6px;font-weight:600">${ch} · TOP5（曝光阈值≥${rk.minShow}）</div><div class="mcards">${rk.top.map(matCard).join('')||'<span style="color:#999">样本不足</span>'}</div>`;
    botH+=`<div class="sub" style="margin:12px 0 6px;font-weight:600">${ch} · BOTTOM5（待淘汰）</div><div class="mcards">${rk.bottom.map(matCard).join('')||'<span style="color:#999">样本不足</span>'}</div>`;
  }
  document.getElementById('matTop').innerHTML = topH || '<span style="color:#999">该期无足够素材数据</span>';
  document.getElementById('matBottom').innerHTML = botH;
}

// ---------- 活动/规律 ----------
function renderEvent(){
  const p=period(curGran(),refDate), ym=p.s.slice(0,7);
  // 彩蛋表
  let h='<table><tr><th class="l">彩蛋档期</th><th class="l">力度</th><th>天数</th><th>新开升级单量</th><th>日均</th><th>选股王日均</th><th>较同月基线</th></tr>';
  DATA.caidan.forEach(c=>{ h+=`<tr><td class="l">${c.name}</td><td class="l">${c.desc}</td><td>${c.n}</td><td>${c.xk}</td><td>${c.xk_avg.toFixed(2)}</td><td>${c.xg_avg.toFixed(2)}</td><td style="color:${diffColor(c.diff)};font-weight:bold">${dfmt(c.diff,true)}</td></tr>`; });
  h+='</table>';
  document.getElementById('caidanTable').innerHTML=h;
  // 彩蛋图（本轮）
  const last=DATA.caidan[DATA.caidan.length-1];
  opt('caidanChart',{ tooltip:{trigger:'axis'}, legend:{data:['新开升级','选股王'],top:0}, grid:{left:40,right:40,top:30,bottom:30},
    xAxis:{type:'category',data:last.daily.map(d=>d.d)}, yAxis:[{type:'value',name:'新开升级'},{type:'value',name:'选股王',position:'right',splitLine:{show:false}}],
    series:[{name:'新开升级',type:'bar',data:last.daily.map(d=>d.xk),itemStyle:{color:RED},
      markArea:{itemStyle:{color:'rgba(230,0,37,.1)'},data:[[{xAxis:last.daily[0].d},{xAxis:last.daily[last.daily.length-1].d}]]}},
      {name:'选股王',type:'line',yAxisIndex:1,data:last.daily.map(d=>d.xg),itemStyle:{color:BLUE}}]});
  // 规律
  let dz=[], wz=[];
  const days=Object.entries(DATA.bi55_daily).filter(([d])=>d.startsWith(ym)).sort((a,b)=>a[0].localeCompare(b[0]));
  for(const [d,v] of days){ const wd=parseD(d).getDay(); const we=(wd===0||wd===6);
    if(we&&v.xk===0&&v.xg===0) dz.push(d.slice(5)); if(!we&&v.xk===0) wz.push(d.slice(5)); }
  let ph=`<div>月份：<b>${ym}</b>｜共 ${days.length} 天</div>
    <div class="ok" style="margin-top:8px">双零周末（常态）：${dz.length?dz.join('、'):'无'}</div>`;
  ph += wz.length ? `<div class="warn">⚠️ 工作日零单（须预警，断裂多在下游支付/捕获）：${wz.join('、')}</div>`
                  : `<div class="ok">本月工作日新开升级均有单。</div>`;
  document.getElementById('pattern').innerHTML=ph;
}

// ---------- 工具 ----------
function opt(id,o){ if(!charts[id]) charts[id]=echarts.init(document.getElementById(id)); charts[id].setOption(o,true); }
function renderAll(){ renderAmount(); renderAd(); renderLink(); renderMaterial(); renderEvent(); }

// ---------- 初始化 ----------
function init(){
  document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('on',x===b));
    document.querySelectorAll('main section').forEach(s=>s.classList.toggle('on',s.id==='tab-'+b.dataset.t));
    Object.values(charts).forEach(c=>c.resize());
  });
  const gran=document.getElementById('gran'), ref=document.getElementById('refDate'), grp=document.getElementById('grp');
  gran.onchange=renderAll; ref.onchange=()=>{ refDate=parseD(ref.value); renderAll(); }; grp.onchange=renderAll;
}
fetch('data/dashboard.json').then(r=>r.json()).then(d=>{
  DATA=d;
  document.getElementById('meta').textContent=`数据源：${d.source}｜更新：${d.updated}｜${d.note}`;
  refDate=parseD(d.updated);
  document.getElementById('refDate').value=d.updated;
  init(); renderAll();
  window.addEventListener('resize',()=>Object.values(charts).forEach(c=>c.resize()));
}).catch(e=>{ document.getElementById('meta').textContent='数据加载失败：'+e; });
