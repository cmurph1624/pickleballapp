import React, { useState, useEffect } from 'react';

const SubstitutePlayerModal = ({ open, onClose, onConfirm, sessionPlayers, allPlayers }) => {
    const [playerToRemove, setPlayerToRemove] = useState('');
    const [playerToAdd, setPlayerToAdd] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (open) {
            setPlayerToRemove('');
            setPlayerToAdd('');
            setSearchTerm('');
        }
    }, [open]);

    if (!open) return null;

    // Filter available players (exclude those already in the session)
    const availablePlayers = allPlayers.filter(
        p => !sessionPlayers.some(sp => sp.id === p.id) &&
            (p.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.lastName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleSubmit = () => {
        if (!playerToRemove || !playerToAdd) return;
        onConfirm(playerToRemove, playerToAdd);
    };

    const getPlayerName = (player) => `${player.firstName} ${player.lastName}`;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-surface-light dark:bg-surface-dark w-full max-w-lg rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-surface-light dark:bg-surface-dark">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">person_swap</span>
                        Swap Player
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto">
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200 flex items-start gap-2">
                            <span className="material-symbols-outlined text-lg mt-0.5">warning</span>
                            <span>
                                <strong>Warning:</strong> Substituting a player will settle all their active bets as a
                                <span className="font-bold text-red-600 dark:text-red-400"> LOSS</span>.
                                Opposing bets will be
                                <span className="font-bold text-green-600 dark:text-green-400"> REFUNDED</span>.
                            </span>
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Step 1: Remove */}
                        <div>
                            <label className="block text-sm font-bold text-red-600 dark:text-red-400 mb-2">
                                OUT (Remove)
                            </label>
                            <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl p-2">
                                {sessionPlayers.map(player => (
                                    <button
                                        key={player.id}
                                        onClick={() => setPlayerToRemove(player.id)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between group ${playerToRemove === player.id
                                            ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 ring-1 ring-red-500'
                                            : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                                            }`}
                                    >
                                        <span className="font-medium">{getPlayerName(player)}</span>
                                        {playerToRemove === player.id && (
                                            <span className="material-symbols-outlined text-red-500">remove_circle</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Step 2: Add */}
                        <div className="flex flex-col">
                            <label className="block text-sm font-bold text-green-600 dark:text-green-400 mb-2">
                                IN (Add)
                            </label>
                            <div className="mb-2">
                                <input
                                    type="text"
                                    placeholder="Search players..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/50"
                                />
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl p-2 flex-1">
                                {availablePlayers.length === 0 ? (
                                    <p className="text-xs text-gray-400 text-center py-4">No players found</p>
                                ) : (
                                    availablePlayers.map(player => (
                                        <button
                                            key={player.id}
                                            onClick={() => setPlayerToAdd(player.id)}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${playerToAdd === player.id
                                                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 ring-1 ring-green-500'
                                                : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                                                }`}
                                        >
                                            <span className="font-medium">{getPlayerName(player)}</span>
                                            {playerToAdd === player.id && (
                                                <span className="material-symbols-outlined text-green-500">add_circle</span>
                                            )}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!playerToRemove || !playerToAdd}
                        className="px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all"
                    >
                        Confirm Substitution
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SubstitutePlayerModal;
