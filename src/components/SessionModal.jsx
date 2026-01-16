import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, updateDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';

const SessionModal = ({ open, onClose, session, league, clubId }) => {
    const [formData, setFormData] = useState({
        name: '',
        players: [],
        gamesPerPlayer: '',
        bettingDeadline: '',
        scheduledDate: '',
        courtCount: '',
        courtNames: '',

        playerLimit: '',
        waitlist: []
    });
    const [leaguePlayers, setLeaguePlayers] = useState([]);

    // Fetch all players to map IDs to names, but only show league players
    useEffect(() => {
        // If we have a league, use its players (or all if Open Play)
        // If we DON'T have a league, we imply it's a "Pickup Session" -> Show ALL club players

        const q = query(collection(db, 'players'), orderBy('firstName'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            let playersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (league && league.type !== 'Open Play') {
                if (!league.players || league.players.length === 0) {
                    playersData = [];
                } else {
                    playersData = playersData.filter(p => league.players.includes(p.id));
                }
            }
            // If league is Open Play OR league is null (Pickup), we use all players (no filter)

            setLeaguePlayers(playersData);
        });
        return () => unsubscribe();
    }, [league, open]);

    useEffect(() => {
        if (session) {
            setFormData({
                name: session.name,
                players: session.players || [],
                gamesPerPlayer: session.gamesPerPlayer || '',
                bettingDeadline: session.bettingDeadline || '',
                scheduledDate: session.scheduledDate || '',
                courtCount: session.courts ? session.courts.length : '',
                courtNames: session.courts ? session.courts.join(', ') : '',
                playerLimit: session.playerLimit || '',
                waitlist: session.waitlist || []
            });
        } else {
            setFormData({
                name: '',
                players: [],
                gamesPerPlayer: '',
                bettingDeadline: '',
                scheduledDate: '',
                courtCount: '',
                courtNames: '',
                playerLimit: '',
                waitlist: []
            });
        }
    }, [session, open]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePlayerToggle = (playerId) => {
        setFormData(prev => {
            const currentPlayers = prev.players;
            const currentWaitlist = prev.waitlist || [];

            if (currentPlayers.includes(playerId)) {
                // REMOVING A PLAYER
                let newPlayers = currentPlayers.filter(id => id !== playerId);
                let newWaitlist = [...currentWaitlist];

                // Auto-promote from waitlist if available (filling the spot)
                if (newWaitlist.length > 0) {
                    const promotedPlayerId = newWaitlist.shift(); // Take first from waitlist
                    newPlayers.push(promotedPlayerId); // Add to players
                    // Optional: Could set a temp status to highlight this change, but reacting purely on data for now.
                }

                return { ...prev, players: newPlayers, waitlist: newWaitlist };
            } else {
                // ADDING A PLAYER
                // If adding, ensure they are removed from waitlist (prevent duplicates)
                let newWaitlist = currentWaitlist.filter(id => id !== playerId);
                return { ...prev, players: [...currentPlayers, playerId], waitlist: newWaitlist };
            }
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Generate courts array
        let courts = [];
        const count = parseInt(formData.courtCount) || 0;

        if (count > 0) {
            // Parse provided names
            const providedNames = formData.courtNames
                ? formData.courtNames.split(',').map(s => s.trim()).filter(s => s !== '')
                : [];

            // Fill array
            for (let i = 0; i < count; i++) {
                if (i < providedNames.length) {
                    courts.push(providedNames[i]);
                } else {
                    // Default naming: Court 1, Court 2...
                    courts.push(`Court ${i + 1}`);
                }
            }
        }

        // Ensure players are not on the waitlist (Consistency Check is now handled in toggle, but safe to keep final filter if needed)
        // However, since we now manage waitlist state locally with promotions, we should trust formData.waitlist

        const data = {
            name: formData.name,
            players: formData.players,
            gamesPerPlayer: parseInt(formData.gamesPerPlayer) || 0,
            bettingDeadline: formData.bettingDeadline,
            scheduledDate: formData.scheduledDate,
            courts: courts,
            playerLimit: parseInt(formData.playerLimit) || 0,
            waitlist: formData.waitlist,
            updatedAt: new Date()
        };

        // If league exists, link it. If not, treat as standalone (link to club).
        // Always link to club
        data.clubId = clubId;

        // If league exists, link it.
        if (league) {
            data.leagueId = league.id;
        } else {
            data.leagueId = null;
        }

        try {
            if (session) {
                // Detect Promoted Players
                const originalWaitlist = session.waitlist || [];
                const newPlayers = data.players || [];

                // Find players who were in original waitlist AND are now in new players list
                const promotedPlayers = originalWaitlist.filter(id => newPlayers.includes(id));

                if (promotedPlayers.length > 0) {
                    // Send notifications
                    const notificationPromises = promotedPlayers.map(playerId => {
                        const playerDoc = leaguePlayers.find(p => p.id === playerId);
                        const targetUserId = playerDoc ? (playerDoc.linkedUserId || playerId) : playerId;

                        return addDoc(collection(db, 'notifications'), {
                            userId: targetUserId,
                            message: `You have been promoted from the waitlist for session ${data.name || 'your session'} on ${data.scheduledDate ? new Date(data.scheduledDate).toLocaleDateString() : 'scheduled date'}!`,
                            type: 'success',
                            read: false,
                            timestamp: new Date().toISOString()
                        });
                    });
                    await Promise.all(notificationPromises);
                }

                await updateDoc(doc(db, 'sessions', session.id), data);
            } else {
                data.createdAt = new Date();
                data.createdBy = auth.currentUser ? auth.currentUser.uid : 'anonymous';
                await addDoc(collection(db, 'sessions'), data);
            }
            onClose();
        } catch (error) {
            console.error("Error saving session:", error);
            alert("Error saving session: " + error.message);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-surface-light dark:bg-surface-dark w-full max-w-2xl rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-surface-light dark:bg-surface-dark">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {session ? 'Edit Session' : 'Add Session'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Session Name */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Session Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="name"
                                required
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="e.g. Session 1"
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-surface-light dark:bg-gray-900/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                            />
                        </div>

                        {/* Court Details */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Number of Courts
                                </label>
                                <input
                                    type="number"
                                    name="courtCount"
                                    min="0"
                                    value={formData.courtCount}
                                    onChange={handleChange}
                                    placeholder="e.g. 3"
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-surface-light dark:bg-gray-900/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Court Names <span className="text-xs text-gray-500 font-normal">(Optional, comma separated)</span>
                                </label>
                                <input
                                    type="text"
                                    name="courtNames"
                                    value={formData.courtNames}
                                    onChange={handleChange}
                                    placeholder="e.g. Center, East, West (Defaults to 1, 2, 3...)"
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-surface-light dark:bg-gray-900/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                />
                            </div>
                        </div>

                        {/* Number of Rounds */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Number of Rounds
                            </label>
                            <input
                                type="number"
                                name="gamesPerPlayer"
                                min="0"
                                value={formData.gamesPerPlayer}
                                onChange={handleChange}
                                placeholder="e.g. 4"
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-surface-light dark:bg-gray-900/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {formData.players.length < 4
                                    ? "Select at least 4 players"
                                    : formData.players.length === 4
                                        ? "Recommended: 3 rounds (Round Robin)"
                                        : formData.players.length === 5
                                            ? "Recommended: 5 rounds (Everyone sits once)"
                                            : formData.players.length < 9
                                                ? `Recommended: ${formData.players.length % 2 === 0 ? formData.players.length - 1 : formData.players.length} rounds for full rotation`
                                                : "Recommended: 4-6 rounds for a typical session"
                                }
                            </p>
                        </div>



                        {/* Player Limit */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Player Limit <span className="text-xs text-gray-500 font-normal">(0 or empty for unlimited)</span>
                            </label>
                            <input
                                type="number"
                                name="playerLimit"
                                min="0"
                                value={formData.playerLimit}
                                onChange={handleChange}
                                placeholder="e.g. 12"
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-surface-light dark:bg-gray-900/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                            />
                        </div>

                        {/* Dates Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Betting Deadline
                                </label>
                                <input
                                    type="datetime-local"
                                    name="bettingDeadline"
                                    value={formData.bettingDeadline}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-surface-light dark:bg-gray-900/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all [color-scheme:light] dark:[color-scheme:dark]"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Bets will be locked after this time
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Scheduled Date
                                </label>
                                <input
                                    type="datetime-local"
                                    name="scheduledDate"
                                    value={formData.scheduledDate}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-surface-light dark:bg-gray-900/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all [color-scheme:light] dark:[color-scheme:dark]"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    When this session's games are played
                                </p>
                            </div>
                        </div>

                        {/* Player Selection */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Select Players
                                </label>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {formData.players.length} of {leaguePlayers.length} selected
                                </span>
                            </div>

                            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800/50 max-h-[200px] overflow-y-auto">
                                {leaguePlayers.length === 0 ? (
                                    <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                                        No players in this league.
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                        {leaguePlayers.map(player => (
                                            <label
                                                key={player.id}
                                                className="flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={formData.players.includes(player.id)}
                                                    onChange={() => handlePlayerToggle(player.id)}
                                                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                />
                                                <span className="text-sm text-gray-700 dark:text-gray-200">
                                                    {player.firstName} {player.lastName}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Waitlist Display (Read Only) */}
                        {formData.waitlist && formData.waitlist.length > 0 && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Current Waitlist <span className="text-xs text-gray-500 font-normal">(Ordered by Priority)</span>
                                </label>
                                <div className="border border-orange-200 dark:border-orange-900/50 rounded-lg overflow-hidden bg-orange-50 dark:bg-orange-900/20">
                                    <div className="divide-y divide-orange-200 dark:divide-orange-900/50">
                                        {formData.waitlist.map((playerId, index) => {
                                            const player = leaguePlayers.find(p => p.id === playerId);
                                            return (
                                                <div key={playerId} className="flex items-center gap-3 p-3">
                                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-800 text-orange-700 dark:text-orange-200 text-xs font-bold">
                                                        {index + 1}
                                                    </span>
                                                    <span className="text-sm text-gray-700 dark:text-gray-200">
                                                        {player ? `${player.firstName} ${player.lastName}` : 'Unknown Player'}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/50">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-lg shadow-sm shadow-primary/20 transition-all transform active:scale-95"
                        >
                            Save Session
                        </button>
                    </div>
                </form>
            </div >
        </div >
    );
};

export default SessionModal;
