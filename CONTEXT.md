# Master Functional Specification & Source of Truth

## System Overview
The platform serves three primary functions: **League Management**, **Fantasy Betting**, and **CRM**. It is the central hub for managing pickleball communities, facilitating competitive play with betting mechanics, and handling user relationships within clubs.

## Core Player Features
1.  **Signup**: Users must be able to register and create a global profile.
2.  **Match Play**: Players participate in competitive round-robin or scheduled matches.
3.  **Betting Wallet**: Every player has a unified wallet for placing fantasy bets on matches. Balances must be tracked accurately and securely.
4.  **Global Rating**: A player's skill rating is universal. It updates based on match performance and follows the player across all clubs.

## Core Organizer Features
1.  **Scheduling**: Organizers plan and publish session schedules.
2.  **Session Management**: Organizers control active sessions, including managing the waitlist, processing substitutions, and finalizing sessions.
3.  **Live Scoring**: Organizers or designated scorers input scores in real-time to settle bets and update ratings immediately.

## The Algorithms
1.  **Smart Matchmaking**: The system must generate schedules that maximize fair play, minimize duplicate partnerships, and ensure diverse opponent matchups.
2.  **Oddsmaking**: The system must automatically calculate point spreads for every match based on the global ratings of the participating players to facilitate balanced betting.

## Data Architecture
**The Passport Model is strictly enforced:**

*   **Global Scope (The Passport)**:
    *   **Users**: Identity is singular and platform-wide.
    *   **Wallets**: A single financial balance travels with the user across all contexts.
    *   **Ratings**: Skill metrics are tied to the user, not the club.

*   **Local Scope (The Visa)**:
    *   **Club Memberships**: Users have not, and cannot have, global membership status. Status (e.g., Member, Admin, Guest) is strictly defined per club.
    *   **Permissions**: Administrative rights and feature access are granted only within the scope of a specific club.
    *   **Chat/Communication**: Messaging and social interactions are compartmentalized within the club instance; there is no global chat.
