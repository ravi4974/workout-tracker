# Workout Tracker PWA

A Progressive Web App for tracking your fitness journey with multiple workout plans, exercises, and detailed progress tracking.

## Features

✅ **Multiple Workout Plans** - Create and manage different workout routines\
✅ **Exercise Tracking** - Log sets, reps, and weights for each exercise\
✅ **Calendar View** - Visual calendar showing workout history\
✅ **Progress Tracking** - View statistics, workout history, and interactive progression graphs\
✅ **Progression Graphs** - Visualize your weight and reps progression for each exercise in the History tab, with a dropdown to select the exercise\
✅ **Smart Prefilling** - Automatically loads previous workout data\
✅ **Minimal, Professional Design** - Clean, modern, and optimized for mobile\
✅ **Default Minimal Theme** - Focused, distraction-free interface\
<!-- Theme switching is hidden by default for a more minimal look -->
✅ **Offline Support** - Works without internet connection\
✅ **Mobile-Friendly** - Fully responsive design\
✅ **Installable** - Install as a native app on your device\
✅ **Data Export/Import** - Backup and restore your workout data\

## Installation

### Desktop (Chrome, Edge, Brave)
1. Open `index.html` in your browser
2. Look for the install button (➕) in the address bar
3. Click "Install" to add it to your desktop

### Mobile (Android)
1. Open the app in Chrome browser
2. Tap the menu (⋮) → "Add to Home Screen"
3. Or click the "📲 Install App" button in the header
4. The app will appear on your home screen like a native app

### Mobile (iOS - Safari)
1. Open the app in Safari browser
2. Tap the Share button (□↑)
3. Scroll and tap "Add to Home Screen"
4. Tap "Add" to install

## How to Use

### Create Your First Workout Plan
1. Click "New Plan" in the sidebar
2. Enter a name (e.g., "Push Day", "Legs", "Full Body")
3. Add a description (optional)
4. Click "Save Plan"

### Add Exercises
1. Select a workout plan
2. Go to the "Exercises" tab
3. Click "+ Add Exercise"
4. Enter exercise name, target sets, and reps
5. Add notes for form cues (optional)

### Log a Workout
1. Select your workout plan
2. Go to the "Log Workout" tab
3. Click "Start Workout"
4. Previous workout values will be automatically loaded
5. Update weights and reps as needed
6. Click "Save Workout" when done

### View Progress
- **Calendar Tab**: See all your workout days highlighted
- **History Tab**: View detailed workout history and interactive progression graphs for each exercise (select exercise from dropdown above the graph)
- **Stats**: See total workouts and weekly count

### Change Theme
Click on the colored theme buttons in the header to switch between:
- 🟣 Default Purple
- ⚫ Dark Mode
- 🔵 Ocean Blue
- 🟢 Forest Green
- 🟠 Sunset Orange

### Backup Your Data
1. Click "📤 Export Data" in the sidebar
2. Save the JSON file to a safe location
3. To restore, click "📥 Import Data" and select your backup file

## Technical Details

- **Storage**: IndexedDB (all data stored locally in browser)
- **Offline**: Service Worker caches app for offline use
- **Platform**: Pure HTML/CSS/JavaScript (no frameworks)
- **Privacy**: No data sent to servers, everything stays on your device

## Browser Support

- ✅ Chrome/Edge (Desktop & Mobile)
- ✅ Firefox
- ✅ Safari (iOS & macOS)
- ✅ Samsung Internet
- ✅ Any modern browser with PWA support

## Files

- `index.html` - Main application UI
- `app.js` - Main application logic (workout plans, exercises, history, graph, etc.)
- `style.css` - Application styles
- `manifest.json` - PWA manifest configuration
- `service-worker.js` - Offline functionality
- `chartjs-loader.js` - Loads Chart.js for progression graphs
- `README.md` - Project documentation

## Troubleshooting

**Install button not showing?**
- Make sure you're using HTTPS or localhost
- Some browsers require the page to be served from a web server

**Data not saving?**
- Check browser console (F12) for errors
- Ensure IndexedDB is enabled in your browser
- Try clearing browser cache and reloading

**App not working offline?**
- Make sure the service worker registered successfully
- Check browser console for service worker errors

## Privacy & Security

- All data is stored locally on your device
- No data is sent to any server
- No analytics or tracking
- Export your data anytime to keep backups

## Future Enhancements

Potential features for future versions:
- 📊 Progress charts and graphs
- 🔔 Workout reminders
- 📸 Exercise form photos
- 🏆 Achievement badges
- 🔄 Cloud sync (optional)
- 📱 Share workouts with friends

## License

Free to use and modify for personal use.

---

**Happy lifting! 💪**
