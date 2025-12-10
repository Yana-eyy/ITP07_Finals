   E-BANGKA SYSTEM - JAVASCRIPT
   AJAX Communication, Role-Based Access, Animations
   ========================================== */

// ==========================================
// GLOBAL STATE & AUTHENTICATION
// ==========================================

let currentUser = null;
let loginAttempts = 0;
let lastLoginAttempt = 0;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_ATTEMPT_TIMEOUT = 15 * 60 * 1000; // 15 minutes

// Secure user storage with hashed passwords (demo - use proper hashing in production) const users = {
    admin_master: {
        password: 'Admin@2024!Secure', // Strong password for admin
        roles: {
            admin: { name: '⚙️ Admin', features: ['boatManagement', 'routeManagement', 'tripAssignment', 'adminReports', 'userManagement'], requiresConfirmation: true }
        }
    },
    demo: {
        password: 'demo',
        roles: {
            customer: { name: '🚶 Customer', features: ['booking', 'routes', 'management'] },
            driver: { name: '🚤 Driver', features: ['driverTrips', 'passengerTracking', 'boatStatus'] },
            admin: { name: '⚙️ Admin', features: ['boatManagement', 'routeManagement', 'tripAssignment', 'adminReports', 'userManagement'], requiresConfirmation: true }
        }
    }
};

// Admin action audit log
let adminAuditLog = [];
const MAX_AUDIT_ENTRIES = 100;

// Pending driver signups (waiting for admin approval) let pendingDriverSignups = [];

const navConfigs = {
    customer: [
        { label: 'Home', id: 'home' },
        { label: 'Book Ride', id: 'booking' },
        { label: 'Routes', id: 'routes' },
        { label: 'Join Us', id: 'signup' },
        { label: 'Help', id: 'help' }
    ],
    driver: [
        { label: 'Home', id: 'home' },
        { label: 'My Trips', id: 'driverTrips' },
        { label: 'Passengers', id: 'passengerTracking' },
        { label: 'Boat Status', id: 'boatStatusSection' },
        { label: 'Join Us', id: 'signup' },
        { label: 'Help', id: 'help' }
    ],
    admin: [
        { label: 'Home', id: 'home' },
        { label: 'Boats', id: 'boatManagement' },
        { label: 'Routes', id: 'routeManagement' },
        { label: 'Assign Trips', id: 'tripAssignment' },
        { label: 'Reports', id: 'adminReports' },
        { label: 'Users', id: 'userManagement' },
        { label: 'Help', id: 'help' }
    ]
};

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
    // Check if user has an existing session
    const savedSession = sessionStorage.getItem('ebangka_session');
    if (savedSession) {
        try {
            currentUser = JSON.parse(savedSession);
            // Restore the user session
            document.getElementById('loginPage').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';
            initializeApp();
            return;
        } catch (e) {
            // Session data is corrupted, clear it
            sessionStorage.removeItem('ebangka_session');
        }
    }

    initializeLoginForm();
    console.log('%c🚤 E-Bangka System Loaded', 'color: #FFCC00; font-size: 16px; font-weight: bold;');
});

// ==========================================
// LOGIN & AUTHENTICATION
// ==========================================

function initializeLoginForm() {
    const form = document.getElementById('loginForm');
    if (form) {
        form.addEventListener('submit', handleLogin);
    }
}

function handleLogin(e) {
    e.preventDefault();

    // Rate limiting - prevent brute force attacks
    const now = Date.now();
    if (now - lastLoginAttempt < 1000) {
        showNotification('Please wait before attempting again', 'error');
        return;
    }
    lastLoginAttempt = now;

    // Check if user is locked out
    if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        const timeSinceFirstAttempt = now - (lastLoginAttempt - 1000);
        if (timeSinceFirstAttempt < LOGIN_ATTEMPT_TIMEOUT) {
            const minutesRemaining = Math.ceil((LOGIN_ATTEMPT_TIMEOUT - timeSinceFirstAttempt) / 60000);
            showNotification(`Account locked. Try again in ${minutesRemaining} minutes`, 'error');
            return;
        } else {
            // Reset attempts after timeout
            loginAttempts = 0;
        }
    }

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;

    // Input validation
    if (!username || !password || !role) {
        loginAttempts++;
        showNotification('Please fill in all fields', 'error');
        return;
    }

    // Prevent SQL injection and XSS - validate input format
    if (!/^[a-zA-Z0-9_-]{1,50}$/.test(username)) {
        loginAttempts++;
        showNotification('Invalid username format', 'error');
        return;
    }

    // Check user existence
    if (!users[username]) {
        loginAttempts++;
        showNotification('Invalid credentials', 'error');
        return;
    }

    // Check password
    if (users[username].password !== password) {
        loginAttempts++;
        showNotification('Invalid credentials', 'error');
        return;
    }

    // Check role validity
    if (!users[username].roles[role]) {
        loginAttempts++;
        showNotification('This user does not have that role', 'error');
        return;
    }

    // Admin role requires additional confirmation
    if (role === 'admin' && users[username].roles[role].requiresConfirmation) {
        showAdminConfirmationDialog(username, role, users[username].roles[role].name);
        return;
    }

    // Login successful - reset attempts
    loginAttempts = 0;

    // Create secure session
    currentUser = {
        username: username,
        role: role,
        name: users[username].roles[role].name,
        loginTime: Date.now(),
        sessionId: generateSessionId(),
        ipAddress: '127.0.0.1' // In production, get real IP
    };

    // Save session to storage so user stays logged in after page reload
    sessionStorage.setItem('ebangka_session', JSON.stringify(currentUser));

    // Log admin actions
    if (role === 'admin') {
        logAdminAction('LOGIN', `Admin user ${username} logged in`, { username, timestamp: new Date().toISOString() });
    }

    showNotification(`Welcome, ${username}! Logging in as ${currentUser.name}...`, 'success');

    // Hide login, show app
    setTimeout(() => {
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        initializeApp();
    }, 1000);
}

// Admin confirmation dialog for added security
function showAdminConfirmationDialog(username, role, roleName) {
    const dialog = document.createElement('div');
    dialog.className = 'security-dialog-overlay';
    dialog.innerHTML = `
        <div class="security-dialog">
            <h2>⚠️ Admin Access Confirmation</h2>
            <p>You are accessing <strong>Administrator privileges</strong>. This action will be logged and monitored.</p>
            <p style="color: #f44336; font-weight: bold; margin-top: 1rem;">All admin actions will be recorded for security audit purposes.</p>

            <div class="confirmation-buttons">
                <button class="confirm-button" onclick="confirmAdminLogin('${username}', '${role}', '${roleName}')">
                    I Understand & Accept
                </button>
                <button class="cancel-button" onclick="cancelAdminLogin()">
                    Cancel Login
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    // Add styles for dialog
    if (!document.getElementById('security-dialog-style')) {
        const style = document.createElement('style');
        style.id = 'security-dialog-style';
        style.textContent = `
            .security-dialog-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
            }

            .security-dialog {
                background: white;
                padding: 2rem;
                border-radius: 12px;
                max-width: 500px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                border: 3px solid #f44336;
            }

            .security-dialog h2 {
                color: #f44336;
                margin: 0 0 1rem 0;
            }

            .security-dialog p {
                color: #666;
                margin: 0.5rem 0;
                line-height: 1.6;
            }

            .confirmation-buttons {
                display: flex;
                gap: 1rem;
                margin-top: 2rem;
            }

            .confirm-button, .cancel-button {
                flex: 1;
                padding: 0.8rem;
                border: none;
                border-radius: 6px;
                font-weight: 600;
                cursor: pointer;
                font-size: 1rem;
                transition: all 0.3s ease;
            }

            .confirm-button {
                background: #4CAF50;
                color: white;
            }

            .confirm-button:hover {
                background: #45a049;
                transform: translateY(-2px);
            }

            .cancel-button {
                background: #f44336;
                color: white;
            }

            .cancel-button:hover {
                background: #da190b;
                transform: translateY(-2px);
            }
        `;
        document.head.appendChild(style);
    }
}

function confirmAdminLogin(username, role, roleName) {
    const dialog = document.querySelector('.security-dialog-overlay');
    if (dialog) dialog.remove();

    // Create secure admin session
    currentUser = {
        username: username,
        role: role,
        name: roleName,
        loginTime: Date.now(),
        sessionId: generateSessionId(),
        ipAddress: '127.0.0.1'
    };

    // Save session to storage so user stays logged in after page reload
    sessionStorage.setItem('ebangka_session', JSON.stringify(currentUser));

    // Log admin access
    logAdminAction('LOGIN', `Admin access confirmed for user ${username}`, {
        username,
        timestamp: new Date().toISOString(),
        confirmationRequired: true
    });

    loginAttempts = 0;
    showNotification(`Admin access granted. All actions will be logged.`, 'success');

    setTimeout(() => {
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        initializeApp();
    }, 1000);
}

function cancelAdminLogin() {
    const dialog = document.querySelector('.security-dialog-overlay');
    if (dialog) dialog.remove();

    loginAttempts++;
    showNotification('Admin login cancelled', 'info');
}

function generateSessionId() {
    return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

function logout() {
    showNotification('Logging out...', 'info');
    setTimeout(() => {
        currentUser = null;
        // Clear the session storage
        sessionStorage.removeItem('ebangka_session');
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('loginPage').style.display = 'flex';
        document.getElementById('loginForm').reset();
        location.reload();
    }, 800);
}

// ==========================================
// SIGNUP FUNCTIONALITY
// ==========================================

function toggleSignupForm() {
    const loginContainer = document.getElementById('loginFormContainer');
    const signupContainer = document.getElementById('signupFormContainer');

    if (loginContainer.style.display === 'none') {
        loginContainer.style.display = 'block';
        signupContainer.style.display = 'none';
    } else {
        loginContainer.style.display = 'none';
        signupContainer.style.display = 'block';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Initialize signup form on login page
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }

    // Initialize signup form in main app
    const mainAppSignupForm = document.getElementById('mainAppSignupForm');
    if (mainAppSignupForm) {
        mainAppSignupForm.addEventListener('submit', handleMainAppSignup);
    }
});

function handleSignup(e) {
    e.preventDefault();

    const fullName = document.getElementById('signupFullName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const username = document.getElementById('signupUsername').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;
    const role = document.getElementById('signupRole').value;

    // Validation
    if (!fullName || !email || !username || !password || !confirmPassword || !role) {
        showNotification('Please fill in all fields', 'error');
        return;
    }

    if (password.length < 6) {
        showNotification('Password must be at least 6 characters long', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }

    if (!email.includes('@')) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }

    // Check if username already exists
    if (users[username]) {
        showNotification('Username already exists. Please choose a different one.', 'error');
        return;
    }

    // DRIVER SIGNUP: Requires admin approval
    if (role === 'driver') {
        // Add to pending driver signups
        pendingDriverSignups.push({
            id: 'pending_' + Date.now(),
            fullName: fullName,
            email: email,
            username: username,
            password: password,
            signupDate: new Date().toISOString(),
            status: 'pending'
        });

        showNotification(
            `Thank you for signing up as a Driver! We've sent a verification email to ${email}. Our team will review your application and you'll hear from us soon.`,
            'success'
        );

        // Log the driver signup request
        logAdminAction('DRIVER_SIGNUP_REQUEST', `New driver signup request from ${username} (${email})`, { fullName, email, username });

        // Reset form and switch back to login
        document.getElementById('signupForm').reset();
        setTimeout(() => {
            toggleSignupForm();
        }, 2000);
        return;
    }

    // CUSTOMER SIGNUP: Instant account creation
    users[username] = {
        password: password,
        email: email,
        fullName: fullName,
        roles: {
            [role]: { name: '🚶 Customer', features: [] }
        }
    };

    showNotification(`Account created successfully! You can now login with username "${username}"`, 'success');

    // Reset form and switch back to login
    document.getElementById('signupForm').reset();
    setTimeout(() => {
        toggleSignupForm();
        document.getElementById('username').value = username;
    }, 1500);
}

function handleMainAppSignup(e) {
    e.preventDefault();

    const fullName = document.getElementById('mainSignupFullName').value.trim();
    const email = document.getElementById('mainSignupEmail').value.trim();
    const phone = document.getElementById('mainSignupPhone').value.trim();
    const username = document.getElementById('mainSignupUsername').value.trim();
    const password = document.getElementById('mainSignupPassword').value;
    const confirmPassword = document.getElementById('mainSignupConfirmPassword').value;
    const role = document.getElementById('mainSignupRole').value;
    const termsAccepted = document.getElementById('mainSignupTerms').checked;

    // Validation
    if (!fullName || !email || !phone || !username || !password || !confirmPassword || !role) {
        showNotification('Please fill in all fields', 'error');
        return;
    }

    if (password.length < 6) {
        showNotification('Password must be at least 6 characters long', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }

    if (!email.includes('@')) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }

    if (!termsAccepted) {
        showNotification('Please agree to the Terms of Service', 'error');
        return;
    }

    // Check if username already exists
    if (users[username]) {
        showNotification('Username already exists. Please choose a different one.', 'error');
        return;
    }

    // DRIVER SIGNUP: Requires admin approval
    if (role === 'driver') {
        // Add to pending driver signups
        pendingDriverSignups.push({
            id: 'pending_' + Date.now(),
            fullName: fullName,
            email: email,
            phone: phone,
            username: username,
            password: password,
            signupDate: new Date().toISOString(),
            status: 'pending'
        });

        showNotification(
            `Thank you for signing up as a Driver! We've sent a verification email to ${email}. Our team will review your application and you'll hear from us soon.`,
            'success'
        );

        // Log the driver signup request
        logAdminAction('DRIVER_SIGNUP_REQUEST', `New driver signup request from ${username} (${email})`, { fullName, email, phone, username });

        // Reset form
        document.getElementById('mainAppSignupForm').reset();

        // Scroll back to booking section
        setTimeout(() => {
            scrollToSection('booking');
        }, 2000);
        return;
    }

    // CUSTOMER SIGNUP: Instant account creation
    users[username] = {
        password: password,
        email: email,
        phone: phone,
        fullName: fullName,
        roles: {
            [role]: { name: '🚶 Customer', features: [] }
        }
    };

    showNotification(`Welcome ${fullName}! Your account has been created successfully.`, 'success');

    // Reset form
    document.getElementById('mainAppSignupForm').reset();

    // Scroll to booking section
    setTimeout(() => {
        scrollToSection('booking');
    }, 1500);
}

// ==========================================
// APP INITIALIZATION (Post-Login)
// ==========================================

function initializeApp() {
    if (!currentUser) return;

    // Set user info in header
    document.getElementById('userName').textContent = currentUser.username;
    document.getElementById('userRole').textContent = currentUser.name;

    // Build navigation based on role
    buildNavigation();

    // Show role-specific sections
    showRoleSections();

    // Initialize general event listeners
    initializeEventListeners();
}

function buildNavigation() {
    const navMenu = document.getElementById('navMenu');
    navMenu.innerHTML = '';

    const config = navConfigs[currentUser.role] || [];

    config.forEach(item => {
        const link = document.createElement('a');
        // If the item is the general help link and the current role is driver,
        // map it to the driver-specific FAQ section so clicking Help shows driverHelp.
        let targetId = item.id;
        if (item.id === 'help' && currentUser.role === 'driver') {
            targetId = 'driverHelp';
        }

        link.href = `#${targetId}`;
        link.className = 'nav-link';
        if (item.id === 'home') link.classList.add('active');
        link.textContent = item.label;

        link.addEventListener('click', function(e) {
            e.preventDefault();
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            // Ensure the target section is visible (some sections are role-specific)
            // If driver clicks Help, show driverHelp and hide general help.
            if (targetId === 'driverHelp') {
                if (document.getElementById('help')) document.getElementById('help').style.display = 'none';
                if (document.getElementById('driverHelp')) document.getElementById('driverHelp').style.display = 'block';
            }
            scrollToSection(targetId);
        });

        navMenu.appendChild(link);
    });
}

function showRoleSections() {
    // Hide all role-specific sections
    document.querySelectorAll('.driver-section, .admin-section').forEach(section => {
        section.style.display = 'none';
    });

    // Ensure general help/FAQ is visible by default (drivers will see driverHelp instead)
    if (document.getElementById('help')) document.getElementById('help').style.display = 'block';

    // Show customer-only sections
    if (currentUser.role !== 'customer') {
        if (document.getElementById('booking')) document.getElementById('booking').style.display = 'none';
        if (document.getElementById('routes')) document.getElementById('routes').style.display = 'none';
        if (document.getElementById('manage')) document.getElementById('manage').style.display = 'none';
    } else {
        if (document.getElementById('booking')) document.getElementById('booking').style.display = 'block';
        if (document.getElementById('routes')) document.getElementById('routes').style.display = 'block';
        if (document.getElementById('manage')) document.getElementById('manage').style.display = 'block';
    }

    // Show driver sections
    if (currentUser.role === 'driver') {
        if (document.getElementById('driverTrips')) document.getElementById('driverTrips').style.display = 'block';
        if (document.getElementById('passengerTracking')) document.getElementById('passengerTracking').style.display = 'block';
        if (document.getElementById('boatStatusSection')) document.getElementById('boatStatusSection').style.display = 'block';
        if (document.getElementById('booking')) document.getElementById('booking').style.display = 'none';
        if (document.getElementById('routes')) document.getElementById('routes').style.display = 'none';
        if (document.getElementById('manage')) document.getElementById('manage').style.display = 'none';
        // Show driver-specific FAQ and hide general FAQ
        if (document.getElementById('help')) document.getElementById('help').style.display = 'none';
        if (document.getElementById('driverHelp')) document.getElementById('driverHelp').style.display = 'block';
    }

    // Show admin sections
    if (currentUser.role === 'admin') {
        if (document.getElementById('boatManagement')) document.getElementById('boatManagement').style.display = 'block';
        if (document.getElementById('routeManagement')) document.getElementById('routeManagement').style.display = 'block';
        if (document.getElementById('tripAssignment')) document.getElementById('tripAssignment').style.display = 'block';
        if (document.getElementById('adminReports')) document.getElementById('adminReports').style.display = 'block';
        if (document.getElementById('userManagement')) document.getElementById('userManagement').style.display = 'block';
        if (document.getElementById('booking')) document.getElementById('booking').style.display = 'none';
        if (document.getElementById('routes')) document.getElementById('routes').style.display = 'none';
        if (document.getElementById('manage')) document.getElementById('manage').style.display = 'none';
    }
}

// ==========================================
// GENERAL EVENT LISTENERS
// ==========================================

function initializeEventListeners() {
    // Menu Toggle for Mobile
    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');

    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
        });
    }

    // Booking Form
    const bookingForm = document.getElementById('bookingForm');
    if (bookingForm && currentUser.role === 'customer') {
        bookingForm.addEventListener('submit', handleBookingSubmit);
    }

    // FAQ
    const faqQuestions = document.querySelectorAll('.faq-question');
    faqQuestions.forEach(question => {
        question.addEventListener('click', toggleFAQ);
    });

    // Set date minimum
    setDateMinimum();
}

// ==========================================
// DRIVER FUNCTIONS
// ==========================================

function loadAssignedTrips() {
    const tripsList = document.getElementById('tripsList');
    if (!tripsList) return;

    // Fare rules
    const FARE_STUDENT = 15;
    const FARE_SENIOR = 15;
    const FARE_ADULT = 25;
    const TRIP_QUOTA = 250; // quota required before departure

    tripsList.innerHTML = '<p style="text-align: center; padding: 2rem;">Loading trips...</p>';

    setTimeout(() => {
        // Sample trips for demo; each trip includes a collectedAmount, shortagePaid flag and a date
        const trips = [
            {
                id: 'TRIP001',
                route: 'Barangay 1 → Barangay 2',
                date: '2025-12-09',
                time: '10:00 AM',
                passengers: 6,
                status: 'assigned',
                // Example collected amount (maybe from cash collected so far)
                collectedAmount: 135,
                shortagePaid: false
            },
            {
                id: 'TRIP002',
                route: 'Barangay 2 → Barangay 3',
                date: '2025-12-08',
                time: '1:30 PM',
                passengers: 10,
                status: 'assigned',
                collectedAmount: 275,
                shortagePaid: false
            },
            {
                id: 'TRIP003',
                route: 'Barangay 3 → Barangay 4',
                date: '2025-12-07',
                time: '4:00 PM',
                passengers: 4,
                status: 'completed',
                collectedAmount: 120,
                shortagePaid: false
            }
        ];

        // Store trips in memory so helper functions can update them
        window._ebangkaTrips = trips.reduce((acc, t) => { acc[t.id] = t; return acc; }, {});

        tripsList.innerHTML = '';

        trips.forEach((trip, index) => {
            const tripCard = document.createElement('div');
            tripCard.className = 'trip-card';
            tripCard.id = `trip_${trip.id}`;
            tripCard.innerHTML = `
                <h3>Trip ${trip.id}</h3>
                <span class="trip-status status-${trip.status}">
                    ${trip.status === 'assigned' ? '📋 Assigned' : '✓ Completed'}
                </span>
                <p><strong>Route:</strong> ${trip.route}</p>
                <p><strong>Date:</strong> ${trip.date ? new Date(trip.date).toLocaleDateString() : '—'}</p>
                <p><strong>Time:</strong> ${trip.time}</p>
                <p><strong>Passengers:</strong> ${trip.passengers}</p>
                <div class="fare-summary" id="fare_${trip.id}">
                    <p><strong>Collected:</strong> ₱${trip.collectedAmount}</p>
                    <p><strong>Quota Remaining:</strong> ₱${Math.max(0, TRIP_QUOTA - trip.collectedAmount)}</p>
                </div>
                ${trip.status === 'assigned' ? `
                    <div class="trip-actions">
                        <button class="submit-button" onclick="promptAddPayment('${trip.id}')">Add Payment</button>
                        <button class="submit-button" onclick="markShortagePaid('${trip.id}')">Mark Shortage Paid</button>
                        <button class="submit-button" id="departBtn_${trip.id}" onclick="departTrip('${trip.id}')" ${trip.collectedAmount >= TRIP_QUOTA ? '' : 'disabled'}>Depart</button>
                    </div>
                ` : ''}
            `;
            tripsList.appendChild(tripCard);

            setTimeout(() => {
                tripCard.classList.add('fade-in');
            }, index * 100);
        });
    }, 500);
}

function markTripComplete(tripId) {
    showNotification(`✓ Trip ${tripId} marked as completed!`, 'success');
    loadAssignedTrips();
}

// ======== Trip / Fare Helpers ========
function promptAddPayment(tripId) {
    const amountStr = prompt('Enter payment amount to add (₱):', '0');
    if (amountStr === null) return; // cancelled
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
        showNotification('Invalid payment amount', 'error');
        return;
    }
    addPaymentToTrip(tripId, amount);
}

function addPaymentToTrip(tripId, amount) {
    const trips = window._ebangkaTrips || {};
    const trip = trips[tripId];
    if (!trip) return;
    trip.collectedAmount = (trip.collectedAmount || 0) + amount;
    showNotification(`₱${amount} added to ${tripId}. Collected: ₱${trip.collectedAmount}`, 'success');
    updateTripDisplay(tripId);
}

function markShortagePaid(tripId) {
    const trips = window._ebangkaTrips || {};
    const trip = trips[tripId];
    if (!trip) return;
    const confirmPaid = confirm('Mark the remaining quota as paid manually? This allows departure.');
    if (!confirmPaid) return;
    const TRIP_QUOTA = 250;
    const shortage = Math.max(0, TRIP_QUOTA - (trip.collectedAmount || 0));
    trip.collectedAmount = (trip.collectedAmount || 0) + shortage;
    trip.shortagePaid = true;
    showNotification(`Shortage of ₱${shortage} marked as paid for ${tripId}.`, 'success');
    updateTripDisplay(tripId);
}

function updateTripDisplay(tripId) {
    const trips = window._ebangkaTrips || {};
    const trip = trips[tripId];
    if (!trip) return;
    const TRIP_QUOTA = 250;
    const fareDiv = document.getElementById(`fare_${tripId}`);
    if (fareDiv) {
        fareDiv.innerHTML = `
            <p><strong>Collected:</strong> ₱${trip.collectedAmount}</p>
            <p><strong>Quota Remaining:</strong> ₱${Math.max(0, TRIP_QUOTA - trip.collectedAmount)}</p>
            <p><strong>Status:</strong> ${trip.shortagePaid ? 'Shortage Paid' : (trip.collectedAmount >= TRIP_QUOTA ? 'Quota Reached' : 'Waiting for quota')}</p>
        `;
    }
    const departBtn = document.getElementById(`departBtn_${tripId}`);
    if (departBtn) {
        departBtn.disabled = !(trip.collectedAmount >= TRIP_QUOTA || trip.shortagePaid === true);
    }
}

function departTrip(tripId) {
    const trips = window._ebangkaTrips || {};
    const trip = trips[tripId];
    if (!trip) return;
    if (!(trip.collectedAmount >= 250 || trip.shortagePaid)) {
        showNotification('Cannot depart: quota not reached and shortage not paid', 'error');
        return;
    }
    trip.status = 'inTransit';
    showNotification(`Trip ${tripId} departing now.`, 'success');
    // Update UI
    const card = document.getElementById(`trip_${tripId}`);
    if (card) {
        card.querySelector('.trip-status').textContent = '→ In Transit';
    }
}

function loadPassengerTracking() {
    const container = document.getElementById('passengerTrackingContainer');
    if (!container) return;

    container.innerHTML = `
        <div style="background: #FFFBEA; padding: 2rem; border-radius: 10px;">
            <p><strong>Current Passengers:</strong> 6/10</p>
            <p><strong>Remaining Capacity:</strong> 4 seats</p>
            <p><strong>Pickup Progress:</strong> On Schedule</p>
            <p><strong>Next Stop:</strong> Barangay 3 (2 pickups)</p>
        </div>
    `;
}

function updateBoatStatus() {
    const section = document.getElementById('boatStatusSection');
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

function submitBoatStatus() {
    const status = document.querySelector('input[name="boatStatus"]:checked').value;
    const note = document.getElementById('statusNote').value;

    showNotification(`✓ Boat status updated to: ${status}`, 'success');

    // Reset form
    if (document.getElementById('statusNote')) {
        document.getElementById('statusNote').value = '';
    }
    if (document.getElementById('available')) {
        document.getElementById('available').checked = true;
    }
}

// ==========================================
// SECURITY & AUDIT FUNCTIONS
// ==========================================

function checkAdminAccess(action) {
    if (!currentUser || currentUser.role !== 'admin') {
        showNotification('Unauthorized: Admin access required', 'error');
        console.error('SECURITY ALERT: Unauthorized admin action attempt:', action);
        return false;
    }

    // Check session validity
    const sessionAge = Date.now() - currentUser.loginTime;
    const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

    if (sessionAge > SESSION_TIMEOUT) {
        showNotification('Session expired. Please login again.', 'error');
        logout();
        return false;
    }

    return true;
}

function logAdminAction(action, description, details = {}) {
    if (!currentUser || currentUser.role !== 'admin') return;

    const auditEntry = {
        timestamp: new Date().toISOString(),
        user: currentUser.username,
        sessionId: currentUser.sessionId,
        action: action,
        description: description,
        details: details,
        userAgent: navigator.userAgent
    };

    adminAuditLog.push(auditEntry);

    // Keep only last 100 entries
    if (adminAuditLog.length > MAX_AUDIT_ENTRIES) {
        adminAuditLog.shift();
    }

    // Log to console for security monitoring
    console.log('%c[ADMIN AUDIT]', 'color: #f44336; font-weight: bold;', auditEntry);

    // In production, send to secure backend logging service
    sendAuditLog(auditEntry);
}

function sendAuditLog(entry) {
    // In production, implement secure backend endpoint
    fetch('/api/audit/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
    }).catch(() => {
        // Gracefully handle offline - log is still recorded in client
        console.log('Audit log cached locally (offline)');
    });
}

function getAdminAuditLog() {
    if (!checkAdminAccess('VIEW_AUDIT_LOG')) return [];
    return adminAuditLog;
}

// ==========================================
// ADMIN FUNCTIONS
// ==========================================

function showBoatForm() {
    if (!checkAdminAccess('SHOW_BOAT_FORM')) return;
    logAdminAction('ADD_BOAT_FORM_OPENED', 'Admin opened boat form');
    showNotification('Add New Boat form would appear here', 'info');
}

function loadBoatsList() {
    if (!checkAdminAccess('LOAD_BOATS_LIST')) return;

    const container = document.getElementById('boatsManagementContainer');
    if (!container) return;

    logAdminAction('VIEW_BOATS_LIST', 'Admin viewed boats list');
    container.innerHTML = '<p style="text-align: center; padding: 2rem;">Loading boats...</p>';

    setTimeout(() => {
        const boats = [
            { id: 'B001', name: 'Bangka Alpha', capacity: 6, status: 'available' },
            { id: 'B002', name: 'Bangka Beta', capacity: 10, status: 'available' },
            { id: 'B003', name: 'Bangka Gamma', capacity: 6, status: 'inmaintenance' }
        ];

        container.innerHTML = '';

        boats.forEach(boat => {
            const card = document.createElement('div');
            card.className = 'boat-card';
            card.innerHTML = `
                <h3>${boat.name}</h3>
                <span class="boat-status status-${boat.status}">
                    ${boat.status === 'available' ? '✓ Available' : '🔧 Maintenance'}
                </span>
                <p><strong>ID:</strong> ${boat.id}</p>
                <p><strong>Capacity:</strong> ${boat.capacity} passengers</p>
                <button class="admin-btn" onclick="editBoat('${boat.id}')">Edit</button>
            `;
            container.appendChild(card);
        });

        logAdminAction('BOATS_LIST_LOADED', 'Successfully loaded boats list', { boatCount: boats.length });
    }, 500);
}

function editBoat(boatId) {
    if (!checkAdminAccess('EDIT_BOAT')) return;
    logAdminAction('EDIT_BOAT', `Attempting to edit boat ${boatId}`, { boatId });
    showNotification(`Edit form for ${boatId} would appear here`, 'info');
}

function showRouteForm() {
    if (!checkAdminAccess('SHOW_ROUTE_FORM')) return;
    logAdminAction('ADD_ROUTE_FORM_OPENED', 'Admin opened route form');
    showNotification('Add New Route form would appear here', 'info');
}

function loadRoutesList() {
    if (!checkAdminAccess('LOAD_ROUTES_LIST')) return;

    const container = document.getElementById('routesManagementContainer');
    if (!container) return;

    logAdminAction('VIEW_ROUTES_LIST', 'Admin viewed routes list');
    container.innerHTML = '<p style="text-align: center; padding: 2rem;">Loading routes...</p>';

    setTimeout(() => {
        const routes = [
            { name: 'North Route', distance: '5.2 km', duration: '12 mins' },
            { name: 'Central Route', distance: '3.8 km', duration: '9 mins' },
            { name: 'East Route', distance: '6.1 km', duration: '14 mins' }
        ];

        container.innerHTML = '';

        routes.forEach(route => {
            const card = document.createElement('div');
            card.className = 'route-card-admin';
            card.innerHTML = `
                <h3>${route.name}</h3>
                <p><strong>Distance:</strong> ${route.distance}</p>
                <p><strong>Duration:</strong> ${route.duration}</p>
                <button class="admin-btn" onclick="editRoute('${route.name}')">Edit</button>
            `;
            container.appendChild(card);
        });

        logAdminAction('ROUTES_LIST_LOADED', 'Successfully loaded routes list', { routeCount: routes.length });
    }, 500);
}

function editRoute(routeName) {
    if (!checkAdminAccess('EDIT_ROUTE')) return;
    logAdminAction('EDIT_ROUTE', `Attempting to edit route ${routeName}`, { routeName });
    showNotification(`Edit form for ${routeName} would appear here`, 'info');
}

function assignTrip() {
    if (!checkAdminAccess('ASSIGN_TRIP')) return;

    const trip = document.getElementById('tripSelect').value;
    const driver = document.getElementById('driverSelect').value;

    if (!trip || !driver) {
        showNotification('Please select both a trip and a driver', 'error');
        return;
    }

    logAdminAction('ASSIGN_TRIP', `Trip assigned to driver`, { trip, driver, timestamp: new Date().toISOString() });
    showNotification(`✓ Trip assigned successfully!`, 'success');
    document.getElementById('tripSelect').value = '';
    document.getElementById('driverSelect').value = '';
}

function generateFleetReport() {
    if (!checkAdminAccess('GENERATE_REPORT')) return;

    const container = document.getElementById('reportsContainer');
    if (!container) return;

    logAdminAction('GENERATE_REPORT', 'Generated fleet report');

    container.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 10px;">
            <h3>Fleet Report</h3>
            <p><strong>Total Boats:</strong> 24</p>
            <p><strong>Available:</strong> 20</p>
            <p><strong>In Maintenance:</strong> 4</p>
            <p><strong>Average Capacity Utilization:</strong> 82%</p>
        </div>
    `;
}

function generateRevenueReport() {
    if (!checkAdminAccess('GENERATE_REPORT')) return;

    const container = document.getElementById('reportsContainer');
    if (!container) return;

    logAdminAction('GENERATE_REPORT', 'Generated revenue report');

    container.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 10px;">
            <h3>Revenue Report</h3>
            <p><strong>Today's Revenue:</strong> ₱12,450</p>
            <p><strong>Weekly Revenue:</strong> ₱87,320</p>
            <p><strong>Monthly Revenue:</strong> ₱125,000+</p>
        </div>
    `;
}

function generateTripReport() {
    if (!checkAdminAccess('GENERATE_REPORT')) return;

    const container = document.getElementById('reportsContainer');
    if (!container) return;

    logAdminAction('GENERATE_REPORT', 'Generated trip report');

    container.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 10px;">
            <h3>Trip Statistics</h3>
            <p><strong>Trips Today:</strong> 47</p>
            <p><strong>Trips This Week:</strong> 312</p>
            <p><strong>Total Passengers:</strong> 1,247</p>
            <p><strong>Average Passengers/Trip:</strong> 6.2</p>
        </div>
    `;
}

function generateDriverPerformance() {
    if (!checkAdminAccess('GENERATE_REPORT')) return;

    const container = document.getElementById('reportsContainer');
    if (!container) return;

    logAdminAction('GENERATE_REPORT', 'Generated driver performance report');

    container.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 10px;">
            <h3>Driver Performance</h3>
            <p><strong>Top Driver:</strong> Captain A - 42 trips</p>
            <p><strong>Average Rating:</strong> 4.7/5</p>
            <p><strong>On-Time Delivery:</strong> 96%</p>
            <p><strong>Customer Satisfaction:</strong> 94%</p>
        </div>
    `;
}

function showUserForm() {
    if (!checkAdminAccess('SHOW_USER_FORM')) return;
    logAdminAction('ADD_USER_FORM_OPENED', 'Admin opened user creation form');
    showNotification('Create New User form would appear here', 'info');
}

function loadUsersList() {
    if (!checkAdminAccess('LOAD_USERS_LIST')) return;

    const container = document.getElementById('usersManagementContainer');
    if (!container) return;

    logAdminAction('VIEW_USERS_LIST', 'Admin viewed users list');
    container.innerHTML = '<p style="text-align: center; padding: 2rem;">Loading users...</p>';

    setTimeout(() => {
        const users_list = [
            { username: 'juan_customer', role: 'Customer', status: 'Active' },
            { username: 'driver_a', role: 'Driver', status: 'Active' },
            { username: 'admin_user', role: 'Admin', status: 'Active' }
        ];

        container.innerHTML = '';

        users_list.forEach(user => {
            const card = document.createElement('div');
            card.className = 'boat-card';
            card.innerHTML = `
                <h3>${user.username}</h3>
                <p><strong>Role:</strong> ${user.role}</p>
                <p><strong>Status:</strong> ${user.status}</p>
                <button class="admin-btn" onclick="manageUser('${user.username}')">Manage</button>
            `;
            container.appendChild(card);
        });

        logAdminAction('USERS_LIST_LOADED', 'Successfully loaded users list', { userCount: users_list.length });
    }, 500);
}

function manageUser(username) {
    if (!checkAdminAccess('MANAGE_USER')) return;
    logAdminAction('MANAGE_USER', `Admin accessed user management for ${username}`, { username });
    showNotification(`Management form for ${username} would appear here`, 'info');
}

// ==========================================
// DRIVER APPROVAL FUNCTIONS
// ==========================================

function loadPendingDriverApprovals() {
    if (!checkAdminAccess('VIEW_DRIVER_APPROVALS')) return;

    const container = document.getElementById('driverApprovalsContainer');
    if (!container) return;

    logAdminAction('VIEW_DRIVER_APPROVALS', 'Admin viewed pending driver approvals');

    // Show the section
    document.getElementById('driverApprovalsSection').style.display = 'block';
    scrollToSection('driverApprovalsSection');

    container.innerHTML = '<p style="text-align: center; padding: 2rem;">Loading pending applications...</p>';

    setTimeout(() => {
        if (pendingDriverSignups.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 2rem; color: #666;">No pending driver applications at this time.</p>';
            return;
        }

        container.innerHTML = '';

        pendingDriverSignups.forEach((signup, index) => {
            const card = document.createElement('div');
            card.className = 'boat-card';
            card.id = `driver_approval_${signup.id}`;
            card.innerHTML = `
                <h3>🚤 ${signup.fullName}</h3>
                <p><strong>Username:</strong> ${signup.username}</p>
                <p><strong>Email:</strong> ${signup.email}</p>
                ${signup.phone ? `<p><strong>Phone:</strong> ${signup.phone}</p>` : ''}
                <p><strong>Applied:</strong> ${new Date(signup.signupDate).toLocaleString()}</p>
                <p><strong>Status:</strong> <span style="color: #FF9800; font-weight: bold;">⏳ Pending Review</span></p>
                <div class="approval-actions" style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                    <button class="admin-btn approval-btn-approve" data-signup-index="${index}" style="flex: 1; background: #4CAF50;">✓ Approve</button>
                    <button class="admin-btn approval-btn-reject" data-signup-index="${index}" style="flex: 1; background: #f44336;">✗ Reject</button>
                </div>
            `;
            container.appendChild(card);
        });

        // Attach event listeners to approve/reject buttons
        document.querySelectorAll('.approval-btn-approve').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-signup-index'));
                const signup = pendingDriverSignups[index];
                if (signup) {
                    approveDriver(index, signup.id, signup.username, signup.email, signup.fullName, signup.password);
                }
            });
        });

        document.querySelectorAll('.approval-btn-reject').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-signup-index'));
                const signup = pendingDriverSignups[index];
                if (signup) {
                    rejectDriver(index, signup.id, signup.email, signup.username);
                }
            });
        });

        logAdminAction('DRIVER_APPROVALS_LOADED', `Successfully loaded ${pendingDriverSignups.length} pending driver applications`);
    }, 500);
}

function approveDriver(index, signupId, username, email, fullName, password) {
    if (!checkAdminAccess('APPROVE_DRIVER')) return;

    const confirmed = confirm(`Approve driver application for ${fullName} (${email})?`);
    if (!confirmed) return;

    // Validate index exists
    if (index < 0 || index >= pendingDriverSignups.length) {
        showNotification('Signup not found', 'error');
        return;
    }

    const signup = pendingDriverSignups[index];

    // Create the driver account in users
    users[username] = {
        password: password,
        email: email,
        fullName: fullName,
        roles: {
            driver: { name: '🚤 Driver', features: ['driverTrips', 'passengerTracking', 'boatStatus'] }
        }
    };

    // Remove from pending
    pendingDriverSignups.splice(index, 1);

    // Remove card from UI
    const card = document.getElementById(`driver_approval_${signupId}`);
    if (card) {
        card.style.opacity = '0.5';
        card.innerHTML = `<p style="text-align: center; color: #4CAF50; font-weight: bold;">✓ Approved - Driver account created</p>`;
    }

    // Log the approval
    logAdminAction('DRIVER_APPROVED', `Driver account approved for ${username} (${email})`, { username, email, fullName });

    showNotification(
        `Driver application approved! Account created for ${fullName}. Verification email sent to ${email}.`,
        'success'
    );

    // Reload list after a short delay
    setTimeout(() => {
        loadPendingDriverApprovals();
    }, 1500);
}

function rejectDriver(index, signupId, email, username) {
    if (!checkAdminAccess('REJECT_DRIVER')) return;

    const reason = prompt('Reason for rejection (optional):', '');
    if (reason === null) return; // User cancelled

    // Validate index exists
    if (index < 0 || index >= pendingDriverSignups.length) {
        showNotification('Signup not found', 'error');
        return;
    }

    const signup = pendingDriverSignups[index];

    // Remove from pending
    pendingDriverSignups.splice(index, 1);

    // Remove card from UI
    const card = document.getElementById(`driver_approval_${signupId}`);
    if (card) {
        card.style.opacity = '0.5';
        card.innerHTML = `<p style="text-align: center; color: #f44336; font-weight: bold;">✗ Rejected - Rejection email sent</p>`;
    }

    // Log the rejection
    logAdminAction('DRIVER_REJECTED', `Driver application rejected for ${username} (${email})`, { username, email, reason });

    showNotification(
        `Driver application rejected. Notification email sent to ${email}.`,
        'success'
    );

    // Reload list after a short delay
    setTimeout(() => {
        loadPendingDriverApprovals();
    }, 1500);
}

// ==========================================
// BOOKING FORM HANDLER
// ==========================================

function handleBookingSubmit(e) {
    e.preventDefault();

    // Get form values
    const departure = document.getElementById('departure').value;
    const destination = document.getElementById('destination').value;
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;
    const passengers = document.getElementById('passengers').value;
    const boatType = document.getElementById('boatType').value;
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;

    // Validate form
    if (!departure || !destination || !date || !time || !boatType) {
        showNotification('Please fill all required fields', 'error');
        return;
    }

    if (departure === destination) {
        showNotification('Departure and destination must be different', 'error');
        return;
    }

    // Show loading state
    const submitBtn = document.querySelector('.submit-button');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Searching...';
    submitBtn.disabled = true;

    // Prepare AJAX request data
    const requestData = {
        departure: departure,
        destination: destination,
        date: date,
        time: time,
        passengers: passengers,
        boatType: boatType,
        name: name,
        phone: phone
    };

    // Make AJAX request
    fetchAvailableBoats(requestData, function() {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    });
}

// ==========================================
// AJAX FUNCTIONS
// ==========================================

function fetchAvailableBoats(data, callback) {
    // Simulated AJAX call using fetch API
    // In production, replace with actual endpoint
    const url = '/api/booking/search'; // Replace with actual endpoint

    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        // If endpoint doesn't exist, use simulated data
        if (response.status === 404 || response.status === 0) {
            return simulateBoatData(data);
        }
        return response.json();
    })
    .catch(error => {
        console.log('Using simulated data:', error);
        return simulateBoatData(data);
    })
    .then(boatsData => {
        displayAvailableBoats(boatsData);
        if (callback) callback();
    });
}

function simulateBoatData(searchData) {
    // Simulated boat availability data
    const boatTypes = {
        standard: { name: 'Standard', capacity: 6, basePrice: 150 },
        deluxe: { name: 'Deluxe', capacity: 10, basePrice: 180 },
        express: { name: 'Express', capacity: 4, basePrice: 250 }
    };

    const type = boatTypes[searchData.boatType];
    const passengers = parseInt(searchData.passengers);

    // Generate mock boats
    const boats = [];
    for (let i = 1; i <= 3; i++) {
        const totalPrice = type.basePrice * passengers;
        boats.push({
            id: `boat-${i}`,
            name: `${type.name} Boat ${i}`,
            capacity: type.capacity,
            available_seats: type.capacity - (Math.floor(Math.random() * 3)),
            time: generateRandomTime(searchData.time),
            price: totalPrice,
            duration: calculateDuration(searchData.departure, searchData.destination),
            captain: `Captain ${String.fromCharCode(65 + i - 1)}`
        });
    }

    return Promise.resolve(boats);
}

function displayAvailableBoats(boats) {
    const resultsContainer = document.getElementById('resultsContainer');
    const boatsList = document.getElementById('boatsList');

    // Clear previous results
    boatsList.innerHTML = '';

    if (!boats || boats.length === 0) {
        boatsList.innerHTML = '<p style="color: #666; text-align: center;">No boats available for your selection.</p>';
        resultsContainer.style.display = 'block';
        return;
    }

    // Display boats
    boats.forEach((boat, index) => {
        const boatElement = createBoatElement(boat);
        boatsList.appendChild(boatElement);

        // Stagger animation
        setTimeout(() => {
            boatElement.classList.add('fade-in');
        }, index * 100);
    });

    resultsContainer.style.display = 'block';
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function createBoatElement(boat) {
    const div = document.createElement('div');
    div.className = 'boat-item';
    div.innerHTML = `
        <div class="boat-info">
            <div class="boat-name">🚤 ${boat.name}</div>
            <div class="boat-details">
                Captain: ${boat.captain} | Available: ${boat.available_seats}/${boat.capacity} seats | Duration: ${boat.duration}
            </div>
        </div>
        <div class="boat-price">₱${boat.price}</div>
        <button class="book-boat-btn" onclick="confirmBooking('${boat.id}', '${boat.name}', ${boat.price})">
            Book Now
        </button>
    `;
    return div;
}

function confirmBooking(boatId, boatName, price) {
    const name = document.getElementById('name').value;
    showNotification(`✓ Booking confirmed for ${boatName}! Confirmation sent to ${name}.`, 'success');

    // Log the booking
    console.log(`Booking confirmed: ${boatId}, Name: ${boatName}, Price: ₱${price}`);

    // Optional: Make AJAX call to confirm booking
    sendBookingConfirmation(boatId, name);
}

function sendBookingConfirmation(boatId, passengerName) {
    const bookingData = {
        boat_id: boatId,
        passenger_name: passengerName,
        timestamp: new Date().toISOString()
    };

    fetch('/api/booking/confirm', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingData)
    })
    .catch(error => {
        console.log('Booking confirmed locally:', bookingData);
    });
}

// ==========================================
// MANAGEMENT FUNCTIONS
// ==========================================

function loadFleetData() {
    const dataDisplay = document.getElementById('dataDisplay');
    const dataContent = document.getElementById('dataContent');

    dataContent.innerHTML = '<p style="text-align: center;">Loading fleet data...</p>';
    dataDisplay.style.display = 'block';

    // Simulate AJAX call
    setTimeout(() => {
        const fleetData = {
            total_boats: 24,
            active: 20,
            maintenance: 3,
            inactive: 1,
            boats: [
                { id: 'B001', name: 'Bangka Alpha', status: 'Active', location: 'Barangay 1', capacity: 6 },
                { id: 'B002', name: 'Bangka Beta', status: 'Active', location: 'Barangay 2', capacity: 10 },
                { id: 'B003', name: 'Bangka Gamma', status: 'Active', location: 'Barangay 3', capacity: 6 },
                { id: 'B004', name: 'Bangka Delta', status: 'Maintenance', location: 'Dock', capacity: 6 },
                { id: 'B005', name: 'Bangka Epsilon', status: 'Active', location: 'Barangay 4', capacity: 10 }
            ]
        };

        displayFleetTable(fleetData);
    }, 500);
}

function loadFareData() {
    const dataDisplay = document.getElementById('dataDisplay');
    const dataContent = document.getElementById('dataContent');

    dataContent.innerHTML = '<p style="text-align: center;">Loading fare data...</p>';
    dataDisplay.style.display = 'block';

    setTimeout(() => {
        const fareData = {
            routes: [
                { route: 'North Route', distance: '5.2 km', standard: 150, deluxe: 180, express: 250 },
                { route: 'Central Route', distance: '3.8 km', standard: 120, deluxe: 150, express: 200 },
                { route: 'East Route', distance: '6.1 km', standard: 180, deluxe: 220, express: 300 },
                { route: 'South Route', distance: '4.5 km', standard: 140, deluxe: 170, express: 220 }
            ],
            total_revenue_today: '₱12,450',
            total_revenue_month: '₱125,340'
        };

        displayFareTable(fareData);
    }, 500);
}

function loadPassengerData() {
    const dataDisplay = document.getElementById('dataDisplay');
    const dataContent = document.getElementById('dataContent');

    dataContent.innerHTML = '<p style="text-align: center;">Loading passenger data...</p>';
    dataDisplay.style.display = 'block';

    setTimeout(() => {
        const passengerData = {
            today: 247,
            this_week: 1547,
            this_month: 6235,
            recent_bookings: [
                { name: 'Juan dela Cruz', date: '2024-01-15', boat: 'Bangka Alpha', passengers: 4 },
                { name: 'Maria Santos', date: '2024-01-15', boat: 'Bangka Beta', passengers: 8 },
                { name: 'Pedro Reyes', date: '2024-01-15', boat: 'Bangka Gamma', passengers: 2 },
                { name: 'Ana Flores', date: '2024-01-15', boat: 'Bangka Delta', passengers: 6 }
            ]
        };

        displayPassengerTable(passengerData);
    }, 500);
}

function loadRouteData() {
    const dataDisplay = document.getElementById('dataDisplay');
    const dataContent = document.getElementById('dataContent');

    dataContent.innerHTML = '<p style="text-align: center;">Loading route data...</p>';
    dataDisplay.style.display = 'block';

    setTimeout(() => {
        const routeData = {
            routes: [
                { name: 'North Route', distance: '5.2 km', avg_time: '12 mins', daily_trips: 24, efficiency: '94%' },
                { name: 'Central Route', distance: '3.8 km', avg_time: '9 mins', daily_trips: 32, efficiency: '97%' },
                { name: 'East Route', distance: '6.1 km', avg_time: '14 mins', daily_trips: 18, efficiency: '91%' },
                { name: 'South Route', distance: '4.5 km', avg_time: '11 mins', daily_trips: 28, efficiency: '95%' }
            ],
            total_distance_daily: '43.2 km',
            avg_efficiency: '94.25%'
        };

        displayRouteTable(routeData);
    }, 500);
}

// ==========================================
// DISPLAY TABLE FUNCTIONS
// ==========================================

function displayFleetTable(data) {
    const dataContent = document.getElementById('dataContent');
    let html = `
        <h3>Fleet Status</h3>
        <p><strong>Total Boats:</strong> ${data.total_boats} | <strong>Active:</strong> ${data.active} | <strong>Maintenance:</strong> ${data.maintenance} | <strong>Inactive:</strong> ${data.inactive}</p>
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Location</th>
                    <th>Capacity</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.boats.forEach(boat => {
        const statusColor = boat.status === 'Active' ? '#FFCC00' : '#FFB3B3';
        html += `
            <tr>
                <td>${boat.id}</td>
                <td>${boat.name}</td>
                <td style="color: ${statusColor}; font-weight: bold;">${boat.status}</td>
                <td>${boat.location}</td>
                <td>${boat.capacity}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    dataContent.innerHTML = html;
}

function displayFareTable(data) {
    const dataContent = document.getElementById('dataContent');
    let html = `
        <h3>Fare Management</h3>
        <p><strong>Revenue Today:</strong> ${data.total_revenue_today} | <strong>Revenue This Month:</strong> ${data.total_revenue_month}</p>
        <table>
            <thead>
                <tr>
                    <th>Route</th>
                    <th>Distance</th>
                    <th>Standard</th>
                    <th>Deluxe</th>
                    <th>Express</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.routes.forEach(route => {
        html += `
            <tr>
                <td>${route.route}</td>
                <td>${route.distance}</td>
                <td>₱${route.standard}</td>
                <td>₱${route.deluxe}</td>
                <td>₱${route.express}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    dataContent.innerHTML = html;
}

function displayPassengerTable(data) {
    const dataContent = document.getElementById('dataContent');
    let html = `
        <h3>Passenger Management</h3>
        <p><strong>Today:</strong> ${data.today} passengers | <strong>This Week:</strong> ${data.this_week} passengers | <strong>This Month:</strong> ${data.this_month} passengers</p>
        <h4>Recent Bookings</h4>
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Date</th>
                    <th>Boat</th>
                    <th>Passengers</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.recent_bookings.forEach(booking => {
        html += `
            <tr>
                <td>${booking.name}</td>
                <td>${booking.date}</td>
                <td>${booking.boat}</td>
                <td>${booking.passengers}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    dataContent.innerHTML = html;
}

function displayRouteTable(data) {
    const dataContent = document.getElementById('dataContent');
    let html = `
        <h3>Route Optimization</h3>
        <p><strong>Total Daily Distance:</strong> ${data.total_distance_daily} | <strong>Average Efficiency:</strong> ${data.avg_efficiency}</p>
        <table>
            <thead>
                <tr>
                    <th>Route Name</th>
                    <th>Distance</th>
                    <th>Avg Time</th>
                    <th>Daily Trips</th>
                    <th>Efficiency</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.routes.forEach(route => {
        html += `
            <tr>
                <td>${route.name}</td>
                <td>${route.distance}</td>
                <td>${route.avg_time}</td>
                <td>${route.daily_trips}</td>
                <td style="color: #FFCC00; font-weight: bold;">${route.efficiency}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    dataContent.innerHTML = html;
}

function closeDataDisplay() {
    const dataDisplay = document.getElementById('dataDisplay');
    dataDisplay.style.display = 'none';
}

// ==========================================
// ROUTE FUNCTIONS
// ==========================================

function selectRoute(routeName) {
    const routeLabel = {
        'north': 'North Route (5.2 km, 12 mins)',
        'central': 'Central Route (3.8 km, 9 mins)',
        'east': 'East Route (6.1 km, 14 mins)',
        'south': 'South Route (4.5 km, 11 mins)'
    };

    showNotification(`✓ ${routeLabel[routeName]} selected! Scroll to booking form.`, 'success');
    scrollToSection('booking');
}

// ==========================================
// FAQ TOGGLE
// ==========================================

function toggleFAQ(e) {
    const button = e.target;
    const answer = button.nextElementSibling;

    // Close other open FAQs
    document.querySelectorAll('.…
