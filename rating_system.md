# Hidden Rating System Documentation

The Pickleball Application uses an **Elo-based rating system** adapted for team sports (2v2) to calculate player ratings. This document outlines the specific algorithm, constants, and logic used in the `RatingEngine`.

## Core Logic

The rating update process follows these steps:

1.  **Calculate Team Averages**: The average rating of both players on a team is calculated to represent the "Team Rating".
2.  **Determine Expected Score**: Based on the difference between the two Team Ratings, we calculate the expected probability of winning.
3.  **Compare with Actual Score**: We compare the expected outcome with the actual match result (Win, Loss, or Draw).
4.  **Update Ratings**: Players gain or lose points based on the difference between the Actual and Expected scores.

## The Algorithm

### 1. Variables and Constants

*   **`hiddenRating`**: The player's skill rating. Defaults to **35.0** (equivalent to 3.5 DUPR) if not set.
*   **`K_FACTOR` = 4**: The maximum number of points a player's rating can change in a single match.
    *   *Note: This corresponds to a 0.04 movement in a 1.0-6.0 scale if we were displaying raw floats, but our internal scale is roughly x10.*
*   **`SCALE_FACTOR` = 40**: The rating difference that represents a 90% win probability.
    *   *Note: Standard Elo uses 400. We use 40 to accommodate our specific rating scale.*

### 2. Formulas

#### A. Team Average
```
TeamAvg = (Player1.Rating + Player2.Rating) / 2
```

#### B. Expected Score (Probability of Winning)
We use the standard logistic curve formula:
```
ExpectedScore_Team1 = 1 / (1 + 10 ^ ((Team2Avg - Team1Avg) / SCALE_FACTOR))
```
*   If Team 1 is rated significantly higher than Team 2, `ExpectedScore` approaches 1 (100% chance to win).
*   If teams are equal, `ExpectedScore` is 0.5 (50% chance).

#### C. Actual Score
*   **Win**: 1.0
*   **Loss**: 0.0
*   **Draw**: 0.5 (Not currently used in standard match flow)

#### D. Rating Change (Delta)
```
Change = K_FACTOR * (ActualScore - ExpectedScore)
```
*   **Upset Win**: If a lower-rated team beats a higher-rated team, `(Actual - Expected)` is large, resulting in a larger point gain.
*   **Expected Win**: If a higher-rated team wins as expected, `(Actual - Expected)` is small, resulting in a smaller point gain.

### 3. Application of Updates

*   **Team 1 Players**: `NewRating = OldRating + Change`
*   **Team 2 Players**: `NewRating = OldRating - Change`

*Note: Ratings are floored at 0 to prevent negative values.*

## Example Scenario

*   **Team 1**: Player A (35), Player B (35) -> **Avg: 35**
*   **Team 2**: Player C (38), Player D (38) -> **Avg: 38**
*   **Result**: Team 1 Wins (Upset)

1.  **Difference**: 38 - 35 = 3
2.  **Expected Score (T1)**: `1 / (1 + 10^(3/40))` ≈ 0.36 (36% chance to win)
3.  **Actual Score (T1)**: 1.0
4.  **Rating Change**: `4 * (1.0 - 0.36)` = `4 * 0.64` = **+2.56**

**Result**:
*   Team 1 Players gain **+2.56** points (New Rating: 37.56).
*   Team 2 Players lose **-2.56** points (New Rating: 35.44).
