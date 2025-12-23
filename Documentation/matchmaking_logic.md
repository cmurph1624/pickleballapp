# Matchmaking Logic Documentation

The Pickleball Application uses a **randomized greedy algorithm (Las Vegas style)** to generate game schedules for a week. The goal is to create fair, varied, and inclusive matchups for all players.

## Core Core Philosophy

The matchmaking engine generates *thousands* of possible schedules and selects the one that best satisfies a hierarchy of constraints. The "score" of a schedule represents its quality (lower is better).

### 1. Hierarchy of Constraints

The algorithm prioritizes rules in the following strict order:

#### Priority 1: Play Against Everyone (Hard Constraint)
*   **Rule**: Every player must play against every other player at least once, if mathematically possible.
*   **Implementation**:
    *   Any schedule where a player completely misses an opponent receives a **massive penalty (+5000 points per miss)**.
    *   This ensures that any valid schedule (where everyone plays everyone) will *always* be chosen over an invalid one.
    *   The match picker is heavily incentivized via a bonus (-500 points) to select matchups between players who haven't faced each other yet.

#### Priority 2: Partner With Everyone (Strong Preference)
*   **Rule**: Players should have as many unique partners as possible. Ideally, everyone partners with everyone else exactly once.
*   **Implementation**:
    *   The system measures the "variance" of partner counts. A perfectly flat distribution (everyone partners once) has the lowest score.
    *   Uneven distributions (partnering with the same person twice while ignoring someone else) are penalized with a **x10 weight multiplier**.
    *   Note: While the system tries its hardest to achieve this, it is strictly secondary to Priority 1.

#### Priority 3: Minimize Repeat Matchups (Soft Constraint)
*   **Rule**: Avoid repeating the exact same matchups (same partners vs same opponents).
*   **Implementation**:
    *   Repeat partners in a single match add a small penalty (+50 points).
    *   Repeat opponents add a smaller penalty (+5 points).

## The Algorithm

### Process
1.  **Generate Candidate Schedule**: The system builds a schedule game-by-game.
2.  **Greedy Selection**: For each game slot, it picks 4 players who haven't played their full quota yet.
3.  **Optimize Match**: It tests all 3 permutations of partners among those 4 players and picks the one with the best local score (prioritizing new opponents and new partners).
4.  **Evaluate Full Schedule**: Once all games are generated, the *entire* schedule is scored based on the global constraints (Did everyone play everyone? Are partners even?).
5.  **Iterate**: This process is repeated **2,000 times**.
6.  **Select Best**: The schedule with the lowest total score (Total Variance + Penalties) is returned.

### Mathematics of Constraints
It is important to note the mathematical difference between "Partnering" and "Opposing":
*   **Opponents**: You play against 2 people per game. With 4 games, you have 8 opponent slots. This makes it mathematically easier to play against 7 other people.
*   **Partners**: You only have 1 partner per game. With 4 games, you have 4 partner slots. It is often mathematically impossible to partner with everyone (e.g., 8 players) in a standard session.

The algorithm handles this by treating "Opponents" as a hard pass/fail rule (since it's usually possible), and "Partners" as a "do your best" optimization problem.
