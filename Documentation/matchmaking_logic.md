# Matchmaking Logic Documentation

The Pickleball Application uses a **Randomized Greedy Algorithm (Las Vegas style)** to generate game schedules. It supports two distinct modes to cater to different play styles: **Social Mixer** and **Competitive Mixer**.

## Modes Overview

### 1. Social Mixer (Default)
**Goal:** Maximize mixing. Players should assume they will play with and against as many different people as possible, regardless of skill level.

**Priority Hierarchy:**
1.  **Strict Partner Limit (Critical)**:
    *   **Logic**: Uses a **Greedy Group Builder** to ensure that groups of 4 have *zero* partner duplication if possible. Structural prevention of repeats is the primary rule.
2.  **Play Against Everyone (High)**:
    *   **Weight**: +5000 penalty per missed opponent.
3.  **Skill Balance (Tie-Breaker)**:
    *   **Weight**: Low (Linear variance).
    *   **Logic**: Only used to break ties between equally "mixed" schedules.

### 2. Competitive Mixer
**Goal:** Create the tightest, most competitive games possible. The system sacrifices social mixing to ensure skill gaps are minimized.

**Priority Hierarchy:**
1.  **Strict Partner Limit (Critical)**:
    *   **Logic**: Also uses the **Greedy Group Builder** to banning repeats.
2.  **Play Against Everyone (High)**:
    *   **Weight**: +5000 penalty per missed opponent.
3.  **Skill Balance (High)**:
    *   **Weight**: Squared variance (Exponential penalty for large gaps).

## The Algorithm

### Process
1.  **Input**: Players & Games Per Player.
2.  **Iteration**: The generator runs **2,000 simulations**.
3.  **Selection**: It returns the schedule with the lowest total Penalty Score.

### Candidate Selection (Competitive Mode)
To enforce the **Strict Partner Limit**, the competitive mode uses a **Greedy Group Builder**:
1.  It selects a primary player (P1) who needs games.
2.  It searches for P2, P3, and P4 such that:
    *   None of them have played with P1.
    *   **AND** none of them have played with **each other** in this session.
3.  This ensures that the group of 4 players selected for a match are complete strangers (partner-wise) to each other, structural preventing repeat "triangles".
4.  If multiple valid groups exist, it picks the one with the closest skill ranking to P1.
