const CONSTRAINT_TYPES = { HARD: 'hard', SOFT: 'soft' };

const HARD_CONSTRAINTS = {
    TOTAL_HOURS: {
        id: 'total_hours',
        type: CONSTRAINT_TYPES.HARD,
        name: 'Total Available Hours',
        check: function(subjects, recommendations) {
            const totalRecommended = recommendations.reduce((sum, r) => sum + r.recommendedHours, 0);
            const totalAvailable = subjects.reduce((sum, s) => sum + s.availableStudyHours, 0);
            const violation = totalRecommended > totalAvailable;
            return {
                satisfied: !violation,
                violation: violation,
                message: violation 
                    ? `Total recommended hours (${totalRecommended.toFixed(1)}) exceeds total available hours (${totalAvailable}) by ${(totalRecommended - totalAvailable).toFixed(1)} hours.`
                    : `Total recommended hours (${totalRecommended.toFixed(1)}) within available capacity (${totalAvailable}).`,
                severity: violation ? 'error' : 'ok'
            };
        }
    },
    INDIVIDUAL_CAPACITY: {
        id: 'individual_capacity',
        type: CONSTRAINT_TYPES.HARD,
        name: 'Individual Subject Capacity',
        check: function(subjects, recommendations) {
            const violations = [];
            recommendations.forEach(rec => {
                const subject = subjects.find(s => s.id === rec.subjectId);
                if (subject && rec.recommendedHours > subject.availableStudyHours) {
                    violations.push({ subjectName: rec.subjectName, excess: rec.recommendedHours - subject.availableStudyHours });
                }
            });
            return {
                satisfied: violations.length === 0,
                violation: violations.length > 0,
                message: violations.length === 0 ? 'All recommendations within individual subject capacities.' : `${violations.length} subject(s) exceed available hours: ${violations.map(v => `${v.subjectName} (${v.excess.toFixed(1)}h excess)`).join(', ')}.`,
                severity: violations.length > 0 ? 'error' : 'ok',
                details: violations
            };
        }
    },
    MINIMUM_HOURS: {
        id: 'minimum_hours',
        type: CONSTRAINT_TYPES.HARD,
        name: 'Minimum Study Hours',
        check: function(subjects, recommendations, config) {
            config = config || { minHours: 1.0 };
            const violations = [];
            recommendations.forEach(rec => {
                if (rec.recommendedHours < config.minHours) {
                    violations.push({ subjectName: rec.subjectName, recommended: rec.recommendedHours, minimum: config.minHours });
                }
            });
            return {
                satisfied: violations.length === 0,
                violation: violations.length > 0,
                message: violations.length === 0 ? 'All subjects meet minimum hour requirements.' : `${violations.length} subject(s) below minimum hours.`,
                severity: violations.length > 0 ? 'warning' : 'ok',
                details: violations
            };
        }
    }
};

const SOFT_CONSTRAINTS = {
    INTEREST_ALIGNMENT: {
        id: 'interest_alignment',
        type: CONSTRAINT_TYPES.SOFT,
        name: 'Interest Alignment',
        check: function(subjects, recommendations) {
            const misalignments = [];
            recommendations.forEach(rec => {
                const subject = subjects.find(s => s.id === rec.subjectId);
                if (subject) {
                    const interestRatio = rec.recommendedHours / subject.availableStudyHours;
                    const expectedRatio = subject.interest / 5;
                    if (Math.abs(interestRatio - expectedRatio) > 0.2) {
                        misalignments.push({ subjectName: rec.subjectName, interest: subject.interest });
                    }
                }
            });
            return {
                satisfied: misalignments.length === 0,
                violation: misalignments.length > 0,
                message: misalignments.length === 0 ? 'Recommendations align well with interest levels.' : `${misalignments.length} subject(s) show interest misalignment.`,
                severity: 'advisory',
                details: misalignments
            };
        }
    },
    WORKLOAD_BALANCE: {
        id: 'workload_balance',
        type: CONSTRAINT_TYPES.SOFT,
        name: 'Workload Balance',
        check: function(subjects, recommendations) {
            if (recommendations.length < 2) return { satisfied: true, violation: false, message: 'Insufficient subjects for balance analysis.', severity: 'ok' };
            const hours = recommendations.map(r => r.recommendedHours);
            const mean = hours.reduce((sum, h) => sum + h, 0) / hours.length;
            const variance = hours.reduce((sum, h) => sum + Math.pow(h - mean, 2), 0) / hours.length;
            const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
            const imbalanced = cv > 0.5;
            return {
                satisfied: !imbalanced,
                violation: imbalanced,
                message: imbalanced ? `Workload is imbalanced (CV: ${cv.toFixed(2)}).` : `Workload is reasonably balanced (CV: ${cv.toFixed(2)}).`,
                severity: 'advisory',
                coefficientOfVariation: cv
            };
        }
    },
    CONFIDENCE_ALIGNMENT: {
        id: 'confidence_alignment',
        type: CONSTRAINT_TYPES.SOFT,
        name: 'Confidence Alignment',
        check: function(subjects, recommendations, config, confidenceData) {
            if (!confidenceData) return { satisfied: true, violation: false, message: 'Confidence data not available.', severity: 'ok' };
            const misalignments = [];
            recommendations.forEach(rec => {
                const confidence = confidenceData.find(c => c.subjectId === rec.subjectId);
                if (confidence && confidence.level === 'low') {
                    const subject = subjects.find(s => s.id === rec.subjectId);
                    if (subject && rec.recommendedHours > subject.availableStudyHours * 0.7) {
                        misalignments.push({ subjectName: rec.subjectName, confidence: 'low' });
                    }
                }
            });
            return {
                satisfied: misalignments.length === 0,
                violation: misalignments.length > 0,
                message: misalignments.length === 0 ? 'Recommendations align with confidence levels.' : `${misalignments.length} low-confidence subject(s) have high hour allocations.`,
                severity: 'advisory',
                details: misalignments
            };
        }
    }
};

function evaluateConstraints(subjects, recommendations, config, confidenceData) {
    const results = { hard: [], soft: [], allSatisfied: true, hasHardViolations: false, hasSoftViolations: false };
    
    Object.values(HARD_CONSTRAINTS).forEach(constraint => {
        const result = constraint.check(subjects, recommendations, config);
        results.hard.push({ constraint: constraint, result: result });
        if (result.violation) { results.hasHardViolations = true; results.allSatisfied = false; }
    });
    
    Object.values(SOFT_CONSTRAINTS).forEach(constraint => {
        const result = constraint.check(subjects, recommendations, config, confidenceData);
        results.soft.push({ constraint: constraint, result: result });
        if (result.violation) results.hasSoftViolations = true;
    });
    
    return results;
}

function generateConstraintSummary(evaluationResults) {
    const messages = [];
    
    if (evaluationResults.hasHardViolations) {
        messages.push('⚠️ HARD CONSTRAINT VIOLATIONS:');
        evaluationResults.hard.forEach(item => {
            if (item.result.violation) messages.push(`  • ${item.constraint.name}: ${item.result.message}`);
        });
    }
    
    if (evaluationResults.hasSoftViolations) {
        messages.push('ℹ️ SOFT CONSTRAINT ADVISORIES:');
        evaluationResults.soft.forEach(item => {
            if (item.result.violation) messages.push(`  • ${item.constraint.name}: ${item.result.message}`);
        });
    }
    
    if (messages.length === 0) messages.push('✓ All constraints satisfied.');
    return messages.join('\n');
}
