import React, { useState, useEffect } from 'react';

const ScoreModal = ({ open, onClose, match, onSave, team1Name, team2Name }) => {
    const [team1Score, setTeam1Score] = useState('');
    const [team2Score, setTeam2Score] = useState('');

    useEffect(() => {
        if (match) {
            setTeam1Score(match.team1Score !== undefined ? match.team1Score : '');
            setTeam2Score(match.team2Score !== undefined ? match.team2Score : '');
        } else {
            setTeam1Score('');
            setTeam2Score('');
        }
    }, [match, open]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(match.id, parseInt(team1Score) || 0, parseInt(team2Score) || 0);
        onClose();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-surface-light dark:bg-surface-dark w-full max-w-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-surface-light dark:bg-surface-dark">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        Enter Score
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="flex flex-col">
                    <div className="p-6 space-y-6">
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200 w-1/2">
                                {team1Name}
                            </span>
                            <div className="w-1/2">
                                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Score</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={team1Score}
                                    onChange={(e) => setTeam1Score(e.target.value)}
                                    autoFocus
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-surface-light dark:bg-gray-900/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-center text-lg font-bold"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200 w-1/2">
                                {team2Name}
                            </span>
                            <div className="w-1/2">
                                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Score</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={team2Score}
                                    onChange={(e) => setTeam2Score(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-surface-light dark:bg-gray-900/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-center text-lg font-bold"
                                />
                            </div>
                        </div>
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
                            Save Score
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ScoreModal;
