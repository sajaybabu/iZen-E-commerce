const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');

/**
 * @param {string} email - Recipient's email
 * @param {string} subject - The subject line for the email
 * @param {object} templateData - Object containing { title, message, otp }
 */
const sendOTP = async (email, subject, templateData) => {
    try {
        //  Connection to Google
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            host: 'smtp.gmail.com',
            port: 587,
            secure: false, 
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS 
            }
        });

        const templatePath = path.join(__dirname, '../views/emails/otp-template.ejs');

        //  Render the EJS file into a string of HTML
        const html = await ejs.renderFile(templatePath, templateData);

        //  Define the Email Content
        const mailOptions = {
            from: {
                name: 'iZen Support',
                address: process.env.EMAIL_USER
            },
            to: email,
            subject: subject,
            html: html // The rendered EJS content
        };

        //  Send the Mail
        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent successfully: %s", info.messageId);
        return true;

    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
};

module.exports = sendOTP;