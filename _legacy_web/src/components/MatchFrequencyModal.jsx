import React, { useState, useMemo } from 'react';

const MatchFrequencyModal = ({ open, onClose, members = [], matches = [] }) => {
    const [tab, setTab] = useState(0);

    const { partnerMatrix, opponentMatrix, players } = useMemo(() => {
        // Sort players by name for consistent axis
        const sortedPlayers = [...members].sort((a, b) => a.firstName.localeCompare(b.firstName));

        const pMap = {};
        sortedPlayers.forEach(p => pMap[p.id] = 0); // Initialize index map

        const pMatrix = sortedPlayers.map(() => sortedPlayers.map(() => 0));
        const oMatrix = sortedPlayers.map(() => sortedPlayers.map(() => 0));

        // Helper to find index
        const getIndex = (id) => sortedPlayers.findIndex(p => p.id === id);

        matches.forEach(m => {
            const t1p1 = m.team1[0], t1p2 = m.team1[1];
            const t2p1 = m.team2[0], t2p2 = m.team2[1];

            const update = (matrix, id1, id2) => {
                const idx1 = getIndex(id1);
                const idx2 = getIndex(id2);
                if (idx1 !== -1 && idx2 !== -1) {
                    matrix[idx1][idx2]++;
                    matrix[idx2][idx1]++;
                }
            };

            // Partners
            update(pMatrix, t1p1, t1p2);
            update(pMatrix, t2p1, t2p2);

            // Opponents
            update(oMatrix, t1p1, t2p1);
            update(oMatrix, t1p1, t2p2);
            update(oMatrix, t1p2, t2p1);
            update(oMatrix, t1p2, t2p2);
        });

        return { partnerMatrix: pMatrix, opponentMatrix: oMatrix, players: sortedPlayers };
    }, [members, matches]);

    const getCellColor = (value, isPartner) => {
        if (value === 0) return 'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-300'; // 0
        if (value === 1) return 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-300'; // 1 (Ideal)
        if (value > 1) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-300'; // > 1 (Repeat)
        return 'text-gray-900 dark:text-gray-300';
    };

    if (!open) return null;

    const renderMatrix = (matrix, isPartner) => (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-xs sm:text-sm border-collapse">
                <thead>
                    <tr>
                        <th className="p-2 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold sticky left-0 z-10 w-32 border-r-2 border-r-gray-300 dark:border-r-gray-600">vs</th>
                        {players.map(p => (
                            <th key={p.id} className="p-2 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold min-w-[3rem] text-center">
                                {p.firstName}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {players.map((p1, rIdx) => (
                        <tr key={p1.id}>
                            <th className="p-2 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-left sticky left-0 z-10 whitespace-nowrap border-r-2 border-r-gray-300 dark:border-r-gray-600 w-32">
                                {p1.firstName} {p1.lastName.substring(0, 1)}.
                            </th>
                            {players.map((p2, cIdx) => {
                                if (rIdx === cIdx) {
                                    return <td key={p2.id} className="p-2 border border-gray-200 dark:border-gray-700 bg-gray-200 dark:bg-gray-800" />;
                                }
                                const val = matrix[rIdx][cIdx];
                                const colorClass = getCellColor(val, isPartner);
                                return (
                                    <td
                                        key={p2.id}
                                        className={`p-2 border border-gray-200 dark:border-gray-700 text-center font-medium ${colorClass}`}
                                    >
                                        {val}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-surface-light dark:bg-surface-dark w-full max-w-4xl rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-surface-light dark:bg-surface-dark bg-gray-50 dark:bg-gray-800/10">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        Match Analysis
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex flex-col flex-1 overflow-hidden p-6 gap-6">
                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 dark:border-gray-700">
                        <button
                            onClick={() => setTab(0)}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${tab === 0
                                ? 'border-primary text-primary'
                                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            Partner Frequency
                        </button>
                        <button
                            onClick={() => setTab(1)}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${tab === 1
                                ? 'border-primary text-primary'
                                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            Opponent Frequency
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {tab === 0 && (
                            <div className="space-y-4">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    <span className="font-bold text-green-600 dark:text-green-400">Green (1)</span>: Ideal. <span className="font-bold text-red-500 dark:text-red-400">Red (0)</span>: Never partnered. <span className="font-bold text-yellow-600 dark:text-yellow-400">Yellow ({'>'}1)</span>: Repeat partners.
                                </p>
                                {renderMatrix(partnerMatrix, true)}
                            </div>
                        )}

                        {tab === 1 && (
                            <div className="space-y-4">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    <span className="font-bold text-green-600 dark:text-green-400">Green (1+)</span>: Played against. <span className="font-bold text-red-500 dark:text-red-400">Red (0)</span>: Never played against.
                                </p>
                                {renderMatrix(opponentMatrix, false)}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MatchFrequencyModal;
