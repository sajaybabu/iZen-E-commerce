const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userModel'); 

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
        // Check if user already exists by googleId or email
        let user = await User.findOne({ 
            $or: [{ googleId: profile.id }, { email: profile.emails[0].value }] 
        });

        if (user) {
            // Check if the existing user is blocked
            if (user.isBlocked) {
                return done(null, false, { message: 'Your account has been blocked by the admin.' });
            }

            // Update googleId if they previously signed up with email
            if (!user.googleId) {
                user.googleId = profile.id;
                // Clean up any empty address objects before saving
                if (user.addresses && user.addresses.length > 0) {
                    user.addresses = user.addresses.filter(addr => addr.city && addr.address);
                }
                await user.save({ validateBeforeSave: false }); 
            }
            return done(null, user);
        } else {
            // Create new user 
            user = new User({
                username: profile.displayName,
                email: profile.emails[0].value,
                googleId: profile.id,
                isBlocked: false,
                isVerified: true
            });
            
            await user.save({ validateBeforeSave: false }); // <-- Added options flag
            return done(null, user);
        }
    } catch (err) {
        return done(err, null);
    }
  }
));

// Session handling
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

module.exports = passport;