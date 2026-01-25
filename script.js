const STORAGE_KEYS = {
    SUBJECTS: 'academicCopilot_subjects',
    PRIORITY_RESULTS: 'academicCopilot_priorityResults',
    WEEKLY_PLANS: 'academicCopilot_weeklyPlans',
    EXECUTION_LOGS: 'academicCopilot_executionLogs',
    CURRENT_WEEK: 'academicCopilot_currentWeek',
    CURRENT_POLICY: 'academicCopilot_currentPolicy',
    RISK_ASSESSMENTS: 'academicCopilot_riskAssessments',
    CONFIDENCE_DATA: 'academicCopilot_confidenceData',
    HISTORICAL_PRIORITIES: 'academicCopilot_historicalPriorities',
    SCENARIO_SNAPSHOTS: 'academicCopilot_scenarioSnapshots'
};

function initializeData() {
    return {
        subjects: loadFromStorage(STORAGE_KEYS.SUBJECTS) || [],
        priorityResults: loadFromStorage(STORAGE_KEYS.PRIORITY_RESULTS) || [],
        weeklyPlans: loadFromStorage(STORAGE_KEYS.WEEKLY_PLANS) || [],
        executionLogs: loadFromStorage(STORAGE_KEYS.EXECUTION_LOGS) || [],
        currentWeek: loadFromStorage(STORAGE_KEYS.CURRENT_WEEK) || getCurrentWeekId(),
        currentPolicy: loadFromStorage(STORAGE_KEYS.CURRENT_POLICY) || 'balanced',
        riskAssessments: loadFromStorage(STORAGE_KEYS.RISK_ASSESSMENTS) || [],
        confidenceData: loadFromStorage(STORAGE_KEYS.CONFIDENCE_DATA) || [],
        historicalPriorities: loadFromStorage(STORAGE_KEYS.HISTORICAL_PRIORITIES) || [],
        scenarioSnapshots: loadFromStorage(STORAGE_KEYS.SCENARIO_SNAPSHOTS) || []
    };
}

let appData = initializeData();

function saveToStorage(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
}

function loadFromStorage(key) {
    try { const data = localStorage.getItem(key); return data ? JSON.parse(data) : null; } catch (e) { return null; }
}

function getCurrentWeekId() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const pastDaysOfYear = (now - startOfYear) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
    return `${now.getFullYear()}-W${weekNumber}`;
}

function addSubject(event) {
    event.preventDefault();
    const name = document.getElementById('subject-name').value.trim();
    const creditWeight = parseInt(document.getElementById('credit-weight').value);
    const difficulty = parseInt(document.getElementById('difficulty').value);
    const interest = parseInt(document.getElementById('interest').value);
    const studyHours = parseFloat(document.getElementById('study-hours').value);
    
    if (!name || creditWeight < 1 || creditWeight > 10 || difficulty < 1 || difficulty > 5 || interest < 1 || interest > 5 || studyHours < 0) {
        alert('Please fill all fields with valid values.');
        return;
    }
    
    appData.subjects.push({ id: Date.now().toString(), name: name, creditWeight: creditWeight, difficulty: difficulty, interest: interest, availableStudyHours: studyHours });
    saveToStorage(STORAGE_KEYS.SUBJECTS, appData.subjects);
    document.getElementById('subject-form').reset();
    renderSubjectsList();
    updateCalculateButton();
}

function removeSubject(subjectId) {
    appData.subjects = appData.subjects.filter(s => s.id !== subjectId);
    saveToStorage(STORAGE_KEYS.SUBJECTS, appData.subjects);
    appData.priorityResults = [];
    appData.weeklyPlans = [];
    saveToStorage(STORAGE_KEYS.PRIORITY_RESULTS, []);
    saveToStorage(STORAGE_KEYS.WEEKLY_PLANS, []);
    renderSubjectsList();
    updateCalculateButton();
    hideModules();
}

function renderSubjectsList() {
    const container = document.getElementById('subjects-list');
    if (appData.subjects.length === 0) { container.innerHTML = '<p style="color: #605e5c; font-size: 14px;">No subjects added yet.</p>'; return; }
    container.innerHTML = appData.subjects.map(subject => `
        <div class="subject-item">
            <div class="subject-item-info">
                <h3>${escapeHtml(subject.name)}</h3>
                <p><strong>Credits:</strong> ${subject.creditWeight} | <strong>Difficulty:</strong> ${subject.difficulty}/5 | <strong>Interest:</strong> ${subject.interest}/5 | <strong>Available Hours:</strong> ${subject.availableStudyHours}/week</p>
            </div>
            <div class="subject-item-actions">
                <fluent-button appearance="neutral" onclick="removeSubject('${subject.id}')">Remove</fluent-button>
            </div>
        </div>
    `).join('');
}

function updateCalculateButton() {
    document.getElementById('calculate-priority-btn').disabled = appData.subjects.length === 0;
}

function resetProfile() {
    if (confirm('Are you sure you want to reset all profile data?')) {
        appData.subjects = [];
        appData.priorityResults = [];
        appData.weeklyPlans = [];
        appData.executionLogs = [];
        saveToStorage(STORAGE_KEYS.SUBJECTS, []);
        saveToStorage(STORAGE_KEYS.PRIORITY_RESULTS, []);
        saveToStorage(STORAGE_KEYS.WEEKLY_PLANS, []);
        saveToStorage(STORAGE_KEYS.EXECUTION_LOGS, []);
        renderSubjectsList();
        updateCalculateButton();
        hideModules();
    }
}

function calculatePriorities() {
    if (appData.subjects.length === 0) { alert('Please add at least one subject first.'); return; }
    
    const policyId = appData.currentPolicy || 'balanced';
    const policy = getPolicy(policyId);
    const executionHistory = buildExecutionHistory();
    
    appData.priorityResults = appData.subjects.map(subject => {
        let executionData = null;
        if (policy.weights.execution > 0 && executionHistory[subject.id]) executionData = executionHistory[subject.id];
        const result = calculatePriorityWithPolicy(subject, policy, executionData);
        return { subjectId: subject.id, subjectName: subject.name, priorityScore: result.priorityScore, explanation: result.explanation, components: result.components, policyId: policyId };
    });
    
    appData.priorityResults.sort((a, b) => b.priorityScore - a.priorityScore);
    appData.priorityResults.forEach((result, index) => { result.rank = index + 1; });
    saveToStorage(STORAGE_KEYS.PRIORITY_RESULTS, appData.priorityResults);
    
    appData.historicalPriorities.push({ timestamp: new Date().toISOString(), policyId: policyId, results: JSON.parse(JSON.stringify(appData.priorityResults)) });
    saveToStorage(STORAGE_KEYS.HISTORICAL_PRIORITIES, appData.historicalPriorities);
    
    computeRiskAssessments();
    computeConfidenceLevels();
    renderPriorityResults();
    renderRiskResults();
    renderExplainability();
    generateRecommendations();
    showModule('priority-section');
    showModule('recommendation-section');
}

function buildExecutionHistory() {
    const history = {};
    appData.weeklyPlans.forEach(plan => {
        const entries = appData.executionLogs.flatMap(log => log.entries.filter(e => e.subjectId === plan.subjectId));
        if (entries.length > 0) {
            const avgActualHours = entries.reduce((sum, e) => sum + e.actualHours, 0) / entries.length;
            history[plan.subjectId] = { avgActualHours: avgActualHours, recommendedHours: plan.recommendedHours, dataPoints: entries.length, deviations: entries.map(e => e.actualHours - plan.recommendedHours) };
        }
    });
    return history;
}

function computeRiskAssessments() {
    const executionHistory = buildExecutionHistory();
    appData.riskAssessments = appData.subjects.map(subject => {
        const plan = appData.weeklyPlans.find(p => p.subjectId === subject.id);
        let executionData = null, planDeviation = null;
        if (executionHistory[subject.id]) {
            executionData = { avgActualHours: executionHistory[subject.id].avgActualHours, recommendedHours: executionHistory[subject.id].recommendedHours };
            if (plan) planDeviation = { deviationPercent: ((executionData.avgActualHours - plan.recommendedHours) / plan.recommendedHours) * 100 };
        }
        const riskResult = calculateRiskScore(subject, executionData, planDeviation);
        return { subjectId: subject.id, subjectName: subject.name, riskScore: riskResult.riskScore, riskLevel: riskResult.riskLevel, explanation: riskResult.explanation, components: riskResult.components };
    });
    saveToStorage(STORAGE_KEYS.RISK_ASSESSMENTS, appData.riskAssessments);
}

function computeConfidenceLevels() {
    const executionHistory = buildExecutionHistory();
    appData.confidenceData = appData.weeklyPlans.map(plan => {
        const subject = appData.subjects.find(s => s.id === plan.subjectId);
        const history = executionHistory[plan.subjectId];
        const subjectPriorityHistory = appData.historicalPriorities.flatMap(hp => hp.results.filter(r => r.subjectId === plan.subjectId)).map(r => ({ priorityScore: r.priorityScore }));
        const confidenceResult = calculateConfidence(subject, history ? { dataPoints: history.dataPoints, deviations: history.deviations } : null, subjectPriorityHistory.length > 0 ? subjectPriorityHistory : null);
        return { subjectId: plan.subjectId, confidenceScore: confidenceResult.confidenceScore, confidenceLevel: confidenceResult.confidenceLevel, explanation: confidenceResult.explanation, factors: confidenceResult.factors };
    });
    saveToStorage(STORAGE_KEYS.CONFIDENCE_DATA, appData.confidenceData);
}

function renderPriorityResults() {
    const container = document.getElementById('priority-results');
    if (appData.priorityResults.length === 0) { container.innerHTML = '<p style="color: #605e5c;">No priority results calculated yet.</p>'; return; }
    
    const policy = getPolicy(appData.currentPolicy);
    const policyInfo = document.getElementById('policy-info');
    if (policyInfo) policyInfo.innerHTML = `<strong>${policy.name}:</strong> ${policy.description}<br><small style="color: #605e5c;">${policy.rationale}</small>`;
    
    container.innerHTML = appData.priorityResults.map(result => `
        <div class="priority-item">
            <div class="priority-item-header">
                <h3>${escapeHtml(result.subjectName)}<span class="priority-rank">Rank #${result.rank}</span></h3>
                <div class="priority-score">Score: ${result.priorityScore.toFixed(2)}</div>
            </div>
            <div class="priority-explanation">${escapeHtml(result.explanation)}</div>
            ${result.components ? `<div style="margin-top: 8px; font-size: 12px; color: #605e5c;">Components: Interest ${result.components.interest.toFixed(2)}, Credits ${result.components.credits.toFixed(2)}, Difficulty ${result.components.difficulty.toFixed(2)}${result.components.execution > 0 ? `, Execution ${result.components.execution.toFixed(2)}` : ''}</div>` : ''}
        </div>
    `).join('');
}

function renderRiskResults() {
    const container = document.getElementById('risk-results');
    if (!container) return;
    if (appData.riskAssessments.length === 0) { container.innerHTML = '<p style="color: #605e5c;">No risk assessments available.</p>'; return; }
    
    const sortedRisks = [...appData.riskAssessments].sort((a, b) => b.riskScore - a.riskScore);
    container.innerHTML = sortedRisks.map(risk => {
        const riskColor = risk.riskLevel === 'high' ? '#d83b01' : risk.riskLevel === 'medium' ? '#ffaa44' : '#107c10';
        return `<div class="priority-item" style="border-left: 4px solid ${riskColor};"><div class="priority-item-header"><h3>${escapeHtml(risk.subjectName)}</h3><div style="font-size: 18px; font-weight: 600; color: ${riskColor};">Risk: ${risk.riskLevel.toUpperCase()} (${risk.riskScore.toFixed(2)})</div></div><div class="priority-explanation">${escapeHtml(risk.explanation)}</div></div>`;
    }).join('');
}

function renderExplainability() {
    const container = document.getElementById('explanation-content');
    if (!container) return;
    if (appData.priorityResults.length === 0) { container.innerHTML = '<p style="color: #605e5c;">No decisions to explain yet.</p>'; return; }
    
    const policy = getPolicy(appData.currentPolicy);
    container.innerHTML = `<div class="insight-item"><h3>Decision-Making Process</h3><p><strong>Policy Applied:</strong> ${policy.name}</p><p><strong>Policy Rationale:</strong> ${policy.rationale}</p><p><strong>Inputs Considered:</strong></p><ul><li>Interest levels (1-5 scale)</li><li>Credit weights (1-10 scale)</li><li>Difficulty ratings (1-5 scale)</li>${policy.weights.execution > 0 ? '<li>Historical execution patterns</li>' : ''}</ul><p><strong>Weight Configuration:</strong></p><ul><li>Interest: ${(policy.weights.interest * 100).toFixed(0)}%</li><li>Credits: ${(policy.weights.credits * 100).toFixed(0)}%</li><li>Difficulty: ${(policy.weights.difficulty * 100).toFixed(0)}%</li>${policy.weights.execution > 0 ? `<li>Execution: ${(policy.weights.execution * 100).toFixed(0)}%</li>` : ''}</ul></div>`;
}

function generateRecommendations() {
    if (appData.priorityResults.length === 0) return;
    
    const totalPriorityScore = appData.priorityResults.reduce((sum, result) => sum + result.priorityScore, 0);
    const totalAvailableHours = appData.subjects.reduce((sum, subject) => sum + subject.availableStudyHours, 0);
    
    appData.weeklyPlans = appData.priorityResults.map(result => {
        const subject = appData.subjects.find(s => s.id === result.subjectId);
        const recommendedHours = (result.priorityScore / totalPriorityScore) * totalAvailableHours;
        return { subjectId: result.subjectId, subjectName: result.subjectName, recommendedHours: Math.round(Math.min(recommendedHours, subject.availableStudyHours) * 10) / 10, availableHours: subject.availableStudyHours, priorityScore: result.priorityScore };
    });
    
    saveToStorage(STORAGE_KEYS.WEEKLY_PLANS, appData.weeklyPlans);
    renderRecommendations();
    showModule('tracking-section');
}

function renderRecommendations() {
    const container = document.getElementById('recommendations');
    const warningContainer = document.getElementById('overload-warning');
    if (appData.weeklyPlans.length === 0) { container.innerHTML = '<p style="color: #605e5c;">No recommendations available.</p>'; return; }
    
    const totalRecommended = appData.weeklyPlans.reduce((sum, plan) => sum + plan.recommendedHours, 0);
    const totalAvailable = appData.subjects.reduce((sum, subject) => sum + subject.availableStudyHours, 0);
    
    container.innerHTML = appData.weeklyPlans.map(plan => {
        const confidence = appData.confidenceData.find(c => c.subjectId === plan.subjectId);
        const confidenceBadge = confidence ? `<span style="font-size: 12px; padding: 2px 6px; background: ${confidence.confidenceLevel === 'high' ? '#107c10' : confidence.confidenceLevel === 'medium' ? '#ffaa44' : '#d83b01'}; color: white; border-radius: 2px; margin-left: 8px;">${confidence.confidenceLevel.toUpperCase()}</span>` : '';
        const disclaimer = confidence ? getConfidenceDisclaimer(plan, confidence) : '';
        return `<div class="recommendation-item"><div class="recommendation-item-info"><h3>${escapeHtml(plan.subjectName)}${confidenceBadge}</h3><p>Priority Score: ${plan.priorityScore.toFixed(2)} | Available: ${plan.availableHours} hrs/week</p>${disclaimer ? `<p style="font-size: 12px; color: #605e5c; margin-top: 4px;">${disclaimer}</p>` : ''}</div><div class="recommendation-hours">${plan.recommendedHours} hrs/week</div></div>`;
    }).join('');
    
    evaluateAndRenderConstraints();
    
    if (totalRecommended > totalAvailable * 1.1) {
        warningContainer.style.display = 'block';
        warningContainer.innerHTML = `<h3>⚠️ Overload Warning</h3><p>Total recommended hours (${totalRecommended.toFixed(1)}) exceed total available hours (${totalAvailable}) by ${(totalRecommended - totalAvailable).toFixed(1)} hours.</p>`;
    } else { warningContainer.style.display = 'none'; }
}

function evaluateAndRenderConstraints() {
    const container = document.getElementById('constraints-results');
    if (!container) return;
    const evaluationResults = evaluateConstraints(appData.subjects, appData.weeklyPlans, {}, appData.confidenceData);
    const summary = generateConstraintSummary(evaluationResults);
    container.innerHTML = `<div class="insight-item"><h3>Constraint Evaluation</h3><pre style="white-space: pre-wrap; font-family: 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.6;">${escapeHtml(summary)}</pre></div>`;
}

function initializeTracking() {
    if (appData.weeklyPlans.length === 0) return;
    renderWeekSelector();
    renderTrackingForm();
    showModule('tracking-section');
}

function renderWeekSelector() {
    const select = document.getElementById('week-select');
    const uniqueWeeks = [...new Set(appData.executionLogs.map(log => log.weekId))];
    select.innerHTML = `<fluent-option value="current">Current Week (${appData.currentWeek})</fluent-option>${uniqueWeeks.map(weekId => `<fluent-option value="${weekId}">${weekId}</fluent-option>`).join('')}`;
    select.value = appData.currentWeek;
    select.addEventListener('change', () => { renderTrackingForm(); });
}

function renderTrackingForm() {
    const weekId = document.getElementById('week-select').value;
    const container = document.getElementById('tracking-form');
    const actionsContainer = document.getElementById('tracking-actions');
    const weekLog = appData.executionLogs.find(log => log.weekId === weekId) || { weekId: weekId, entries: [] };
    
    container.innerHTML = appData.weeklyPlans.map(plan => {
        const entry = weekLog.entries.find(e => e.subjectId === plan.subjectId) || { subjectId: plan.subjectId, actualHours: 0, completionStatus: 'partial' };
        return `<div class="tracking-item"><h3>${escapeHtml(plan.subjectName)}</h3><p style="font-size: 12px; color: #605e5c; margin-bottom: 12px;">Recommended: ${plan.recommendedHours} hrs/week</p><div class="tracking-item-fields"><div class="tracking-item-field"><label>Actual Study Hours</label><fluent-text-field type="number" min="0" step="0.5" value="${entry.actualHours}" data-subject-id="${plan.subjectId}" data-field="actualHours" placeholder="0.0"></fluent-text-field></div><div class="tracking-item-field"><label>Completion Status</label><fluent-select data-subject-id="${plan.subjectId}" data-field="completionStatus"><fluent-option value="completed" ${entry.completionStatus === 'completed' ? 'selected' : ''}>Completed</fluent-option><fluent-option value="partial" ${entry.completionStatus === 'partial' ? 'selected' : ''}>Partial</fluent-option><fluent-option value="skipped" ${entry.completionStatus === 'skipped' ? 'selected' : ''}>Skipped</fluent-option></fluent-select></div></div></div>`;
    }).join('');
    actionsContainer.style.display = 'block';
}

function saveTrackingData() {
    const weekId = document.getElementById('week-select').value;
    const entries = [];
    appData.weeklyPlans.forEach(plan => {
        const hoursField = document.querySelector(`fluent-text-field[data-subject-id="${plan.subjectId}"][data-field="actualHours"]`);
        const statusField = document.querySelector(`fluent-select[data-subject-id="${plan.subjectId}"][data-field="completionStatus"]`);
        if (hoursField && statusField) entries.push({ subjectId: plan.subjectId, actualHours: parseFloat(hoursField.value) || 0, completionStatus: statusField.value });
    });
    
    const existingIndex = appData.executionLogs.findIndex(log => log.weekId === weekId);
    const logEntry = { weekId: weekId, entries: entries, timestamp: new Date().toISOString() };
    if (existingIndex >= 0) appData.executionLogs[existingIndex] = logEntry;
    else appData.executionLogs.push(logEntry);
    
    saveToStorage(STORAGE_KEYS.EXECUTION_LOGS, appData.executionLogs);
    alert('Tracking data saved successfully!');
    generateInsights();
}

function createNewWeek() {
    appData.currentWeek = getCurrentWeekId();
    saveToStorage(STORAGE_KEYS.CURRENT_WEEK, appData.currentWeek);
    renderWeekSelector();
    renderTrackingForm();
}

function generateInsights() {
    if (appData.executionLogs.length === 0 || appData.weeklyPlans.length === 0) return;
    const insights = generateMatureInsights(appData.executionLogs, appData.weeklyPlans, appData.subjects);
    appData.currentInsights = insights;
    appData.currentInsightsView = 'raw';
    renderMatureInsights(insights);
    generateTrendAnalysis();
    showModule('insights-section');
}

function renderMatureInsights(insights) {
    const container = document.getElementById('insights-content');
    if (!container) return;
    
    const view = appData.currentInsightsView || 'raw';
    let currentInsights = view === 'raw' ? insights.raw : view === 'pattern' ? insights.pattern : insights.behavioral;
    currentInsights = currentInsights || [];
    
    if (currentInsights.length === 0) {
        container.innerHTML = `<div class="insight-item"><h3>No ${view === 'raw' ? 'Raw Comparison' : view === 'pattern' ? 'Pattern' : 'Behavioral'} Insights Available</h3><p>${view === 'pattern' ? 'Need at least 2 weeks of data.' : view === 'behavioral' ? 'Need at least 3 weeks of data.' : 'No insights generated yet.'}</p></div>`;
        return;
    }
    
    container.innerHTML = currentInsights.map(insight => `<div class="insight-item"><h3>${escapeHtml(insight.subjectName)} - ${insight.type.replace('_', ' ').toUpperCase()}</h3><p><strong>Observation:</strong> ${escapeHtml(insight.message)}</p><p><strong>Recommendation:</strong> ${escapeHtml(insight.recommendation)}</p></div>`).join('');
}

function generateTrendAnalysis() {
    const container = document.getElementById('trends-content');
    if (!container) return;
    if (appData.executionLogs.length < 2) { container.innerHTML = '<p style="color: #605e5c;">Insufficient data for trend analysis (need at least 2 weeks).</p>'; return; }
    
    const trends = [];
    const accuracyTrend = analyzePlanningAccuracyTrend(appData.executionLogs, appData.weeklyPlans);
    if (accuracyTrend.trend !== 'insufficient_data') trends.push({ title: 'Planning Accuracy Trend', message: accuracyTrend.message });
    if (appData.historicalPriorities.length >= 2) {
        const volatility = analyzePriorityVolatility(appData.historicalPriorities);
        if (volatility.volatility !== 'insufficient_data') trends.push({ title: 'Priority Volatility', message: volatility.message });
    }
    if (appData.executionLogs.length >= 3) {
        const burnout = analyzeBurnoutIndicators(appData.executionLogs, appData.weeklyPlans);
        if (burnout.burnoutRisk !== 'insufficient_data') trends.push({ title: 'Burnout Indicators', message: burnout.message });
    }
    
    if (trends.length === 0) { container.innerHTML = '<p style="color: #605e5c;">No trend data available yet.</p>'; return; }
    container.innerHTML = trends.map(trend => `<div class="insight-item"><h3>${trend.title}</h3><p>${escapeHtml(trend.message)}</p></div>`).join('');
}

function showModule(moduleId) {
    const module = document.getElementById(moduleId);
    if (module) module.style.display = 'block';
}

function hideModules() {
    document.getElementById('priority-section').style.display = 'none';
    document.getElementById('recommendation-section').style.display = 'none';
    document.getElementById('tracking-section').style.display = 'none';
    document.getElementById('insights-section').style.display = 'none';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function initializeScenarioSimulation() {
    const scenarioType = document.getElementById('scenario-type');
    if (!scenarioType) return;
    scenarioType.addEventListener('change', () => { renderScenarioParams(); });
    renderScenarioParams();
}

function renderScenarioParams() {
    const scenarioType = document.getElementById('scenario-type');
    const paramsContainer = document.getElementById('scenario-params');
    if (!scenarioType || !paramsContainer) return;
    
    const type = scenarioType.value;
    if (type === 'drop_subject') {
        paramsContainer.innerHTML = `<div class="form-group" style="margin-top: 16px;"><label for="scenario-subject-drop">Subject to Drop:</label><fluent-select id="scenario-subject-drop">${appData.subjects.map(s => `<fluent-option value="${s.id}">${escapeHtml(s.name)}</fluent-option>`).join('')}</fluent-select></div>`;
    } else if (type === 'modify_hours') {
        paramsContainer.innerHTML = `<div class="form-group" style="margin-top: 16px;"><label for="scenario-subject-hours">Subject:</label><fluent-select id="scenario-subject-hours">${appData.subjects.map(s => `<fluent-option value="${s.id}">${escapeHtml(s.name)}</fluent-option>`).join('')}</fluent-select></div><div class="form-group" style="margin-top: 16px;"><label for="scenario-new-hours">New Available Hours:</label><fluent-text-field id="scenario-new-hours" type="number" min="0" step="0.5" placeholder="Hours"></fluent-text-field></div>`;
    } else if (type === 'change_policy') {
        paramsContainer.innerHTML = `<div class="form-group" style="margin-top: 16px;"><label for="scenario-new-policy">New Policy:</label><fluent-select id="scenario-new-policy">${getAllPolicies().map(p => `<fluent-option value="${p.id}">${escapeHtml(p.name)}</fluent-option>`).join('')}</fluent-select></div>`;
    }
}

function runScenario() {
    if (appData.subjects.length === 0 || appData.priorityResults.length === 0) { alert('Please calculate priorities first.'); return; }
    
    const scenarioType = document.getElementById('scenario-type').value;
    const policy = getPolicy(appData.currentPolicy);
    const executionHistory = buildExecutionHistory();
    const baseline = createScenarioSnapshot(appData.subjects, appData.priorityResults, appData.weeklyPlans, appData.currentPolicy);
    
    let scenarioResult = null;
    if (scenarioType === 'drop_subject') {
        const subjectId = document.getElementById('scenario-subject-drop').value;
        scenarioResult = simulateDropSubject(baseline, subjectId, policy, executionHistory);
    } else if (scenarioType === 'modify_hours') {
        const subjectId = document.getElementById('scenario-subject-hours').value;
        const newHours = parseFloat(document.getElementById('scenario-new-hours').value);
        if (!newHours || newHours < 0) { alert('Please enter valid hours.'); return; }
        scenarioResult = simulateModifyHours(baseline, subjectId, newHours, policy, executionHistory);
    } else if (scenarioType === 'change_policy') {
        const newPolicyId = document.getElementById('scenario-new-policy').value;
        scenarioResult = simulateChangePolicy(baseline, getPolicy(newPolicyId), executionHistory);
    }
    
    if (scenarioResult && !scenarioResult.error) renderScenarioResults(scenarioResult);
    else if (scenarioResult && scenarioResult.error) alert(scenarioResult.error);
}

function renderScenarioResults(scenarioResult) {
    const container = document.getElementById('scenario-results');
    if (!container) return;
    const summary = generateScenarioSummary(scenarioResult);
    container.innerHTML = `<div class="insight-item"><h3>Scenario Results</h3><pre style="white-space: pre-wrap; font-family: 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.6;">${escapeHtml(summary)}</pre></div><div style="margin-top: 16px;"><h4>New Priority Rankings:</h4>${scenarioResult.newPriorityResults.map(r => `<div style="padding: 8px; margin: 4px 0; background: #faf9f8; border-radius: 4px;"><strong>${escapeHtml(r.subjectName)}</strong> - Rank #${r.rank} (Score: ${r.priorityScore.toFixed(2)})</div>`).join('')}</div><div style="margin-top: 16px;"><h4>New Recommendations:</h4>${scenarioResult.newWeeklyPlans.map(p => `<div style="padding: 8px; margin: 4px 0; background: #faf9f8; border-radius: 4px;"><strong>${escapeHtml(p.subjectName)}</strong> - ${p.recommendedHours} hrs/week</div>`).join('')}</div>`;
}

function resetScenario() {
    const container = document.getElementById('scenario-results');
    if (container) container.innerHTML = '';
    renderScenarioParams();
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('subject-form').addEventListener('submit', addSubject);
    document.getElementById('calculate-priority-btn').addEventListener('click', calculatePriorities);
    document.getElementById('reset-profile-btn').addEventListener('click', resetProfile);
    
    const policySelect = document.getElementById('policy-select');
    if (policySelect) {
        policySelect.value = appData.currentPolicy || 'balanced';
        policySelect.addEventListener('change', () => {
            appData.currentPolicy = policySelect.value;
            saveToStorage(STORAGE_KEYS.CURRENT_POLICY, appData.currentPolicy);
            if (appData.priorityResults.length > 0) calculatePriorities();
        });
        const recalculateBtn = document.getElementById('recalculate-priority-btn');
        if (recalculateBtn) recalculateBtn.addEventListener('click', () => { calculatePriorities(); });
    }
    
    document.getElementById('save-tracking-btn').addEventListener('click', saveTrackingData);
    document.getElementById('new-week-btn').addEventListener('click', createNewWeek);
    
    const rawBtn = document.getElementById('insights-raw-btn');
    const patternBtn = document.getElementById('insights-pattern-btn');
    const behavioralBtn = document.getElementById('insights-behavioral-btn');
    
    if (rawBtn) rawBtn.addEventListener('click', () => { appData.currentInsightsView = 'raw'; if (appData.currentInsights) renderMatureInsights(appData.currentInsights); rawBtn.classList.add('active'); patternBtn?.classList.remove('active'); behavioralBtn?.classList.remove('active'); });
    if (patternBtn) patternBtn.addEventListener('click', () => { appData.currentInsightsView = 'pattern'; if (appData.currentInsights) renderMatureInsights(appData.currentInsights); patternBtn.classList.add('active'); rawBtn?.classList.remove('active'); behavioralBtn?.classList.remove('active'); });
    if (behavioralBtn) behavioralBtn.addEventListener('click', () => { appData.currentInsightsView = 'behavioral'; if (appData.currentInsights) renderMatureInsights(appData.currentInsights); behavioralBtn.classList.add('active'); rawBtn?.classList.remove('active'); patternBtn?.classList.remove('active'); });
    
    const runScenarioBtn = document.getElementById('run-scenario-btn');
    const resetScenarioBtn = document.getElementById('reset-scenario-btn');
    if (runScenarioBtn) runScenarioBtn.addEventListener('click', runScenario);
    if (resetScenarioBtn) resetScenarioBtn.addEventListener('click', resetScenario);
    
    renderSubjectsList();
    updateCalculateButton();
    
    if (appData.priorityResults.length > 0) { renderPriorityResults(); renderRiskResults(); renderExplainability(); showModule('priority-section'); }
    if (appData.weeklyPlans.length > 0) { renderRecommendations(); showModule('recommendation-section'); initializeTracking(); }
    if (appData.executionLogs.length > 0) generateInsights();
    
    initializeScenarioSimulation();
    showModule('scenario-section');
});

window.removeSubject = removeSubject;
