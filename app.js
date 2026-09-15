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
const model = { world: null, causal: null, scenario: null, portfolio: null, publication: null, brief: null, releaseCalendar: null, historyReplay: null, factorRisk: null, phase5Status: null, totalReturnLedger: null, calibration: null, temporal: null };
let selectedEntity = "US";
let selectedPathId = null;
let selectedEdgeId = null;
let selectedIndicatorId = null;
let selectedHorizon = "6M";
let selectedRiskView = "normal";
let selectedWorkstreamFilter = "all";
let selectedSnapshotPeriod = null;
let compareSnapshotPeriod = null;
let selectedDataView = "demo-state";
let selectedModelLens = "demo-model";
let selectedLoop = "medium";
let drawerReturnFocus = null;

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
const historyPoints = () => model.historyReplay?.points || [];
const latestHistoryPeriod = () => historyPoints().at(-1)?.period || null;
const activeHistoryPeriod = () => selectedSnapshotPeriod || latestHistoryPeriod();
const activeHistoryPoint = () => historyPoints().find((point) => point.period === activeHistoryPeriod()) || historyPoints().at(-1);
const isHistoricalMode = () => Boolean(activeHistoryPeriod() && activeHistoryPeriod() !== latestHistoryPeriod());
const periodLabel = (period) => period ? period.replace("-", " · ") : "—";
const regimeLabels = {
  goldilocks: "增长改善 · 通胀回落",
  overheating: "增长与价格压力上行",
  stagflation: "增长走弱 · 通胀上行",
  contraction: "增长与价格压力回落",
  transition_zone: "混合过渡区",
  mixed_transition: "混合过渡区",
};

function activeHistoricalEntity() {
  return activeHistoryPoint()?.entities?.[selectedEntity] || null;
}

function displayedDimensions() {
  const current = state()?.dimensions || {};
  const historical = activeHistoricalEntity();
  if (!isHistoricalMode() || !historical) return current;
  return {
    growth: { ...(current.growth || {}), level: historical.growth, momentum: 0, pressure: historical.growth, confidence: 0, coverage: 0, trend: "flat", freshness: "estimated", historicalAvailability: "DEMO" },
    inflation: { ...(current.inflation || {}), level: historical.inflation, momentum: 0, pressure: historical.inflation, confidence: 0, coverage: 0, trend: "flat", freshness: "estimated", historicalAvailability: "DEMO" },
    liquidity: { level: 0, momentum: 0, pressure: 0, confidence: 0, coverage: 0, trend: "flat", freshness: "missing", historicalAvailability: "NOT_AVAILABLE" },
    fragility: { level: 0, momentum: 0, pressure: 0, confidence: 0, coverage: 0, trend: "flat", freshness: "missing", historicalAvailability: "NOT_AVAILABLE" },
    order: { level: 0, momentum: 0, pressure: 0, confidence: 0, coverage: 0, trend: "flat", freshness: "missing", historicalAvailability: "NOT_AVAILABLE" },
  };
}

function pageHead(number, title, description, context = "") {
  return `<header class="page-head"><div><p class="eyebrow">${String(number).padStart(2, "0")} / WORLD MODEL OS</p><h1>${title}</h1><p>${description}</p></div>${context}</header>`;
}

function statusBadge(status) {
  const cls = String(status).toLowerCase().replaceAll("_", "-");
  return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

function stateStrip({ compact = false } = {}) {
  const dimensions = displayedDimensions();
  return `<section class="status-strip ${compact ? "compact" : ""}">${Object.entries(stateMeta).map(([key, meta]) => {
    const value = dimensions[key] || { level: 0, momentum: 0, pressure: 0, confidence: 0, coverage: 0, trend: "flat", freshness: "missing" };
    const confidence = value.confidenceComponents || { dataCoverage: value.coverage, sourceReliability: value.confidence, modelConfidence: value.confidence };
    const position = Math.max(2, Math.min(98, 50 + value.level * 25));
    const unavailable = value.historicalAvailability === "NOT_AVAILABLE";
    return `<button class="state ${unavailable ? "unavailable" : ""}" data-dimension="${key}" aria-label="查看${meta.name}证据" ${unavailable ? "disabled" : ""}>
      <div class="state-top"><span class="state-code">${meta.code} · ${meta.name.toUpperCase()}</span><span class="trend">${arrow(value.trend)} ${Math.abs(value.momentum).toFixed(2)}</span></div>
      <div class="state-value"><b>${unavailable ? "—" : signed(value.level)}</b><span>${unavailable ? "该历史维度尚未重建" : meta.risk(value.level)}</span></div>
      <div class="bar"><i style="left:${position}%"></i></div>
      <div class="state-metrics"><span>PRESS ${signed(value.pressure)}</span><span>COV ${pct(confidence.dataCoverage)}</span><span>SRC ${pct(confidence.sourceReliability)}</span><span>MOD ${pct(confidence.modelConfidence)}</span></div>
      <div class="state-foot"><span>${meta.driver}</span><span class="quality-${value.freshness}">${unavailable ? "NOT AVAILABLE" : `${String(value.freshness).toUpperCase()} · AGG ${pct(value.confidence)}`}</span></div>
    </button>`;
  }).join("")}</section>`;
}

function releaseContext() {
  const publication = model.publication;
  if (!publication) return "";
  return `<div class="release-context"><p class="kicker">${escapeHtml(publication.siteRelease)}</p><strong>${escapeHtml(publication.approvalStatus.replaceAll("_", " "))}</strong><small>${escapeHtml(publication.snapshotId)}</small></div>`;
}

function syncUrlState() {
  const url = new URL(window.location.href);
  const values = {
    entity: selectedEntity,
    snapshot: activeHistoryPeriod(),
    data_view: selectedDataView,
    model_lens: selectedModelLens,
    loop: selectedLoop,
    compare: compareSnapshotPeriod,
  };
  Object.entries(values).forEach(([key, value]) => value ? url.searchParams.set(key, value) : url.searchParams.delete(key));
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function selectHistoryPeriod(period) {
  if (!historyPoints().some((point) => point.period === period)) return;
  selectedSnapshotPeriod = period === latestHistoryPeriod() ? null : period;
  syncContextControls();
  syncUrlState();
  render();
}

function stepHistory(direction) {
  const points = historyPoints();
  const index = Math.max(0, points.findIndex((point) => point.period === activeHistoryPeriod()));
  const next = Math.max(0, Math.min(points.length - 1, index + direction));
  selectHistoryPeriod(points[next].period);
}

function syncContextControls() {
  const snapshot = $("#snapshot-select");
  if (snapshot && historyPoints().length) {
    snapshot.innerHTML = historyPoints().map((point) => `<option value="${escapeHtml(point.period)}">${escapeHtml(point.period === latestHistoryPeriod() ? `${point.period} · CURRENT` : point.period)}</option>`).join("");
    snapshot.value = activeHistoryPeriod();
  }
  if ($("#entity-select")) $("#entity-select").value = selectedEntity;
  if ($("#data-view-select")) $("#data-view-select").value = selectedDataView;
  if ($("#model-lens-select")) $("#model-lens-select").value = selectedModelLens;
  if ($("#loop-select")) $("#loop-select").value = selectedLoop;
  if ($("#mobile-context-date")) $("#mobile-context-date").textContent = activeHistoryPeriod() || "当前";
}

function renderGlobalTimebar() {
  const target = $("#global-timebar");
  if (!target || !historyPoints().length) return;
  const points = historyPoints();
  const index = points.findIndex((point) => point.period === activeHistoryPeriod());
  const historical = isHistoricalMode();
  target.innerHTML = `<div class="timebar-core">
    <button type="button" data-time-action="previous" aria-label="上一个历史时点" ${index <= 0 ? "disabled" : ""}>← <span>上期</span></button>
    <button type="button" class="timebar-date" data-route-link="history"><small>${historical ? "HISTORICAL SNAPSHOT" : "LATEST SNAPSHOT"}</small><b>${escapeHtml(activeHistoryPeriod())}</b></button>
    <button type="button" data-time-action="next" aria-label="下一个历史时点" ${index >= points.length - 1 ? "disabled" : ""}><span>下期</span> →</button>
  </div><div class="timebar-actions">
    <span class="${historical ? "historical" : "current"}">${historical ? "HISTORICAL MODE" : "CURRENT"}</span>
    <button type="button" data-time-action="compare">${compareSnapshotPeriod ? `COMPARE ${escapeHtml(compareSnapshotPeriod)}` : "设置对比"}</button>
    ${historical ? `<button type="button" data-time-action="latest">返回当前</button>` : ""}
  </div>`;
  const banner = $("#historical-banner");
  banner.hidden = !historical;
  if (historical) $("#historical-banner-copy").textContent = `Selected ${activeHistoryPeriod()} · Demo history is not PIT`;
}

function historicalBoundary(message = "当前历史产物仅重建 G/I 的 Demo 状态，不是 point-in-time 数据，也不包含当时模型、情景或组合结果。") {
  return `<section class="history-boundary"><div><p class="eyebrow">HISTORICAL DATA BOUNDARY</p><h2>只显示当时可证明的内容。</h2></div><p>${escapeHtml(message)}</p><a href="#methodology">查看方法与放行门槛 →</a></section>`;
}

function historicalUnavailablePage(number, title, capability) {
  return `<div class="view historical-view">${pageHead(number, title, `${entityLabels[selectedEntity]} · ${activeHistoryPeriod()} 的历史上下文已保留。`, `<div class="release-context"><p class="kicker">HISTORICAL MODE</p><strong>BLOCKED</strong><small>${escapeHtml(capability)} history unavailable</small></div>`)}<section class="blocked-history"><p class="eyebrow">FAIL CLOSED</p><h2>该历史层尚未达到可发布标准。</h2><p>系统不会把当前的${escapeHtml(title)}结果冒充为 ${escapeHtml(activeHistoryPeriod())} 当时可知的结果。完成真实 PIT、Model Release 与对应历史账本后才会开放。</p><div><a href="#history">返回历史轨迹</a><button type="button" data-time-action="latest">查看当前版本</button></div></section>${historicalBoundary()}</div>`;
}

function historicalBrief() {
  const point = activeHistoricalEntity();
  if (!point) return loadingView(1, "历史简报");
  const label = regimeLabels[point.candidateLabel] || point.candidateLabel;
  return `<div class="view latest-view historical-view">
    ${pageHead(1, "历史简报", `${entityLabels[selectedEntity]} · ${activeHistoryPeriod()} 的已保存研究截面。`, `<div class="release-context"><p class="kicker">DEMO HISTORY · NOT PIT</p><strong>${escapeHtml(point.candidateLabel.replaceAll("_", " "))}</strong><small>真实 AS_KNOWN_AT 尚未通过 vintage 回放</small></div>`)}
    <section class="brief-thesis"><div><p class="eyebrow">HISTORICAL READING</p><h2>${escapeHtml(label)}</h2><p>这是历史状态回放，不是对该时点之后结果的预测。</p></div><div class="regime-read"><span>RESEARCH REGIME</span><b>${escapeHtml(point.candidateLabel.replaceAll("_", " "))}</b><small>连续 ${point.candidateRunLength}/${point.minimumDuration} 期 · ${escapeHtml(point.publicationStatus)}</small></div></section>
    ${stateStrip({ compact: true })}
    ${historicalBoundary()}
    <section class="history-callout"><div><p class="eyebrow">CONTINUE IN CONTEXT</p><h2>沿同一时间坐标检查轨迹与差异。</h2></div><a href="#history">打开历史轨迹 →</a><a href="#world">打开世界状态 →</a></section>
  </div>`;
}

function latest() {
  if (isHistoricalMode()) return historicalBrief();
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

function historySvg() {
  const points = historyPoints();
  if (!points.length) return `<p class="empty">等待历史状态产物。</p>`;
  const x = (index) => points.length === 1 ? 500 : 30 + index * (940 / (points.length - 1));
  const y = (value) => 112 - ((Number(value) + 1) / 2) * 94;
  const line = (key) => points.map((row, index) => `${x(index).toFixed(1)},${y(row.entities[selectedEntity][key]).toFixed(1)}`).join(" ");
  const selectedIndex = Math.max(0, points.findIndex((point) => point.period === activeHistoryPeriod()));
  return `<div class="history-chart" role="img" aria-label="${entityLabels[selectedEntity]}增长与通胀历史状态，从 ${points[0].period} 到 ${points.at(-1).period}">
    <svg viewBox="0 0 1000 140" preserveAspectRatio="none" aria-hidden="true">
      <line class="axis-zero" x1="30" y1="65" x2="970" y2="65" />
      <line class="selected-rule" x1="${x(selectedIndex)}" y1="8" x2="${x(selectedIndex)}" y2="124" />
      <polyline class="growth-line" points="${line("growth")}" />
      <polyline class="inflation-line" points="${line("inflation")}" />
      ${points.map((row, index) => `<circle class="growth-dot ${row.period === activeHistoryPeriod() ? "selected" : ""}" cx="${x(index)}" cy="${y(row.entities[selectedEntity].growth)}" r="${row.period === activeHistoryPeriod() ? 5 : 2.5}"/><circle class="inflation-dot ${row.period === activeHistoryPeriod() ? "selected" : ""}" cx="${x(index)}" cy="${y(row.entities[selectedEntity].inflation)}" r="${row.period === activeHistoryPeriod() ? 5 : 2.5}"/>`).join("")}
    </svg>
  </div><div class="legend history-legend"><span><i class="growth-key"></i>增长</span><span><i class="inflation-key"></i>通胀</span><span>数值为模型状态分数，不是经济增长率或通胀率</span></div>`;
}

function historyRegimeRail() {
  return `<div class="regime-rail" role="list" aria-label="历史状态时间轨">${historyPoints().map((row) => {
    const point = row.entities[selectedEntity];
    return `<button type="button" role="listitem" class="regime-tick regime-${escapeHtml(point.candidateLabel)} ${row.period === activeHistoryPeriod() ? "selected" : ""} ${row.period === latestHistoryPeriod() ? "latest" : ""}" data-history-period="${escapeHtml(row.period)}" aria-pressed="${row.period === activeHistoryPeriod()}"><span>${escapeHtml(row.period.slice(5))}</span><b>${escapeHtml(point.candidateLabel.replaceAll("_", " "))}</b></button>`;
  }).join("")}</div>`;
}

function historyDataTable() {
  return `<details class="history-table"><summary>查看可访问数据表</summary><div class="table-scroll"><table><thead><tr><th>时期</th><th>增长状态</th><th>通胀状态</th><th>候选 Regime</th><th>持续期</th><th>发布状态</th></tr></thead><tbody>${historyPoints().map((row) => { const point = row.entities[selectedEntity]; return `<tr class="${row.period === activeHistoryPeriod() ? "selected" : ""}"><td><button type="button" data-history-period="${escapeHtml(row.period)}">${escapeHtml(row.period)}</button></td><td>${signed(point.growth)}</td><td>${signed(point.inflation)}</td><td>${escapeHtml(point.candidateLabel)}</td><td>${point.candidateRunLength}/${point.minimumDuration}</td><td>${escapeHtml(point.publicationStatus)}</td></tr>`; }).join("")}</tbody></table></div></details>`;
}

function historyStateTracks() {
  const point = activeHistoricalEntity();
  const available = [
    ["G", "增长", point?.growth, "DEMO STATE"],
    ["I", "通胀", point?.inflation, "DEMO STATE"],
    ["L", "流动性", null, "NOT RECONSTRUCTED"],
    ["F", "脆弱性", null, "NOT RECONSTRUCTED"],
    ["O", "秩序", null, "NOT RECONSTRUCTED"],
  ];
  return `<div class="history-small-multiples">${available.map(([code, label, value, status]) => `<div class="history-track ${value == null ? "blocked" : ""}"><span>${code} · ${label}</span><div><i style="width:${value == null ? 0 : Math.max(4, Math.min(100, 50 + Number(value) * 50))}%"></i></div><b>${value == null ? "—" : signed(value)}</b><small>${status}</small></div>`).join("")}</div>`;
}

function dalioCycleTracks() {
  const rows = [
    ["生产率", "STRUCTURE · SLOW", "指标合同已定义；真实长历史待接入", "blocked"],
    ["短期债务周期", "CYCLE · MEDIUM", "当前 G/I Demo 可作界面验证，不可作周期结论", "partial"],
    ["长期债务周期", "BALANCE SHEET · SLOW", "债务与利息负担历史尚未重建", "blocked"],
    ["内部秩序", "DOMESTIC ORDER · SLOW", "低频数据与事件证据待双人审核", "blocked"],
    ["外部秩序", "EXTERNAL ORDER · SLOW", "事件轨合同已定义，真实事件尚未发布", "blocked"],
  ];
  return `<div class="cycle-tracks">${rows.map(([label, layer, copy, status]) => `<div><i class="delivery-dot ${status}"></i><span><b>${label}</b><small>${layer}</small></span><p>${copy}</p></div>`).join("")}</div>`;
}

function historyEvents() {
  const points = historyPoints();
  const events = points.flatMap((row, index) => {
    if (!index) return [];
    const current = row.entities[selectedEntity];
    const previous = points[index - 1].entities[selectedEntity];
    if (current.candidateLabel === previous.candidateLabel) return [];
    return [{ period: row.period, from: previous.candidateLabel, to: current.candidateLabel, persistent: current.persistenceMet }];
  });
  if (!events.length) return `<p class="empty">当前范围内没有候选 Regime 切换。</p>`;
  return `<div class="event-rail">${events.map((event) => `<button type="button" data-history-period="${escapeHtml(event.period)}"><time>${escapeHtml(event.period)}</time><span>${escapeHtml(event.from.replaceAll("_", " "))} → ${escapeHtml(event.to.replaceAll("_", " "))}</span><small>${event.persistent ? "PERSISTENCE MET" : "CANDIDATE ONLY"}</small></button>`).join("")}</div>`;
}

function historyCompare() {
  const points = historyPoints();
  const activeIndex = points.findIndex((point) => point.period === activeHistoryPeriod());
  const defaultCompare = points[Math.max(0, activeIndex - 1)]?.period;
  const comparePeriod = compareSnapshotPeriod && compareSnapshotPeriod !== activeHistoryPeriod() ? compareSnapshotPeriod : defaultCompare;
  const a = points.find((point) => point.period === comparePeriod)?.entities?.[selectedEntity];
  const b = activeHistoricalEntity();
  if (!a || !b) return "";
  return `<section class="snapshot-compare"><div class="section-title"><h2>快照 A/B</h2><span>STATE CHANGE · NOT CAUSAL</span></div><div class="compare-controls"><label><span>A · 基准</span><select id="compare-select" aria-label="选择对比历史时点">${points.filter((point) => point.period !== activeHistoryPeriod()).map((point) => `<option value="${escapeHtml(point.period)}" ${point.period === comparePeriod ? "selected" : ""}>${escapeHtml(point.period)}</option>`).join("")}</select></label><div><span>B · 当前选择</span><b>${escapeHtml(activeHistoryPeriod())}</b></div></div><div class="compare-grid"><div><span>增长变化</span><b class="${b.growth - a.growth < 0 ? "negative" : "positive"}">${signed(b.growth - a.growth, 2)}</b><small>${signed(a.growth)} → ${signed(b.growth)}</small></div><div><span>通胀变化</span><b class="${b.inflation - a.inflation > 0 ? "negative" : "positive"}">${signed(b.inflation - a.inflation, 2)}</b><small>${signed(a.inflation)} → ${signed(b.inflation)}</small></div><div><span>状态迁移</span><b>${escapeHtml(a.candidateLabel.replaceAll("_", " "))}</b><small>→ ${escapeHtml(b.candidateLabel.replaceAll("_", " "))}</small></div><div><span>可归因范围</span><b>STATE ONLY</b><small>无 revision/model/override 历史</small></div></div></section>`;
}

function historyView() {
  const point = activeHistoricalEntity();
  if (!point) return loadingView(2, "历史轨迹");
  return `<div class="view history-view">
    ${pageHead(2, "历史轨迹", `${entityLabels[selectedEntity]} · 将当前判断放回可回放轨迹，区分状态变化、数据修订与模型变化。`, `<div class="release-context"><p class="kicker">SELECTED SNAPSHOT</p><strong>${escapeHtml(activeHistoryPeriod())}</strong><small>${escapeHtml(model.historyReplay.dataMode)} · ${escapeHtml(selectedModelLens)}</small></div>`)}
    <section class="history-hero"><div><p class="eyebrow">HISTORICAL OBSERVATORY</p><h2>${escapeHtml(regimeLabels[point.candidateLabel] || point.candidateLabel)}</h2><p>当前选择是历史轨迹中的一个截面。时间选择会在简报与世界状态之间保持连续。</p></div><div class="history-reading"><span>GROWTH</span><b>${signed(point.growth)}</b><span>INFLATION</span><b>${signed(point.inflation)}</b></div></section>
    <section class="history-workspace"><div class="section-title"><h2>状态长卷</h2><span>CLICK A PERIOD · DEMO NOT PIT</span></div>${historySvg()}${historyRegimeRail()}${historyDataTable()}</section>
    <section class="history-state-section"><div class="section-title"><h2>五维状态轨迹</h2><span>AVAILABLE COVERAGE AT SELECTED DATE</span></div>${historyStateTracks()}</section>
    ${historyCompare()}
    <section class="history-lower"><div><div class="section-title"><h2>Dalio 五力轨道</h2><span>READINESS</span></div>${dalioCycleTracks()}</div><div><div class="section-title"><h2>状态切换事件</h2><span>DERIVED FROM DEMO REGIME</span></div>${historyEvents()}</div></section>
    ${historicalBoundary("本页以现有 12 期 Demo 状态验证产品交互。G/I 是模型分数；L/F/O、真实 vintage、Model Release、修订归因、情景结算和组合收益轨迹仍保持 blocked。")}
  </div>`;
}

function historicalWorld() {
  const current = activeHistoricalEntity();
  if (!current) return loadingView(3, "历史世界状态");
  const matrixRows = ["US", "CN", "GLOBAL"].map((entity) => {
    const item = activeHistoryPoint()?.entities?.[entity];
    return `<button class="matrix-row ${selectedEntity === entity ? "selected" : ""}" data-entity="${entity}"><b>${entityLabels[entity]}</b><span>${signed(item?.growth)} →</span><span>${signed(item?.inflation)} →</span><span>—</span><span>—</span><span>—</span></button>`;
  }).join("");
  return `<div class="view historical-view">
    ${pageHead(3, "历史世界状态", `${entityLabels[selectedEntity]} · ${activeHistoryPeriod()} 的 Demo 状态截面。`, `<div class="release-context"><p class="kicker">HISTORICAL MODE · NOT PIT</p><strong>${escapeHtml(current.candidateLabel.replaceAll("_", " "))}</strong><small>仅 G/I 已有历史 Demo</small></div>`)}
    ${stateStrip()}
    <section class="world-grid"><div class="matrix-panel"><div class="section-title"><h2>同一时点的经济体错位</h2><span>G / I AVAILABLE</span></div><div class="matrix-head"><span>实体</span>${Object.values(stateMeta).map((meta) => `<span>${meta.code}</span>`).join("")}</div>${matrixRows}</div><div class="drivers-panel"><div class="section-title"><h2>变化归因</h2><span>BLOCKED</span></div><div class="blocked-panel"><b>尚不能区分现实、修订与模型变化</b><p>当前 Demo 没有 Observation Revision、Model Release 与人工覆盖历史，因此不生成伪归因。</p></div></div></section>
    <section class="timeline-panel"><div class="section-title"><h2>状态轨迹</h2><span>SELECTED ${escapeHtml(activeHistoryPeriod())}</span></div>${historySvg()}</section>
    ${historicalBoundary()}
  </div>`;
}

function world() {
  if (isHistoricalMode()) return historicalWorld();
  const current = state();
  if (!current) return loadingView(3, "世界状态");
  const regime = current.regime;
  const transition = regime.transition;
  const matrixRows = ["US", "CN", "GLOBAL"].map((entity) => `<button class="matrix-row ${selectedEntity === entity ? "selected" : ""}" data-entity="${entity}"><b>${entityLabels[entity]}</b>${Object.keys(stateMeta).map((key) => { const d = model.world.entities[entity].dimensions[key]; return `<span>${signed(d.level)} ${arrow(d.trend)}</span>`; }).join("")}</button>`).join("");
  const drivers = current.drivers.slice(0, 5).map((driver, index) => `<button class="driver" data-indicator="${driver.indicatorId}"><span>${String(index + 1).padStart(2, "0")}</span><p><b>${escapeHtml(driver.label)}</b><small>${escapeHtml(driver.explanation)} · ${driver.sourceCapability}</small></p><em class="${driver.impact < 0 ? "negative" : "positive"}">${signed(driver.impact, 3)}</em></button>`).join("");
  return `<div class="view">
    ${pageHead(3, "世界状态", `${entityLabels[selectedEntity]} · Level、Momentum、Pressure 与可信度；颜色不替代方向语义。`, `<div class="release-context"><p class="kicker">STATISTICAL STATE</p><strong>${escapeHtml(regime.label.replaceAll("_", " "))}</strong><small>未经样本外校准，分布仅称 score share</small></div>`)}
    ${stateStrip()}
    <section class="regime-guardrail"><div><p class="eyebrow">REGIME GUARDRAIL</p><h2>${escapeHtml(transition.candidateLabel.replaceAll("_", " "))}</h2><small>候选连续 ${transition.candidateRunLength}/${transition.minimumDuration} 期 · band ±${transition.hysteresisBand}</small></div><div><span>持续期</span><b>${transition.persistenceMet ? "满足" : "未满足"}</b></div><div><span>发布状态</span><b>${escapeHtml(transition.publicationStatus)}</b></div><div><span>校准状态</span><b>${escapeHtml(transition.calibrationStatus)}</b></div><p>${transition.reasonCodes.map((item) => escapeHtml(item.replaceAll("_", " "))).join(" · ")}。该层只抑制假切换，未完成样本外校准。</p></section>
    ${calibrationGate()}
    <section class="world-grid">
      <div class="matrix-panel"><div class="section-title"><h2>经济体错位</h2><span>CLICK TO FOCUS</span></div><div class="matrix-head"><span>实体</span>${Object.values(stateMeta).map((meta) => `<span>${meta.code}</span>`).join("")}</div>${matrixRows}</div>
      <div class="drivers-panel"><div class="section-title"><h2>状态变化贡献</h2><span>PROXY · NOT CAUSAL</span></div>${drivers}</div>
    </section>
    <section class="expectation-gap"><div><p class="eyebrow">REALITY MAP</p><h3>真实状态</h3><strong>${stateMeta.growth.risk(current.dimensions.growth.level)} · ${stateMeta.inflation.risk(current.dimensions.inflation.level)}</strong><small>来自当前 Demo 指标聚合</small></div><i>≠</i><div><p class="eyebrow">EXPECTATION MAP</p><h3>市场隐含预期</h3><strong>尚未接入正式价格隐含序列</strong><small>Phase 5.1 接入后才能计算 Surprise Gap</small></div></section>
    <section class="timeline-panel"><div class="section-title"><h2>状态轨迹</h2><span>G / I · DEMO HISTORY</span></div>${historyChart()}</section>
  </div>`;
}

function calibrationGate() {
  const item = model.calibration;
  if (!item) return "";
  const threshold = item.thresholds;
  const folds = Math.max(...Object.values(item.walkForward.modes).map((mode) => mode.foldCount));
  const rows = [
    ["PIT 历史", `${item.currentHistory.eligiblePointInTimeObservations}/${item.walkForward.configuration.minimumTrainingPeriods}`, item.gateChecks.minimumHistory && item.gateChecks.allPointInTime],
    ["OOS 折数", `${folds}/${threshold.minimumFolds}`, item.gateChecks.minimumFolds],
    ["Brier Skill", item.metrics.brierSkill == null ? `— / ≥${pct(threshold.minimumBrierSkill)}` : pct(item.metrics.brierSkill), item.gateChecks.brierSkill],
    ["最大校准差", item.metrics.maximumCalibrationError == null ? `— / ≤${pct(threshold.maximumCalibrationError)}` : pct(item.metrics.maximumCalibrationError), item.gateChecks.maximumCalibrationError],
    ["独立评审", item.gateChecks.reviewApproval ? "APPROVED" : "PENDING", item.gateChecks.reviewApproval],
  ];
  return `<section class="calibration-gate"><div class="calibration-copy"><p class="eyebrow">PROBABILITY NAMING GATE</p><h2>${item.probabilityNamingAllowed ? "已允许显示校准概率" : "仍是 Score Share，不是概率"}</h2><p>扩展窗与滚动窗方案已冻结；真实 PIT、时间隔离、样本量、校准表现和人工评审必须同时通过。</p></div><div class="calibration-checks">${rows.map(([label, value, pass]) => `<div><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b><i class="${pass ? "pass" : "blocked"}">${pass ? "PASS" : "BLOCKED"}</i></div>`).join("")}</div><footer><span>${escapeHtml(item.planId)} · v${escapeHtml(item.planVersion)}</span><b>${escapeHtml(item.status)}</b></footer></section>`;
}

function historyChart() {
  const points = model.world?.history?.points || [];
  if (!points.length) return `<p class="empty">等待可比快照。</p>`;
  const path = (key) => points.map((row, index) => { const x = points.length === 1 ? 500 : index * (1000 / (points.length - 1)); const y = 65 - (row[selectedEntity]?.[key] || 0) * 38; return `${x.toFixed(1)},${Math.max(6, Math.min(124, y)).toFixed(1)}`; }).join(" ");
  return `<div class="chart-wrap"><svg viewBox="0 0 1000 130" preserveAspectRatio="none" aria-label="增长和通胀状态历史"><line x1="0" y1="65" x2="1000" y2="65"/><polyline class="growth-line" points="${path("growth")}"/><polyline class="inflation-line" points="${path("inflation")}"/></svg></div><div class="legend"><span><i class="growth-key"></i>增长</span><span><i class="inflation-key"></i>通胀</span><span>${escapeHtml(points[0].period)} — ${escapeHtml(points.at(-1).period)}</span></div>`;
}

function causal() {
  if (isHistoricalMode()) return historicalUnavailablePage(4, "因果机制", "mechanism");
  const current = graph();
  if (!current) return loadingView(4, "因果地图");
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
    ${pageHead(4, "因果地图", `${entityLabels[selectedEntity]} · 只绘制契约中真实存在的边；所有机制仍是研究候选。`, `<div class="release-context">${statusBadge("RESEARCH_CANDIDATE")}<strong>${escapeHtml(path.label)}</strong><small>Evidence ${path.evidenceGrade} · 活动度 ${Math.round(path.activityScore * 100)}</small></div>`)}
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
  if (isHistoricalMode()) return historicalUnavailablePage(5, "情景路径", "scenario ledger");
  const set = scenarioSet();
  if (!set) return loadingView(5, "情景推演");
  const forecast = set.forecasts?.find((item) => item.horizon === selectedHorizon) || set.forecasts?.[0];
  const scenarios = forecast?.scenarios || set.scenarios;
  const rows = scenarios.map((item) => `<article class="scenario-row"><div><p class="eyebrow">${item.slot} · ${escapeHtml(item.approvalStatus)}</p><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.definition)}</p></div><div class="probability-steps"><span><small>PRIOR</small><b>${pct(item.priorProbability)}</b></span><i>→</i><span><small>SUGGESTED</small><b>${pct(item.suggestedProbability)}</b></span><i>→</i><span class="pending"><small>APPROVED</small><b>—</b></span></div><dl><dt>进入条件</dt><dd>${escapeHtml(item.trigger)}</dd><dt>失效条件</dt><dd>${escapeHtml(item.invalidation)}</dd><dt>影响区间</dt><dd class="${item.impactRange.low < 0 ? "negative" : "positive"}">${formatRange(item.impactRange)} · 假设</dd></dl></article>`).join("");
  const evidence = (forecast?.waterfall || set.waterfall || []).slice(0, 8).map((item) => `<div class="waterfall-row"><span>${escapeHtml(item.cluster)}</span><div><i style="width:${Math.min(100, Math.abs(item.rawImpact) * 120)}%"></i></div><b>${signed(item.rawImpact, 3)} → ${signed(item.discountedImpact, 3)}</b><small>${escapeHtml(item.scenarioId)}</small></div>`).join("");
  const horizonTabs = (set.forecasts || []).map((item) => `<button data-horizon="${item.horizon}" class="${item.horizon === forecast?.horizon ? "active" : ""}"><b>${item.horizon}</b><small>结算 ${escapeHtml(item.settlesAt.slice(0, 10))}</small></button>`).join("");
  const jointBranches = [...(set.overlayTree || [])].sort((a, b) => b.jointProbability - a.jointProbability).slice(0, 6).map((item) => `<tr><td>${escapeHtml(item.baseScenarioId)}</td><td>${item.productivityUpside ? "ON" : "OFF"}</td><td>${item.orderShock ? "ON" : "OFF"}</td><td>${pct(item.jointProbability)}</td></tr>`).join("");
  return `<div class="view">
    ${pageHead(5, "情景推演", `${entityLabels[selectedEntity]} · 3M/6M/12M 预测账本；展示先验、机器建议与人工批准的严格边界。`, `<div class="release-context"><p class="kicker">HORIZON · ${escapeHtml(forecast?.horizon)}</p><strong>PENDING HUMAN REVIEW</strong><small>结算 ${escapeHtml(forecast?.settlesAt.slice(0, 10))}</small></div>`)}
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
  if (isHistoricalMode()) return historicalUnavailablePage(6, "组合风险", "portfolio total return");
  const data = model.portfolio;
  if (!data) return loadingView(6, "组合风险");
  const normal = data.riskViews.normal; const stress = data.riskViews.stress;
  const activeRisk = data.riskViews[selectedRiskView];
  const contributions = [...activeRisk.contributions].sort((a, b) => b.absoluteContributionPct - a.absoluteContributionPct);
  const top = contributions[0]; const budget = data.riskBudgets.find((item) => item.factorId === top.factorId);
  const capital = data.capitalWeights.map((item) => exposureRow(item.label, item.weight)).join("");
  const risks = contributions.map((item) => { const policy = data.riskBudgets.find((row) => row.factorId === item.factorId); const status = selectedRiskView === "stress" ? policy.stressStatus : policy.normalStatus; return exposureRow(factorLabels[item.factorId] || item.factorId, item.absoluteContributionPct, policy.policyMax, status); }).join("") + exposureRow(factorLabels.specific_risk, activeRisk.specificContribution.absoluteContributionPct);
  const stresses = data.scenarioStress.map((item) => `<tr><td>${escapeHtml(item.title)}<small>${item.scenarioType.toUpperCase()} · ${escapeHtml(item.approvalStatus)}</small></td><td>${item.suggestedProbability == null ? "条件事件" : pct(item.suggestedProbability)}</td><td class="negative">${formatRange(item.lossRange)}</td><td>${escapeHtml(factorLabels[item.leadingLossFactor] || item.leadingLossFactor)}</td></tr>`).join("");
  const method = data.riskMethod; const comparison = data.proposal.comparison;
  const estimator = `<section class="risk-audit"><div><p class="eyebrow">ACTIVE ESTIMATOR</p><h2>${escapeHtml(method.activeEstimator)}</h2><p>${escapeHtml(method.fallbackReason)}</p></div><dl><div><dt>请求方法</dt><dd>${escapeHtml(method.requestedEstimator)}</dd></div><div><dt>周频样本</dt><dd>${method.actualWeeks} / ${method.minimumWeeks} 最低</dd></div><div><dt>收缩强度</dt><dd>${pct(method.shrinkageIntensity)}</dd></div><div><dt>候选矩阵 PSD</dt><dd>${method.candidatePsd ? "PASS" : "—"}</dd></div><div><dt>Normal 矩阵</dt><dd>${escapeHtml(data.matrixGovernance.normal.status)}</dd></div><div><dt>Stress 矩阵</dt><dd>${escapeHtml(data.matrixGovernance.stress.status)}</dd></div></dl></section>`;
  const exposureRows = data.exposureEngine.assets.map((item) => { const estimate = item.exploratoryEstimate; const publishMetric = estimate && item.actualWeeks >= item.minimumWeeks; return `<tr><td><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.activeMappingMethod)}</small></td><td>${item.actualWeeks} / ${item.minimumWeeks}</td><td>${publishMetric ? pct(estimate.rSquared) : estimate ? "PIPELINE ONLY" : "—"}</td><td>${publishMetric ? pct(estimate.residualVolatility) : estimate ? "PIPELINE ONLY" : "—"}</td><td>${escapeHtml(item.stabilityStatus)}</td><td>${escapeHtml(item.status)}</td></tr>`; }).join("");
  const exposureDiagnostics = `<section class="exposure-diagnostics"><div class="section-title"><h2>资产暴露诊断</h2><span>${escapeHtml(data.exposureEngine.gateStatus)} · 104 / 156 / 260W</span></div><div class="table-scroll"><table><thead><tr><th>参考资产</th><th>样本</th><th>探索 R²</th><th>残差波动</th><th>窗口稳定性</th><th>映射状态</th></tr></thead><tbody>${exposureRows}</tbody></table></div><p class="boundary-copy">16 周结果仅用于验证回归管线；达到正式周频数据门槛并完成人工复核前，不覆盖结构先验。</p></section>`;
  const ledger = model.totalReturnLedger;
  const ledgerRows = (ledger?.assets || []).map((item) => `<tr><td><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.assetId)}</small></td><td>${escapeHtml(item.returnBasis)}</td><td>${escapeHtml(item.sourceCurrency)} → ${escapeHtml(ledger.baseCurrency)}</td><td>${escapeHtml(item.calendar)}</td><td>${item.minimumWeeks}W</td><td class="negative">BLOCKED</td></tr>`).join("");
  const returnDataGate = `<section class="return-ledger-panel"><div class="section-title"><h2>总收益数据门</h2><span>${escapeHtml(ledger?.readiness?.gateStatus || "UNAVAILABLE")}</span></div><div class="return-ledger-summary"><div><span>数据口径</span><b>总收益 × 汇率</b></div><div><span>周频切点</span><b>${escapeHtml(ledger?.weeklyCut || "—")}</b></div><div><span>修订策略</span><b>APPEND-ONLY PIT</b></div><div><span>正式放行</span><b>${ledger?.readiness?.verifiedAssets || 0}/${ledger?.readiness?.totalAssets || 0}</b></div></div><div class="table-scroll"><table><thead><tr><th>参考资产</th><th>收益口径</th><th>币种转换</th><th>交易日历</th><th>最低历史</th><th>状态</th></tr></thead><tbody>${ledgerRows}</tbody></table></div><p class="boundary-copy">当前只公开来源与方法元数据，不公开收益值。供应商、许可、原始文件哈希和 260 周历史全部通过后，才允许进入正式风险估计。</p></section>`;
  const proposalCompare = `<div class="proposal-compare"><span><small>BEFORE · VOL</small><b>${pct(comparison.before.expectedVolatility)}</b><em>${pct(comparison.before.topFactorContribution)} ${escapeHtml(factorLabels[comparison.before.topFactorId])}</em></span><i>→</i><span><small>ILLUSTRATIVE AFTER · VOL</small><b>${pct(comparison.after.expectedVolatility)}</b><em>${pct(comparison.after.topFactorContribution)} ${escapeHtml(factorLabels[comparison.after.topFactorId])}</em></span><p>仅在因子空间把 ${escapeHtml(factorLabels[comparison.changedFactorId])} beta 缩放至 ${pct(comparison.factorBetaScale)}；不是资产配置或交易建议。</p></div>`;
  return `<div class="view">
    ${pageHead(6, "组合风险", "公开合成参考组合 · 用七个风险因子与压力情景检查集中度，不生成目标权重或订单。", `<div class="release-context">${statusBadge("PUBLIC_SYNTHETIC_REFERENCE")}<strong>${escapeHtml(data.proposal.status.replaceAll("_", " "))}</strong><small>${escapeHtml(data.modelVersion)} · NON-EXECUTABLE</small></div>`)}
    <section class="portfolio-thesis"><div><p class="eyebrow">PRIMARY RISK · ${selectedRiskView.toUpperCase()} VIEW</p><h2>${pct(top.absoluteContributionPct)} 的绝对风险贡献来自${escapeHtml(factorLabels[top.factorId])}。</h2><p>政策上限 ${pct(budget.policyMax)}。该组合是公开研究夹具，不代表任何用户真实账户。</p><div class="risk-view-tabs"><button data-risk-view="normal" class="${selectedRiskView === "normal" ? "active" : ""}">NORMAL</button><button data-risk-view="stress" class="${selectedRiskView === "stress" ? "active" : ""}">STRESS</button></div></div><div class="portfolio-metrics"><span><small>正常波动</small><b>${pct(normal.expectedVolatility)}</b></span><span><small>压力波动</small><b>${pct(stress.expectedVolatility)}</b></span><span><small>最差下界</small><b class="negative">${pct(data.constraints.worstTailLoss)}</b></span></div></section>
    <section class="exposure-grid"><div><div class="section-title"><h2>资金权重</h2><span>CAPITAL · 100%</span></div>${capital}</div><div><div class="section-title"><h2>绝对风险贡献</h2><span>FACTORS + SPECIFIC = 100%</span></div>${risks}<p class="boundary-copy">Normal 与 Stress 均使用因子绝对贡献加特异风险的同一分母；净方差贡献同时对账至 100%。</p></div></section>
    ${estimator}
    ${returnDataGate}
    ${exposureDiagnostics}
    <section class="stress-panel"><div class="section-title"><h2>情景压力</h2><span>RESEARCH ASSUMPTIONS</span></div><div class="table-scroll"><table><thead><tr><th>情景</th><th>建议概率</th><th>影响区间</th><th>最大损失来源</th></tr></thead><tbody>${stresses}</tbody></table></div></section>
    <section class="proposal"><div><p class="eyebrow">READ-ONLY PROPOSAL</p><b>${escapeHtml(data.proposal.reasons.join("；"))}</b><small>requiresHumanApproval = true · orderPayload = null</small>${proposalCompare}</div><button disabled>不生成交易指令</button></section>
  </div>`;
}

function exposureRow(label, value, marker = null, status = "") {
  return `<div class="exposure-row ${status === "within_band" ? "" : status}"><span>${escapeHtml(label)}</span><div><i style="width:${Math.min(100, value * 100)}%"></i>${marker == null ? "" : `<u style="left:${marker * 100}%"></u>`}</div><b>${pct(value)}</b></div>`;
}

function evidence() {
  if (isHistoricalMode()) return historicalUnavailablePage(7, "证据与数据", "observation revision");
  const current = state();
  if (!current) return loadingView(7, "证据与数据");
  const indicators = current.dataHealth.indicators;
  const selected = indicators.find((item) => item.indicatorId === selectedIndicatorId) || indicators[0];
  selectedIndicatorId = selected?.indicatorId || null;
  const counts = current.dataHealth.statusCounts;
  const calendar = selectedEntity === "US" ? (model.releaseCalendar?.series || []) : [];
  const selectedRelease = calendar.find((item) => item.indicatorId === selected?.indicatorId);
  const registry = indicators.map((item) => `<button class="indicator-row ${item.indicatorId === selectedIndicatorId ? "selected" : ""}" data-indicator-select="${item.indicatorId}"><i class="quality-dot quality-${item.qualityStatus}"></i><span><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.indicatorId)} · ${escapeHtml(item.dimension)}</small></span><em>${escapeHtml(item.value)} ${escapeHtml(item.unit)}</em><u>${escapeHtml(item.sourceCapability)}</u></button>`).join("");
  const sourceLink = selected?.sourceUrl ? `<a href="${escapeHtml(selected.sourceUrl)}" target="_blank" rel="noreferrer">打开原始来源 ↗</a>` : `<span>无公开来源链接</span>`;
  return `<div class="view">
    ${pageHead(7, "证据与数据", `${entityLabels[selectedEntity]} · 检查数据模式、来源、发布时间、vintage、变换入口与状态贡献。`, releaseContext())}
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

function temporalGovernancePanel() {
  const temporal = model.temporal;
  if (!temporal) return "";
  const viewLabels = {
    AS_KNOWN_AT: "当时可知",
    SOURCE_FIRST_RELEASE: "来源首次发布",
    WMOS_FIRST_CAPTURE: "WMOS 首次归档",
    LATEST_REVISED: "最新修订 · 仅回顾",
  };
  const views = temporal.dataViews.map((item) => `<article class="governance-card"><div><span>${escapeHtml(item.id)}</span>${statusBadge(item.liveInferenceAllowed ? "LIVE SAFE" : "RETROSPECTIVE ONLY")}</div><h3>${escapeHtml(viewLabels[item.id] || item.id)}</h3><p>${escapeHtml(item.meaning)}</p><small>${escapeHtml(item.availability)}</small></article>`).join("");
  const timeRows = temporal.entityTimeContracts.entities.map((item) => `<tr><td><b>${escapeHtml(item.entityId)}</b></td><td>${escapeHtml(item.decisionCutoffLocal)} · ${escapeHtml(item.timeZone)}</td><td>${escapeHtml(item.calendarId)}</td><td>${escapeHtml(item.pitApproval)}</td></tr>`).join("");
  const releases = temporal.modelRegistry.releases.map((item) => `<div class="model-release-row"><div><span>${escapeHtml(item.modelVersion)}</span><b>${escapeHtml(item.dataEligibility)}</b></div><p>发布 ${escapeHtml(item.publishedAt)} · 生效 ${escapeHtml(item.effectiveFrom)}</p><small>${escapeHtml(item.sourceCommit.slice(0, 12))} · ${escapeHtml(item.artifactHash.slice(0, 16))}…</small></div>`).join("");
  const license = temporal.publicLicensePolicies;
  return `<section class="temporal-governance"><div class="section-title"><h2>时间与发布治理</h2><span>${escapeHtml(temporal.dataMode)}</span></div>
    <div class="governance-gate"><div><p class="eyebrow">HISTORICAL RELEASE GATE</p><h3>合同已冻结，真实 PIT 尚未放行。</h3><p>历史默认采用 ${escapeHtml(temporal.defaultDataView)} + ${escapeHtml(temporal.defaultModelLens)}。目标日没有合格模型时返回 MODEL_NOT_AVAILABLE，不用当前模型补算。</p></div><div><span>静默回退</span><b>${temporal.releaseGate.silentFallbackAllowed ? "允许" : "禁止"}</b><span>Verified PIT 实体</span><b>${temporal.releaseGate.verifiedPitEntities.length}</b><span>公开默认</span><b>${escapeHtml(temporal.releaseGate.defaultPublicDecision).toUpperCase()}</b></div></div>
    <div class="governance-grid">${views}</div>
    <div class="governance-lower"><div><div class="section-title"><h3>实体状态日</h3><span>LOCAL CUTOFF · UTC STORAGE</span></div><div class="table-scroll"><table><thead><tr><th>实体</th><th>状态截点</th><th>日历</th><th>PIT 放行</th></tr></thead><tbody>${timeRows}</tbody></table></div></div><div><div class="section-title"><h3>Model Release</h3><span>${escapeHtml(temporal.modelRegistry.registryStatus)}</span></div>${releases}<p class="boundary-copy">历史模型覆盖始于 ${escapeHtml(temporal.releaseGate.historicalModelCoverageStart)}；此前一律显示 MODEL_NOT_AVAILABLE。</p></div></div>
    <div class="license-gate"><div><p class="eyebrow">PUBLIC LICENSE SANITIZER</p><h3>${escapeHtml(license.registryStatus)}</h3></div><p>逐序列策略要求产物类型、最小聚合、精度、发布滞后与归因全部批准。当前默认 <b>${escapeHtml(license.defaultDecision).toUpperCase()}</b>，不会仅凭“可派生”字段放行高精度历史。</p></div>
  </section>`;
}

function methodology() {
  const data = model.phase5Status;
  if (!data) return loadingView(8, "方法与版本");
  const summary = data.summary;
  const semantics = Object.entries(data.statusSemantics).map(([status, label]) => `<div><i class="delivery-dot ${status}"></i><span>${escapeHtml(status)}</span><small>${escapeHtml(label)}</small></div>`).join("");
  const filters = ["all", "complete", "partial", "blocked", "deferred"].map((status) => {
    const count = status === "all" ? summary.total : summary[status];
    return `<button data-workstream-filter="${status}" class="${selectedWorkstreamFilter === status ? "active" : ""}">${status.toUpperCase()} <span>${count}</span></button>`;
  }).join("");
  const visible = data.workstreams.filter((item) => selectedWorkstreamFilter === "all" || item.status === selectedWorkstreamFilter);
  const workstreams = visible.map((item) => `<article class="delivery-row">
    <div class="delivery-identity"><span>${escapeHtml(item.priority)} · ${escapeHtml(item.id)}</span><h2>${escapeHtml(item.title)}</h2><small>${item.ownerFunctions.map(escapeHtml).join(" · ")}</small></div>
    <div class="delivery-progress"><div><i style="width:${item.completionPct}%"></i></div><b>${item.completionPct}%</b><span class="delivery-status ${item.status}">${escapeHtml(item.status)}</span></div>
    <div class="delivery-action"><span>NEXT ACTION</span><b>${escapeHtml(item.nextAction)}</b>${item.blocker ? `<small>BLOCKER · ${escapeHtml(item.blocker)}</small>` : `<small>EXIT · ${escapeHtml(item.exitCriteria)}</small>`}</div>
  </article>`).join("");
  const releases = [...data.releaseHistory].reverse().map((item) => `<div class="release-row ${item.status}"><span>${escapeHtml(item.release)}</span><b>${escapeHtml(item.focus)}</b><small>${escapeHtml(item.status)}</small></div>`).join("");
  const queue = data.decisionQueue.map((item) => `<div class="decision-row"><span>${String(item.rank).padStart(2, "0")}</span><b>${escapeHtml(item.decision)}</b><small>${item.requiresExternalInput ? "EXTERNAL INPUT" : "INTERNAL EXECUTION"}</small></div>`).join("");
  return `<div class="view methodology-view">
    ${pageHead(8, "方法与版本", "PRD 执行账本 · 区分已交付、基础设施完成但未校准、外部阻塞与明确延期。", `<div class="release-context"><p class="kicker">CURRENT RELEASE</p><strong>${escapeHtml(data.siteRelease)}</strong><small>Schema validation · immutable manifest · rollback ready</small></div>`)}
    <section class="method-thesis"><div><p class="eyebrow">METHOD STACK</p><h2>世界状态决定风险地图，价值框架定义长期目标，证据纪律决定什么有资格进入模型。</h2></div><dl><div><dt>PRIMARY</dt><dd>${escapeHtml(data.methodology.primary)}</dd></div><div><dt>VALUE ANCHOR</dt><dd>${escapeHtml(data.methodology.valueAnchor)}</dd></div><div><dt>EVIDENCE</dt><dd>${escapeHtml(data.methodology.evidenceDiscipline)}</dd></div></dl></section>
    <section class="delivery-summary"><div><span>当前范围完成度</span><b>${summary.inScopeCompletionPct}%</b><small>全路线图 ${summary.weightedCompletionPct}%</small></div><div><span>已完成</span><b class="positive">${summary.complete}</b></div><div><span>部分完成</span><b>${summary.partial}</b></div><div><span>外部阻塞</span><b class="negative">${summary.blocked}</b></div><div><span>明确延期</span><b>${summary.deferred}</b></div></section>
    <section class="status-semantics">${semantics}</section>
    ${temporalGovernancePanel()}
    <section class="delivery-board"><div class="section-title"><h2>Phase 5 执行账本</h2><span>PRD STATUS · FILTERABLE</span></div><div class="delivery-filters">${filters}</div><div class="delivery-list">${workstreams || `<p class="empty">此筛选条件下没有工作流。</p>`}</div></section>
    <section class="method-grid"><div><div class="section-title"><h2>版本链</h2><span>NEWEST FIRST</span></div>${releases}</div><div><div class="section-title"><h2>下一执行队列</h2><span>GATES BEFORE FEATURES</span></div>${queue}<p class="boundary-copy">外部数据未满足许可、PIT 和样本门槛前，系统继续显示 Fixture / Candidate，不升级为 Verified。</p></div></section>
    <section class="release-download"><div><p class="eyebrow">RELEASE GOVERNANCE</p><h2>每次发布同时固定版本、提交、产物哈希、数据模式和降级原因。</h2><p>${escapeHtml(model.publication.sourceCommit.slice(0, 12))} · ${Object.keys(model.publication.artifactHashes).length} HASHED ARTIFACTS · READ ONLY</p></div><button data-open-manifest>检查当前发布清单</button></section>
  </div>`;
}

function loadingView(number, title) {
  return `<div class="view">${pageHead(number, title, "正在读取不可变研究快照。")}</div>`;
}

const views = { latest, history: historyView, world, causal, scenario, portfolio, evidence, methodology };
let lastRenderedRoute = null;

function render() {
  const route = views[currentRoute()] ? currentRoute() : "latest";
  document.querySelectorAll("[data-route]").forEach((link) => link.classList.toggle("active", link.dataset.route === route));
  const more = $("#mobile-more");
  if (more) more.classList.toggle("active", ["causal", "portfolio", "evidence", "methodology"].includes(route));
  $("#app").innerHTML = views[route]();
  syncContextControls();
  renderGlobalTimebar();
  document.title = `WMOS · ${route}`;
  if (lastRenderedRoute !== route) window.scrollTo({ top: 0, behavior: "instant" });
  lastRenderedRoute = route;
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

function renderContextDrawer() {
  $("#drawer-eyebrow").textContent = isHistoricalMode() ? "HISTORICAL CONTEXT" : "RESEARCH CONTEXT";
  $("#drawer-title").textContent = "观察上下文";
  const option = (value, label, selected, disabled = false) => `<option value="${value}" ${selected ? "selected" : ""} ${disabled ? "disabled" : ""}>${label}</option>`;
  $("#drawer-content").innerHTML = `<section class="drawer-section context-sheet"><p>这些选择会跨页面保持一致。不可用视图会说明原因，不会回退到其他数据。</p>
    <label><span>实体</span><select data-context-select="entity">${Object.entries(entityLabels).map(([value, label]) => option(value, label, value === selectedEntity)).join("")}</select></label>
    <label><span>状态日期</span><select data-context-select="snapshot">${historyPoints().map((point) => option(point.period, point.period === latestHistoryPeriod() ? `${point.period} · CURRENT` : point.period, point.period === activeHistoryPeriod())).join("")}</select></label>
    <label><span>数据视图</span><select data-context-select="data-view">${option("demo-state", "DEMO STATE", true)}${option("as-known-at", "AS KNOWN AT · 合同就绪", false, true)}${option("source-first-release", "SOURCE FIRST · 合同就绪", false, true)}${option("wmos-first-capture", "WMOS FIRST · 前向采集", false, true)}${option("latest-revised", "LATEST REVISED · 仅回顾", false, true)}</select></label>
    <label><span>模型视图</span><select data-context-select="model-lens">${option("demo-model", "DEMO MODEL", true)}${option("as-published", "AS PUBLISHED · 版本就绪", false, true)}${option("recomputed-current", "RECOMPUTED · 数据待接入", false, true)}</select></label>
    <label><span>更新循环</span><select data-context-select="loop">${["fast", "medium", "slow"].map((value) => option(value, value.toUpperCase(), value === selectedLoop)).join("")}</select></label>
  </section><section class="drawer-section"><h3>当前边界</h3><dl class="manifest-list"><div><dt>Data mode</dt><dd>${escapeHtml(model.historyReplay?.dataMode)}</dd></div><div><dt>Coverage</dt><dd>G/I · 12 demo points</dd></div><div><dt>Model lens</dt><dd>${escapeHtml(selectedModelLens)}</dd></div><div><dt>Approval</dt><dd>${escapeHtml(model.publication?.approvalStatus)}</dd></div></dl></section>`;
}

function renderMobileMenu() {
  $("#drawer-eyebrow").textContent = "WORLD MODEL OS";
  $("#drawer-title").textContent = "更多";
  const links = [["causal", "因果机制", "检验路径与反证"], ["portfolio", "组合风险", "查看因子暴露"], ["evidence", "证据与数据", "追溯来源与版本"], ["methodology", "方法与版本", "检查门槛与执行账本"]];
  $("#drawer-content").innerHTML = `<nav class="drawer-menu" aria-label="更多页面">${links.map(([route, label, copy]) => `<a href="#${route}" data-route-link="${route}"><b>${label}</b><small>${copy}</small><span>→</span></a>`).join("")}</nav><section class="drawer-section"><a class="drawer-external" href="https://github.com/zhangyi7456/world-model-os" target="_blank" rel="noreferrer">GitHub 源码与文档 ↗</a><a class="drawer-external" href="https://github.com/zhangyi7456/world-model-os-demo/issues" target="_blank" rel="noreferrer">反馈与挑战 ↗</a></section>`;
}

function openDrawer(kind = "manifest", trigger = null) {
  drawerReturnFocus = trigger || document.activeElement;
  if (kind === "context") renderContextDrawer();
  else if (kind === "menu") renderMobileMenu();
  else renderManifest();
  $("#drawer-backdrop").hidden = false;
  requestAnimationFrame(() => document.body.classList.add("drawer-open"));
  $("#detail-drawer").setAttribute("aria-hidden", "false");
  $("#drawer-close").focus();
}

function closeDrawer() {
  document.body.classList.remove("drawer-open");
  $("#detail-drawer").setAttribute("aria-hidden", "true");
  setTimeout(() => { $("#drawer-backdrop").hidden = true; }, 180);
  if (drawerReturnFocus?.focus) drawerReturnFocus.focus();
}

function selectEntity(entity) {
  if (!model.world?.entities?.[entity]) return;
  selectedEntity = entity;
  selectedPathId = null; selectedEdgeId = null; selectedIndicatorId = null;
  $("#entity-select").value = entity;
  syncUrlState();
  render();
}

async function loadData() {
  try {
    const names = ["world-state", "causal-map", "scenario-set", "portfolio-risk", "publication-manifest", "latest-brief", "release-calendar", "history-replay", "factor-risk-method", "phase5-status", "total-return-ledger-method", "calibration-readiness", "temporal-governance"];
    const responses = await Promise.all(names.map((name) => fetch(`./data/${name}.json`, { cache: "no-store" })));
    if (responses.some((response) => !response.ok)) throw new Error("required public artifacts are unavailable");
    const [worldData, causalData, scenarioData, portfolioData, publicationData, briefData, releaseCalendarData, historyReplayData, factorRiskData, phase5StatusData, totalReturnLedgerData, calibrationData, temporalData] = await Promise.all(responses.map((response) => response.json()));
    Object.assign(model, { world: worldData, causal: causalData, scenario: scenarioData, portfolio: portfolioData, publication: publicationData, brief: briefData, releaseCalendar: releaseCalendarData, historyReplay: historyReplayData, factorRisk: factorRiskData, phase5Status: phase5StatusData, totalReturnLedger: totalReturnLedgerData, calibration: calibrationData, temporal: temporalData });
    const url = new URL(window.location.href);
    const requestedEntity = url.searchParams.get("entity");
    selectedEntity = worldData.entities?.[requestedEntity] ? requestedEntity : (worldData.primaryEntity || "US");
    const requestedSnapshot = url.searchParams.get("snapshot");
    selectedSnapshotPeriod = historyReplayData.points.some((point) => point.period === requestedSnapshot) && requestedSnapshot !== historyReplayData.points.at(-1)?.period ? requestedSnapshot : null;
    const requestedCompare = url.searchParams.get("compare");
    compareSnapshotPeriod = historyReplayData.points.some((point) => point.period === requestedCompare) ? requestedCompare : null;
    selectedLoop = ["fast", "medium", "slow"].includes(url.searchParams.get("loop")) ? url.searchParams.get("loop") : "medium";
    syncContextControls();
    $("#data-mode").textContent = publicationData.dataModeComposition.worldState;
    $("#site-release").textContent = publicationData.siteRelease.toUpperCase();
    $("#as-of-time").textContent = `AS OF ${worldData.asOf.slice(0, 10)}`;
    $("#snapshot-date").textContent = worldData.asOf.slice(0, 10).replaceAll("-", " · ");
    const counts = worldData.quality.statusCounts;
    const degraded = (counts.stale || 0) + (counts.estimated || 0) + (counts.missing || 0) + (counts.bad || 0);
    $("#data-health").textContent = `${worldData.quality.observationCount} 项输入 · ${degraded} 项降级`;
    syncUrlState();
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
  const riskView = event.target.closest("[data-risk-view]"); if (riskView) { selectedRiskView = riskView.dataset.riskView; render(); }
  const workstreamFilter = event.target.closest("[data-workstream-filter]"); if (workstreamFilter) { selectedWorkstreamFilter = workstreamFilter.dataset.workstreamFilter; render(); }
  const historyPeriod = event.target.closest("[data-history-period]"); if (historyPeriod) selectHistoryPeriod(historyPeriod.dataset.historyPeriod);
  const timeAction = event.target.closest("[data-time-action]"); if (timeAction) {
    const action = timeAction.dataset.timeAction;
    if (action === "previous") stepHistory(-1);
    if (action === "next") stepHistory(1);
    if (action === "latest") selectHistoryPeriod(latestHistoryPeriod());
    if (action === "compare") {
      const points = historyPoints();
      const index = points.findIndex((point) => point.period === activeHistoryPeriod());
      compareSnapshotPeriod = points[Math.max(0, index - 1)]?.period || null;
      syncUrlState();
      location.hash = "history";
      render();
    }
  }
  const routeLink = event.target.closest("[data-route-link]"); if (routeLink) { location.hash = routeLink.dataset.routeLink; if (document.body.classList.contains("drawer-open")) closeDrawer(); }
  if (event.target.closest("#release-trigger, #manifest-trigger, [data-open-manifest]")) openDrawer("manifest", event.target.closest("button"));
  if (event.target.closest("#context-trigger")) openDrawer("context", event.target.closest("button"));
  if (event.target.closest("#mobile-more")) openDrawer("menu", event.target.closest("button"));
  if (event.target.closest("#drawer-close") || event.target.id === "drawer-backdrop") closeDrawer();
});
$("#entity-select").addEventListener("change", (event) => selectEntity(event.target.value));
$("#snapshot-select").addEventListener("change", (event) => selectHistoryPeriod(event.target.value));
$("#data-view-select").addEventListener("change", (event) => { selectedDataView = event.target.value; syncUrlState(); render(); });
$("#model-lens-select").addEventListener("change", (event) => { selectedModelLens = event.target.value; syncUrlState(); render(); });
$("#loop-select").addEventListener("change", (event) => { selectedLoop = event.target.value; syncUrlState(); render(); });
document.addEventListener("change", (event) => {
  if (event.target.id === "compare-select") { compareSnapshotPeriod = event.target.value; syncUrlState(); render(); }
  const kind = event.target.dataset.contextSelect;
  if (!kind) return;
  if (kind === "entity") selectEntity(event.target.value);
  if (kind === "snapshot") selectHistoryPeriod(event.target.value);
  if (kind === "loop") { selectedLoop = event.target.value; syncUrlState(); renderContextDrawer(); render(); }
});
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && document.body.classList.contains("drawer-open")) closeDrawer(); });
addEventListener("hashchange", render);
render();
loadData();
