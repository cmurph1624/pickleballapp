import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC3lrm_BdW7-SlQyPaf6Yrnogm867fleVU",
  authDomain: "pickleball-268d5.firebaseapp.com",
  projectId: "pickleball-268d5",
  storageBucket: "pickleball-268d5.firebasestorage.app",
  messagingSenderId: "323222852358",
  appId: "1:323222852358:web:bbf762c7d6df0057340487",
  measurementId: "G-WNVV13W3C9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userInfo = document.getElementById('user-info');
const userPhoto = document.getElementById('user-photo');
const userName = document.getElementById('user-name');

// Navigation
const navLeagues = document.getElementById('nav-leagues');
const navPlayers = document.getElementById('nav-players');
const leaguesSection = document.getElementById('leagues-section');
const playersSection = document.getElementById('players-section');

console.log("DOM Elements Check:", {
  navLeagues: !!navLeagues,
  navPlayers: !!navPlayers,
  leaguesSection: !!leaguesSection,
  playersSection: !!playersSection
});

if (!navLeagues || !navPlayers) {
  console.error("CRITICAL: Navigation buttons not found!");
}

// Leagues UI
const leagueList = document.getElementById('league-list');
const addLeagueBtn = document.getElementById('add-league-btn');
const leagueModal = document.getElementById('league-modal');
const leagueForm = document.getElementById('league-form');
const cancelLeagueBtn = document.getElementById('cancel-league-btn');

// Players UI
const playerList = document.getElementById('player-list');
const addPlayerBtn = document.getElementById('add-player-btn');
const playerModal = document.getElementById('player-modal');
const playerForm = document.getElementById('player-form');
const cancelPlayerBtn = document.getElementById('cancel-player-btn');
const modalTitle = document.getElementById('modal-title');

// Navigation Logic
navLeagues.addEventListener('click', () => {
  console.log("Navigating to Leagues");
  navLeagues.classList.add('active');
  navPlayers.classList.remove('active');
  leaguesSection.hidden = false;
  playersSection.hidden = true;
});

navPlayers.addEventListener('click', () => {
  console.log("Navigating to Players");
  navPlayers.classList.add('active');
  navLeagues.classList.remove('active');
  playersSection.hidden = false;
  leaguesSection.hidden = true;
});

// League Modal Logic
const openLeagueModal = (league = null) => {
  leagueModal.hidden = false;
  leagueForm.reset();
  document.getElementById('date-error').hidden = true;
  document.getElementById('name-error').hidden = true;
  document.getElementById('save-league-btn').disabled = false;

  const selectedPlayers = league ? (league.players || []) : [];
  renderLeaguePlayerSelection(selectedPlayers);

  if (league) {
    document.getElementById('league-modal-title').textContent = "Edit League";
    document.getElementById('league-id').value = league.id;
    document.getElementById('league-name').value = league.name;
    document.getElementById('start-date').value = league.startDate;
    document.getElementById('end-date').value = league.endDate;
    document.getElementById('league-type').value = league.type;
  } else {
    document.getElementById('league-modal-title').textContent = "Create League";
    document.getElementById('league-id').value = '';
  }
};

const renderLeaguePlayerSelection = (selectedIds = []) => {
  const container = document.getElementById('league-players-list');
  container.innerHTML = '';

  if (allPlayers.length === 0) {
    container.innerHTML = '<p style="padding: 0.5rem; color: #666;">No players available.</p>';
    return;
  }

  allPlayers.forEach(player => {
    const div = document.createElement('div');
    div.className = 'checkbox-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `player-${player.id}`;
    checkbox.value = player.id;
    checkbox.name = 'league-player';
    if (selectedIds.includes(player.id)) {
      checkbox.checked = true;
    }

    const label = document.createElement('label');
    label.htmlFor = `player-${player.id}`;
    label.textContent = `${player.firstName} ${player.lastName}`;

    div.appendChild(checkbox);
    div.appendChild(label);
    container.appendChild(div);
  });
};

const closeLeagueModal = () => {
  leagueModal.hidden = true;
  leagueForm.reset();
  document.getElementById('date-error').hidden = true;
  document.getElementById('name-error').hidden = true;
  document.getElementById('save-league-btn').disabled = false;
};

addLeagueBtn.addEventListener('click', () => openLeagueModal());
cancelLeagueBtn.addEventListener('click', closeLeagueModal);

// Validation Logic
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const dateError = document.getElementById('date-error');
const leagueNameInput = document.getElementById('league-name');
const nameError = document.getElementById('name-error');
const saveLeagueBtn = document.getElementById('save-league-btn');

const updateSaveButtonState = () => {
  const isDateInvalid = !dateError.hidden;
  const isNameInvalid = !nameError.hidden;
  saveLeagueBtn.disabled = isDateInvalid || isNameInvalid;
};

const validateDates = () => {
  const start = startDateInput.value;
  const end = endDateInput.value;

  if (start && end && new Date(end) < new Date(start)) {
    dateError.hidden = false;
  } else {
    dateError.hidden = true;
  }
  updateSaveButtonState();
};

const validateLeagueName = async () => {
  const name = leagueNameInput.value.trim();
  if (!name) {
    nameError.hidden = true;
    updateSaveButtonState();
    return;
  }

  // Check if name exists in Firestore
  const q = query(leaguesCollection, where("name", "==", name));
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    nameError.hidden = false;
  } else {
    nameError.hidden = true;
  }
  updateSaveButtonState();
};

startDateInput.addEventListener('input', validateDates);
endDateInput.addEventListener('input', validateDates);
leagueNameInput.addEventListener('blur', validateLeagueName);
leagueNameInput.addEventListener('input', () => {
  // Optional: Clear error while typing to be nicer? 
  // For now, let's stick to the requested "blur" behavior strictly, 
  // but maybe hide error if they change it?
  // User asked for validation on click off (blur). 
  // Let's keep it simple.
  if (!nameError.hidden) {
    nameError.hidden = true;
    updateSaveButtonState();
  }
});

// League CRUD Logic
const leaguesCollection = collection(db, 'leagues');

// Create / Update League
leagueForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Final check before submit
  if (saveLeagueBtn.disabled) return;

  const id = document.getElementById('league-id').value;
  const startDate = startDateInput.value;
  const endDate = endDateInput.value;

  // Get selected players
  const selectedPlayers = Array.from(document.querySelectorAll('input[name="league-player"]:checked'))
    .map(cb => cb.value);

  const data = {
    name: document.getElementById('league-name').value,
    startDate: startDate,
    endDate: endDate,
    type: document.getElementById('league-type').value,
    players: selectedPlayers,
    updatedAt: new Date()
  };

  try {
    if (id) {
      // Update
      await updateDoc(doc(db, 'leagues', id), data);
    } else {
      // Create
      data.createdAt = new Date();
      data.createdBy = auth.currentUser ? auth.currentUser.uid : 'anonymous';
      await addDoc(leaguesCollection, data);
    }
    closeLeagueModal();
  } catch (error) {
    console.error("Error saving league:", error);
    alert("Error saving league: " + error.message);
  }
});

// Delete Modal Logic
const deleteModal = document.getElementById('delete-modal');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const deleteMessage = deleteModal.querySelector('p'); // Get the paragraph to update text
let deleteTargetId = null;
let deleteTargetType = null; // 'league' or 'week'

const openDeleteModal = (id, type = 'league') => {
  deleteTargetId = id;
  deleteTargetType = type;

  if (type === 'league') {
    deleteMessage.textContent = "Are you sure you want to delete this league? This action cannot be undone.";
  } else if (type === 'week') {
    deleteMessage.textContent = "Are you sure you want to delete this week? This action cannot be undone.";
  }

  deleteModal.hidden = false;
};

const closeDeleteModal = () => {
  deleteTargetId = null;
  deleteTargetType = null;
  deleteModal.hidden = true;
};

cancelDeleteBtn.addEventListener('click', closeDeleteModal);

confirmDeleteBtn.addEventListener('click', async () => {
  if (deleteTargetId && deleteTargetType) {
    try {
      const collectionName = deleteTargetType === 'league' ? 'leagues' : 'weeks';
      await deleteDoc(doc(db, collectionName, deleteTargetId));
      closeDeleteModal();
    } catch (error) {
      console.error(`Error deleting ${deleteTargetType}:`, error);
      alert(`Error deleting ${deleteTargetType}: ` + error.message);
    }
  }
});

// List Leagues (Real-time)
const leaguesQuery = query(leaguesCollection, orderBy('startDate', 'desc'));
onSnapshot(leaguesQuery, (snapshot) => {
  leagueList.innerHTML = '';
  snapshot.forEach((leagueDoc) => {
    const league = { id: leagueDoc.id, ...leagueDoc.data() };
    const li = document.createElement('li');
    li.className = 'player-item'; // Reusing player-item style
    li.innerHTML = `
            <div class="player-info">
                <h3>${league.name}</h3>
                <div class="player-stats">
                    ${league.type} | ${league.startDate} to ${league.endDate}
                </div>
                <div class="player-stats" style="font-size: 0.8rem; margin-top: 0.25rem;">
                    ${league.players ? league.players.length : 0} Players
                </div>
            </div>
            <div class="player-actions">
                <button class="edit-btn">Edit</button>
                <button class="delete-btn">Delete</button>
            </div>
        `;

    // Attach event listeners
    li.querySelector('.edit-btn').addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent triggering viewLeague
      openLeagueModal(league);
    });
    li.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent triggering viewLeague
      openDeleteModal(league.id, 'league');
    });

    // Make the whole item clickable to view details
    li.addEventListener('click', () => viewLeague(league));
    li.style.cursor = 'pointer';

    leagueList.appendChild(li);
  });
});

// --- Weeks Logic ---

const leagueDetailsSection = document.getElementById('league-details-section');
const leagueDetailsTitle = document.getElementById('league-details-title');
const backToLeaguesBtn = document.getElementById('back-to-leagues-btn');
const weekList = document.getElementById('week-list');
const addWeekBtn = document.getElementById('add-week-btn');
const weekModal = document.getElementById('week-modal');
const weekForm = document.getElementById('week-form');
const cancelWeekBtn = document.getElementById('cancel-week-btn');

let currentLeague = null;
let weeksUnsubscribe = null;

const viewLeague = (league) => {
  currentLeague = league;
  leagueDetailsTitle.textContent = league.name;

  // Navigation
  leaguesSection.hidden = true;
  playersSection.hidden = true;
  leagueDetailsSection.hidden = false;
  navLeagues.classList.remove('active'); // Optional: visual cue

  // Fetch Weeks
  const weeksCollection = collection(db, 'weeks');
  // Removing orderBy to avoid needing a composite index for now
  const q = query(weeksCollection, where('leagueId', '==', league.id));

  if (weeksUnsubscribe) weeksUnsubscribe(); // Unsubscribe previous listener

  weeksUnsubscribe = onSnapshot(q, (snapshot) => {
    weekList.innerHTML = '';
    const weeks = [];
    snapshot.forEach((weekDoc) => {
      weeks.push({ id: weekDoc.id, ...weekDoc.data() });
    });

    // Sort in memory
    weeks.sort((a, b) => a.createdAt - b.createdAt);

    weeks.forEach((week) => {
      const li = document.createElement('li');
      li.className = 'player-item';
      li.innerHTML = `
                <div class="player-info">
                    <h3>${week.name}</h3>
                    <div class="player-stats">
                        ${week.players ? week.players.length : 0} Players
                    </div>
                </div>
                <div class="player-actions">
                    <button class="edit-btn">Edit</button>
                    <button class="delete-btn">Delete</button>
                </div>
            `;

      li.querySelector('.edit-btn').addEventListener('click', () => openWeekModal(week));
      li.querySelector('.delete-btn').addEventListener('click', () => openDeleteModal(week.id, 'week'));

      weekList.appendChild(li);
    });
  });
};

backToLeaguesBtn.addEventListener('click', () => {
  leagueDetailsSection.hidden = true;
  leaguesSection.hidden = false;
  navLeagues.classList.add('active');
  currentLeague = null;
  if (weeksUnsubscribe) weeksUnsubscribe();
});

// Week Modal
const openWeekModal = (week = null) => {
  if (!currentLeague) return;

  weekModal.hidden = false;
  weekForm.reset();
  document.getElementById('week-id').value = '';
  document.getElementById('week-modal-title').textContent = "Add Week";

  const leaguePlayerIds = currentLeague.players || [];
  let selectedIds = [];

  if (week) {
    document.getElementById('week-modal-title').textContent = "Edit Week";
    document.getElementById('week-id').value = week.id;
    document.getElementById('week-name').value = week.name;
    selectedIds = week.players || [];
  }

  // Render Players (Subset of League Players)
  const container = document.getElementById('week-players-list');
  container.innerHTML = '';

  if (leaguePlayerIds.length === 0) {
    container.innerHTML = '<p style="padding: 0.5rem; color: #666;">No players in this league.</p>';
    return;
  }

  // Filter allPlayers to find those in the league
  const leaguePlayers = allPlayers.filter(p => leaguePlayerIds.includes(p.id));

  leaguePlayers.forEach(player => {
    const div = document.createElement('div');
    div.className = 'checkbox-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `week-player-${player.id}`;
    checkbox.value = player.id;
    checkbox.name = 'week-player';

    if (selectedIds.includes(player.id)) {
      checkbox.checked = true;
    }

    const label = document.createElement('label');
    label.htmlFor = `week-player-${player.id}`;
    label.textContent = `${player.firstName} ${player.lastName}`;

    div.appendChild(checkbox);
    div.appendChild(label);
    container.appendChild(div);
  });
};

const closeWeekModal = () => {
  weekModal.hidden = true;
  weekForm.reset();
};

addWeekBtn.addEventListener('click', () => openWeekModal());
cancelWeekBtn.addEventListener('click', closeWeekModal);

// Create / Update Week
weekForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentLeague) return;

  const id = document.getElementById('week-id').value;
  const name = document.getElementById('week-name').value;
  const selectedPlayers = Array.from(document.querySelectorAll('input[name="week-player"]:checked'))
    .map(cb => cb.value);

  const data = {
    leagueId: currentLeague.id,
    name: name,
    players: selectedPlayers,
    updatedAt: new Date()
  };

  try {
    if (id) {
      // Update
      await updateDoc(doc(db, 'weeks', id), data);
    } else {
      // Create
      data.createdAt = new Date();
      data.createdBy = auth.currentUser ? auth.currentUser.uid : 'anonymous';
      await addDoc(collection(db, 'weeks'), data);
    }
    closeWeekModal();
  } catch (error) {
    console.error("Error saving week:", error);
    alert("Error saving week: " + error.message);
  }
});

const openModal = (player = null) => {
  playerModal.hidden = false;
  if (player) {
    modalTitle.textContent = "Edit Player";
    document.getElementById('player-id').value = player.id;
    document.getElementById('first-name').value = player.firstName;
    document.getElementById('last-name').value = player.lastName;
    document.getElementById('gender').value = player.gender;
    document.getElementById('dupr-doubles').value = player.duprDoubles || '';
    document.getElementById('dupr-singles').value = player.duprSingles || '';
  } else {
    modalTitle.textContent = "Add Player";
    playerForm.reset();
    document.getElementById('player-id').value = '';
  }
};

const closeModal = () => {
  playerModal.hidden = true;
  playerForm.reset();
};

addPlayerBtn.addEventListener('click', () => openModal());
cancelPlayerBtn.addEventListener('click', closeModal);

// Player CRUD Logic
const playersCollection = collection(db, 'players');
let allPlayers = []; // Cache for modal

// Create / Update
playerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('player-id').value;
  const data = {
    firstName: document.getElementById('first-name').value,
    lastName: document.getElementById('last-name').value,
    gender: document.getElementById('gender').value,
    duprDoubles: parseFloat(document.getElementById('dupr-doubles').value) || null,
    duprSingles: parseFloat(document.getElementById('dupr-singles').value) || null,
    updatedAt: new Date()
  };

  try {
    if (id) {
      // Update
      await updateDoc(doc(db, 'players', id), data);
    } else {
      // Create
      data.createdAt = new Date();
      data.createdBy = auth.currentUser ? auth.currentUser.uid : 'anonymous';
      await addDoc(playersCollection, data);
    }
    closeModal();
  } catch (error) {
    console.error("Error saving player:", error);
    alert("Error saving player: " + error.message);
  }
});

// Read (Real-time)
const q = query(playersCollection, orderBy('firstName'));
onSnapshot(q, (snapshot) => {
  playerList.innerHTML = '';
  allPlayers = []; // Reset cache
  snapshot.forEach((playerDoc) => {
    const player = { id: playerDoc.id, ...playerDoc.data() };
    allPlayers.push(player); // Add to cache

    const li = document.createElement('li');
    li.className = 'player-item';
    li.innerHTML = `
            <div class="player-info">
                <h3>${player.firstName} ${player.lastName}</h3>
                <div class="player-stats">
                    ${player.gender} | DUPR (D): ${player.duprDoubles || 'N/A'} | DUPR (S): ${player.duprSingles || 'N/A'}
                </div>
            </div>
            <div class="player-actions">
                <button class="edit-btn">Edit</button>
                <button class="delete-btn">Delete</button>
            </div>
        `;

    // Attach event listeners
    li.querySelector('.edit-btn').addEventListener('click', () => openModal(player));
    li.querySelector('.delete-btn').addEventListener('click', async () => {
      if (confirm(`Delete ${player.firstName}?`)) {
        try {
          await deleteDoc(doc(db, 'players', player.id));
        } catch (error) {
          console.error("Error deleting player:", error);
          alert("Error deleting player: " + error.message);
        }
      }
    });

    playerList.appendChild(li);
  });
});

// Auth Logic
onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is signed in
    console.log("User signed in:", user);

    loginBtn.hidden = true;
    userInfo.hidden = false;
    userName.textContent = user.displayName;

    const placeholderDataUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23ccc'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' font-family='Arial' font-size='14' fill='%23666'%3E?%3C/text%3E%3C/svg%3E";

    if (user.photoURL) {
      userPhoto.src = user.photoURL;
    } else {
      userPhoto.src = placeholderDataUrl;
    }

    userPhoto.onerror = () => {
      console.log("Failed to load user photo, using placeholder");
      userPhoto.onerror = null; // Prevent infinite loop
      userPhoto.src = placeholderDataUrl;
    };
  } else {
    // User is signed out
    console.log("User signed out");
    loginBtn.hidden = false;
    userInfo.hidden = true;
  }
});

loginBtn.addEventListener('click', () => {
  console.log("Login button clicked");
  const provider = new GoogleAuthProvider();
  signInWithPopup(auth, provider)
    .then((result) => {
      console.log("Sign in successful", result.user);
    })
    .catch((error) => {
      console.error("Sign in error", error);
      alert("Login failed: " + error.message);
    });
});

logoutBtn.addEventListener('click', () => {
  console.log("Logout button clicked");
  signOut(auth)
    .then(() => console.log("Sign out successful"))
    .catch((error) => console.error("Sign out error", error));
});

console.log("App loaded");
