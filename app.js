const stateMeta = {
  growth: { code: "G", name: "增长", driver: "需求与生产", risk: (v) => v < -0.2 ? "增长承压" : v > 0.2 ? "增长偏强" : "增长中性" },
  inflation: { code: "I", name: "通胀", driver: "核心价格与供给", risk: (v) => v > 0.2 ? "价格压力偏高" : v < -0.2 ? "通缩压力" : "价格中性" },
  liquidity: { code: "L", name: "流动性", driver: "政策、信用、市场", risk: (v) => v < -0.2 ? "金融条件偏紧" : v > 0.2 ? "流动性宽松" : "流动性中性" },
  fragility: { code: "F", name: "脆弱性", driver: "债务与利息负担", risk: (v) => v > 0.25 ? "脆弱性偏高" : "资产负债表较稳健" },
  order: { code: "O", name: "秩序", driver: "贸易与地缘秩序", risk: (v) => v > 0.75 ? "秩序压力高" : v > 0.25 ? "秩序压力上升" : "秩序相对稳定" },
};
const entityLabels = { US: "美国", CN: "中国", GLOBAL: "全球" };
const factorLabels = {
  equity: "权益系统风险",
  nominal_duration: "名义久期",
  real_rate: "实际利率下行",
  credit: "信用风险",
  inflation_commodity: "通胀 / 商品",
  usd: "美元",
  china_equity: "中国权益特异风险",
  specific_risk: "资产特异风险",
};
const qualityLabels = { fresh: "正常", stale: "陈旧", estimated: "估算", missing: "缺失", bad: "拒绝" };
const model = { world: null, causal: null, scenario: null, portfolio: null, publication: null, brief: null, releaseCalendar: null, historyReplay: null, factorRisk: null };
let selectedEntity = "US";
let selectedPathId = null;
let selectedEdgeId = null;
let selectedIndicatorId = null;
let selectedHorizon = "6M";

const $ = (selector) => document.querySelector(selector);
const pct = (value) => `${Math.round(Number(value || 0) * 100)}%`;
const signed = (value, digits = 1) => `${Number(value) >= 0 ? "+" : "−"}${Math.abs(Number(value || 0)).toFixed(digits)}`;
const arrow = (trend) => trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
const escapeHtml = (value) => String(value ?? "—").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const state = () => model.world?.entities?.[selectedEntity];
const graph = () => model.causal?.entities?.[selectedEntity];
const scenarioSet = () => model.scenario?.entities?.[selectedEntity];
const brief = () => model.brief?.entities?.[selectedEntity];
const currentRoute = () => location.hash.slice(1) || "latest";

function pageHead(number, title, description, context = "") {
  return `<header class="page-head"><div><p class="eyebrow">${String(number).padStart(2, "0")} / WORLD MODEL OS</p><h1>${title}</h1><p>${description}</p></div>${context}</header>`;
}

function statusBadge(status) {
  const cls = String(status).toLowerCase().replaceAll("_", "-");
  return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

function stateStrip({ compact = false } = {}) {
  const dimensions = state()?.dimensions || {};
  return `<section class="status-strip ${compact ? "compact" : ""}">${Object.entries(stateMeta).map(([key, meta]) => {
    const value = dimensions[key] || { level: 0, momentum: 0, pressure: 0, confidence: 0, coverage: 0, trend: "flat", freshness: "missing" };
    const confidence = value.confidenceComponents || { dataCoverage: value.coverage, sourceReliability: value.confidence, modelConfidence: value.confidence };
    const position = Math.max(2, Math.min(98, 50 + value.level * 25));
    return `<button class="state" data-dimension="${key}" aria-label="查看${meta.name}证据">
      <div class="state-top"><span class="state-code">${meta.code} · ${meta.name.toUpperCase()}</span><span class="trend">${arrow(value.trend)} ${Math.abs(value.momentum).toFixed(2)}</span></div>
      <div class="state-value"><b>${signed(value.level)}</b><span>${meta.risk(value.level)}</span></div>
      <div class="bar"><i style="left:${position}%"></i></div>
      <div class="state-metrics"><span>PRESS ${signed(value.pressure)}</span><span>COV ${pct(confidence.dataCoverage)}</span><span>SRC ${pct(confidence.sourceReliability)}</span><span>MOD ${pct(confidence.modelConfidence)}</span></div>
      <div class="state-foot"><span>${meta.driver}</span><span class="quality-${value.freshness}">${String(value.freshness).toUpperCase()} · AGG ${pct(value.confidence)}</span></div>
    </button>`;
  }).join("")}</section>`;
}

function releaseContext() {
  const publication = model.publication;
  if (!publication) return "";
  return `<div class="release-context"><p class="kicker">${escapeHtml(publication.siteRelease)}</p><strong>${escapeHtml(publication.approvalStatus.replaceAll("_", " "))}</strong><small>${escapeHtml(publication.snapshotId)}</small></div>`;
}

function latest() {
  const item = brief();
  if (!item) return loadingView(1, "最新简报");
  const topPath = graph()?.paths?.find((path) => path.id === item.primaryPath.id) || item.primaryPath;
  const topRisk = model.brief.referencePortfolio.topRiskFactor;
  const worst = model.brief.referencePortfolio.worstScenario;
  const changes = item.changes.map((change, index) => `<button class="change-row" data-indicator="${change.id}">
    <span>${String(index + 1).padStart(2, "0")}</span><div><b>${escapeHtml(change.label)}</b><small>${escapeHtml(change.explanation)} · 来源 ${change.sourceCapability} · ${qualityLabels[change.qualityStatus] || change.qualityStatus}</small></div><em class="impact ${change.impact < 0 ? "negative" : "positive"}">${signed(change.impact, 3)}</em>
  </button>`).join("");
  const scenarios = [...scenarioSet().scenarios].sort((a, b) => b.suggestedProbability - a.suggestedProbability);
  const probabilityBar = scenarios.map((scenario) => `<i style="width:${scenario.suggestedProbability * 100}%" title="${escapeHtml(scenario.title)} ${pct(scenario.suggestedProbability)}"></i>`).join("");
  const scenarioLegend = scenarios.map((scenario) => `<button data-route-link="scenario"><span>${scenario.slot}</span><b>${pct(scenario.suggestedProbability)}</b><small>${signed(scenario.deltaPp, 1)}pp</small></button>`).join("");
  return `<div class="view latest-view">
    ${pageHead(1, "最新简报", `${entityLabels[selectedEntity]} · 本期状态变化、主导机制、情景分布与参考组合风险。`, releaseContext())}
    <section class="brief-thesis">
      <div><p class="eyebrow">CURRENT READING · MACHINE GENERATED DEMO</p><h2>${escapeHtml(item.summary)}</h2><p>这是结构化研究摘要，不是预测、投资建议或人工批准结论。</p></div>
      <div class="regime-read"><span>STATISTICAL REGIME</span><b>${escapeHtml(item.regime.label.replaceAll("_", " "))}</b><small>Score share ${pct(Math.max(...Object.values(item.regime.probabilities || {})))} · Model confidence ${pct(item.regime.confidence)}</small></div>
    </section>
    ${stateStrip({ compact: true })}
    <section class="brief-grid">
      <div class="brief-column"><div class="section-title"><h2>自上期最重要的变化</h2><span>TOP CONTRIBUTIONS · NOT CAUSAL</span></div><div class="changes">${changes}</div></div>
      <div class="brief-column"><div class="section-title"><h2>当前主导机制</h2>${statusBadge("RESEARCH_CANDIDATE")}</div><button class="dominant-path" data-route-link="causal"><span>${escapeHtml(topPath.label)}</span><b>${Math.round(topPath.activityScore * 100)}</b><small>活动度 · Evidence ${topPath.evidenceGrade}</small></button><p class="boundary-copy">活动度只表示当前状态与研究路径相符，不代表因果关系已经识别。</p></div>
    </section>
    <section class="brief-grid lower">
      <div class="brief-column"><div class="section-title"><h2>情景分布</h2><span>SUGGESTED · PENDING REVIEW</span></div><div class="probability-stack">${probabilityBar}</div><div class="scenario-legend">${scenarioLegend}</div></div>
      <div class="brief-column"><div class="section-title"><h2>参考组合风险镜头</h2>${statusBadge("SYNTHETIC")}</div><div class="risk-lens"><div><span>最大风险来源</span><b>${factorLabels[topRisk.factorId] || topRisk.factorId}</b><strong>${pct(topRisk.absoluteContributionPct)}</strong></div><div><span>最差研究情景</span><b>${escapeHtml(worst.title)}</b><strong class="negative">${formatRange(worst.impactRange)}</strong></div></div><a class="text-link" href="#portfolio">查看风险归因 →</a></div>
    </section>
    <section class="uncertainty"><div><p class="eyebrow">KNOWN LIMITS</p><h2>当前最大的限制，是数据可信度而非覆盖率。</h2></div><p>${model.publication.degradationFlags.map((flag) => escapeHtml(flag.replaceAll("_", " "))).join(" · ")}。所有模块在公开站分别声明数据模式。</p><a href="#evidence">检查证据链 →</a></section>
  </div>`;
}

function world() {
  const current = state();
  if (!current) return loadingView(2, "世界状态");
  const regime = current.regime;
  const transition = regime.transition;
  const matrixRows = ["US", "CN", "GLOBAL"].map((entity) => `<button class="matrix-row ${selectedEntity === entity ? "selected" : ""}" data-entity="${entity}"><b>${entityLabels[entity]}</b>${Object.keys(stateMeta).map((key) => { const d = model.world.entities[entity].dimensions[key]; return `<span>${signed(d.level)} ${arrow(d.trend)}</span>`; }).join("")}</button>`).join("");
  const drivers = current.drivers.slice(0, 5).map((driver, index) => `<button class="driver" data-indicator="${driver.indicatorId}"><span>${String(index + 1).padStart(2, "0")}</span><p><b>${escapeHtml(driver.label)}</b><small>${escapeHtml(driver.explanation)} · ${driver.sourceCapability}</small></p><em class="${driver.impact < 0 ? "negative" : "positive"}">${signed(driver.impact, 3)}</em></button>`).join("");
  return `<div class="view">
    ${pageHead(2, "世界状态", `${entityLabels[selectedEntity]} · Level、Momentum、Pressure 与可信度；颜色不替代方向语义。`, `<div class="release-context"><p class="kicker">STATISTICAL STATE</p><strong>${escapeHtml(regime.label.replaceAll("_", " "))}</strong><small>未经样本外校准，分布仅称 score share</small></div>`)}
    ${stateStrip()}
    <section class="regime-guardrail"><div><p class="eyebrow">REGIME GUARDRAIL</p><h2>${escapeHtml(transition.candidateLabel.replaceAll("_", " "))}</h2><small>候选连续 ${transition.candidateRunLength}/${transition.minimumDuration} 期 · band ±${transition.hysteresisBand}</small></div><div><span>持续期</span><b>${transition.persistenceMet ? "满足" : "未满足"}</b></div><div><span>发布状态</span><b>${escapeHtml(transition.publicationStatus)}</b></div><div><span>校准状态</span><b>${escapeHtml(transition.calibrationStatus)}</b></div><p>${transition.reasonCodes.map((item) => escapeHtml(item.replaceAll("_", " "))).join(" · ")}。该层只抑制假切换，未完成样本外校准。</p></section>
    <section class="world-grid">
      <div class="matrix-panel"><div class="section-title"><h2>经济体错位</h2><span>CLICK TO FOCUS</span></div><div class="matrix-head"><span>实体</span>${Object.values(stateMeta).map((meta) => `<span>${meta.code}</span>`).join("")}</div>${matrixRows}</div>
      <div class="drivers-panel"><div class="section-title"><h2>状态变化贡献</h2><span>PROXY · NOT CAUSAL</span></div>${drivers}</div>
    </section>
    <section class="expectation-gap"><div><p class="eyebrow">REALITY MAP</p><h3>真实状态</h3><strong>${stateMeta.growth.risk(current.dimensions.growth.level)} · ${stateMeta.inflation.risk(current.dimensions.inflation.level)}</strong><small>来自当前 Demo 指标聚合</small></div><i>≠</i><div><p class="eyebrow">EXPECTATION MAP</p><h3>市场隐含预期</h3><strong>尚未接入正式价格隐含序列</strong><small>Phase 5.1 接入后才能计算 Surprise Gap</small></div></section>
    <section class="timeline-panel"><div class="section-title"><h2>状态轨迹</h2><span>G / I · DEMO HISTORY</span></div>${historyChart()}</section>
  </div>`;
}

function historyChart() {
  const points = model.world?.history?.points || [];
  if (!points.length) return `<p class="empty">等待可比快照。</p>`;
  const path = (key) => points.map((row, index) => { const x = points.length === 1 ? 500 : index * (1000 / (points.length - 1)); const y = 65 - (row[selectedEntity]?.[key] || 0) * 38; return `${x.toFixed(1)},${Math.max(6, Math.min(124, y)).toFixed(1)}`; }).join(" ");
  return `<div class="chart-wrap"><svg viewBox="0 0 1000 130" preserveAspectRatio="none" aria-label="增长和通胀状态历史"><line x1="0" y1="65" x2="1000" y2="65"/><polyline class="growth-line" points="${path("growth")}"/><polyline class="inflation-line" points="${path("inflation")}"/></svg></div><div class="legend"><span><i class="growth-key"></i>增长</span><span><i class="inflation-key"></i>通胀</span><span>${escapeHtml(points[0].period)} — ${escapeHtml(points.at(-1).period)}</span></div>`;
}

function causal() {
  const current = graph();
  if (!current) return loadingView(3, "因果地图");
  const path = current.paths.find((item) => item.id === (selectedPathId || current.primaryPathId)) || current.paths[0];
  selectedPathId = path.id;
  const edges = path.edgeIds.map((id) => current.edges.find((edge) => edge.id === id)).filter(Boolean);
  const edge = edges.find((item) => item.id === selectedEdgeId) || edges[0];
  selectedEdgeId = edge?.id || null;
  const node = (id) => current.nodes.find((item) => item.id === id);
  const pathNodes = [];
  edges.forEach((item) => { if (!pathNodes.includes(item.source)) pathNodes.push(item.source); if (!pathNodes.includes(item.target)) pathNodes.push(item.target); });
  const flow = pathNodes.map((id, index) => `<button class="flow-node"><span>${escapeHtml(node(id)?.layer || "node")}</span><b>${escapeHtml(node(id)?.label || id)}</b><small>${node(id)?.state?.bindingStatus === "observed_model_state" ? `${signed(node(id).state.score)} · ${pct(node(id).state.confidence)}` : "RESEARCH ASSUMPTION"}</small></button>${index < pathNodes.length - 1 ? `<button class="flow-edge ${edges[index]?.id === edge?.id ? "active" : ""}" data-edge="${edges[index]?.id}" aria-label="查看因果边证据">→<small>${edges[index]?.evidenceGrade}</small></button>` : ""}`).join("");
  const tabs = current.paths.map((item) => `<button data-path="${item.id}" class="${item.id === path.id ? "active" : ""}">${escapeHtml(item.label)}<span>${Math.round(item.activityScore * 100)}</span></button>`).join("");
  const source = node(edge?.source); const target = node(edge?.target);
  const mechanism = current.mechanismContracts?.find((item) => item.id === edge?.mechanismId);
  return `<div class="view">
    ${pageHead(3, "因果地图", `${entityLabels[selectedEntity]} · 只绘制契约中真实存在的边；所有机制仍是研究候选。`, `<div class="release-context">${statusBadge("RESEARCH_CANDIDATE")}<strong>${escapeHtml(path.label)}</strong><small>Evidence ${path.evidenceGrade} · 活动度 ${Math.round(path.activityScore * 100)}</small></div>`)}
    <div class="path-tabs">${tabs}</div>
    <section class="causal-workspace"><div class="causal-canvas"><p class="eyebrow">CURRENT DOMINANT PATH</p><div class="causal-flow">${flow}</div><p class="boundary-copy">节点之间仅在数据契约存在 edge 时显示箭头；活动度不等于因果强度。</p></div>
    <aside class="inspector"><p class="eyebrow">SELECTED EDGE · ${escapeHtml(edge?.runtimeStatus)}</p><h2>${escapeHtml(source?.label)} → ${escapeHtml(target?.label)}</h2><p>${escapeHtml(mechanism?.statement || edge?.conditions?.join("；") || "未配置适用条件")}</p><div class="edge-picker">${edges.map((item) => `<button data-edge="${item.id}" class="${item.id === edge?.id ? "active" : ""}">${escapeHtml(node(item.source)?.label)} → ${escapeHtml(node(item.target)?.label)}</button>`).join("")}</div><dl class="evidence-list"><div><dt>证据等级</dt><dd>${escapeHtml(edge?.evidenceGrade)}</dd></div><div><dt>方向 / 形状</dt><dd>${escapeHtml(edge?.sign)} / ${escapeHtml(edge?.shape)}</dd></div><div><dt>时滞</dt><dd>${edge?.lag?.minDays || 0}—${edge?.lag?.maxDays || 0} 天；典型 ${edge?.lag?.modeDays || 0} 天</dd></div><div><dt>反证条件</dt><dd>${escapeHtml(edge?.invalidation)}</dd></div><div><dt>审批边界</dt><dd>候选机制；不得描述为已验证因果</dd></div></dl>${mechanismAudit(mechanism)}</aside></section>
  </div>`;
}

function mechanismAudit(mechanism) {
  if (!mechanism) return `<div class="mechanism-audit empty-audit"><p>该边尚未进入首批 Mechanism Contract。</p></div>`;
  const evaluation = mechanism.falsificationEvaluation;
  const readings = evaluation.featureReadings.map((item) => `<li><span>${escapeHtml(item.feature)} ${escapeHtml(item.operator)} ${item.threshold}</span><b class="${item.matches ? "negative" : "positive"}">${signed(item.value)} · ${item.matches ? "MATCH" : "NO"}</b></li>`).join("");
  return `<div class="mechanism-audit"><p class="eyebrow">MECHANISM CONTRACT · ${escapeHtml(mechanism.version)}</p><div class="mechanism-status"><span>反证监控</span><b>${escapeHtml(evaluation.status)}</b><small>${evaluation.observationsAvailable}/${evaluation.observationsRequired} 期 · ${escapeHtml(evaluation.historyBoundary)}</small></div><ul>${readings}</ul><div class="evidence-sides"><div><span>支持</span><b>${escapeHtml(mechanism.supportingEvidence[0].title)}</b></div><div><span>反对</span><b>${escapeHtml(mechanism.opposingEvidence[0].title)}</b></div></div></div>`;
}

function scenario() {
  const set = scenarioSet();
  if (!set) return loadingView(4, "情景推演");
  const forecast = set.forecasts?.find((item) => item.horizon === selectedHorizon) || set.forecasts?.[0];
  const scenarios = forecast?.scenarios || set.scenarios;
  const rows = scenarios.map((item) => `<article class="scenario-row"><div><p class="eyebrow">${item.slot} · ${escapeHtml(item.approvalStatus)}</p><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.definition)}</p></div><div class="probability-steps"><span><small>PRIOR</small><b>${pct(item.priorProbability)}</b></span><i>→</i><span><small>SUGGESTED</small><b>${pct(item.suggestedProbability)}</b></span><i>→</i><span class="pending"><small>APPROVED</small><b>—</b></span></div><dl><dt>进入条件</dt><dd>${escapeHtml(item.trigger)}</dd><dt>失效条件</dt><dd>${escapeHtml(item.invalidation)}</dd><dt>影响区间</dt><dd class="${item.impactRange.low < 0 ? "negative" : "positive"}">${formatRange(item.impactRange)} · 假设</dd></dl></article>`).join("");
  const evidence = (forecast?.waterfall || set.waterfall || []).slice(0, 8).map((item) => `<div class="waterfall-row"><span>${escapeHtml(item.cluster)}</span><div><i style="width:${Math.min(100, Math.abs(item.rawImpact) * 120)}%"></i></div><b>${signed(item.rawImpact, 3)} → ${signed(item.discountedImpact, 3)}</b><small>${escapeHtml(item.scenarioId)}</small></div>`).join("");
  const horizonTabs = (set.forecasts || []).map((item) => `<button data-horizon="${item.horizon}" class="${item.horizon === forecast?.horizon ? "active" : ""}"><b>${item.horizon}</b><small>结算 ${escapeHtml(item.settlesAt.slice(0, 10))}</small></button>`).join("");
  const jointBranches = [...(set.overlayTree || [])].sort((a, b) => b.jointProbability - a.jointProbability).slice(0, 6).map((item) => `<tr><td>${escapeHtml(item.baseScenarioId)}</td><td>${item.productivityUpside ? "ON" : "OFF"}</td><td>${item.orderShock ? "ON" : "OFF"}</td><td>${pct(item.jointProbability)}</td></tr>`).join("");
  return `<div class="view">
    ${pageHead(4, "情景推演", `${entityLabels[selectedEntity]} · 3M/6M/12M 预测账本；展示先验、机器建议与人工批准的严格边界。`, `<div class="release-context"><p class="kicker">HORIZON · ${escapeHtml(forecast?.horizon)}</p><strong>PENDING HUMAN REVIEW</strong><small>结算 ${escapeHtml(forecast?.settlesAt.slice(0, 10))}</small></div>`)}
    <section class="horizon-tabs">${horizonTabs}</section>
    <section class="scenario-list">${rows}</section>
    <section class="scenario-analysis"><div><div class="section-title"><h2>簇折扣 Waterfall</h2><span>RAW → DISCOUNTED</span></div>${evidence}<p class="boundary-copy">同一维度只保留一个主导信号，避免重复计数。</p></div><div><div class="section-title"><h2>独立覆盖层</h2><span>NOT ADDED TO 100%</span></div>${set.overlays.map((item) => `<article class="overlay-row"><div><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.trigger)}</small></div><strong>${pct(item.suggestedProbability)}</strong></article>`).join("")}<p class="boundary-copy">覆盖层通过下方联合树进入情景，不与主路径直接相加。</p></div></section>
    <section class="overlay-tree"><div class="section-title"><h2>Overlay 联合树 · 最高分支</h2><span>CONDITIONAL INDEPENDENCE DEMO</span></div><div class="table-scroll"><table><thead><tr><th>主路径</th><th>生产率上行</th><th>秩序冲击</th><th>联合权重</th></tr></thead><tbody>${jointBranches}</tbody></table></div><p class="boundary-copy">这是结构演示，条件独立是假设，不是经校准的联合概率。</p></section>
  </div>`;
}

function formatRange(range) {
  return `${Math.round(Number(range.low) * 100)}% 至 ${Number(range.high) >= 0 ? "+" : ""}${Math.round(Number(range.high) * 100)}%`;
}

function portfolio() {
  const data = model.portfolio;
  if (!data) return loadingView(5, "组合风险");
  const normal = data.riskViews.normal; const stress = data.riskViews.stress;
  const contributions = [...normal.contributions].sort((a, b) => b.absoluteContributionPct - a.absoluteContributionPct);
  const top = contributions[0]; const budget = data.riskBudgets.find((item) => item.factorId === top.factorId);
  const capital = data.capitalWeights.map((item) => exposureRow(item.label, item.weight)).join("");
  const risks = contributions.map((item) => { const policy = data.riskBudgets.find((row) => row.factorId === item.factorId); return exposureRow(factorLabels[item.factorId] || item.factorId, item.absoluteContributionPct, policy.policyMax, policy.status); }).join("") + exposureRow(factorLabels.specific_risk, normal.specificContribution.absoluteContributionPct);
  const stresses = data.scenarioStress.map((item) => `<tr><td>${escapeHtml(item.title)}<small>${item.scenarioType.toUpperCase()} · ${escapeHtml(item.approvalStatus)}</small></td><td>${item.suggestedProbability == null ? "条件事件" : pct(item.suggestedProbability)}</td><td class="negative">${formatRange(item.lossRange)}</td><td>${escapeHtml(factorLabels[item.leadingLossFactor] || item.leadingLossFactor)}</td></tr>`).join("");
  const method = data.riskMethod; const comparison = data.proposal.comparison;
  const estimator = `<section class="risk-audit"><div><p class="eyebrow">ACTIVE ESTIMATOR</p><h2>${escapeHtml(method.activeEstimator)}</h2><p>${escapeHtml(method.fallbackReason)}</p></div><dl><div><dt>请求方法</dt><dd>${escapeHtml(method.requestedEstimator)}</dd></div><div><dt>周频样本</dt><dd>${method.actualWeeks} / ${method.minimumWeeks} 最低</dd></div><div><dt>收缩强度</dt><dd>${pct(method.shrinkageIntensity)}</dd></div><div><dt>候选矩阵 PSD</dt><dd>${method.candidatePsd ? "PASS" : "—"}</dd></div><div><dt>预算资格</dt><dd>${method.eligibleForRiskBudget ? "ELIGIBLE" : "BLOCKED"}</dd></div><div><dt>输入模式</dt><dd>${escapeHtml(method.returnDataMode)}</dd></div></dl></section>`;
  const proposalCompare = `<div class="proposal-compare"><span><small>BEFORE · VOL</small><b>${pct(comparison.before.expectedVolatility)}</b><em>${pct(comparison.before.topFactorContribution)} ${escapeHtml(factorLabels[comparison.before.topFactorId])}</em></span><i>→</i><span><small>ILLUSTRATIVE AFTER · VOL</small><b>${pct(comparison.after.expectedVolatility)}</b><em>${pct(comparison.after.topFactorContribution)} ${escapeHtml(factorLabels[comparison.after.topFactorId])}</em></span><p>仅在因子空间把 ${escapeHtml(factorLabels[comparison.changedFactorId])} beta 缩放至 ${pct(comparison.factorBetaScale)}；不是资产配置或交易建议。</p></div>`;
  return `<div class="view">
    ${pageHead(5, "组合风险", "公开合成参考组合 · 用七个风险因子与压力情景检查集中度，不生成目标权重或订单。", `<div class="release-context">${statusBadge("PUBLIC_SYNTHETIC_REFERENCE")}<strong>${escapeHtml(data.proposal.status.replaceAll("_", " "))}</strong><small>${escapeHtml(data.modelVersion)} · NON-EXECUTABLE</small></div>`)}
    <section class="portfolio-thesis"><div><p class="eyebrow">PRIMARY RISK · NORMAL VIEW</p><h2>${pct(top.absoluteContributionPct)} 的绝对风险贡献来自${escapeHtml(factorLabels[top.factorId])}。</h2><p>政策上限 ${pct(budget.policyMax)}。该组合是公开研究夹具，不代表任何用户真实账户。</p></div><div class="portfolio-metrics"><span><small>正常波动</small><b>${pct(normal.expectedVolatility)}</b></span><span><small>压力波动</small><b>${pct(stress.expectedVolatility)}</b></span><span><small>最差下界</small><b class="negative">${pct(data.constraints.worstTailLoss)}</b></span></div></section>
    <section class="exposure-grid"><div><div class="section-title"><h2>资金权重</h2><span>CAPITAL · 100%</span></div>${capital}</div><div><div class="section-title"><h2>绝对风险贡献</h2><span>FACTORS + SPECIFIC = 100%</span></div>${risks}<p class="boundary-copy">Normal 与 Stress 均使用因子绝对贡献加特异风险的同一分母；净方差贡献同时对账至 100%。</p></div></section>
    ${estimator}
    <section class="stress-panel"><div class="section-title"><h2>情景压力</h2><span>RESEARCH ASSUMPTIONS</span></div><div class="table-scroll"><table><thead><tr><th>情景</th><th>建议概率</th><th>影响区间</th><th>最大损失来源</th></tr></thead><tbody>${stresses}</tbody></table></div></section>
    <section class="proposal"><div><p class="eyebrow">READ-ONLY PROPOSAL</p><b>${escapeHtml(data.proposal.reasons.join("；"))}</b><small>requiresHumanApproval = true · orderPayload = null</small>${proposalCompare}</div><button disabled>不生成交易指令</button></section>
  </div>`;
}

function exposureRow(label, value, marker = null, status = "") {
  return `<div class="exposure-row ${status === "within_band" ? "" : status}"><span>${escapeHtml(label)}</span><div><i style="width:${Math.min(100, value * 100)}%"></i>${marker == null ? "" : `<u style="left:${marker * 100}%"></u>`}</div><b>${pct(value)}</b></div>`;
}

function evidence() {
  const current = state();
  if (!current) return loadingView(6, "证据与数据");
  const indicators = current.dataHealth.indicators;
  const selected = indicators.find((item) => item.indicatorId === selectedIndicatorId) || indicators[0];
  selectedIndicatorId = selected?.indicatorId || null;
  const counts = current.dataHealth.statusCounts;
  const calendar = selectedEntity === "US" ? (model.releaseCalendar?.series || []) : [];
  const selectedRelease = calendar.find((item) => item.indicatorId === selected?.indicatorId);
  const registry = indicators.map((item) => `<button class="indicator-row ${item.indicatorId === selectedIndicatorId ? "selected" : ""}" data-indicator-select="${item.indicatorId}"><i class="quality-dot quality-${item.qualityStatus}"></i><span><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.indicatorId)} · ${escapeHtml(item.dimension)}</small></span><em>${escapeHtml(item.value)} ${escapeHtml(item.unit)}</em><u>${escapeHtml(item.sourceCapability)}</u></button>`).join("");
  const sourceLink = selected?.sourceUrl ? `<a href="${escapeHtml(selected.sourceUrl)}" target="_blank" rel="noreferrer">打开原始来源 ↗</a>` : `<span>无公开来源链接</span>`;
  return `<div class="view">
    ${pageHead(6, "证据与数据", `${entityLabels[selectedEntity]} · 检查数据模式、来源、发布时间、vintage、变换入口与状态贡献。`, releaseContext())}
    <section class="data-mode-strip">${Object.entries(model.publication.dataModeComposition).map(([key, value]) => `<div><span>${escapeHtml(key)}</span><b>${escapeHtml(value)}</b></div>`).join("")}</section>
    <section class="health-strip"><div><span>有效输入</span><b>${current.quality.observationCount}/${current.quality.catalogCount}</b></div>${Object.entries(qualityLabels).map(([key, label]) => `<div><span>${label}</span><b class="quality-${key}">${counts[key] || 0}</b></div>`).join("")}</section>
    <section class="evidence-workspace"><div class="indicator-registry"><div class="section-title"><h2>指标目录</h2><span>${indicators.length} SERIES</span></div>${registry}</div><article class="indicator-detail"><div class="indicator-title"><div><p class="eyebrow">${escapeHtml(selected?.indicatorId)} · ${escapeHtml(selected?.dimension)}</p><h2>${escapeHtml(selected?.label)}</h2></div>${statusBadge(String(selected?.qualityStatus || "missing").toUpperCase())}</div><div class="observation-value"><strong>${escapeHtml(selected?.value)}</strong><span>${escapeHtml(selected?.unit)}</span></div><dl class="detail-grid"><div><dt>观察期</dt><dd>${escapeHtml(selected?.observationPeriod)}</dd></div><div><dt>发布时间</dt><dd>${escapeHtml(selected?.releaseTime)}</dd></div><div><dt>Vintage</dt><dd>${escapeHtml(selected?.vintageId)}</dd></div><div><dt>来源能力</dt><dd>${escapeHtml(selected?.sourceCapability)}</dd></div><div><dt>质量状态</dt><dd>${escapeHtml(selected?.qualityStatus)}</dd></div><div><dt>聚合置信</dt><dd>${pct(selected?.confidence)}</dd></div><div><dt>来源置信</dt><dd>${pct(selected?.sourceConfidence ?? selected?.confidence)}</dd></div><div><dt>发布时间依据</dt><dd>${escapeHtml(selected?.releaseTimeBasis)}</dd></div><div><dt>来源</dt><dd>${escapeHtml(selected?.source)}</dd></div><div><dt>PIT 状态</dt><dd>${escapeHtml(selectedRelease?.pitAvailability || "NOT IN US CANDIDATE REGISTRY")}</dd></div></dl><div class="source-action">${sourceLink}<button data-open-manifest>查看 Run Manifest</button></div><div class="lineage"><p class="eyebrow">PUBLIC LINEAGE</p><div><span>SOURCE<small>${escapeHtml(selected?.source)}</small></span><i>→</i><span>RAW<small>${escapeHtml(selected?.vintageId)}</small></span><i>→</i><span>TRANSFORM<small>CATALOG VERSIONED</small></span><i>→</i><span>STATE<small>${escapeHtml(selected?.dimension)}</small></span></div></div>${selected?.releaseTimeBasis === "retrieval_time_proxy" ? `<p class="warning">发布时间使用抓取时间代理，不能用于精确历史回放。</p>` : ""}${selectedRelease ? `<p class="warning neutral">该序列已进入 US PIT 候选注册表；首次发布/最新修订账本契约已实现，但正式历史数据尚未装载。</p>` : ""}</article></section>
    ${releaseCalendarPanel(calendar)}
    <section class="release-download"><div><p class="eyebrow">REPRODUCIBILITY</p><h2>同一快照由版本、提交与内容哈希固定。</h2><p>${escapeHtml(model.publication.snapshotId)} · ${escapeHtml(model.publication.sourceCommit.slice(0, 12))}</p></div><button data-open-manifest>查看完整发布清单</button></section>
  </div>`;
}

function releaseCalendarPanel(calendar) {
  if (!calendar.length) return `<section class="release-calendar"><p class="empty">当前实体尚无公开 PIT 候选注册表。</p></section>`;
  const rows = calendar.map((item) => `<tr><td><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.seriesId)}</small></td><td>${escapeHtml(item.frequency)}</td><td>${item.expectedCadenceDays} + ${item.graceDays} 天</td><td>${escapeHtml(item.fixtureFreshness?.status || "missing")}</td><td>${escapeHtml(item.pitAvailability)}</td></tr>`).join("");
  return `<section class="release-calendar"><div class="section-title"><h2>US 发布日历与修订视图</h2><span>CANDIDATE REGISTRY · ${escapeHtml(model.releaseCalendar?.timeZone)}</span></div><div class="table-scroll"><table><thead><tr><th>序列</th><th>频率</th><th>预期周期 + 宽限</th><th>Fixture 新鲜度</th><th>PIT 装载</th></tr></thead><tbody>${rows}</tbody></table></div><p class="boundary-copy">新鲜度从来源发布时间计算；当前时间列来自 Demo fixture。正式凭据接入前，不将该注册表标记为 REAL_STATE_PIT。</p></section>`;
}

function loadingView(number, title) {
  return `<div class="view">${pageHead(number, title, "正在读取不可变研究快照。")}</div>`;
}

const views = { latest, world, causal, scenario, portfolio, evidence };

function render() {
  const route = views[currentRoute()] ? currentRoute() : "latest";
  document.querySelectorAll("[data-route]").forEach((link) => link.classList.toggle("active", link.dataset.route === route));
  $("#app").innerHTML = views[route]();
  document.title = `WMOS · ${route}`;
  window.scrollTo({ top: 0, behavior: "instant" });
}

function renderManifest() {
  const item = model.publication;
  if (!item) return;
  $("#drawer-eyebrow").textContent = "RELEASE MANIFEST";
  $("#drawer-title").textContent = "发布清单";
  const modes = Object.entries(item.dataModeComposition).map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
  const versions = Object.entries(item.modelVersions).map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
  const hashes = Object.entries(item.artifactHashes).map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd title="${escapeHtml(value)}">${escapeHtml(value.slice(0, 16))}…</dd></div>`).join("");
  $("#drawer-content").innerHTML = `<section class="drawer-section"><div class="manifest-hero"><span>${escapeHtml(item.siteRelease)}</span><b>${escapeHtml(item.approvalStatus)}</b><small>READ ONLY · ${item.workingTreeDirty ? "LOCAL BUILD" : "COMMITTED BUILD"}</small></div></section><section class="drawer-section"><h3>数据模式</h3><dl class="manifest-list">${modes}</dl></section><section class="drawer-section"><h3>不可变上下文</h3><dl class="manifest-list"><div><dt>Snapshot</dt><dd>${escapeHtml(item.snapshotId)}</dd></div><div><dt>Decision as-of</dt><dd>${escapeHtml(item.decisionAsOf)}</dd></div><div><dt>Data cutoff</dt><dd>${escapeHtml(item.dataCutoff)}</dd></div><div><dt>Source commit</dt><dd>${escapeHtml(item.sourceCommit)}</dd></div></dl></section><section class="drawer-section"><h3>模型版本</h3><dl class="manifest-list">${versions}</dl></section><section class="drawer-section"><h3>产物哈希</h3><dl class="manifest-list hashes">${hashes}</dl></section><section class="drawer-section"><h3>降级与边界</h3><ul>${item.degradationFlags.map((flag) => `<li>${escapeHtml(flag)}</li>`).join("")}</ul><p>公开页面是研究快照，不是交易系统；所有写入和审批均在私有环境中完成。</p></section>`;
}

function openDrawer() {
  renderManifest();
  $("#drawer-backdrop").hidden = false;
  requestAnimationFrame(() => document.body.classList.add("drawer-open"));
  $("#detail-drawer").setAttribute("aria-hidden", "false");
  $("#drawer-close").focus();
}

function closeDrawer() {
  document.body.classList.remove("drawer-open");
  $("#detail-drawer").setAttribute("aria-hidden", "true");
  setTimeout(() => { $("#drawer-backdrop").hidden = true; }, 180);
}

function selectEntity(entity) {
  if (!model.world?.entities?.[entity]) return;
  selectedEntity = entity;
  selectedPathId = null; selectedEdgeId = null; selectedIndicatorId = null;
  $("#entity-select").value = entity;
  render();
}

async function loadData() {
  try {
    const names = ["world-state", "causal-map", "scenario-set", "portfolio-risk", "publication-manifest", "latest-brief", "release-calendar", "history-replay", "factor-risk-method"];
    const responses = await Promise.all(names.map((name) => fetch(`./data/${name}.json`, { cache: "no-store" })));
    if (responses.some((response) => !response.ok)) throw new Error("required public artifacts are unavailable");
    const [worldData, causalData, scenarioData, portfolioData, publicationData, briefData, releaseCalendarData, historyReplayData, factorRiskData] = await Promise.all(responses.map((response) => response.json()));
    Object.assign(model, { world: worldData, causal: causalData, scenario: scenarioData, portfolio: portfolioData, publication: publicationData, brief: briefData, releaseCalendar: releaseCalendarData, historyReplay: historyReplayData, factorRisk: factorRiskData });
    selectedEntity = worldData.primaryEntity || "US";
    $("#entity-select").value = selectedEntity;
    $("#data-mode").textContent = publicationData.dataModeComposition.worldState;
    $("#site-release").textContent = publicationData.siteRelease.toUpperCase();
    $("#as-of-time").textContent = `AS OF ${worldData.asOf.slice(0, 10)}`;
    $("#snapshot-date").textContent = worldData.asOf.slice(0, 10).replaceAll("-", " · ");
    const counts = worldData.quality.statusCounts;
    const degraded = (counts.stale || 0) + (counts.estimated || 0) + (counts.missing || 0) + (counts.bad || 0);
    $("#data-health").textContent = `${worldData.quality.observationCount} 项输入 · ${degraded} 项降级`;
    render();
  } catch (error) {
    $("#data-mode").textContent = "DATA UNAVAILABLE";
    $("#data-mode").classList.add("quality-bad");
    $("#data-health").textContent = "公开产物读取失败";
    $("#app").innerHTML = `<div class="fatal"><p class="eyebrow">PUBLIC SNAPSHOT ERROR</p><h1>无法读取当前发布。</h1><p>${escapeHtml(error.message)}</p></div>`;
  }
}

document.addEventListener("click", (event) => {
  const entity = event.target.closest("[data-entity]"); if (entity) selectEntity(entity.dataset.entity);
  const path = event.target.closest("[data-path]"); if (path) { selectedPathId = path.dataset.path; selectedEdgeId = null; render(); }
  const edge = event.target.closest("[data-edge]"); if (edge) { selectedEdgeId = edge.dataset.edge; render(); }
  const indicator = event.target.closest("[data-indicator]"); if (indicator) { selectedIndicatorId = indicator.dataset.indicator; location.hash = "evidence"; render(); }
  const indicatorSelect = event.target.closest("[data-indicator-select]"); if (indicatorSelect) { selectedIndicatorId = indicatorSelect.dataset.indicatorSelect; render(); }
  const dimension = event.target.closest("[data-dimension]"); if (dimension) { const found = state()?.dataHealth?.indicators?.find((item) => item.dimension.startsWith(dimension.dataset.dimension)); selectedIndicatorId = found?.indicatorId || null; location.hash = "evidence"; render(); }
  const horizon = event.target.closest("[data-horizon]"); if (horizon) { selectedHorizon = horizon.dataset.horizon; render(); }
  const routeLink = event.target.closest("[data-route-link]"); if (routeLink) location.hash = routeLink.dataset.routeLink;
  if (event.target.closest("#release-trigger, #manifest-trigger, [data-open-manifest]")) openDrawer();
  if (event.target.closest("#drawer-close") || event.target.id === "drawer-backdrop") closeDrawer();
});
$("#entity-select").addEventListener("change", (event) => selectEntity(event.target.value));
$("#loop-select").addEventListener("change", render);
$("#vintage-select").addEventListener("change", render);
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && document.body.classList.contains("drawer-open")) closeDrawer(); });
addEventListener("hashchange", render);
render();
loadData();
