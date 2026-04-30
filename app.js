const dotenv = require('dotenv');
const express = require('express');
const connectDB = require('./config/db');
const path = require('path');
const session = require('express-session');
const passport = require('./config/passport'); 

// --- ROUTE IMPORTS ---
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoute'); 

dotenv.config();
const app = express();

// Connect to MongoDB
connectDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. SESSION CONFIGURATION
app.use(session({
    secret: 'izen_secret_key', 
    resave: false,
    saveUninitialized: true,
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24, 
        secure: false 
    }
}));

// 2. PASSPORT INITIALIZATION
app.use(passport.initialize());
app.use(passport.session());

// 3. LOCALS MIDDLEWARE
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.admin = req.session.admin || null; 
    next();
});

// View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static Files
app.use(express.static(path.join(__dirname, 'public')));

// --- ROUTES ---
app.use('/', userRoutes);
app.use('/admin', adminRoutes); 

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));