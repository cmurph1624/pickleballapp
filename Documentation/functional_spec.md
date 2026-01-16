# Pickleball System Functional Specification

## 1. System Overview
This application is a comprehensive platform designed to manage pickleball clubs, leagues, and individual playing sessions. Beyond simple scheduling, it integrates a sophisticated "fantasy sports" style betting layer and a dynamic player rating system to enhance engagement and competitiveness.

## 2. Core Features for Players

### **Match Play & Participation**
*   **Session Signup**: Players can view upcoming sessions on their dashboard and join them.
*   **Waitlist Management**: If a session is full, players are automatically added to a waitlist and promoted if a spot opens up.
*   **Live Scorecards**: During a session, players can view their assigned court, partner, and opponents in real-time.
*   **Score Entry**: Players can record the scores of their own games directly through the app.

### **The Betting Exchange**
*   **Virtual Wallet**: Every player has a virtual wallet with play-money to wager on matches.
*   **Smart Odds**: The system automatically calculates "point spreads" for every match based on the historical performance of the players involved.
    *   *Example*: If a strong team plays a weaker team, the strong team might have to win by 5 points for a bet on them to pay out.
*   **Placing Bets**: Players can view all upcoming matches in a session and place bets on which team will cover the spread.
*   **Leaderboard ("High Rollers")**: A tracking system showing the wealthiest players in the league, adding a fun layer of meta-competition.

### **Profile & Statistics**
*   **Player Profiles**: Players claim their own profile to track their history.
*   **Performance Tracking**: The system tracks wins, losses, and point differentials.
*   **Dynamic Ratings**: A player's skill rating updates automatically after every session, similar to chess rankings or video game matchmaking.

## 3. Core Features for Organizers (Admins)

### **Automated Scheduling**
The system replaces manual spreadsheet work with a powerful "one-click" schedule generator.
*   **Social Mode**: Prioritizes mixing. The system ensures players rarely partner with the same person twice and play against a wide variety of opponents.
*   **Competitive Mode**: Prioritizes close games. The system groups players of similar skill levels together to ensure tight, competitive matches.
*   **Conflict Resolution**: Automatically handles "bye rounds" (players sitting out) when player counts aren't even.

### **Session Management**
*   **Live Control**: Admins can edit scores, substitute players mid-session, and recalculate odds if needed.
*   **Session Completion**: A "Complete Session" button that automatically:
    1.  Finalizes all scores.
    2.  Updates every player's skill rating.
    3.  Settles all active bets (paying out winners and updating wallets).

## 4. "The Magic" (How it Works)

### **Smart Matchmaking**
The system simulates thousands of possible schedule combinations in seconds to find the perfect balance. It looks for a schedule where:
1.  Partners stay fresh (no repeat partners).
2.  Opponents vary (you don't play the same team twice).
3.  Courts are utilized efficiently.

### **The Oddsmaker**
Instead of guessing who will win, the system uses math. By looking at the rating difference between Team A and Team B, it calculates a fair handicap. This keeps betting interesting even when a "Pro" team plays a "Rookie" team, as the spread levels the playing field.
