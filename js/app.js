// 选股王/高端版 广告×成交 分析面板 - 渲染层
const RED = '#E60025', GREEN = '#187a2e', BLUE = '#2C5F8A', GRAY = '#888';
let DATA = null;
const fmt = n => (n == null ? '无数据' : (Number.isInteger(n) ? n.toString() : n.toFixed(2)));

function diffColor(d){ return d > 0 ? RED : (d < 0 ? GREEN : '#444'); }
function diffText(d, isPct){
  if (d == null) return '无数据';
  const s = (d > 0 ? '+' : '') + (isPct ? d.toFixed(2) + 'pp' : d);
  return '变化 ' + s;
}

// ---------- 工具：从 bi55_daily 算月聚合 ----------
function monthAgg(ym){
  let xk=0, xg=0;
  for (const [d,v] of Object.entries(DATA.bi55_daily)){
    if (d.startsWith(ym)){ xk += v.xk; xg += v.xg; }
  }
  return {xk, xg};
}
function monthDays(ym){
  const out = [];
  for (const [d,v] of Object.entries(DATA.bi55_daily)){
    if (d.startsWith(ym)) out.push({d, ...v});
  }
  out.sort((a,b)=>a.d.localeCompare(b.d));
  return out;
}
function pctChange(cur, prev){
  if (!prev) return null;
  return cur - prev;
}

// ---------- ① KPI ----------
function renderKPI(){
  const cur = DATA.kpi_periods.cur, prev = DATA.kpi_periods.prev;
  const curLbl = cur.slice(5)+'月', prevLbl = prev.slice(5)+'月';
  const c = monthAgg(cur), p = monthAgg(prev);
  const dxk = pctChange(c.xk, p.xk), dxg = pctChange(c.xg, p.xg);
  const el = document.getElementById('kpis');
  el.innerHTML = `
    <div class="kpi"><div class="t">本月(${cur}) 新开升级 单量</div><div class="v">${c.xk}</div>
      <div class="d" style="color:${diffColor(dxk)}">${diffText(dxk,false)} <span style="color:#888;font-weight:normal">vs ${prevLbl}</span></div></div>
    <div class="kpi"><div class="t">本月(${cur}) 选股王 单量</div><div class="v">${c.xg}</div>
      <div class="d" style="color:${diffColor(dxg)}">${diffText(dxg,false)} <span style="color:#888;font-weight:normal">vs ${prevLbl}</span></div></div>
    <div class="kpi"><div class="t">本月新开升级占比</div><div class="v">${((c.xk/(c.xk+c.xg))*100).toFixed(1)}%</div>
      <div class="d" style="color:#888;font-weight:normal">新开升级 / 合计</div></div>
    <div class="kpi"><div class="t">数据截至</div><div class="v" style="font-size:20px;">${DATA.updated.slice(5)}</div>
      <div class="d" style="color:#888;font-weight:normal">${cur}（环比=本月至今 vs 上月同期）</div></div>`;
}

// ---------- ② 分组×渠道环比表 ----------
function renderCtr(){
  const groups = ['选股王','新开升级'];
  const chs = ['普通广告','APP弹窗广告','APP通知栏推送','PC弹窗推送'];
  const cur = DATA.ctr_periods.cur, prev = DATA.ctr_periods.prev;
  let html = `<div style="font-size:12px;color:#555;margin-bottom:4px">分组 × 渠道 环比（本期 <b>${cur}</b> vs 上期 <b>${prev}</b>，展示变化数值，红涨绿跌）</div>`;
  html += '<table><tr><th class="l">分组</th><th class="l">渠道</th><th>曝光(去重)</th><th>点击人数</th><th>点击率CTR</th><th>点击购买人数</th><th>点击购买率</th></tr>';
  for (const g of groups){
    chs.forEach((ch,i)=>{
      const s = DATA.ctr_mom[g][ch].cur, a = DATA.ctr_mom[g][ch].prev;
      const ctr_s = s.count_show_user ? s.count_access_user/s.count_show_user*100 : null;
      const ctr_a = a.count_show_user ? a.count_access_user/a.count_show_user*100 : null;
      const buy_s = s.count_access_user ? s.count_main_button_user/s.count_access_user*100 : null;
      const buy_a = a.count_access_user ? a.count_main_button_user/a.count_access_user*100 : null;
      const dShow = pctChange(s.count_show_user, a.count_show_user);
      const dAcc = pctChange(s.count_access_user, a.count_access_user);
      const dCtr = (ctr_s!=null&&ctr_a!=null) ? ctr_s-ctr_a : null;
      const dBuy = pctChange(s.count_main_button_user, a.count_main_button_user);
      const dBuyR = (buy_s!=null&&buy_a!=null) ? buy_s-buy_a : null;
      const showTxt = s.count_show_user ? s.count_show_user : '无数据';
      const ctrTxt = ctr_s==null ? '无数据' : ctr_s.toFixed(2)+'%';
      html += `<tr><td class="l" ${i==0?'rowspan="4" style="font-weight:bold;vertical-align:middle"':''}>${i==0?g:''}</td>`
        + `<td class="l">${ch}</td>`
        + `<td>${showTxt}<br><span style="color:${diffColor(dShow)};font-size:11px">${diffText(dShow,false)}</span></td>`
        + `<td>${s.count_access_user}<br><span style="color:${diffColor(dAcc)};font-size:11px">${diffText(dAcc,false)}</span></td>`
        + `<td>${ctrTxt}<br><span style="color:${diffColor(dCtr)};font-size:11px">${diffText(dCtr,true)}</span></td>`
        + `<td>${s.count_main_button_user}<br><span style="color:${diffColor(dBuy)};font-size:11px">${diffText(dBuy,false)}</span></td>`
        + `<td>${buy_s==null?'无数据':buy_s.toFixed(2)+'%'}<br><span style="color:${diffColor(dBuyR)};font-size:11px">${diffText(dBuyR,true)}</span></td></tr>`;
    });
  }
  html += '</table>';
  document.getElementById('ctrTable').innerHTML = html;
}

// ---------- ③ 每日成交分布 ----------
let chart3;
function renderDaily(){
  const y = document.getElementById('y3').value;
  const m = document.getElementById('m3sel').value;
  const ym = `${y}-${m}`;
  const days = monthDays(ym);
  const caidan = DATA.caidan.find(c => ym>=c.sd.slice(0,7) && ym<=c.ed.slice(0,7));
  const labels = days.map(d=>d.d.slice(5));
  const xk = days.map(d=>d.xk);
  const xg = days.map(d=>d.xg);
  const opts = {
    tooltip:{trigger:'axis'},
    legend:{data:['新开升级','选股王'],top:0},
    grid:{left:45,right:45,top:30,bottom:55},
    xAxis:{type:'category',data:labels,axisLabel:{fontSize:9,interval:0,rotate:90}},
    yAxis:[{type:'value',name:'新开升级',position:'left'},
           {type:'value',name:'选股王',position:'right',splitLine:{show:false}}],
    series:[
      {name:'新开升级',type:'bar',data:xk,itemStyle:{color:'#b0b0b0'},
       markPoint:{data: days.map((d,i)=> d.xk===0 && new Date(d.d).getDay()%6!==0 ? {coord:[i,d.xk],value:'零',itemStyle:{color:RED}} : null).filter(Boolean) }},
      {name:'选股王',type:'line',yAxisIndex:1,data:xg,itemStyle:{color:BLUE},lineStyle:{width:1.3}}
    ]
  };
  if (caidan){
    const si = days.findIndex(d=>d.d===caidan.sd);
    const ei = days.findIndex(d=>d.d===caidan.ed);
    if (si>=0 && ei>=0){
      opts.series[0].markArea = {itemStyle:{color:'rgba(230,0,37,0.10)'},
        data:[[{xAxis:labels[si]},{xAxis:labels[ei]}]]};
    }
  }
  chart3.setOption(opts, true);
}

// ---------- ④ 彩蛋专项 ----------
function renderCaidanTable(){
  let html = '<table><tr><th class="l">彩蛋档期</th><th class="l">活动力度</th><th>天数</th><th>新开升级<br>单量</th><th>新开升级<br>日均</th><th>选股王<br>日均(对照)</th><th>较同月基线<br>(新开升级日均差)</th></tr>';
  DATA.caidan.forEach(c=>{
    html += `<tr><td class="l">${c.name}</td><td class="l">${c.desc}</td><td>${c.n}</td><td>${c.xk}</td><td>${c.xk_avg.toFixed(2)}</td><td>${c.xg_avg.toFixed(2)}</td>`
      + `<td style="color:${diffColor(c.diff)};font-weight:bold">${diffText(c.diff,true)}</td></tr>`;
  });
  html += '</table>';
  document.getElementById('caidanTable').innerHTML = html;
}
let chart4;
function renderCaidanChart(){
  const i = +document.getElementById('caidanSel').value;
  const c = DATA.caidan[i];
  const labels = c.daily.map(d=>d.d);
  chart4.setOption({
    tooltip:{trigger:'axis'},
    legend:{data:['新开升级','选股王'],top:0},
    grid:{left:45,right:45,top:30,bottom:40},
    xAxis:{type:'category',data:labels},
    yAxis:[{type:'value',name:'新开升级'},{type:'value',name:'选股王',position:'right',splitLine:{show:false}}],
    series:[
      {name:'新开升级',type:'bar',data:c.daily.map(d=>d.xk),itemStyle:{color:RED},
       markArea:{itemStyle:{color:'rgba(230,0,37,0.10)'},data:[[{xAxis:labels[0]},{xAxis:labels[labels.length-1]}]]}},
      {name:'选股王',type:'line',yAxisIndex:1,data:c.daily.map(d=>d.xg),itemStyle:{color:BLUE}}
    ]
  }, true);
}

// ---------- ⑤ 周末/工作日规律 ----------
function renderPattern(){
  const ym = document.getElementById('m5sel').value;
  const days = monthDays(ym);
  let doubleZero = [], workdayZero = [];
  days.forEach(d=>{
    const dow = new Date(d.d).getDay();
    const isWeekend = (dow===0||dow===6);
    if (isWeekend && d.xk===0 && d.xg===0) doubleZero.push(d.d.slice(5));
    if (!isWeekend && d.xk===0) workdayZero.push(d.d.slice(5));
  });
  let html = `<div>月份：<b>${ym}</b> ｜ 共 ${days.length} 天</div>`;
  html += `<div class="warn" style="color:${GREEN};background:#f1f8f2;border-color:#bfe0c5">双零周末（选股王+新开升级均无单）：${doubleZero.length? doubleZero.join('、') : '无'}</div>`;
  if (workdayZero.length){
    html += `<div class="warn">⚠️ 工作日零单（新开升级为0，须预警，断裂在下游支付/捕获）：${workdayZero.join('、')}</div>`;
  } else {
    html += `<div class="ok" style="margin-top:8px">本月工作日新开升级均有单，无异常断裂。</div>`;
  }
  document.getElementById('m5out').innerHTML = html;
}

// ---------- 初始化 ----------
function initControls(){
  const years = [...new Set(Object.keys(DATA.bi55_daily).map(d=>d.slice(0,4)))].sort();
  const y3 = document.getElementById('y3'), m3 = document.getElementById('m3sel');
  years.forEach(y=>{ const o=document.createElement('option');o.value=y;o.text=y;y3.appendChild(o); });
  ['01','02','03','04','05','06','07','08','09','10','11','12'].forEach(m=>{const o=document.createElement('option');o.value=m;o.text=m;m3.appendChild(o);});
  y3.value='2026'; m3.value='09';
  y3.onchange = renderDaily; m3.onchange = renderDaily;

  const m5 = document.getElementById('m5sel');
  const months = [...new Set(Object.keys(DATA.bi55_daily).map(d=>d.slice(0,7)))].sort();
  months.forEach(m=>{const o=document.createElement('option');o.value=m;o.text=m;m5.appendChild(o);});
  m5.value = months[months.length-1]; m5.onchange = renderPattern;

  const cs = document.getElementById('caidanSel');
  DATA.caidan.forEach((c,i)=>{const o=document.createElement('option');o.value=i;o.text=c.name;cs.appendChild(o);});
  cs.onchange = renderCaidanChart;
}

fetch('data/dashboard.json').then(r=>r.json()).then(d=>{
  DATA = d;
  document.getElementById('meta').textContent = `数据源：${d.source} ｜ 更新：${d.updated} ｜ ${d.note}`;
  chart3 = echarts.init(document.getElementById('chart3'));
  chart4 = echarts.init(document.getElementById('chart4'));
  renderKPI(); renderCtr(); initControls();
  renderDaily(); renderCaidanTable(); renderCaidanChart(); renderPattern();
  window.addEventListener('resize', ()=>{chart3.resize();chart4.resize();});
}).catch(e=>{
  document.getElementById('meta').textContent = '数据加载失败：' + e + '（若本地打开请用 http 服务，GitHub Pages 直接可访问）';
});
