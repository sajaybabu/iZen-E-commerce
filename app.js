const express = require('express');
const connectDB = require('./config/db');
const dotenv = require('dotenv');
const path = require('path');
const session = require('express-session');
const userRoutes = require('./routes/userRoutes'); 

dotenv.config();
const app = express();

// Connect to MongoDB
connectDB();

// Body Parser Middleware 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Configuration 
app.use(session({
    secret: 'izen_secret_key', 
    resave: false,
    saveUninitialized: true,
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24, // Session valid for 24 hours
        secure: false 
    }
}));

// This helps your EJS files know if a user is logged in (to show "Logout" vs "Login")
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