
// IndexedDB Setup
let db;
const DB_NAME = 'WorkoutTrackerDB';
const DB_VERSION = 1;

const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('IndexedDB error:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            console.log('IndexedDB initialized successfully');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            console.log('Upgrading IndexedDB schema');

            // Create object stores if they don't exist
            if (!db.objectStoreNames.contains('plans')) {
                const planStore = db.createObjectStore('plans', { keyPath: 'id', autoIncrement: true });
                console.log('Created plans store');
            }

            if (!db.objectStoreNames.contains('exercises')) {
                const exerciseStore = db.createObjectStore('exercises', { keyPath: 'id', autoIncrement: true });
                exerciseStore.createIndex('planId', 'planId', { unique: false });
                console.log('Created exercises store');
            }

            if (!db.objectStoreNames.contains('workouts')) {
                const workoutStore = db.createObjectStore('workouts', { keyPath: 'id', autoIncrement: true });
                workoutStore.createIndex('planId', 'planId', { unique: false });
                workoutStore.createIndex('date', 'date', { unique: false });
                console.log('Created workouts store');
            }
        };

        request.onblocked = () => {
            console.warn('IndexedDB blocked - close other tabs');
        };
    });
};

// State
let currentPlan = null;
let currentWorkoutData = {};
let workoutTimer = null;
let workoutStartTime = null;
let workoutElapsed = 0;
let exerciseTimers = [];
let editingPlanId = null;
let currentCalendarDate = new Date();
let lastWorkoutData = null;

// Theme Management
function changeTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('workout-theme', theme);

    // Update active button
    document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.theme-${theme}`).classList.add('active');
}

function loadSavedTheme() {
    const savedTheme = localStorage.getItem('workout-theme') || 'default';
    if (savedTheme !== 'default') {
        document.documentElement.setAttribute('data-theme', savedTheme);
    }

    // Update active button
    document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.theme-${savedTheme}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

// Initialize app
(async () => {
    try {
        loadSavedTheme();
        await initDB();
        await loadPlans();
        console.log('App initialized successfully');
    } catch (error) {
        console.error('App initialization error:', error);
        alert('Error initializing app. Please refresh the page.');
    }
})();

// Plan Management
async function loadPlans() {
    try {
        const plans = await getAll('plans');
        const planList = document.getElementById('planList');

        if (plans.length === 0) {
            planList.innerHTML = '<p style="color: var(--text-light); text-align: center; padding: 20px;">No plans yet</p>';
            return;
        }

        const today = new Date().getDay();
        // Find last workout for each plan
        const allWorkouts = await getAll('workouts');
        planList.innerHTML = plans.map(plan => {
            const isToday = plan.weekday !== undefined && plan.weekday !== null && plan.weekday !== '' && Number(plan.weekday) === today;
            const planWorkouts = allWorkouts.filter(w => w.planId === plan.id);
            let lastDone = '';
            if (planWorkouts.length > 0) {
                planWorkouts.sort((a, b) => new Date(b.date) - new Date(a.date));
                lastDone = new Date(planWorkouts[0].date).toLocaleDateString();
            }
            return `
                        <div class="plan-item ${currentPlan?.id === plan.id ? 'active' : ''} ${isToday ? 'highlight-today' : ''}" onclick="selectPlan(${plan.id})">
                            <div class="plan-name">${plan.name} ${isToday ? '<span style=\"color:#c9184a;font-size:0.9em;\">(Today)</span>' : ''}</div>
                            <div class="plan-info">${plan.description || 'No description'}</div>
                            <div class="plan-info" style="font-size:0.92em;color:#888;">${plan.weekday !== undefined && plan.weekday !== '' ? 'Assigned: ' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][plan.weekday] : ''}${lastDone ? ' | Last done: ' + lastDone : ''}</div>
                        </div>
                    `;
        }).join('');
    } catch (error) {
        console.error('Error loading plans:', error);
        alert('Error loading workout plans. Please refresh the page.');
    }
}

async function selectPlan(planId) {
    try {
        const plans = await getAll('plans');
        currentPlan = plans.find(p => p.id === planId);

        if (!currentPlan) {
            console.error('Plan not found:', planId);
            return;
        }

        document.getElementById('noPlanSelected').style.display = 'none';
        document.getElementById('planView').style.display = 'block';
        document.getElementById('currentPlanName').textContent = currentPlan.name;

        await loadPlans();
        await loadExercises();
        await loadHistory();
        await updateStats();
        await renderCalendar();
    } catch (error) {
        console.error('Error selecting plan:', error);
        alert('Error loading plan details.');
    }
}

function showCreatePlanModal() {
    editingPlanId = null;
    document.getElementById('planModalTitle').textContent = 'Create New Plan';
    document.getElementById('planNameInput').value = '';
    document.getElementById('planDescInput').value = '';
    document.getElementById('planWeekdayInput').value = '';
    document.getElementById('planModal').classList.add('active');
}

function editCurrentPlan() {
    if (!currentPlan) return;
    editingPlanId = currentPlan.id;
    document.getElementById('planModalTitle').textContent = 'Edit Plan';
    document.getElementById('planNameInput').value = currentPlan.name;
    document.getElementById('planDescInput').value = currentPlan.description || '';
    document.getElementById('planWeekdayInput').value = currentPlan.weekday !== undefined ? currentPlan.weekday : '';
    document.getElementById('planModal').classList.add('active');
}

function closePlanModal() {
    document.getElementById('planModal').classList.remove('active');
}

async function savePlan() {
    try {
        const name = document.getElementById('planNameInput').value.trim();
        const description = document.getElementById('planDescInput').value.trim();
        const weekday = document.getElementById('planWeekdayInput').value;
        if (!name) {
            alert('Please enter a plan name');
            return;
        }
        const planData = {
            name,
            description,
            weekday,
            createdAt: editingPlanId ? currentPlan.createdAt : new Date().toISOString()
        };
        if (editingPlanId) {
            planData.id = editingPlanId;
            await update('plans', planData);
            if (currentPlan.id === editingPlanId) {
                currentPlan = planData;
                document.getElementById('currentPlanName').textContent = name;
            }
        } else {
            const id = await add('plans', planData);
            planData.id = id;
            currentPlan = planData;
            await selectPlan(id);
        }
        closePlanModal();
        await loadPlans();
    } catch (error) {
        console.error('Error saving plan:', error);
        alert('Error saving plan. Please try again.');
    }
}

async function deleteCurrentPlan() {
    if (!currentPlan) return;

    if (!confirm(`Delete "${currentPlan.name}" and all its data?`)) return;

    // Delete all exercises and workouts for this plan
    const exercises = await getAllByIndex('exercises', 'planId', currentPlan.id);
    for (const ex of exercises) {
        await deleteRecord('exercises', ex.id);
    }

    const workouts = await getAllByIndex('workouts', 'planId', currentPlan.id);
    for (const wo of workouts) {
        await deleteRecord('workouts', wo.id);
    }

    await deleteRecord('plans', currentPlan.id);

    currentPlan = null;
    document.getElementById('noPlanSelected').style.display = 'block';
    document.getElementById('planView').style.display = 'none';

    await loadPlans();
}

// Exercise Management
async function loadExercises() {
    if (!currentPlan) return;

    const exercises = await getAllByIndex('exercises', 'planId', currentPlan.id);
    const exerciseList = document.getElementById('exerciseList');

    if (exercises.length === 0) {
        exerciseList.innerHTML = '<div class="empty-state"><p>No exercises yet. Add your first exercise!</p></div>';
        return;
    }

    exerciseList.innerHTML = exercises.map(ex => `
                <div class="exercise-item">
                    <div class="exercise-info">
                        <div class="exercise-name">${ex.name}</div>
                        <div class="exercise-details">${ex.sets} sets × ${ex.reps} reps</div>
                        ${ex.notes ? `<div class="exercise-details" style="margin-top: 5px; font-style: italic;">${ex.notes}</div>` : ''}
                    </div>
                    <div class="exercise-actions">
                        <button class="btn btn-small btn-danger" onclick="deleteExercise(${ex.id})">Delete</button>
                    </div>
                </div>
            `).join('');
}

function showAddExerciseModal() {
    if (!currentPlan) return;
    document.getElementById('exerciseNameInput').value = '';
    document.getElementById('exerciseSetsInput').value = '3';
    document.getElementById('exerciseRepsInput').value = '10';
    document.getElementById('exerciseNotesInput').value = '';
    document.getElementById('exerciseModal').classList.add('active');
}

function closeExerciseModal() {
    document.getElementById('exerciseModal').classList.remove('active');
}

async function saveExercise() {
    if (!currentPlan) return;

    const name = document.getElementById('exerciseNameInput').value.trim();
    const sets = parseInt(document.getElementById('exerciseSetsInput').value);
    const reps = parseInt(document.getElementById('exerciseRepsInput').value);
    const notes = document.getElementById('exerciseNotesInput').value.trim();

    if (!name || !sets || !reps) {
        alert('Please fill in all required fields');
        return;
    }

    await add('exercises', {
        planId: currentPlan.id,
        name,
        sets,
        reps,
        notes
    });

    closeExerciseModal();
    await loadExercises();
}

async function deleteExercise(id) {
    if (!confirm('Delete this exercise?')) return;
    await deleteRecord('exercises', id);
    await loadExercises();
}

// Workout Logging
async function startWorkout() {
    const exercises = await getAllByIndex('exercises', 'planId', currentPlan.id);

    if (exercises.length === 0) {
        alert('Add exercises to this plan first!');
        return;
    }

    // Get last workout to prefill values
    const workouts = await getAllByIndex('workouts', 'planId', currentPlan.id);
    workouts.sort((a, b) => new Date(b.date) - new Date(a.date));
    lastWorkoutData = workouts[0] || null;

    currentWorkoutData = {
        planId: currentPlan.id,
        date: new Date().toISOString(),
        workoutDuration: 0,
        exercises: exercises.map(ex => {
            // Find last workout data for this exercise
            let lastSets = Array(ex.sets).fill(null).map(() => ({ weight: '', reps: '' }));
            if (lastWorkoutData) {
                const lastExercise = lastWorkoutData.exercises.find(e => e.exerciseId === ex.id);
                if (lastExercise && lastExercise.sets) {
                    lastSets = lastExercise.sets.map(set => ({
                        weight: set.weight || '',
                        reps: set.reps || ''
                    }));
                    while (lastSets.length < ex.sets) {
                        lastSets.push({ weight: '', reps: '' });
                    }
                    lastSets = lastSets.slice(0, ex.sets);
                }
            }
            return {
                exerciseId: ex.id,
                name: ex.name,
                sets: lastSets,
                exerciseDuration: 0
            };
        })
    };
    // Start workout timer
    workoutStartTime = Date.now();
    workoutElapsed = 0;
    if (workoutTimer) clearInterval(workoutTimer);
    workoutTimer = setInterval(() => {
        workoutElapsed = Math.floor((Date.now() - workoutStartTime) / 1000);
        document.getElementById('workoutTimerDisplay').textContent = formatTime(workoutElapsed);
    }, 1000);
    // Per-exercise timers
    exerciseTimers = currentWorkoutData.exercises.map(() => ({ start: null, elapsed: 0, timer: null }));
    renderWorkoutLogger();
    document.getElementById('workoutLogger').style.display = 'block';
}

function renderWorkoutLogger() {
    // Show last workout info
    const lastWorkoutInfo = document.getElementById('lastWorkoutInfo');
    if (lastWorkoutData) {
        const lastDate = new Date(lastWorkoutData.date);
        lastWorkoutInfo.innerHTML = `
                    <div class="last-workout-indicator">
                        <span>📊</span>
                        <div>
                            <strong>Previous workout values loaded</strong><br>
                            <span style="font-size: 0.9em;">Last workout: ${lastDate.toLocaleDateString()} at ${lastDate.toLocaleTimeString()}</span>
                        </div>
                    </div>
                `;
    } else {
        lastWorkoutInfo.innerHTML = '';
    }

    const container = document.getElementById('workoutExercises');
    container.innerHTML = currentWorkoutData.exercises.map((ex, exIdx) => `
        <div class="workout-session">
            <h3 style="margin-bottom: 15px; color: #667eea; display: flex; align-items: center; gap: 10px;">
                ${ex.name}
                ${lastWorkoutData ? '<span class="prefilled-indicator">✓ Prefilled from last workout</span>' : ''}
                <span style="font-size:0.95em; color:#333; margin-left:auto;">
                    <span id="exerciseTimerDisplay${exIdx}">${formatTime(exerciseTimers[exIdx]?.elapsed || 0)}</span>
                    <button class="btn btn-small" type="button" onclick="toggleExerciseTimer(${exIdx})" style="margin-left:6px; min-width:60px;">
                        <span id="exerciseTimerBtn${exIdx}">${exerciseTimers[exIdx]?.timer ? 'Pause' : 'Start'}</span>
                    </button>
                </span>
            </h3>
            ${ex.sets.map((set, setIdx) => `
                <div class="set-log">
                    <span><strong>Set ${setIdx + 1}</strong></span>
                    <input type="number" placeholder="Weight" value="${set.weight}" 
                           onchange="updateSet(${exIdx}, ${setIdx}, 'weight', this.value)"
                           step="0.5">
                    <input type="number" placeholder="Reps" value="${set.reps}" 
                           onchange="updateSet(${exIdx}, ${setIdx}, 'reps', this.value)">
                    <span style="color: #999;">kg / reps</span>
                </div>
            `).join('')}
        </div>
    `).join('');
    // Update all exercise timers
    currentWorkoutData.exercises.forEach((_, exIdx) => {
        document.getElementById(`exerciseTimerDisplay${exIdx}`).textContent = formatTime(exerciseTimers[exIdx]?.elapsed || 0);
        document.getElementById(`exerciseTimerBtn${exIdx}`).textContent = exerciseTimers[exIdx]?.timer ? 'Pause' : 'Start';
    });
}

// Timer display for workout (make global)
function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// Toggle per-exercise timer
window.toggleExerciseTimer = function(exIdx) {
    if (!exerciseTimers[exIdx]) return;
    if (exerciseTimers[exIdx].timer) {
        // Pause
        clearInterval(exerciseTimers[exIdx].timer);
        exerciseTimers[exIdx].timer = null;
        // Save elapsed
        exerciseTimers[exIdx].elapsed = Math.floor((Date.now() - exerciseTimers[exIdx].start) / 1000) + (exerciseTimers[exIdx].elapsed || 0);
        currentWorkoutData.exercises[exIdx].exerciseDuration = exerciseTimers[exIdx].elapsed;
    } else {
        // Start
        exerciseTimers[exIdx].start = Date.now();
        exerciseTimers[exIdx].timer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - exerciseTimers[exIdx].start) / 1000) + (exerciseTimers[exIdx].elapsed || 0);
            document.getElementById(`exerciseTimerDisplay${exIdx}`).textContent = formatTime(elapsed);
            currentWorkoutData.exercises[exIdx].exerciseDuration = elapsed;
        }, 1000);
    }
    document.getElementById(`exerciseTimerBtn${exIdx}`).textContent = exerciseTimers[exIdx].timer ? 'Pause' : 'Start';
};

function updateSet(exIdx, setIdx, field, value) {
    currentWorkoutData.exercises[exIdx].sets[setIdx][field] = value;
}

async function saveWorkout() {
    try {
        // Validate at least some data entered
        const hasData = currentWorkoutData.exercises.some(ex =>
            ex.sets.some(set => set.weight || set.reps)
        );
        if (!hasData) {
            if (!confirm('No data entered. Save empty workout?')) return;
        }
        // Stop all timers
        if (workoutTimer) clearInterval(workoutTimer);
        currentWorkoutData.workoutDuration = workoutElapsed;
        exerciseTimers.forEach((t, exIdx) => {
            if (t.timer) clearInterval(t.timer);
            // Save elapsed
            t.elapsed = t.timer ? Math.floor((Date.now() - t.start) / 1000) + (t.elapsed || 0) : (t.elapsed || 0);
            currentWorkoutData.exercises[exIdx].exerciseDuration = t.elapsed;
        });
        await add('workouts', currentWorkoutData);
        alert('Workout saved! 💪');
        cancelWorkout();
        await loadHistory();
        await updateStats();
        await renderCalendar();
    } catch (error) {
        console.error('Error saving workout:', error);
        alert('Error saving workout. Please try again.');
    }
}

function cancelWorkout() {
    currentWorkoutData = {};
    lastWorkoutData = null;
    if (workoutTimer) clearInterval(workoutTimer);
    exerciseTimers.forEach(t => t.timer && clearInterval(t.timer));
    workoutTimer = null;
    workoutElapsed = 0;
    exerciseTimers = [];
    document.getElementById('workoutLogger').style.display = 'none';
    document.getElementById('lastWorkoutInfo').innerHTML = '';
}

// History
async function loadHistory() {
    if (!currentPlan) return;

    const workouts = await getAllByIndex('workouts', 'planId', currentPlan.id);
    workouts.sort((a, b) => new Date(a.date) - new Date(b.date)); // oldest to newest for graph

    const historyList = document.getElementById('historyList');

    // --- Progression Graph Logic with Dropdown ---
    const chartCanvas = document.getElementById('progressionChart');
    const exerciseSelect = document.getElementById('progressionExerciseSelect');
    if (chartCanvas && exerciseSelect) {
        // Aggregate all unique exercise names
        let exerciseNames = new Set();
        workouts.forEach(wo => wo.exercises.forEach(ex => exerciseNames.add(ex.name)));
        exerciseNames = Array.from(exerciseNames);
        // Populate dropdown if needed
        if (exerciseSelect.options.length !== exerciseNames.length || Array.from(exerciseSelect.options).some((opt, i) => opt.value !== exerciseNames[i])) {
            exerciseSelect.innerHTML = exerciseNames.map(name => `<option value="${name}">${name}</option>`).join('');
        }
        // Get selected exercise
        let selectedExercise = exerciseSelect.value || exerciseNames[0] || '';
        exerciseSelect.value = selectedExercise;
        // Redraw chart on dropdown change
        exerciseSelect.onchange = () => loadHistory();
        // Gather data for selected exercise
        let labels = [], weightData = [], repsData = [];
        workouts.forEach(wo => {
            const ex = wo.exercises.find(e => e.name === selectedExercise);
            if (ex) {
                let totalWeight = 0, totalReps = 0, count = 0;
                ex.sets.forEach(set => {
                    if (set.weight && !isNaN(set.weight)) { totalWeight += Number(set.weight); count++; }
                    if (set.reps && !isNaN(set.reps)) { totalReps += Number(set.reps); }
                });
                labels.push(new Date(wo.date).toLocaleDateString());
                weightData.push(count ? totalWeight / count : 0);
                repsData.push(count ? totalReps / count : 0);
            }
        });
        // Draw chart
        if (window._progressionChart) { window._progressionChart.destroy(); }
        if (window.Chart && labels.length > 0) {
            window._progressionChart = new Chart(chartCanvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        {
                            label: selectedExercise + ' (Weight)',
                            data: weightData,
                            borderColor: '#667eea',
                            backgroundColor: 'rgba(102,126,234,0.1)',
                            yAxisID: 'y',
                            tension: 0.3,
                            pointRadius: 4,
                            fill: false
                        },
                        {
                            label: selectedExercise + ' (Reps)',
                            data: repsData,
                            borderColor: '#c9184a',
                            backgroundColor: 'rgba(201,24,74,0.1)',
                            yAxisID: 'y1',
                            tension: 0.3,
                            pointRadius: 4,
                            fill: false
                        }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: true, position: 'top' },
                        title: { display: true, text: 'Progression History' }
                    },
                    scales: {
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: { display: true, text: 'Weight (kg)' }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            grid: { drawOnChartArea: false },
                            title: { display: true, text: 'Reps' }
                        }
                    }
                }
            });
        } else if (window.Chart && labels.length === 0) {
            chartCanvas.getContext('2d').clearRect(0, 0, chartCanvas.width, chartCanvas.height);
        }
    }

    if (workouts.length === 0) {
        historyList.innerHTML = '<div class="empty-state"><p>No workout history yet</p></div>';
        return;
    }

    historyList.innerHTML = workouts.map(wo => {
        const workoutDuration = wo.workoutDuration ? `<span class="history-duration">⏱️ ${formatTime(wo.workoutDuration)}</span>` : '';
        return `
            <div class="history-item">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <div class="history-date">${new Date(wo.date).toLocaleDateString()} ${new Date(wo.date).toLocaleTimeString()} ${workoutDuration}</div>
                    <button class="btn btn-small btn-danger" onclick="deleteWorkout(${wo.id})">Delete</button>
                </div>
                ${wo.exercises.map(ex => {
                    const exDuration = ex.exerciseDuration ? `<span class=\"history-duration\" style=\"margin-left:8px;color:#667eea;font-size:0.95em;\">⏱️ ${formatTime(ex.exerciseDuration)}</span>` : '';
                    return `
                        <div class="history-exercise">
                            <div class="history-exercise-name">${ex.name}${exDuration}</div>
                            <div class="history-sets">
                                ${ex.sets.map((set, idx) =>
                                    set.weight || set.reps ?
                                        `Set ${idx + 1}: ${set.weight || '-'} kg × ${set.reps || '-'} reps` :
                                        `Set ${idx + 1}: Not logged`
                                ).join(' • ')}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }).join('');
}

async function deleteWorkout(id) {
    if (!confirm('Delete this workout?')) return;
    await deleteRecord('workouts', id);
    await loadHistory();
    await updateStats();
    await renderCalendar();
}

async function updateStats() {
    if (!currentPlan) return;

    const workouts = await getAllByIndex('workouts', 'planId', currentPlan.id);
    document.getElementById('totalWorkouts').textContent = workouts.length;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const thisWeek = workouts.filter(w => new Date(w.date) >= oneWeekAgo).length;
    document.getElementById('thisWeek').textContent = thisWeek;
}

// Tabs
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    event.target.classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');

    // Render calendar when switching to calendar tab
    if (tabName === 'calendar') {
        renderCalendar();
    }
}

// Calendar Functions
async function renderCalendar() {
    if (!currentPlan) return;

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    // Update title
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('calendarTitle').textContent = `${monthNames[month]} ${year}`;

    // Get workouts for this month
    const workouts = await getAllByIndex('workouts', 'planId', currentPlan.id);
    const workoutsByDate = {};
    workouts.forEach(wo => {
        const date = new Date(wo.date);
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (!workoutsByDate[dateKey]) {
            workoutsByDate[dateKey] = [];
        }
        workoutsByDate[dateKey].push(wo);
    });

    // Build calendar grid
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';

    // Day headers
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        grid.appendChild(header);
    });

    // Previous month days
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const day = prevMonthDays - i;
        const cell = document.createElement('div');
        cell.className = 'calendar-day other-month';
        cell.innerHTML = `<div class="calendar-day-number">${day}</div>`;
        grid.appendChild(cell);
    }

    // Current month days
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const cell = document.createElement('div');
        cell.className = 'calendar-day';

        const isToday = today.getDate() === day &&
            today.getMonth() === month &&
            today.getFullYear() === year;

        const hasWorkout = workoutsByDate[dateKey] && workoutsByDate[dateKey].length > 0;

        if (isToday) cell.classList.add('today');
        if (hasWorkout) cell.classList.add('has-workout');

        cell.innerHTML = `
                    <div class="calendar-day-number">${day}</div>
                    ${hasWorkout ? `<div class="calendar-day-indicator">${workoutsByDate[dateKey].length} 🏋️</div>` : ''}
                `;

        if (hasWorkout) {
            cell.onclick = () => showWorkoutDetail(dateKey, workoutsByDate[dateKey]);
        }

        grid.appendChild(cell);
    }

    // Next month days
    const remainingCells = 42 - (firstDayOfWeek + daysInMonth);
    for (let day = 1; day <= remainingCells; day++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day other-month';
        cell.innerHTML = `<div class="calendar-day-number">${day}</div>`;
        grid.appendChild(cell);
    }
}

function changeMonth(delta) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
    renderCalendar();
}

function goToToday() {
    currentCalendarDate = new Date();
    renderCalendar();
}

function showWorkoutDetail(dateKey, workouts) {
    const modal = document.getElementById('workoutDetailModal');
    const date = new Date(dateKey);
    document.getElementById('workoutDetailDate').textContent =
        `Workouts on ${date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;

    const content = document.getElementById('workoutDetailContent');
    content.innerHTML = workouts.map((wo, idx) => `
                <div class="history-item" style="margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <div class="history-date">Workout ${idx + 1} - ${new Date(wo.date).toLocaleTimeString()}</div>
                        <button class="btn btn-small btn-danger" onclick="deleteWorkoutFromCalendar(${wo.id})">Delete</button>
                    </div>
                    ${wo.exercises.map(ex => `
                        <div class="history-exercise">
                            <div class="history-exercise-name">${ex.name}</div>
                            <div class="history-sets">
                                ${ex.sets.map((set, idx) =>
        set.weight || set.reps ?
            `Set ${idx + 1}: ${set.weight || '-'} kg × ${set.reps || '-'} reps` :
            `Set ${idx + 1}: Not logged`
    ).join(' • ')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `).join('');

    modal.classList.add('active');
}

function closeWorkoutDetailModal() {
    document.getElementById('workoutDetailModal').classList.remove('active');
}

async function deleteWorkoutFromCalendar(id) {
    if (!confirm('Delete this workout?')) return;
    await deleteRecord('workouts', id);
    closeWorkoutDetailModal();
    await loadHistory();
    await updateStats();
    await renderCalendar();
}

// Import/Export
async function exportData() {
    const plans = await getAll('plans');
    const exercises = await getAll('exercises');
    const workouts = await getAll('workouts');

    const data = {
        version: 1,
        exportDate: new Date().toISOString(),
        plans,
        exercises,
        workouts
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workout-tracker-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function showImportModal() {
    document.getElementById('importFileInput').value = '';
    document.getElementById('importModal').classList.add('active');
}

function closeImportModal() {
    document.getElementById('importModal').classList.remove('active');
}

async function importData() {
    const fileInput = document.getElementById('importFileInput');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a file');
        return;
    }

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.version || !data.plans) {
            throw new Error('Invalid file format');
        }

        if (!confirm('This will add imported data to your existing data. Continue?')) {
            return;
        }

        // Import plans
        const planIdMap = {};
        for (const plan of data.plans) {
            const oldId = plan.id;
            delete plan.id;
            const newId = await add('plans', plan);
            planIdMap[oldId] = newId;
        }

        // Import exercises with new plan IDs
        const exerciseIdMap = {};
        for (const ex of data.exercises) {
            const oldId = ex.id;
            const oldPlanId = ex.planId;
            delete ex.id;
            ex.planId = planIdMap[oldPlanId];
            const newId = await add('exercises', ex);
            exerciseIdMap[oldId] = newId;
        }

        // Import workouts with new plan and exercise IDs
        for (const wo of data.workouts) {
            const oldPlanId = wo.planId;
            delete wo.id;
            wo.planId = planIdMap[oldPlanId];

            // Update exercise IDs in workout data
            wo.exercises = wo.exercises.map(ex => ({
                ...ex,
                exerciseId: exerciseIdMap[ex.exerciseId] || ex.exerciseId
            }));

            await add('workouts', wo);
        }

        alert('Data imported successfully!');
        closeImportModal();
        await loadPlans();

    } catch (error) {
        alert('Error importing data: ' + error.message);
        console.error(error);
    }
}

// IndexedDB Helper Functions
function add(storeName, data) {
    return new Promise((resolve, reject) => {
        try {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.add(data);

            request.onsuccess = () => {
                console.log(`Added to ${storeName}:`, request.result);
                resolve(request.result);
            };
            request.onerror = () => {
                console.error(`Error adding to ${storeName}:`, request.error);
                reject(request.error);
            };

            tx.onerror = () => {
                console.error(`Transaction error on ${storeName}:`, tx.error);
                reject(tx.error);
            };
        } catch (error) {
            console.error(`Exception in add to ${storeName}:`, error);
            reject(error);
        }
    });
}

function update(storeName, data) {
    return new Promise((resolve, reject) => {
        try {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => {
                console.log(`Updated in ${storeName}:`, request.result);
                resolve(request.result);
            };
            request.onerror = () => {
                console.error(`Error updating ${storeName}:`, request.error);
                reject(request.error);
            };
        } catch (error) {
            console.error(`Exception in update ${storeName}:`, error);
            reject(error);
        }
    });
}

function deleteRecord(storeName, id) {
    return new Promise((resolve, reject) => {
        try {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => {
                console.log(`Deleted from ${storeName}:`, id);
                resolve();
            };
            request.onerror = () => {
                console.error(`Error deleting from ${storeName}:`, request.error);
                reject(request.error);
            };
        } catch (error) {
            console.error(`Exception in delete from ${storeName}:`, error);
            reject(error);
        }
    });
}

function getAll(storeName) {
    return new Promise((resolve, reject) => {
        try {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                console.log(`Got all from ${storeName}:`, request.result.length, 'items');
                resolve(request.result);
            };
            request.onerror = () => {
                console.error(`Error getting all from ${storeName}:`, request.error);
                reject(request.error);
            };
        } catch (error) {
            console.error(`Exception in getAll from ${storeName}:`, error);
            reject(error);
        }
    });
}

function getAllByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
        try {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);

            request.onsuccess = () => {
                console.log(`Got from ${storeName} by ${indexName}=${value}:`, request.result.length, 'items');
                resolve(request.result);
            };
            request.onerror = () => {
                console.error(`Error getting by index from ${storeName}:`, request.error);
                reject(request.error);
            };
        } catch (error) {
            console.error(`Exception in getAllByIndex from ${storeName}:`, error);
            reject(error);
        }
    });
}

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('Service Worker registered successfully:', registration.scope);
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
    });
}

// PWA Install Prompt
let deferredPrompt;
const installButton = document.getElementById('installButton');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Show install button if it exists
    if (installButton) {
        installButton.style.display = 'block';
    }
});

function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            }
            deferredPrompt = null;
            if (installButton) {
                installButton.style.display = 'none';
            }
        });
    }
}

window.addEventListener('appinstalled', () => {
    console.log('PWA installed successfully');
    if (installButton) {
        installButton.style.display = 'none';
    }
});
