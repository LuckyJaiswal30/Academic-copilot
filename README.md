# Academic Copilot

## Project Overview

Academic Copilot is a rule-based academic decision support system that helps students make better prioritization and workload allocation decisions. The system structures academic context, applies transparent rule-based logic, highlights trade-offs and risks, and provides feedback through execution tracking. It is designed as a human-in-the-loop decision support tool, not an automated planner or AI chatbot.

## Why This Project Exists

Students often struggle with academic prioritization and workload estimation. This system addresses decision quality rather than task tracking. It helps students understand why certain subjects should receive more attention, what risks exist in their current plan, and how their execution patterns compare to their intentions. The goal is to improve decision-making through structured analysis and explainable recommendations.

## Core System Design

The system operates through several independent engines that work together:

- **Decision Logic**: Policy-driven priority scoring in `policies.js`. Multiple decision policies (Balanced, Exam-Focused, Risk-Averse, Execution-Aware) apply different weight configurations to subject attributes. Priority calculation is separated from risk assessment.

- **Risk Assessment**: Independent risk evaluation in `riskEngine.js`. Risk factors (difficulty, interest, execution history, planning deviation) are calculated separately from priority scores. Risk levels (Low/Medium/High) are determined through rule-based thresholds.

- **Constraint Validation**: Hard and soft constraint checking in `constraints.js`. Hard constraints (total hours, individual capacity) must be satisfied. Soft constraints (interest alignment, workload balance) provide advisory feedback.

- **Feedback Generation**: Execution comparison and pattern detection in `insightsEngine.js`. The system compares planned vs actual study hours across three maturity levels: raw comparison, pattern detection (2+ weeks), and behavioral signal detection (3+ weeks).

- **Confidence Modeling**: Uncertainty assessment in `confidenceEngine.js`. Recommendations include confidence levels (High/Medium/Low) based on data availability, execution stability, and input consistency.

- **Trend Analysis**: Temporal pattern detection in `trendAnalysis.js`. Tracks planning accuracy trends, priority volatility, and burnout indicators over time.

- **Scenario Simulation**: What-if analysis in `scenarioEngine.js`. Allows users to simulate dropping subjects, modifying hours, or changing policies without committing to changes.

## Folder Responsibility

- `policies.js` – Decision policies and weight configuration strategies
- `riskEngine.js` – Independent risk evaluation logic
- `constraints.js` – Workload and time constraint validation
- `confidenceEngine.js` – Recommendation confidence and uncertainty modeling
- `trendAnalysis.js` – Temporal pattern and trend detection
- `insightsEngine.js` – Reflection and feedback generation with maturity levels
- `scenarioEngine.js` – Scenario simulation and what-if analysis
- `script.js` – Core application logic, data management, and UI coordination
- `index.html` – User interface structure
- `styles.css` – Fluent UI styling

## Limitations

- Rule-based logic: All calculations use deterministic formulas, not machine learning models
- Single-user: Data stored locally in browser localStorage, no multi-user support
- Manual inputs: Subject attributes (difficulty, interest, hours) require manual entry
- No predictive modeling: System analyzes historical patterns but does not predict future outcomes
- No LMS integration: Course data must be entered manually

## Future Direction

- Adaptive decision policies that learn from user execution patterns
- Multi-user support with backend data persistence
- Advanced analytics with predictive capacity modeling
