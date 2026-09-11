const fallbackStates = [
  {code:'G · GROWTH', value:'−0.7', label:'增长放缓', trend:'↓ 0.3', cls:'down', pos:32, conf:'84%', driver:'消费与新订单'},
  {code:'I · INFLATION', value:'+0.8', label:'压力偏高', trend:'↑ 0.2', cls:'up', pos:70, conf:'79%', driver:'工资与能源'},
  {code:'L · LIQUIDITY', value:'−0.6', label:'金融条件偏紧', trend:'→ 0.0', cls:'flat', pos:35, conf:'90%', driver:'实际利率'},
  {code:'F · FRAGILITY', value:'+0.9', label:'脆弱性上升', trend:'↑ 0.2', cls:'up', pos:73, conf:'72%', driver:'财政利息负担'},
  {code:'O · ORDER', value:'+1.2', label:'秩序压力高', trend:'↑ 0.1', cls:'up', pos:80, conf:'61%', driver:'贸易与能源通道'}
];
let runtimeData = null;
let causalData = null;
let scenarioData = null;
let portfolioData = null;
let selectedEntity = 'US';
let selectedPathId = null;
let selectedEdgeId = null;
const entityLabels = {US:'美国', CN:'中国', GLOBAL:'全球'};
const selectedState = () => runtimeData?.entities?.[selectedEntity] || runtimeData;
const dimensionMeta = {
  growth: {code:'G · GROWTH', label:v=>v<-.2?'增长放缓':v>.2?'增长偏强':'增长中性', driver:'消费与新订单'},
  inflation: {code:'I · INFLATION', label:v=>v>.2?'压力偏高':v<-.2?'通缩压力':'价格中性', driver:'核心价格与供给'},
  liquidity: {code:'L · LIQUIDITY', label:v=>v<-.2?'金融条件偏紧':v>.2?'流动性宽松':'流动性中性', driver:'政策、信用、市场'},
  fragility: {code:'F · FRAGILITY', label:v=>v>.25?'脆弱性上升':'资产负债表稳健', driver:'信用与财政负担'},
  order: {code:'O · ORDER', label:v=>v>.75?'秩序压力高':v>.25?'秩序压力上升':'秩序稳定', driver:'贸易与地缘秩序'}
};
const signed = v => `${v>=0?'+':'−'}${Math.abs(v).toFixed(1)}`;
const matrixValue = (entity,key) => {const d=runtimeData?.entities?.[entity]?.dimensions?.[key];return d?`${signed(d.level)} ${d.trend==='up'?'↑':d.trend==='down'?'↓':'→'}`:'—';};
const currentStates = () => {
  const state=selectedState();
  if (!state?.dimensions) return fallbackStates;
  return Object.entries(dimensionMeta).map(([key,meta])=>{
    const d=state.dimensions[key];
    return {code:meta.code,value:signed(d.level),label:meta.label(d.level),trend:`${d.trend==='up'?'↑':d.trend==='down'?'↓':'→'} ${Math.abs(d.momentum).toFixed(1)}`,cls:d.trend, pos:Math.max(2,Math.min(98,50+d.level*25)),conf:`${Math.round(d.confidence*100)}%`,driver:meta.driver,freshness:d.freshness};
  });
};
const stateStrip = () => `<section class="status-strip">${currentStates().map(s=>`<article class="state"><div class="state-top"><span class="state-code">${s.code}</span><span class="trend ${s.cls}">${s.trend}</span></div><div class="state-value"><b>${s.value}</b><span>${s.label}</span></div><div class="bar"><i style="left:${s.pos}%"></i></div><div class="state-foot"><span>${s.driver}</span><span class="${s.freshness==='stale'?'stale':''}">${s.freshness==='stale'?'STALE · ':''}CONF ${s.conf}</span></div></article>`).join('')}</section>`;
const head = (n,title,desc,right='') => `<header class="page-head"><div><p class="eyebrow">0${n} / WORLD MODEL OS</p><h1>${title}</h1><p>${desc}</p></div>${right}</header>`;

const historySvg = () => {
  const points=runtimeData?.history?.points||[];
  if(!points.length)return '<div class="history-empty">等待累计可比快照</div>';
  const series=key=>points.map((row,index)=>{const x=points.length===1?500:index*(1000/(points.length-1));const value=row[selectedEntity]?.[key]??0;const y=60-value*38;return `${x.toFixed(1)},${Math.max(4,Math.min(116,y)).toFixed(1)}`;}).join(' ');
  return `<svg viewBox="0 0 1000 120" preserveAspectRatio="none"><line x1="0" x2="1000" y1="60" y2="60" stroke="rgba(180,210,212,.12)"/><polyline fill="none" stroke="#63d7cf" stroke-width="2" points="${series('growth')}"/><polyline fill="none" stroke="#e5b86b" stroke-width="1.5" points="${series('inflation')}"/></svg>`;
};

const dynamicDrivers = state => (state?.drivers||[]).slice(0,4).map((driver,index)=>`<div class="driver"><b>${String(index+1).padStart(2,'0')}</b><p>${driver.label}<br><small>${driver.explanation} · 来源能力 ${driver.sourceCapability}</small></p><em class="${driver.impact<0?'loss':''}">${driver.impact>=0?'+':''}${driver.impact.toFixed(3)} ${driver.dimension[0].toUpperCase()}</em></div>`).join('');

function worldV2(){
  const state=selectedState();
  const regime=state?.regime;
  const regimeText={stagflation:'增长放缓 × 通胀上行',contraction:'增长与通胀同步回落',goldilocks:'增长改善 × 通胀回落',overheating:'增长与通胀同步上行',mixed_transition:'混合过渡状态'}[regime?.label]||'数据不足';
  const conf=regime?.confidence?Math.round(regime.confidence*100):0;
  const rows=['US','CN','GLOBAL'].map(entity=>`<tr data-entity="${entity}" class="${selectedEntity===entity?'selected':''}" tabindex="0"><td><i class="dot ${entity==='US'?'d-accent':entity==='CN'?'d-warn':'d-good'}"></i>${entityLabels[entity]}</td>${['growth','inflation','liquidity','fragility','order'].map(key=>`<td>${matrixValue(entity,key)}</td>`).join('')}</tr>`).join('');
  const history=runtimeData?.history?.points||[];
  const range=history.length?`${history[0].period} — ${history[history.length-1].period}`:'NO HISTORY';
  return `<div class="view">${head(1,'世界状态',`${entityLabels[selectedEntity]} · 现实、方向、约束与置信度。点击经济体行切换主视图；当前结论不构成交易指令。`,`<div class="regime"><p class="kicker">CURRENT REGIME · ${conf}% CONF</p><strong>${regimeText}</strong><small>${state?.overlays?.order==='high'?'高秩序压力覆盖层':'秩序压力中低'} · ${runtimeData?.dataMode||'LOADING'}</small></div>`)}${stateStrip()}
  <div class="grid-2"><section class="section"><div class="section-title"><h2>经济体状态错位</h2><span>ENGINE OUTPUT · CLICK TO FOCUS</span></div><table class="matrix interactive"><thead><tr><th>实体</th><th>增长</th><th>通胀</th><th>政策流动性</th><th>脆弱性</th><th>秩序</th></tr></thead><tbody>${rows}</tbody></table></section>
  <section class="section"><div class="section-title"><h2>主要变化贡献</h2><span>${selectedEntity} · MOMENTUM PROXY</span></div><div class="drivers">${dynamicDrivers(state)||'<p class="empty-copy">当前没有有效驱动数据。</p>'}</div></section></div>
  <section class="timeline"><div class="section-title"><h2>状态轨迹</h2><span>DEMO HISTORY · ${range}</span></div><div class="line-chart">${historySvg()}</div><div class="legend"><span><i style="background:#63d7cf"></i>Growth</span><span><i style="background:#e5b86b"></i>Inflation</span><span>当前实体：${entityLabels[selectedEntity]}</span></div></section></div>`;
}

const causalForEntity = () => causalData?.entities?.[selectedEntity];
const scenarioForEntity = () => scenarioData?.entities?.[selectedEntity];
const layerMeta = {
  structure:['STRUCTURE','5—30Y'],cycle:['CYCLE','1M—3Y'],balance_sheet:['BALANCE SHEET','1Q—10Y'],
  policy:['POLICY','EVENT—3Y'],order:['ORDER','1M—10Y'],expectations:['EXPECTATIONS','1D—2Y'],portfolio:['PORTFOLIO','NOW']
};
const nodeById = (graph,id) => graph?.nodes?.find(node=>node.id===id);

function causal(){
  const graph=causalForEntity();
  if(!graph)return `<div class="view">${head(2,'因果地图','等待版本化因果图产物。')}</div>`;
  const path=graph.paths.find(item=>item.id===(selectedPathId||graph.primaryPathId))||graph.paths[0];
  selectedPathId=path?.id||null;
  const pathEdges=(path?.edgeIds||[]).map(id=>graph.edges.find(edge=>edge.id===id)).filter(Boolean);
  const edge=graph.edges.find(item=>item.id===selectedEdgeId)||pathEdges[0]||graph.edges[0];
  selectedEdgeId=edge?.id||null;
  const activeNodes=new Set(pathEdges.flatMap(item=>[item.source,item.target]));
  const lanes=Object.entries(layerMeta).map(([key,meta])=>[key,...meta,graph.nodes.filter(node=>node.layer===key)]);
  const source=nodeById(graph,edge?.source),target=nodeById(graph,edge?.target);
  const pathTabs=graph.paths.map(item=>`<button data-path="${item.id}" class="${item.id===path.id?'active':''}">${item.label}<span>${Math.round(item.activityScore*100)}</span></button>`).join('');
  return `<div class="view">${head(2,'因果地图',`${entityLabels[selectedEntity]} · 当前主导路径来自状态绑定与研究机制，不构成因果识别。`,`<div class="regime"><span class="badge">RESEARCH CANDIDATE</span><strong>${path?.label||'暂无主路径'}</strong><small>活动度 ${Math.round((path?.activityScore||0)*100)}% · 所有边待研究审批</small></div>`)}
  <div class="path-tabs">${pathTabs}</div><div class="causal-layout"><section class="causal-stage">${lanes.map(([key,label,horizon,nodes])=>`<div class="lane"><div class="lane-label"><b>${label}</b><small>${horizon}</small></div><div class="nodes">${nodes.map((node,index)=>{const state=node.state||{};const observed=state.bindingStatus==='observed_model_state';const score=state.score==null?'UNOBSERVED':signed(Number(state.score));return `<button class="node ${activeNodes.has(node.id)?'hot':''}" title="${observed?'绑定模型状态':'研究假设，尚无观测绑定'}"><b>${node.label}</b><span>${score}${observed?` · CONF ${Math.round(state.confidence*100)}%`:' · ASSUMPTION'}</span></button>${index<nodes.length-1?'<span class="arrow">→</span>':''}`}).join('')||'<span class="empty-copy">本层暂无节点</span>'}</div></div>`).join('')}</section>
  <aside class="inspector"><p class="eyebrow">SELECTED EDGE · ${edge?.runtimeStatus||'—'}</p><h3>${source?.label||'—'} → ${target?.label||'—'}</h3><p>${edge?.conditions?.join('；')||'未配置适用条件'}</p><div class="edge-picker">${pathEdges.map(item=>`<button data-edge="${item.id}" class="${item.id===edge?.id?'active':''}">${nodeById(graph,item.source)?.label} → ${nodeById(graph,item.target)?.label}</button>`).join('')}</div><div class="evidence"><article><span class="grade">GRADE ${edge?.evidenceGrade||'D'}</span><b>证据状态</b><p>${edge?.status==='approved'?'已审批':'研究候选；不得解释为已验证因果关系'}</p></article><article><span class="grade">LAG</span><b>机制与时滞</b><p>${edge?.sign||'—'} / ${edge?.shape||'—'}；${edge?.lag?.minDays||0}—${edge?.lag?.maxDays||0} 天，典型 ${edge?.lag?.modeDays||0} 天。</p></article><article><span class="grade">CHALLENGE</span><b>反证条件</b><p>${edge?.invalidation||'未配置'}</p></article><article><span class="grade">COMPETING</span><b>竞争假设</b><p>${graph.hypotheses.map(h=>`${h.id} ${h.title}（${Math.round(h.confidence*100)}%）`).join('<br>')}</p></article></div></aside></div></div>`;
}

const percentRange = range => `${Math.round(range.low*100)}% ~ ${range.high>=0?'+':''}${Math.round(range.high*100)}%`;
const featureLabels={
  'growth.momentum':'增长动量','inflation.momentum':'通胀动量','liquidity.level':'金融条件',
  'fragility.level':'脆弱性','order.level':'秩序压力'
};

function scenario(){
  const set=scenarioForEntity();
  if(!set)return `<div class="view">${head(3,'情景推演','等待版本化情景建议产物。')}</div>`;
  const lead=[...set.scenarios].sort((a,b)=>Math.abs(b.deltaPp)-Math.abs(a.deltaPp))[0];
  const cards=set.scenarios.map(item=>`<article class="scenario"><p class="eyebrow">${item.slot} · PENDING REVIEW</p><div class="prob">${Math.round(item.suggestedProbability*100)}%</div><span class="delta ${item.deltaPp<0?'loss':''}">${item.deltaPp>=0?'+':''}${item.deltaPp.toFixed(1)}pp / PRIOR</span><h2>${item.title}</h2><p>${item.definition}</p><dl><dt>进入条件</dt><dd>${item.trigger}</dd><dt>失效条件</dt><dd>${item.invalidation}</dd><dt>组合压力</dt><dd class="${item.impactRange.low<-.05?'loss':''}">${percentRange(item.impactRange)} · 假设</dd></dl></article>`).join('');
  const overlays=set.overlays.map((item,index)=>`<article class="overlay"><div><p class="eyebrow">OVERLAY 0${index+1} · PENDING</p><h3>${item.title}</h3><p>${item.definition} · 触发：${item.trigger}</p></div><strong>${Math.round(item.suggestedProbability*100)}%</strong></article>`).join('');
  const evidence=set.evidence.slice(0,5).map(item=>`<div class="trace-row"><span>${featureLabels[item.feature]||item.feature}</span><div class="trace-bar"><i style="width:${Math.min(100,Math.abs(item.impact)*120)}%"></i></div><span>${item.impact>=0?'+':''}${item.impact.toFixed(3)} → ${item.scenarioId}</span></div>`).join('');
  return `<div class="view">${head(3,'情景推演',`${entityLabels[selectedEntity]} · 三个互斥主路径与两个独立覆盖层；概率仅为有边界的机器建议。`,`<div class="regime"><p class="kicker">HORIZON · ${set.horizon.toUpperCase()}</p><strong>机器建议：${lead.slot} ${lead.deltaPp>=0?'+':''}${lead.deltaPp.toFixed(1)}pp</strong><small>PENDING HUMAN REVIEW · 单期上限 ${Math.round(set.constraints.maxSingleRunShift*100)}pp</small></div>`)}<section class="scenario-grid">${cards}</section><section class="overlay-row">${overlays}</section><section class="prob-trace"><div class="section-title"><h2>本期建议的主要证据贡献</h2><span>STATE FEATURES · CLUSTER DISCOUNT</span></div>${evidence}<p class="model-boundary">模型输出是研究判断支持，不是客观后验；批准前不会进入组合风险预算。</p></section></div>`;
}

const pct = value => `${Math.round(Number(value)*100)}%`;
const portfolioFactorLabels = {
  equity:'权益系统风险',nominal_duration:'名义久期',real_rate:'实际利率下行',credit:'信用风险',
  inflation_commodity:'通胀 / 商品',usd:'美元',china_equity:'中国权益特异风险'
};

function portfolio(){
  const data=portfolioData;
  if(!data)return `<div class="view">${head(4,'组合暴露','等待七因子组合风险产物。')}</div>`;
  const normal=data.riskViews.normal,stress=data.riskViews.stress;
  const top=[...normal.contributions].sort((a,b)=>b.absoluteContributionPct-a.absoluteContributionPct)[0];
  const topBudget=data.riskBudgets.find(item=>item.factorId===top.factorId);
  const tail=data.constraints.worstTailLoss;
  const capital=data.capitalWeights.map(item=>`<div class="risk-row"><span>${item.label}</span><div class="riskbar"><i style="width:${item.weight*100}%"></i></div><b>${pct(item.weight)}</b></div>`).join('');
  const riskRows=[...normal.contributions].sort((a,b)=>b.absoluteContributionPct-a.absoluteContributionPct).map(item=>{const budget=data.riskBudgets.find(row=>row.factorId===item.factorId);const cls=budget.status==='within_band'?'':'outside';return `<div class="risk-row ${cls}"><span>${portfolioFactorLabels[item.factorId]||item.factorId}</span><div class="riskbar"><i style="width:${item.absoluteContributionPct*100}%"></i><u style="left:${budget.policyMax*100}%"></u></div><b>${pct(item.absoluteContributionPct)}</b></div>`}).join('');
  const scenarios=data.scenarioStress.map(item=>{const isLoss=item.lossRange.low<0;const limit=data.constraints.policy.tailLossFloor;const status=item.lossRange.low<limit?'breach':item.lossRange.low<limit+0.06?'review':'pass';const statusText={pass:'通过',review:'复核',breach:'突破'}[status];const dot={pass:'d-good',review:'d-warn',breach:'d-bad'}[status];return `<tr><td>${item.title}<small>${item.scenarioType==='overlay'?'OVERLAY':'PRIMARY'} · ${item.approvalStatus==='pending_human_review'?'待审批':'已审批'}</small></td><td>${item.suggestedProbability==null?'独立':pct(item.suggestedProbability)}</td><td class="${isLoss?'loss':''}">${percentRange(item.lossRange)}</td><td>${portfolioFactorLabels[item.leadingLossFactor]||item.leadingLossFactor}</td><td><i class="dot ${dot}"></i>${statusText}</td></tr>`}).join('');
  const checks=data.constraints.hardChecks.map(item=>`<span class="check ${item.status}"><i></i>${item.label} · ${item.status==='pass'?'通过':'突破'}</span>`).join('');
  const reasons=data.proposal.reasons.join('；')||'当前风险预算位于政策带内';
  return `<div class="view">${head(4,'组合暴露','资金分散不等于风险分散。用七个风险因子、压力相关性与硬约束审查组合；不输出交易指令。',`<div class="regime"><p class="kicker">PORTFOLIO · ${data.portfolioId.toUpperCase()}</p><strong>${data.proposal.status==='review_required'?'需复核：风险预算偏离':'风险预算位于政策带内'}</strong><small>${data.dataMode} · ${data.modelVersion}</small></div>`)}<section class="portfolio-hero"><div class="thesis"><p class="eyebrow">PRIMARY RISK · NORMAL MATRIX</p><h2>${pct(top.absoluteContributionPct)} 的绝对风险贡献来自${portfolioFactorLabels[top.factorId]}，政策上限为 ${pct(topBudget.policyMax)}。</h2><p>${reasons}。压力矩阵下预计波动升至 ${pct(stress.expectedVolatility)}；这是只读研究产物，不是目标权重或交易建议。</p><div class="checks">${checks}</div></div><div class="constraint"><div class="metric"><span>正常预计波动</span><b>${pct(normal.expectedVolatility)}</b><span>目标 ${pct(data.constraints.policy.volatilityTarget.min)}—${pct(data.constraints.policy.volatilityTarget.max)}</span></div><div class="metric"><span>最差情景下界</span><b class="${tail<data.constraints.policy.tailLossFloor?'loss':''}">${pct(tail)}</b><span>硬下限 ${pct(data.constraints.policy.tailLossFloor)}</span></div><div class="metric"><span>3日内流动性</span><b>${pct(data.constraints.liquidWeight)}</b><span>最低 ${pct(data.constraints.policy.liquidWithinDays.minimumWeight)}</span></div></div></section><section class="risk-compare"><div class="risk-col"><div class="section-title"><h2>资金权重</h2><span>CAPITAL · 100%</span></div>${capital}</div><div class="risk-col"><div class="section-title"><h2>七因子绝对风险贡献</h2><span>竖线 = POLICY MAX</span></div>${riskRows}<p class="risk-note">同时保留净贡献与绝对贡献；本图使用绝对贡献，避免正负抵消造成集中度错觉。</p></div></section><section class="section"><div class="section-title"><h2>情景压力</h2><span>FACTOR SHOCK + LIQUIDITY HAIRCUT · RESEARCH ASSUMPTION</span></div><table class="stress-table"><thead><tr><th>情景</th><th>建议概率</th><th>组合区间</th><th>最大损失来源</th><th>约束</th></tr></thead><tbody>${scenarios}</tbody></table></section><div class="review-action"><p><b>只读 Proposal：${reasons}</b><small>模型置信度 ${pct(data.modelConfidence)} · 待人工审批 · orderPayload = null</small></p><button disabled aria-disabled="true">不生成交易指令</button></div></div>`;
}

const views={world:worldV2,causal,scenario,portfolio};
function render(){const route=location.hash.slice(1)||'world';document.querySelectorAll('[data-route]').forEach(a=>a.classList.toggle('active',a.dataset.route===route));document.querySelector('#app').innerHTML=(views[route]||worldV2)();document.title=`WMOS · ${route}`;}
function renderDrawer(){
  const state=selectedState();
  const rows=state?.dataHealth?.indicators||[];
  const counts=state?.dataHealth?.statusCounts||{};
  const statusLabel={fresh:'正常',stale:'陈旧',estimated:'估算',missing:'缺失',bad:'拒绝'};
  document.querySelector('#drawer-content').innerHTML=`<div class="health-summary"><div><span>当前实体</span><b>${entityLabels[selectedEntity]}</b></div><div><span>有效输入</span><b>${state?.quality?.observationCount||0}/${state?.quality?.catalogCount||0}</b></div><div><span>降级项</span><b>${(counts.stale||0)+(counts.estimated||0)+(counts.missing||0)}</b></div></div><div class="health-legend">${Object.entries(statusLabel).map(([key,label])=>`<span class="q-${key}">${label} ${counts[key]||0}</span>`).join('')}</div><div class="health-list">${rows.map(row=>`<article><div class="health-name"><i class="q-dot q-${row.qualityStatus}"></i><div><b>${row.label}</b><small>${row.indicatorId} · ${row.dimension}</small></div><span class="source-grade">${row.sourceCapability||'D'}</span></div><dl><dt>状态</dt><dd>${statusLabel[row.qualityStatus]||row.qualityStatus}</dd><dt>观察期</dt><dd>${row.observationPeriod||'—'}</dd><dt>发布时间</dt><dd>${row.releaseTime?row.releaseTime.slice(0,10):'—'}</dd><dt>版本</dt><dd>${row.vintageId||'—'}</dd><dt>来源</dt><dd>${row.source||'—'}</dd><dt>置信度</dt><dd>${Math.round((row.confidence||0)*100)}%</dd></dl>${row.releaseTimeBasis==='retrieval_time_proxy'?'<p class="health-note">发布时间使用抓取时间代理，不得用于精确历史回放。</p>':''}</article>`).join('')}</div>`;
}
function openDrawer(){renderDrawer();document.querySelector('#drawer-backdrop').hidden=false;requestAnimationFrame(()=>document.body.classList.add('drawer-open'));document.querySelector('#data-drawer').setAttribute('aria-hidden','false');document.querySelector('#drawer-close').focus();}
function closeDrawer(){document.body.classList.remove('drawer-open');document.querySelector('#data-drawer').setAttribute('aria-hidden','true');setTimeout(()=>{document.querySelector('#drawer-backdrop').hidden=true;},220);document.querySelector('#data-health-trigger').focus();}
function selectEntity(entity){if(!runtimeData?.entities?.[entity])return;selectedEntity=entity;selectedPathId=null;selectedEdgeId=null;document.querySelector('#entity-cycle').textContent=`PRIMARY · ${entity}⌄`;render();if(document.body.classList.contains('drawer-open'))renderDrawer();}
async function loadRuntimeData(){
  try{
    const responses=await Promise.all(['world-state.json','causal-map.json','scenario-set.json','portfolio-risk.json'].map(name=>fetch(`./data/${name}`,{cache:'no-store'})));
    if(responses.some(response=>!response.ok))throw new Error('one or more model artifacts are unavailable');
    [runtimeData,causalData,scenarioData,portfolioData]=await Promise.all(responses.map(response=>response.json()));
    selectedEntity=runtimeData.primaryEntity||'US';
    document.querySelector('#entity-cycle').textContent=`PRIMARY · ${selectedEntity}⌄`;
    document.querySelector('#model-version').textContent='MODEL WMOS 0.4';
    document.querySelector('#data-mode').textContent=runtimeData.isDemo?'DEMO FIXTURE':'VERIFIED DATA';
    document.querySelector('#as-of-time').textContent=`AS OF ${runtimeData.asOf.slice(0,10)}`;
    document.querySelector('#snapshot-date').textContent=runtimeData.asOf.slice(0,10).replaceAll('-',' · ');
    const degraded=(runtimeData.quality.statusCounts?.stale||0)+(runtimeData.quality.statusCounts?.estimated||0)+(runtimeData.quality.statusCounts?.missing||0);
    document.querySelector('#data-health').textContent=`${runtimeData.quality.observationCount} 项输入 · ${degraded} 项降级`;
    render();
  }catch(error){
    document.querySelector('#data-mode').textContent='DATA UNAVAILABLE';
    document.querySelector('#data-mode').classList.add('confidence-low');
    document.querySelector('#data-health').textContent='产物读取失败';
  }
}
document.addEventListener('click',event=>{const row=event.target.closest('[data-entity]');if(row)selectEntity(row.dataset.entity);const path=event.target.closest('[data-path]');if(path){selectedPathId=path.dataset.path;selectedEdgeId=null;render();}const edge=event.target.closest('[data-edge]');if(edge){selectedEdgeId=edge.dataset.edge;render();}if(event.target.closest('#data-health-trigger'))openDrawer();if(event.target.closest('#drawer-close')||event.target.id==='drawer-backdrop')closeDrawer();if(event.target.closest('#entity-cycle')){const entities=['US','CN','GLOBAL'];selectEntity(entities[(entities.indexOf(selectedEntity)+1)%entities.length]);}});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('drawer-open'))closeDrawer();if((event.key==='Enter'||event.key===' ')&&event.target.matches('[data-entity]'))selectEntity(event.target.dataset.entity);});
addEventListener('hashchange',render);render();loadRuntimeData();
