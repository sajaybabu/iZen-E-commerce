const express = require('express');
const connectDB = require('./config/db');
const dotenv = require('dotenv');
const path = require('path');
const session = require('express-session');
const userRoutes = require('./routes/userRoutes');
const passport = require('./config/passport'); 

dotenv.config();
const app = express();

// Connect to MongoDB
connectDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. SESSION CONFIGURATION (Must come before Passport)
app.use(session({
    secret: 'izen_secret_key', 
    resave: false,
    saveUninitialized: true, // Set to false in production for better privacy
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24, // Session valid for 24 hours
        secure: false 
    }
}));

// 2. PASSPORT INITIALIZATION (Must come after Session)
app.use(passport.initialize());
app.use(passport.session());

// 3. LOCALS MIDDLEWARE
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/', userRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));