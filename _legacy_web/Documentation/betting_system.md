# Betting System Documentation

This document outlines the logic behind the application's betting system, including spread calculation, bet types, and resolution rules.

## 1. Spread Calculation (The Oddsmaker)

Spreads are automatically calculated based on the difference in team skill ratings. The logic is defined in `src/services/Oddsmaker.js`.

### Formula
1.  **Calculate Team Ratings**: Average the `hiddenRating` of all players on each team.
2.  **Determine Difference**: `Diff = Team1Avg - Team2Avg`.
3.  **Apply Scaling**: We use a **Scaling Factor of 0.2**.
    *   This means **5 Rating Points = 1 Point Spread**.
    *   *Example*: If Team A is rated 38 and Team B is rated 33 (Diff: 5), Team A will be favored by -1.0.
4.  **Rounding**: Spreads are rounded to the nearest **0.5**.

### Definitions
*   **Favorite**: The team with the higher rating.
*   **Underdog**: The team with the lower rating.
*   **Pick 'em**: If ratings are equal (Spread = 0).

---

## 2. Placing Bets

Users place bets using virtual currency from their wallet.

*   **Stake**: The amount wagered.
*   **Odds**: Fixed at **1:1** (Even Money).
    *   Win: +100% (Double your money back).
    *   Push: Refund stake.
    *   Loss: Lose stake.

---

## 3. Bet Resolution Logic

Bets are resolved when a week is marked "Completed" or an Admin completes a specific week. The logic is in `src/services/BettingService.js`.

### Winning Conditions

#### A. Pick 'em (Spread 0)
*   **Win**: Your team wins match.
*   **Loss**: Your team loses match.
*   **Push**: Tie match (rare).

#### B. Spread Betting
Spreads are applied to the **Favorite's** score (subtracted) or added to the **Underdog's**.

**Scenario 1: You Bet on the Favorite (-X.X)**
*   **Win**: Your team wins by **more** than the spread.
    *   *Example (-2.5)*: Win 11-8 (Diff 3) -> **WIN**
*   **Push**: Your team wins by **exactly** the spread.
    *   *Example (-3.0)*: Win 11-8 (Diff 3) -> **PUSH**
*   **Loss**: Your team wins by less than spread, or loses.
    *   *Example (-4.5)*: Win 11-8 (Diff 3) -> **LOSS**

**Scenario 2: You Bet on the Underdog (+X.X)**
*   **Win**: Your team wins outright, OR loses by **less** than the spread.
    *   *Example (+4.5)*: Lose 8-11 (Diff -3) -> **WIN**
*   **Push**: Your team loses by **exactly** the spread.
*   **Loss**: Your team loses by **more** than the spread.

---

## 4. Refunds & Cancellations

### Unplayed Matches
If a match is never played (unscored) and the week is completed, all open bets on that match are **REFUNDED**.
*   The original stake is returned to the user's wallet.
*   Status is marked as `REFUNDED`.

### Pushes
If the outcome is a Push (tie after spread), the original stake is returned.
