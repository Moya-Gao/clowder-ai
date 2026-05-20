# Harness Eval Observation Model (F208/F192)

> **Authority**: F192 Socio-Technical Eval
> **Implementation**: F208 Control Plane

## 1. The Observation Unit
Unlike traditional APM that looks at single spans (tool calls), Harness Eval observes **Thread Segments**.

- **Thread Segment**: The sequence of events between two "Stable States" (e.g., from User Message A to User Message B, or from Kickoff to Merge).
- **Contextual Integrity**: A tool call like `hold_ball` is only successful if it *actually* waits for the condition and is woken up, WITHOUT the user having to manually ping the agent.

## 2. User Compensation Behaviors (The "Friction" Metric)
We detect these patterns in the thread history:

### 2.1 Harness Gap (能力缺口)
- **Pattern**: Harness was inactive, but User performed the action manually.
- **Example**: `hold_ball` was not called, but User waited 5 mins and then asked "is it done?".
- **Signal**: Need to automate/suggest this unit more aggressively.

### 2.2 Trust Gap (信任缺口)
- **Pattern**: Harness was active, but User overrode or canceled it.
- **Example**: Cat called `hold_ball`, but User canceled it immediately and @mentioned the cat again.
- **Signal**: Harness behavior is confusing or unreliable; needs "why" explanation (Feedback).

### 2.3 Both Spinning (协同空转)
- **Pattern**: Harness is active, but no progress is made across multiple turns.
- **Example**: `hold_ball` keeps timing out and re-triggering with no external signal change.
- **Signal**: Governance should "degrade" or "sunset" the rule if it's ineffective.

## 3. Aggregation & Time Windows
- **Real-time**: L1 In-context alerts for immediate failures.
- **Hourly**: L2 Entity status dots (Health Score).
- **Daily/Weekly**: L3 Governance review (Upgrade/Sunset candidates).
