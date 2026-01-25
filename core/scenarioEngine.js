const SCENARIO_TYPES = { DROP_SUBJECT: 'drop_subject', MODIFY_HOURS: 'modify_hours', CHANGE_POLICY: 'change_policy' };

function createScenarioSnapshot(subjects, priorityResults, weeklyPlans, policyId) {
    return {
        timestamp: new Date().toISOString(),
        subjects: JSON.parse(JSON.stringify(subjects)),
        priorityResults: JSON.parse(JSON.stringify(priorityResults)),
        weeklyPlans: JSON.parse(JSON.stringify(weeklyPlans)),
        policyId: policyId
    };
}

function simulateDropSubject(baselineSnapshot, subjectIdToDrop, policy, executionHistory) {
    const modifiedSubjects = baselineSnapshot.subjects.filter(s => s.id !== subjectIdToDrop);
    if (modifiedSubjects.length === 0) return { error: 'Cannot drop the only remaining subject.' };
    
    const newPriorityResults = modifiedSubjects.map(subject => {
        let executionData = null;
        if (executionHistory) {
            const history = executionHistory.find(h => h.subjectId === subject.id);
            if (history) executionData = { avgActualHours: history.avgActualHours, recommendedHours: history.recommendedHours };
        }
        const result = calculatePriorityWithPolicy(subject, policy, executionData);
        return { subjectId: subject.id, subjectName: subject.name, priorityScore: result.priorityScore, explanation: result.explanation };
    });
    
    newPriorityResults.sort((a, b) => b.priorityScore - a.priorityScore);
    newPriorityResults.forEach((result, index) => { result.rank = index + 1; });
    
    const totalAvailableHours = modifiedSubjects.reduce((sum, s) => sum + s.availableStudyHours, 0);
    const totalPriorityScore = newPriorityResults.reduce((sum, r) => sum + r.priorityScore, 0);
    
    const newWeeklyPlans = newPriorityResults.map(result => {
        const subject = modifiedSubjects.find(s => s.id === result.subjectId);
        const recommendedHours = totalPriorityScore > 0 ? (result.priorityScore / totalPriorityScore) * totalAvailableHours : 0;
        return { subjectId: result.subjectId, subjectName: result.subjectName, recommendedHours: Math.round(Math.min(recommendedHours, subject.availableStudyHours) * 10) / 10, availableHours: subject.availableStudyHours, priorityScore: result.priorityScore };
    });
    
    const deltas = newPriorityResults.map(newResult => {
        const oldResult = baselineSnapshot.priorityResults.find(r => r.subjectId === newResult.subjectId);
        const oldPlan = baselineSnapshot.weeklyPlans.find(p => p.subjectId === newResult.subjectId);
        const newPlan = newWeeklyPlans.find(p => p.subjectId === newResult.subjectId);
        return { subjectId: newResult.subjectId, subjectName: newResult.subjectName, priorityDelta: oldResult ? newResult.priorityScore - oldResult.priorityScore : newResult.priorityScore, rankDelta: oldResult ? oldResult.rank - newResult.rank : null, hoursDelta: oldPlan && newPlan ? newPlan.recommendedHours - oldPlan.recommendedHours : (newPlan ? newPlan.recommendedHours : 0) };
    });
    
    const droppedSubject = baselineSnapshot.subjects.find(s => s.id === subjectIdToDrop);
    return { scenarioType: SCENARIO_TYPES.DROP_SUBJECT, modifiedSubjects: modifiedSubjects, newPriorityResults: newPriorityResults, newWeeklyPlans: newWeeklyPlans, deltas: deltas, droppedSubject: { name: droppedSubject.name, freedHours: droppedSubject.availableStudyHours, previousPriority: baselineSnapshot.priorityResults.find(r => r.subjectId === subjectIdToDrop)?.priorityScore || 0 }, summary: { totalSubjects: modifiedSubjects.length, totalAvailableHours: totalAvailableHours, totalRecommendedHours: newWeeklyPlans.reduce((sum, p) => sum + p.recommendedHours, 0) } };
}

function simulateModifyHours(baselineSnapshot, subjectId, newAvailableHours, policy, executionHistory) {
    const modifiedSubjects = baselineSnapshot.subjects.map(s => s.id === subjectId ? { ...s, availableStudyHours: newAvailableHours } : s);
    
    const newPriorityResults = modifiedSubjects.map(subject => {
        let executionData = null;
        if (executionHistory) {
            const history = executionHistory.find(h => h.subjectId === subject.id);
            if (history) executionData = { avgActualHours: history.avgActualHours, recommendedHours: history.recommendedHours };
        }
        const result = calculatePriorityWithPolicy(subject, policy, executionData);
        return { subjectId: subject.id, subjectName: subject.name, priorityScore: result.priorityScore, explanation: result.explanation };
    });
    
    newPriorityResults.sort((a, b) => b.priorityScore - a.priorityScore);
    newPriorityResults.forEach((result, index) => { result.rank = index + 1; });
    
    const totalAvailableHours = modifiedSubjects.reduce((sum, s) => sum + s.availableStudyHours, 0);
    const totalPriorityScore = newPriorityResults.reduce((sum, r) => sum + r.priorityScore, 0);
    
    const newWeeklyPlans = newPriorityResults.map(result => {
        const subject = modifiedSubjects.find(s => s.id === result.subjectId);
        const recommendedHours = totalPriorityScore > 0 ? (result.priorityScore / totalPriorityScore) * totalAvailableHours : 0;
        return { subjectId: result.subjectId, subjectName: result.subjectName, recommendedHours: Math.round(Math.min(recommendedHours, subject.availableStudyHours) * 10) / 10, availableHours: subject.availableStudyHours, priorityScore: result.priorityScore };
    });
    
    const deltas = newPriorityResults.map(newResult => {
        const oldResult = baselineSnapshot.priorityResults.find(r => r.subjectId === newResult.subjectId);
        const oldPlan = baselineSnapshot.weeklyPlans.find(p => p.subjectId === newResult.subjectId);
        const newPlan = newWeeklyPlans.find(p => p.subjectId === newResult.subjectId);
        return { subjectId: newResult.subjectId, subjectName: newResult.subjectName, priorityDelta: oldResult ? newResult.priorityScore - oldResult.priorityScore : 0, rankDelta: oldResult ? oldResult.rank - newResult.rank : 0, hoursDelta: oldPlan && newPlan ? newPlan.recommendedHours - oldPlan.recommendedHours : 0 };
    });
    
    const modifiedSubject = modifiedSubjects.find(s => s.id === subjectId);
    return { scenarioType: SCENARIO_TYPES.MODIFY_HOURS, modifiedSubjects: modifiedSubjects, newPriorityResults: newPriorityResults, newWeeklyPlans: newWeeklyPlans, deltas: deltas, modifiedSubject: { name: modifiedSubject.name, oldHours: baselineSnapshot.subjects.find(s => s.id === subjectId).availableStudyHours, newHours: newAvailableHours, hoursDelta: newAvailableHours - baselineSnapshot.subjects.find(s => s.id === subjectId).availableStudyHours }, summary: { totalAvailableHours: totalAvailableHours, totalRecommendedHours: newWeeklyPlans.reduce((sum, p) => sum + p.recommendedHours, 0), availableHoursDelta: totalAvailableHours - baselineSnapshot.subjects.reduce((sum, s) => sum + s.availableStudyHours, 0) } };
}

function simulateChangePolicy(baselineSnapshot, newPolicy, executionHistory) {
    const newPriorityResults = baselineSnapshot.subjects.map(subject => {
        let executionData = null;
        if (executionHistory) {
            const history = executionHistory.find(h => h.subjectId === subject.id);
            if (history) executionData = { avgActualHours: history.avgActualHours, recommendedHours: history.recommendedHours };
        }
        const result = calculatePriorityWithPolicy(subject, newPolicy, executionData);
        return { subjectId: subject.id, subjectName: subject.name, priorityScore: result.priorityScore, explanation: result.explanation };
    });
    
    newPriorityResults.sort((a, b) => b.priorityScore - a.priorityScore);
    newPriorityResults.forEach((result, index) => { result.rank = index + 1; });
    
    const totalAvailableHours = baselineSnapshot.subjects.reduce((sum, s) => sum + s.availableStudyHours, 0);
    const totalPriorityScore = newPriorityResults.reduce((sum, r) => sum + r.priorityScore, 0);
    
    const newWeeklyPlans = newPriorityResults.map(result => {
        const subject = baselineSnapshot.subjects.find(s => s.id === result.subjectId);
        const recommendedHours = totalPriorityScore > 0 ? (result.priorityScore / totalPriorityScore) * totalAvailableHours : 0;
        return { subjectId: result.subjectId, subjectName: result.subjectName, recommendedHours: Math.round(Math.min(recommendedHours, subject.availableStudyHours) * 10) / 10, availableHours: subject.availableStudyHours, priorityScore: result.priorityScore };
    });
    
    const deltas = newPriorityResults.map(newResult => {
        const oldResult = baselineSnapshot.priorityResults.find(r => r.subjectId === newResult.subjectId);
        const oldPlan = baselineSnapshot.weeklyPlans.find(p => p.subjectId === newResult.subjectId);
        const newPlan = newWeeklyPlans.find(p => p.subjectId === newResult.subjectId);
        return { subjectId: newResult.subjectId, subjectName: newResult.subjectName, priorityDelta: oldResult ? newResult.priorityScore - oldResult.priorityScore : 0, rankDelta: oldResult ? oldResult.rank - newResult.rank : 0, hoursDelta: oldPlan && newPlan ? newPlan.recommendedHours - oldPlan.recommendedHours : 0 };
    });
    
    return { scenarioType: SCENARIO_TYPES.CHANGE_POLICY, newPolicy: newPolicy, oldPolicyId: baselineSnapshot.policyId, newPriorityResults: newPriorityResults, newWeeklyPlans: newWeeklyPlans, deltas: deltas, summary: { policyChanged: true, totalRecommendedHours: newWeeklyPlans.reduce((sum, p) => sum + p.recommendedHours, 0) } };
}

function generateScenarioSummary(scenarioResult) {
    if (scenarioResult.error) return scenarioResult.error;
    const parts = [];
    
    if (scenarioResult.scenarioType === SCENARIO_TYPES.DROP_SUBJECT) {
        parts.push(`Scenario: Dropping ${scenarioResult.droppedSubject.name}`);
        parts.push(`Freed hours: ${scenarioResult.droppedSubject.freedHours}`);
        parts.push(`Remaining subjects: ${scenarioResult.summary.totalSubjects}`);
        if (scenarioResult.deltas.length > 0) {
            parts.push('\nImpact on remaining subjects:');
            scenarioResult.deltas.forEach(delta => {
                if (delta.hoursDelta !== 0 || delta.rankDelta !== 0) parts.push(`  • ${delta.subjectName}: ${delta.hoursDelta > 0 ? '+' : ''}${delta.hoursDelta.toFixed(1)}h, Rank ${delta.rankDelta > 0 ? '+' : ''}${delta.rankDelta}`);
            });
        }
    } else if (scenarioResult.scenarioType === SCENARIO_TYPES.MODIFY_HOURS) {
        parts.push(`Scenario: Modifying hours for ${scenarioResult.modifiedSubject.name}`);
        parts.push(`Hours change: ${scenarioResult.modifiedSubject.oldHours} → ${scenarioResult.modifiedSubject.newHours} (${scenarioResult.modifiedSubject.hoursDelta > 0 ? '+' : ''}${scenarioResult.modifiedSubject.hoursDelta})`);
        parts.push(`Total available hours: ${scenarioResult.summary.totalAvailableHours} (${scenarioResult.summary.availableHoursDelta > 0 ? '+' : ''}${scenarioResult.summary.availableHoursDelta})`);
    } else if (scenarioResult.scenarioType === SCENARIO_TYPES.CHANGE_POLICY) {
        parts.push(`Scenario: Changing policy from ${scenarioResult.oldPolicyId} to ${scenarioResult.newPolicy.id}`);
        parts.push(`Policy: ${scenarioResult.newPolicy.name}`);
        if (scenarioResult.deltas.length > 0) {
            parts.push('\nPriority changes:');
            scenarioResult.deltas.filter(d => d.priorityDelta !== 0 || d.rankDelta !== 0).sort((a, b) => Math.abs(b.priorityDelta) - Math.abs(a.priorityDelta)).slice(0, 5).forEach(delta => {
                parts.push(`  • ${delta.subjectName}: Priority ${delta.priorityDelta > 0 ? '+' : ''}${delta.priorityDelta.toFixed(2)}, Rank ${delta.rankDelta > 0 ? '+' : ''}${delta.rankDelta}`);
            });
        }
    }
    return parts.join('\n');
}
