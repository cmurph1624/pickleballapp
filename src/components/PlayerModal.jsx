import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';

const PlayerModal = ({ open, onClose, player }) => {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        gender: 'Male',
        duprDoubles: '',
        duprSingles: '',
        linkedUserEmail: ''
    });

    useEffect(() => {
        if (player) {
            setFormData({
                firstName: player.firstName,
                lastName: player.lastName,
                gender: player.gender,
                duprDoubles: player.duprDoubles || '',
                duprSingles: player.duprSingles || '',
                linkedUserEmail: player.linkedUserEmail || ''
            });
        } else {
            setFormData({
                firstName: '',
                lastName: '',
                gender: 'Male',
                duprDoubles: '',
                duprSingles: '',
                linkedUserEmail: ''
            });
        }
    }, [player, open]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const data = {
            firstName: formData.firstName,
            lastName: formData.lastName,
            gender: formData.gender,
            duprDoubles: parseFloat(formData.duprDoubles) || null,
            duprSingles: parseFloat(formData.duprSingles) || null,
            linkedUserEmail: formData.linkedUserEmail ? formData.linkedUserEmail.trim().toLowerCase() : null,
            updatedAt: new Date()
        };

        // If linking a user, try to find them
        if (data.linkedUserEmail) {
            const searchEmail = data.linkedUserEmail;
            const q = query(collection(db, 'users'), where('email', '==', searchEmail));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const userDoc = querySnapshot.docs[0];
                data.linkedUserId = userDoc.id;
            } else {
                alert(`Warning: No user found with email "${data.linkedUserEmail}". The email will be saved on the player profile, but no system link was created. The user must sign up/log in first.`);
            }
        }

        try {
            if (player) {
                await updateDoc(doc(db, 'players', player.id), data);
            } else {
                data.createdAt = new Date();
                data.createdBy = auth.currentUser ? auth.currentUser.uid : 'anonymous';
                // Initialize hiddenRating based on DUPR (e.g. 3.5 -> 35)
                const dupr = data.duprDoubles || 3.5;
                data.hiddenRating = dupr * 10;
                await addDoc(collection(db, 'players'), data);
            }
            onClose();
        } catch (error) {
            console.error("Error saving player:", error);
            alert("Error saving player: " + error.message);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-surface-light dark:bg-surface-dark w-full max-w-lg rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {player ? 'Edit Player' : 'Add Player'}
                    </h2>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">First Name</label>
                            <input
                                type="text"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                required
                                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Last Name</label>
                            <input
                                type="text"
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                required
                                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Gender</label>
                        <select
                            name="gender"
                            value={formData.gender}
                            onChange={handleChange}
                            required
                            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                        >
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">DUPR Doubles</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="8.0"
                                name="duprDoubles"
                                value={formData.duprDoubles}
                                onChange={handleChange}
                                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">DUPR Singles</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="8.0"
                                name="duprSingles"
                                value={formData.duprSingles}
                                onChange={handleChange}
                                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Linked User Email</label>
                        <input
                            type="email"
                            name="linkedUserEmail"
                            value={formData.linkedUserEmail}
                            onChange={handleChange}
                            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                            placeholder="user@example.com"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400">Enter the email address this player uses to sign in, if applicable.</p>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary-dark rounded-lg shadow-sm active:scale-95 transition-all"
                        >
                            Save Player
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PlayerModal;
