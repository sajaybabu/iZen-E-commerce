const nodemailer = require('nodemailer');

const sendOTP = async (email, otp) => {
    try {
        // The Connection to Google
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            host: 'smtp.gmail.com',
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS 
            }
        });

        // 2. Define the Email Content
        const mailOptions = {
            from: {
                name: 'iZen Support',
                address: process.env.EMAIL_USER
            },
            to: email,
            subject: 'Verify your iZen Account',
            html: `
                <div style="font-family: Helvetica, Arial, sans-serif; min-width: 1000px; overflow: auto; line-height: 2">
                    <div style="margin: 50px auto; width: 70%; padding: 20px 0">
                        <p style="font-size: 1.1em">Hi,</p>
                        <p>Thank you for choosing iZen. Use the following OTP to complete your Sign Up procedures. OTP is valid for 5 minutes</p>
                        <h2 style="background: #1d1d1f; margin: 0 auto; width: max-content; padding: 0 10px; color: #fff; border-radius: 4px;">${otp}</h2>
                        <p style="font-size: 0.9em;">Regards,<br />iZen Team</p>
                    </div>
                </div>`
        };

        // 3. Send the Mail
        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent successfully: %s", info.messageId);
        return true;

    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
};

module.exports = sendOTP;