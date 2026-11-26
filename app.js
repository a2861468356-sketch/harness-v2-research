"use strict";
const publicSite = document.documentElement.hasAttribute("data-public-site");
const pages = ["overview","tree","results","audit","markets","knowledge","system"];
const classes = {market_development:"开发样本", synthetic_engineering:"合成工程", model_conjecture:"模型推测"};
const modeLabels = {neutral:"中性",conservative:"保守",adverse:"较不利",entry5:"首单 +5 bps",entry10:"首单 +10 bps",delay1000:"延迟压力"};
const phaseLabels = {registered:"试验登记",model_dispatched:"模型派发",model_recorded:"回执已保存",completed:"评估完成",checkpoint_pause:"检查点暂停",stopped:"预算停止",paused:"等待核查",audited_and_accounted:"账户对账",compiled_and_prefix_audited:"候选前缀审计",started_or_resumed:"启动或续跑"};
const state = {data:null, selected:"Q009", profile:"neutral", period:"base", compare:"", market:"", marketSearch:"", liquid:false, lane:"market_development", knowledgeSearch:"", tree:"Q009"};
const content = document.querySelector("#content");
const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const num = (value,digits=2) => Number.isFinite(value) ? new Intl.NumberFormat("zh-CN",{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value) : "—";
const sign = x => (Number.isFinite(x) && x > 0 ? "+" : "") + num(x);
const pct = x => Number.isFinite(x) ? num(100*x,2)+"%" : "—";
const tone = x => x > 0 ? "good" : x < 0 ? "negative" : "";
const date = value => {
  if (!value) return "—";
  const time = new Date(value);
  if (isNaN(time)) return safe(value);
  return safe(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Dublin",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).format(time));
};
const bubble = (s,k="") => '<span class="badge '+safe(k)+'">'+safe(s)+'</span>';
const classBadge = s => bubble(classes[s] || s, s === "synthetic_engineering" ? "blue" : s === "model_conjecture" ? "warn" : "");
const trialStatus = s => bubble(s, s === "已淘汰" ? "bad" : s === "证据不足" ? "warn" : s === "工程通过" ? "blue" : "muted");
const heading = (section,title,sub,action="") => '<div class="heading"><div><p class="eyebrow">'+section+'</p><h1>'+title+'</h1><p>'+sub+'</p></div>'+action+'</div>';
const panelHead = (title,sub="",badge="") => '<div class="panel-head"><div><h2>'+title+'</h2>'+(sub?'<p>'+sub+'</p>':"")+'</div>'+badge+'</div>';
const tile = (name,value,detail="",cl="") => '<div class="kpi"><span>'+safe(name)+'</span><strong class="'+safe(cl)+'">'+safe(value)+'</strong>'+(detail?'<small>'+safe(detail)+'</small>':"")+'</div>';
const rows = values => '<ul class="list">'+values.map(([key,value])=>'<li><span>'+safe(key)+'</span><strong>'+value+'</strong></li>').join("")+'</ul>';
const section = contents => '<section class="panel">'+contents+'</section>';
const table = (headers,items) => '<div class="table-wrap"><table><thead><tr>'+headers.map(t=>'<th scope="col">'+safe(t)+'</th>').join("")+'</tr></thead><tbody>'+items.map(r=>'<tr>'+r.map(value=>'<td>'+value+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>';
const listOptions = (values,chosen) => values.map(([v,l])=>'<option value="'+safe(v)+'"'+(v===chosen?" selected":"")+'>'+safe(l)+'</option>').join("");
const selector = (id,label,values,chosen) => '<label class="select-label" for="'+id+'">'+safe(label)+'<select id="'+id+'">'+listOptions(values,chosen)+'</select></label>';
const linkTrial = id => '<a class="linklike" href="#results/'+safe(id)+'">'+safe(id)+'</a>';
const metric = (v,kind) => kind==="pct"?pct(v):kind==="int"?num(v,0):num(v);
const nodeFor = id => state.data.nodes.find(x=>x.id===id);
const urlTrial = (id,period,profile) => "/api/trial/"+id+"?"+new URLSearchParams({period,profile});
const publicCacheKey = "harness-public-snapshot-v1";
let snapshot = null, snapshotLoad = null, cachedSnapshot = false;

function validSnapshot(value){
  return value?.schema===1 && Number.isFinite(Date.parse(value.synced_at)) &&
    Number.isFinite(value.stale_after_seconds) && value.overview?.nodes?.length>0 &&
    value.markets && value.knowledge && value.results;
}

async function loadSnapshot(){
  if(snapshotLoad)return snapshotLoad;
  snapshotLoad=(async()=>{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),8500);
    try{
      const url=new URL("./snapshot.json",location.href);
      url.searchParams.set("v",String(Math.floor(Date.now()/60000)));
      const response=await fetch(url,{cache:"no-store",credentials:"omit",signal:controller.signal});
      if(!response.ok)throw Error("快照暂不可用");
      const fresh=await response.json();
      if(!validSnapshot(fresh))throw Error("快照格式无效");
      // A lagging cache should never replace a more recent verified snapshot.
      if(!snapshot || Date.parse(fresh.synced_at)>=Date.parse(snapshot.synced_at))snapshot=fresh;
      cachedSnapshot=false;
      try{localStorage.setItem(publicCacheKey,JSON.stringify(snapshot));}catch{}
    }catch(error){
      if(!snapshot){
        try{
          const stored=JSON.parse(localStorage.getItem(publicCacheKey));
          if(validSnapshot(stored))snapshot=stored;
        }catch{}
      }
      if(!snapshot)throw error;
      cachedSnapshot=true;
    }finally{
      clearTimeout(timeout);
    }
    return snapshot;
  })();
  try{return await snapshotLoad;}finally{snapshotLoad=null;}
}

const request = async url => {
  if(publicSite){
    const input=new URL(url,location.origin);
    const data=input.pathname==="/api/overview"?await loadSnapshot():snapshot||await loadSnapshot();
    if(input.pathname==="/api/overview")return data.overview;
    if(input.pathname==="/api/markets")return data.markets;
    if(input.pathname==="/api/playbook")return data.knowledge;
    const trial=input.pathname.match(/^\/api\/trial\/(Q[0-9]{3,6}|SYN-[0-9]{2,6})$/)?.[1];
    const item=trial?data.results[[trial,input.searchParams.get("period"),input.searchParams.get("profile")].join("/")]:null;
    if(!item)throw Error("没有该公开指标");
    const info=data.overview.nodes.find(n=>n.id===trial);
    return {...item,info,scope:info.scope};
  }
  const result=await fetch(url,{cache:"no-store"});
  if(!result.ok)throw new Error("本地数据暂不可用");
  return result.json();
};
const currentLocation = () => {
  const [page,id]=location.hash.slice(1).split("/");
  return [pages.includes(page)?page:"overview", id||""];
};
let renderVersion=0;
function setStatus(status){
  const element=document.querySelector("#status");
  const stateLabel={running:"研究运行中",stopped:"已停止 · 待审核",paused:"已暂停",stale:"心跳失联",offline:"数据源离线"};
  element.textContent=stateLabel[status.state]||"状态未知";
  element.className="badge "+(status.state==="running"?"":status.state==="stale"||status.state==="offline"?"warn":"muted");
  if(publicSite && snapshot){
    const stale=Date.now()-Date.parse(snapshot.synced_at)>=snapshot.stale_after_seconds*1000;
    const label=cachedSnapshot?"网络离线":stale?"Mac 同步离线":"快照已同步";
    document.querySelector("#sync").textContent=label+" · "+date(snapshot.synced_at)+" 都柏林";
    const notice=document.querySelector("#notice");
    notice.hidden=!stale&&!cachedSnapshot;
    if(!notice.hidden)notice.textContent=(cachedSnapshot?"暂时无法连接公开站点。":"Mac 同步心跳已超时。")+"当前保留上一次成功同步的快照。";
    return;
  }
  document.querySelector("#sync").textContent=status.at?new Date(status.at).toLocaleTimeString("en-GB",{timeZone:"Europe/Dublin",hour12:false}):"";
}
function overview(d){
  const modelTotal=publicSite?d.model_count:d.models.length;
  const rejects=d.nodes.filter(n=>n.status==="已淘汰").length, uncertain=d.nodes.filter(n=>n.status==="证据不足").length;
  const waiting=d.nodes.filter(n=>n.status==="冻结待独立验证").length;
  const chartNode=nodeFor("Q009")||d.nodes.find(n=>n.scope==="market_development"&&n.completed);
  const wallets=d.market.wallets;
  const tab=d.nodes.slice().reverse().slice(0,6).map(n=>[linkTrial(n.id),safe(n.name),classBadge(n.scope),
    '<strong class="'+tone(n.net)+'">'+sign(n.net)+'</strong>',trialStatus(n.status)]);
  return heading("Workspace / Overview","研究总览","查看真实试验、审计结果和当前运行状态。",bubble(publicSite?"公开研究快照":"本地工作区","muted"))+
    '<div class="grid kpis">'+tile("当前进化代数",num(d.batch.completed,0),"合成工程已完成")+
    tile("累计候选",num(d.nodes.length,0),d.market.completed+" 项历史市场 · "+num(d.formal_run?.used.candidates||0,0)+" 项本批 · "+d.batch.completed+" 项合成")+
    tile(d.formal_run?"本批剩余候选上限":"当前批次剩余预算",
      num(d.formal_run?d.formal_run.caps.candidates-d.formal_run.used.candidates:d.batch.remaining,0),
      d.formal_run?num(d.formal_run.used.candidates,0)+" / "+num(d.formal_run.caps.candidates,0)+" 真实市场候选":d.batch.completed+" / "+d.batch.budget+" 合成候选")+
    tile("实际模型调用记录",num(modelTotal,0),"含预检与知识回读")+'</div>'+
    '<div class="grid split">'+section(panelHead("账户权益曲线",chartNode?safe(chartNode.id+" · "+chartNode.name+" · 原 54 日"):"",bubble("开发样本"))+
      '<canvas class="chart" id="overview-chart" role="img" aria-label="开发样本账户权益曲线"></canvas><div class="legend"><span>中性执行 · '+(publicSite?"权益指数，初始为 100":"USDT")+'</span></div>')+
    section(panelHead("控制器状态","批次进度与审核停点",bubble("正式预算 "+d.batch.formal_budget,"muted"))+
      '<progress class="progress" aria-label="合成批次进度" value="'+d.batch.completed+'" max="'+ d.batch.budget+'"></progress>'+
      rows([["当前任务",safe(d.runtime.task)],["执行阶段",safe(d.current?.status||"等待人工审核")],["市场评估器",d.market_readiness?.status==="awaiting_review"?'<a href="#audit">接线与成交审计</a>':"待验收"],["最近登记",safe(d.latest?.id||"—")],
        ["已淘汰 / 证据不足",rejects+" / "+uncertain],["待独立验证",num(waiting,0)],["开发账户账本",num(wallets,0)],["研发状态更新时间",date(d.runtime.at)]])+
      ((d.current?.hypothesis||d.latest?.hypothesis)?'<details><summary>'+safe(d.current?"当前候选假设":"最近候选假设")+'</summary><p class="detailcopy">'+safe(d.current?.hypothesis||d.latest?.hypothesis)+'</p></details>':""))+'</div>'+
    formalBudget(d.formal_run)+
    '<div class="top-gap">'+section(panelHead("最近候选","各计划执行结果及证据类别",'<a class="textbutton" href="#tree">查看进化树</a>')+
      table(["编号","策略","样本口径","中性净额","状态"],tab))+'</div>';
}
function charts(canvas, groups){
  if(!canvas)return;
  const colors=["#79dfbf","#9db7ff","#efb887","#f7a1b8","#bfabfa","#c7dc95"];
  const render=()=>{
    const ratio=window.devicePixelRatio||1, w=canvas.clientWidth, h=canvas.clientHeight;
    if(!w||!h)return;
    canvas.width=Math.round(w*ratio); canvas.height=Math.round(h*ratio);
    const c=canvas.getContext("2d"); c.scale(ratio,ratio);
    const valid=groups.map(g=>({...g,points:g.points.filter(p=>Number.isFinite(p[1]))})).filter(g=>g.points.length);
    if(!valid.length){
      c.fillStyle="#a5b4c3";c.font="14px sans-serif";c.fillText("无可绘制的归档权益数据",16,32);return;
    }
    const p={x:58,y:19,r:19,b:37}, iw=w-p.x-p.r, ih=h-p.y-p.b;
    const values=valid.flatMap(g=>g.points.map(q=>q[1]));
    let lo=Math.min(...values), hi=Math.max(...values);
    const pad=Math.max((hi-lo)*.1,.15); lo-=pad;hi+=pad;
    const dateLabels=[...new Set(valid.flatMap(g=>g.points.map(q=>q[0])))].sort();
    const timeline = new Map(dateLabels.map((label,i)=>[label,i]));
    const x=label=>p.x + iw * timeline.get(label)/Math.max(dateLabels.length-1,1);
    const y=n=>p.y + ih*(hi-n)/(hi-lo);
    c.textBaseline="middle";c.font="11px Menlo, monospace";c.textAlign="right";
    for(let i=0;i<=4;i++){
      const value=hi-i*(hi-lo)/4, at=p.y+ih*i/4;
      c.strokeStyle="#2c3d4c";c.lineWidth=1;c.beginPath();c.moveTo(p.x,at);c.lineTo(w-p.r,at);c.stroke();
      c.fillStyle="#91a4b4";c.fillText(value.toFixed(hi-lo<10?1:0),p.x-9,at);
    }
    c.textAlign="center"; const steps=w<370?3:5;
    for(let i=0;i<=steps;i++){
      const number=Math.round((dateLabels.length-1)*i/steps), label=dateLabels[number];
      c.fillStyle="#91a4b4";c.fillText(publicSite?Number(label.slice(1))+" 日":label.slice(5),x(label),h-15);
    }
    const line=(group)=>{
      c.beginPath(); group.points.forEach(([label,value],i)=> i?c.lineTo(x(label),y(value)):c.moveTo(x(label),y(value)));
    };
    valid.forEach((g,i)=>{
      if(i===0){
        line(g); c.lineTo(x(g.points.at(-1)[0]),h-p.b);c.lineTo(x(g.points[0][0]),h-p.b);c.closePath();
        const gradient=c.createLinearGradient(0,p.y,0,h-p.b);gradient.addColorStop(0,"#79dfbf35");gradient.addColorStop(1,"#79dfbf01");
        c.fillStyle=gradient;c.fill();
      }
      line(g);c.strokeStyle=colors[i%colors.length];c.lineWidth=2;c.lineJoin="round";c.stroke();
      const [last,value]=g.points.at(-1);c.beginPath();c.arc(x(last),y(value),3,0,Math.PI*2);c.fillStyle=colors[i%colors.length];c.fill();
    });
  };
  const observer=new ResizeObserver(()=>{
    if(canvas.isConnected)render();else observer.disconnect();
  });
  observer.observe(canvas);
  render();
}
function detail(node){
  const fields=[["生成依据",node.origin],["经济假设",node.hypothesis],["变更",node.change],["失败归因 / 限制",node.failure],
    ["反证条件",node.falsifier],["审计",node.audit]];
  return '<dl class="detail">'+fields.filter(([,x])=>x).map(([k,v])=>'<dt>'+k+'</dt><dd>'+safe(v)+'</dd>').join("")+'</dl>';
}
function treePage(d,id){
  const selected=nodeFor(id)||nodeFor(state.tree)||d.nodes[0];
  state.tree=selected.id;
  function branch(node,descendants=new Set()){
    if(descendants.has(node.id))return "";
    const next=new Set([...descendants,node.id]);
    const children=d.nodes.filter(n=>n.parent===node.id&&n.scope===node.scope);
    return '<li class="tree-group'+(descendants.size?" tree-child":"")+'"><button type="button" class="tree-node" data-node="'+safe(node.id)+'" aria-pressed="'+(selected.id===node.id)+'"><span><strong>'+safe(node.id+" · "+node.name)+'</strong><small>'+safe(node.origin)+'</small></span>'+trialStatus(node.status)+'</button>'+
      (children.length?'<ul class="tree-branch">'+children.map(n=>branch(n,next)).join("")+'</ul>':"")+'</li>';
  }
  const forest=(scope,select=()=>true)=>'<ul class="tree-branch tree-grid">'+d.nodes.filter(n=>n.scope===scope&&!n.parent&&select(n)).map(n=>branch(n)).join("")+'</ul>';
  const unknown=d.nodes.filter(n=>n.parent&&!d.nodes.some(p=>p.id===n.parent&&p.scope===n.scope));
  return heading("Research / Lineage","策略进化树","查看登记父代、模型依据与实际变更。")+
    '<div class="grid split"><div>'+section(panelHead(publicSite?"历史已用样本":"已用市场开发", "预登记根机制与预设派生", bubble("V1"))+
      forest("market_development", n=>!publicSite||n.origin==="历史已用样本"))+
    (publicSite?'<div class="top-gap">'+section(panelHead("V2 真实市场开发","仅已用开发资料，独立验证未执行")+
      forest("market_development",n=>n.origin!=="历史已用样本"))+'</div>':"")+
    '<div class="top-gap">'+section(panelHead("真实模型驱动合成", "已验证反馈驱动的两代工程", bubble("V2","blue"))+forest("synthetic_engineering"))+'</div>'+
    (unknown.length?section(panelHead("待核对的父代")+unknown.map(n=>safe(n.id)).join("、")):"")+'</div>'+
    section(panelHead(safe(selected.id+" · "+selected.name),"候选溯源",classBadge(selected.scope))+detail(selected)+
    '<div class="actions"><a class="textbutton" href="#results/'+safe(selected.id)+'">'+(publicSite?"查看公开指标":"查看指标与代码差异")+'</a></div>')+'</div>';
}
function resultControls(){
  const node=nodeFor(state.selected);
  if(!node)return "";
  const virtual=node.scope==="synthetic_engineering";
  const candidates=state.data.nodes.filter(n=>n.completed).map(n=>[n.id,n.id+" · "+n.name]);
  const intervals=virtual?[["synthetic","14 个合成日"]]:[["base","原 54 日开发样本"],["later","补充 34 日鲁棒性"],["Aug","8 月补充"],["Oct","10 月补充"],["Nov","11 月补充"]];
  if(!intervals.some(([k])=>k===state.period))state.period=intervals[0][0];
  const peers=state.data.nodes.filter(n=>n.scope===node.scope&&n.id!==node.id&&n.completed).map(n=>[n.id,n.id+" · "+n.name]);
  if(!peers.some(([k])=>k===state.compare))state.compare="";
  return '<div class="actions">'+selector("candidate","候选",candidates,state.selected)+selector("period","数据区间",intervals,state.period)+
    selector("profile","执行档",Object.entries(modeLabels),state.profile)+selector("compare","对照候选",[["","无"],...peers],state.compare)+'</div>';
}
const statLabels = [["净盈利因子","pf",""],["净胜率","win","pct"],["平均盈亏比","payoff",""],["篮子数量","baskets","int"],["最大回撤","max_drawdown","pct"],["最大浮亏","max_float",""],["平均持仓（小时）","mean_hold",""],["中位持仓（小时）","median_hold",""],["P90 持仓（小时）","p90_hold",""],["保证金小时","margin_hours",""],["每千保证金小时净额","per_1000_margin_hours",""],["强平次数","liquidations","int"],["资金耗尽","bankruptcies","int"],["期末未平篮","end_baskets","int"]];
function resultInner(d,other){
  if(publicSite&&!d.measured){
    return section(panelHead("无可报告收益",d.period,classBadge(d.scope))+
      '<p class="detailcopy">'+safe(d.info.failure)+'</p>'+detail(d.info));
  }
  const m=d.metrics, synthetic=d.scope==="synthetic_engineering";
  const detailText=synthetic?"仅合成工程 · 计价模拟单位 · PF 与胜率使用闭合篮":"归档开发结果 · 账户指标单位 USDT";
  const span = (a,b) => Number.isFinite(a)&&Number.isFinite(b)?"["+num(a,3)+", "+num(b,3)+"]":"未提供足够的区间估计";
  const comparable = other ? {name:other.info.id,...other.metrics} : null;
  return '<div class="grid kpis">'+tile("全成本净额",sign(m.net),other?"对照 "+sign(other.metrics.net):d.period,tone(m.net))+
    tile("账户日净 EV",num(m.daily_ev,3),synthetic?"合成结果，不具市场晋级资格":"按 UTC 会计日",tone(m.daily_ev))+
    tile("扣费前毛收益",sign(m.gross),synthetic?"合成撮合":"模型成交与浮动估值",tone(m.gross))+
    tile("全部交易成本",num(m.cost),Number.isFinite(m.fee)?"手续费 "+num(m.fee):"含估计期末退出成本")+'</div>'+
    section(panelHead("账户权益",safe(publicSite?"按周抽样 · 权益指数，初始为 100":detailText),classBadge(d.scope))+
      '<canvas class="chart" id="result-chart" role="img" aria-label="账户权益曲线"></canvas><div class="legend">'+
      [d,...(other?[other]:[])].flatMap(r=>r.series.map(s=>'<span>'+safe(r.info.id+" · "+s.name)+'</span>')).join("")+
      '</div><p>补充区间各自独立起算，曲线分段绘制。'+(synthetic?"合成延迟压力为额外一个柱。":"")+'</p>')+
    '<div class="grid columns">'+section(panelHead("账户与持仓指标")+
      table(["指标",d.info.id,...(comparable?[comparable.name]:[])],statLabels.map(([label,key,kind])=>
        [safe(label),metric(m[key],kind),...(comparable?[metric(comparable[key],kind)]:[])])))+
    section(panelHead("成交成本与压力测试")+
      rows([["手续费",num(m.fee)],["资金费",num(m.funding)],["滑点、价差代理与取整",num(m.slip_round)],
        ["7 日区块区间 / 日",safe(span(m.low_7d,m.high_7d))],["14 日区块区间 / 日",safe(span(m.low_14d,m.high_14d))]])+
      table(["情景","净额",...(other?[other.info.id]:[])],d.stress.map(item=>[safe(modeLabels[item.profile]),
        '<strong class="'+tone(item.net)+'">'+sign(item.net)+'</strong>',
        ...(other?[sign(other.stress.find(x=>x.profile===item.profile)?.net)]:[])])))+'</div>'+
    section(panelHead("策略与审计")+detail(d.info)+
      (d.diff?'<details><summary>查看父代代码变化</summary><pre>'+safe(d.diff)+'</pre></details>':""));
}
function formalBudget(batch){
  if(!batch)return "";
  const u=batch.used,c=batch.caps;
  return section(panelHead("第一批真实市场研究","按实际调用与钱包计费")+
      rows([["候选",num(u.candidates,0)+" / "+num(c.candidates,0)],
        ["真实模型调用",num(u.model_calls,0)+" / "+num(c.model_calls,0)],
        ["已确认 Token",num(u.tokens,0)+" / "+num(c.tokens,0)],
        ["未结算预留 Token",num(u.tokens_reserved_unresolved,0)],
        ["正式 / 工程钱包",num(u.formal_wallets,0)+" / "+num(u.engineering_wallets,0)+"，总上限 "+num(c.wallets,0)],
        ["累计计算 / 实际壁钟",num(u.compute_seconds,1)+" / "+num(u.wall_seconds,1)+" 秒"],
        ["新增支出",num(u.spend,0)],["停止原因",safe(batch.reason||"运行中")]]));
}

function marketReadiness(market){
  if(market?.status!=="awaiting_review")return "";
  return section(panelHead("真实市场评估器",market.order_checks?.length?"冻结 Binance 账本与非零开仓验收":"冻结 Binance 账本与零开仓接线验收")+
    rows([["归档账户",num(market.wallets,0)],["合格开仓决策",num(market.decisions,0)],
      ...(publicSite?[]:[["最小准入成交额",num(market.minimum_entry_quote_usdt,2)+" USDT"]]),
      ["历史开仓单 / 成交片段",num(market.entries,0)+" / "+num(market.fills,0)],
      ["接线时正式新回测",num(market.formal_replays_run,0)],
      ["核验时间",date(market.verified_at)]])+
    table(["冻结基准","净额 (USDT)","逐字节一致文件","期末持仓"],market.benchmarks.map(x=>[
      safe(x.arm),sign(x.net),num(x.byte_identical_files,0),num(x.terminal_baskets,0)]))+
    table(["开发分区","零开仓钱包天数","原始逐笔及成交额"],market.windows.map(x=>[
      safe(x.window),num(x.days,0),x.verified?bubble("核对通过"):bubble("待核对","warn")]))+
    (market.order_checks?.length?table(["非零订单验证","成交片段","部分开仓"],market.order_checks.map(x=>[
      safe(x.window),num(x.fills,0),x.partial_entry?"有":"无"])):""));
}
function auditPage(d){
  const a=d.audit;
  const labels={credential_fixture_denied:"凭证探针拒绝",evaluator_write_denied:"评估器改写拒绝",external_program_denied:"外部进程拒绝",listing_denied:"目录枚举拒绝",minimal_env:"最小环境",network_denied:"策略执行禁网",read_denied:"外部文件读取拒绝",scratch_read_write:"临时目录可读写",symlink_read_denied:"符号链接越界拒绝"};
  return heading("Governance / Audit","防过拟合审计","记录固定评估器、样本权限和不确定性。",bubble("留验封存","blue"))+
    '<div class="grid kpis">'+tile("已用市场候选",num(a.registered_market,0),"全部登记")+
      tile("CSCV PBO",pct(a.pbo),num(a.blocks,0)+" 个区块 · 开发诊断")+
      tile("DSR 区块",num(a.dsr_blocks,0),"仅已用样本")+
      tile("合成账户审计",num(a.prefix_accounts,0),"时间前缀、成交和核算")+'</div>'+
    '<div class="grid columns">'+section(panelHead("冻结协议与边界")+
      rows([["评估器指纹",a.lock_intact?bubble("校验通过"):bubble("待核对","bad")],...(publicSite?[]:[["版本",safe(a.policy)]]),["成本口径",safe(a.cost_basis)],
        ...(publicSite?[]:[["成交额门槛",num(a.threshold_usdt,0)+" USDT"]]),["独立验证",safe(a.independent)],["重启复核",a.restart_unchanged?"记录未改变":"暂无"]])+
      '<details><summary>查看冻结晋级条款</summary><p class="detailcopy">'+safe(a.gate)+'</p></details>')+
    section(panelHead("进程与数据隔离","九项 macOS 内核探针")+
      rows(Object.entries(a.isolation).map(([key,val])=>[labels[key]||key,val?bubble("通过"):bubble("待核对","bad")])) )+'</div>'+
    marketReadiness(d.market_readiness)+
    section(panelHead("候选拒绝与晋级依据","PBO、DSR 与区间证据不能证明未来表现")+
      table(["候选","DSR","状态","判定依据"],d.nodes.map(n=>[linkTrial(n.id),num(n.dsr,3),trialStatus(n.status),safe(n.gate_reasons.join("；"))])));
}
function externalCoverage(external){
  if(!external?.sources?.length)return "";
  const statuses = rows([["最近采集",safe(external.latest||"待采集")],
    ["官方发布索引",external.catalog_verified?"已核对":"待核对"],
    ["样本用途",safe("仅工程验收 · 研究使用 "+num(external.research_uses,0)+" 次 · 待审核 "+num(external.pending_uses,0)+" 项")],
    ["同期外部信号与 Binance 模拟成交","等待审批和可知时间核验"]]);
  const entries = external.sources.flatMap(source=>{
    const identity = "<strong>"+safe(source.name)+"</strong><br>"+safe(source.kind+" · "+source.market);
    const status = safe(source.review)+(source.versions?"<br>"+num(source.versions,0)+" 份发布档案":"");
    return source.coverage.length?source.coverage.map((window,i)=>[
      i===0?identity:"", i===0?status:"",safe(window.grain+" · "+window.start+" 至 "+window.end),
      num(window.observations,0)+" 条 · "+num(window.missing,0)+" 缺值"
    ]):[[identity,status,"—","—"]];
  });
  return section(panelHead("外部历史数据", "A 类 · 各档案按发布版本统计；时间覆盖可重叠")+
    statuses+table(["来源","审核与采集","原始粒度及覆盖","质量"],entries));
}
function marketsPage(data){
  const s=data.summary;
  if(publicSite){
    return heading("Coverage / TradFi","全球 TradFi 市场覆盖","Binance 原生开发分区与外部来源审核汇总。",bubble("汇总数据","muted"))+
      '<div class="grid kpis">'+tile("目录合约",num(s.count,0),"归档快照")+
        tile("快照达标",num(s.liquid,0),"目录口径")+tile("开发行情分区",num(data.windows.length,0),"划分独立统计")+'</div>'+
      '<div class="grid columns">'+section(panelHead("目录地区")+
        table(["地区","数量"],data.groups.map(x=>[safe(x.name),num(x.count,0)])))+
      section(panelHead("Binance 原生开发覆盖")+
        table(["分区","合约数","时钟行数"],data.windows.map(x=>[safe(x.window),num(x.assets,0),num(x.rows,0)])))+'</div>'+externalCoverage(data.external);
  }
  const filtered=data.rows.filter(r=>(!state.market||r.market===state.market)&&(!state.liquid||r.liquid)&&
    (r.symbol+" "+r.name).toLowerCase().includes(state.marketSearch.toLowerCase()));
  return heading("Coverage / TradFi","全球 TradFi 品种池","历史归档快照 · "+date(s.as_of)+" 都柏林时间",bubble("离线目录","muted"))+
    '<div class="grid kpis">'+tile("已知合约",num(s.count,0),"两份目录按合约去重")+tile("快照成交额达标",num(s.liquid,0),"≥1,000 万 USDT")+
    tile("快照前七日上市",num(s.recent,0),"按目录时间戳")+tile("行情分区",num(data.windows.length,0),"已用开发／补充")+'</div>'+
    section(panelHead("Binance 原生开发覆盖","分区为独立钱包，逐笔覆盖单独核验")+
      table(["分区","发行合约数","5 分钟时钟行数"],data.windows.map(x=>[safe(x.window),num(x.assets,0),num(x.rows,0)])))+
    externalCoverage(data.external)+
    section(panelHead("合约目录","快照数额仅供审计。新仓必须按历史决策时点核验流动性。")+
      '<div class="actions filters">'+selector("market","市场",[["","全部"],...s.markets.map(x=>[x,x])],state.market)+
      '<label class="select-label">合约<input id="marketSearch" type="search" placeholder="输入合约或名称" value="'+safe(state.marketSearch)+'"></label>'+
      '<label class="subtle"><input id="liquid" type="checkbox"'+(state.liquid?" checked":"")+'> 仅达门槛</label></div>'+
      '<div class="subtle">显示 '+num(filtered.length,0)+' 个合约</div>'+
      table(["合约","市场","分类","名义成交额","上市时间","历史覆盖"],filtered.map(x=>[
        '<strong>'+safe(x.symbol)+'</strong>'+(x.recent?' '+bubble("新上市","blue"):""),safe(x.market),safe(x.category),num(x.quote_usdt,0),date(x.onboard),safe(x.coverage)])));
}
function knowledgePage(data){
  const files = data.records.filter(r=>r.scope===state.lane&&
    (r.key+" "+r.name+" "+r.hypothesis+" "+r.failure).toLowerCase().includes(state.knowledgeSearch.toLowerCase()));
  const entry=(r)=>'<details class="record"><summary>'+safe(r.name)+' '+linkTrial(r.trial)+' '+classBadge(r.scope)+'</summary>'+
    detail({...r,origin:r.basis,change:r.change,falsifier:r.counterexample})+
    '<p class="detailcopy">'+safe(r.retain||r.interpretation)+'</p><div class="record-token">'+
    r.evidence.map(x=>safe(x.label+" · SHA-256 "+x.sha256)).join("<br>")+'</div></details>';
  return heading("Knowledge / Playbook","研究知识库",publicSite?"公开审定摘要，按证据类别浏览。":"每条新增记录关联试验编号及证据指纹。",bubble("回读 "+(data.readback.status==="verified"?"已验证":"待验证"),"blue"))+
    section(panelHead("Playbook", "更新于 "+date(data.updated_at))+
      '<div class="actions filters">'+selector("lane","证据类别",Object.entries(classes),state.lane)+
      '<label class="select-label">检索<input id="knowledgeSearch" type="search" placeholder="试验编号或机制" value="'+safe(state.knowledgeSearch)+'"></label></div>'+
      (files.length?files.map(entry).join(""):'<p class="empty">没有匹配的记录。</p>'))+
    section(panelHead("历史知识归档",publicSite?"原档 "+num(data.history_count,0)+" 条 · 公开摘要":"历史既有项目中的成功、失败及保留机制")+
      data.history.map(r=>'<details class="record"><summary>'+safe(r.id+" · "+r.name)+'</summary>'+
      '<p class="detailcopy">'+safe(r.hypothesis)+"<br>"+safe(r.result)+"<br>"+safe(r.failure)+"<br>"+safe(r.retain)+'</p><div class="record-token">'+safe(r.source_sha256)+'</div></details>').join(""));
}
function capabilityStatus(capability){
  if(!capability)return "";
  return section(panelHead("高能力模型专项","工程验收与真实研究进度")+
    rows([["模型与恢复状态",safe(capability.route+" · "+capability.state)],
      ["本轮派发",num(capability.calls,0)+" / "+num(capability.cap_calls,0)],
      ["确认 Token",num(capability.tokens,0)+" / "+num(capability.cap_tokens,0)],
      ["中断预留 Token",num(capability.reserved,0)],
      ["候选逻辑预检",safe(capability.preflight)],
      ["数据权限",safe(capability.data_permission)],
      ["证据隔离",safe(capability.custody)],
      ["真实市场研究",safe(capability.research)]]));
}
function systemPage(d){
  const live=d.runtime;
  if(publicSite){
    return heading("Runtime / Snapshot","系统与同步","公开快照与本地研究状态。")+
      section(panelHead("最近一次同步")+
        rows([["研究状态",safe(live.task)],["研究状态更新时间",date(live.at)],
          ["公开快照时间",date(snapshot.synced_at)+" 都柏林"],["同步间隔","每 30 分钟"]]))+
      capabilityStatus(d.capability)+formalBudget(d.formal_run)+section(panelHead("公开历史事件","按事件类别与归档阶段汇总")+
        table(["时间","来源","事件","候选"],d.events.map(e=>[
          date(e.at),safe(e.source),safe(phaseLabels[e.stage]||e.stage),safe(e.trial||"—")])));
  }
  return heading("Runtime / Local","系统监控","控制器与浏览器分离。","")+
    '<div class="grid kpis">'+tile("控制器进程",live.state==="running"?"运行中":live.state==="stale"?"心跳失联":live.state==="stopped"?"已停止":"已暂停",live.pid?"PID "+live.pid:"无可验证的活跃进程")+
    tile("CPU 占用",live.process?pct(live.process.cpu_percent/100):"—","仅对应研究控制器")+
    tile("驻留内存",num(live.process?.rss_mib),live.process?"MiB":"无实时进程采样")+
    tile("模型调用",num(d.models.length,0),"含预检及 Playbook 回读")+'</div>'+
    '<div class="grid columns">'+section(panelHead("心跳与检查点")+
      rows([["当前任务",safe(live.task)],["最后状态 / 心跳",date(live.at)],["发布器",safe(d.log.publisher?.status||"等待同步")],
      ["恢复测试",d.audit.resumed?"第一代检查点完整":"无凭据"],["完成后重启",d.audit.restart_unchanged?"无重复调用或重跑":"无凭据"]]))+
    section(panelHead("历史异常")+"<p>"+safe(d.log.incident.summary)+"</p>")+'</div>'+
    capabilityStatus(d.capability)+section(panelHead("模型调用记录","仅显示已许可会话元数据与可用令牌用量")+
      table(["时间","用途","候选","用时（秒）","输入 Token","输出 Token","状态","会话"],
        d.models.map(m=>[date(m.at),safe(m.source),safe(m.trial||"—"),num(m.seconds),
          num(m.usage.input_tokens,0),num(m.usage.output_tokens,0),safe(m.status),'<code>'+safe(m.session||"—")+'</code>'])))+
    section(panelHead("运行日志","结构化事件与恢复节点")+
      table(["时间","来源","事件","候选","记录"],d.log.events.map(e=>[
        date(e.at),safe(e.source),safe(phaseLabels[e.stage]||e.stage),safe(e.trial||e.id||"—"),safe(e.reason||e.error||"—")])));
}
async function render(){
  if(!state.data)return;
  const [page,id]=currentLocation();
  const ticket=++renderVersion;
  document.querySelectorAll("#nav a").forEach(a=>a.dataset.page===page?a.setAttribute("aria-current","page"):a.removeAttribute("aria-current"));
  try{
    if(page==="overview"){
      content.innerHTML=overview(state.data);
      const node=nodeFor("Q009")||state.data.nodes.find(n=>n.scope==="market_development"&&n.completed);
      if(node){
        const data=await request(urlTrial(node.id,"base","neutral"));
        if(ticket===renderVersion)charts(document.querySelector("#overview-chart"),data.series);
      }
    }else if(page==="tree")content.innerHTML=treePage(state.data,id);
    else if(page==="audit")content.innerHTML=auditPage(state.data);
    else if(page==="system")content.innerHTML=systemPage(state.data);
    else if(page==="markets"){
      const data=await request("/api/markets");
      if(ticket===renderVersion)content.innerHTML=marketsPage(data);
    }else if(page==="knowledge"){
      const data=await request("/api/playbook");
      if(ticket===renderVersion)content.innerHTML=knowledgePage(data);
    }else if(page==="results"){
      if(id && nodeFor(id)?.completed && id!==state.selected){ state.selected=id;state.period="base";state.compare=""; }
      content.innerHTML=heading("Research / Replay","量化回测中心",publicSite?"对照公开的区间汇总与抽样曲线。":"按候选、区间及执行档查看实际账本。")+
        section(resultControls())+'<div id="result-data" class="loading">正在读取账户…</div>';
      const data=await request(urlTrial(state.selected,state.period,state.profile));
      const other=state.compare?await request(urlTrial(state.compare,state.period,state.profile)):null;
      if(ticket!==renderVersion)return;
      const result=document.querySelector("#result-data");
      result.classList.remove("loading");result.innerHTML=resultInner(data,other);
      charts(document.querySelector("#result-chart"),[...data.series,...(other?.series||[])]);
    }
  }catch{
    if(ticket===renderVersion)content.innerHTML=section(panelHead("资料暂不可用")+"<p>"+(publicSite?"请刷新公开页面或调整筛选。":"请检查本地研究服务或更换筛选。")+"</p>");
  }
}
content.addEventListener("change",event=>{
  const {id,value,checked}=event.target;
  if(id==="candidate"){location.hash="#results/"+value;return;}
  if(id==="liquid")state.liquid=checked;
  else if(["market","marketSearch","lane","knowledgeSearch","profile","period","compare"].includes(id))state[id]=value;
  else return;
  render();
});
content.addEventListener("click",event=>{
  const node=event.target.closest("button[data-node]");
  if(node)location.hash="#tree/"+node.dataset.node;
});
window.addEventListener("hashchange",()=>{
  window.scrollTo({top:0});
  render();
});
async function sync(){
  const notice=document.querySelector("#notice");
  try{
    const current=await request("/api/overview");
    const changed = !state.data || current!==state.data&&publicSite || current.runtime.state!==state.data.runtime.state ||
      current.runtime.task!==state.data.runtime.task ||
      current.formal_run?.used.wallets!==state.data.formal_run?.used.wallets ||
      current.formal_run?.used.tokens!==state.data.formal_run?.used.tokens ||
      current.nodes.length!==state.data.nodes.length || (current.model_count??current.models?.length)!==(state.data.model_count??state.data.models?.length) ||
      current.nodes.map(n=>n.status).join()!==state.data.nodes.map(n=>n.status).join();
    state.data=current; if(!publicSite)notice.hidden=true; setStatus(current.runtime);
    const page=currentLocation()[0];
    if(changed||page==="system")render();
  }catch{
    setStatus({state:"offline"});notice.textContent=publicSite?"公开快照暂不可用，稍后将自动重试。":"本地数据服务不可用。重新连接后会自动更新。";notice.hidden=false;
  }
}
sync(); window.setInterval(sync,publicSite?60000:6500);
