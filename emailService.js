import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid'; // Import uuid to generate unique IDs

// Configure the email transporter using credentials from the .env file
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Sends a reminder email and creates a corresponding notification object.
 * @param {Array<string>} recipientEmails - An array of email addresses to send the reminder to.
 * @param {Array<object>} expiringItems - An array of items that are nearing their expiration date.
 * @returns {object|null} A notification object if an email was sent, otherwise null.
 */
export const sendReminderEmail = (recipientEmails, expiringItems) => {
  if (!recipientEmails || recipientEmails.length === 0) {
    console.log('No recipient emails configured. Skipping reminder.');
    return null; // Return null if no recipients are configured
  }
  if (!expiringItems || expiringItems.length === 0) {
    console.log('No items are expiring soon. No reminder needed.');
    return null; // Return null if there's nothing to report
  }

  // Create an HTML list of the expiring items
  const itemsHtml = `
    <ul>
      ${expiringItems.map(item => `
        <li>
          <strong>${item.description}</strong> (Code: ${item.id}) - 
          Expires on: ${new Date(item.expiryDate).toLocaleDateString()} - 
          Quantity: ${item.quantity}
        </li>
      `).join('')}
    </ul>
  `;

  const mailOptions = {
    from: `"Inventory System" <${process.env.EMAIL_USER}>`,
    to: recipientEmails.join(', '), // Send to all recipients
    subject: `⚠️ Expiry Date Reminder - ${expiringItems.length} item(s)`,
    html: `
      <p>Hello,</p>
      <p>This is an automated reminder that the following items are expiring soon:</p>
      ${itemsHtml}
      <p>Please review your stock.</p>
    `,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.error('Error sending email:', error);
    }
    console.log('Reminder email sent successfully:', info.response);
  });

  // Return a notification object to be saved to the database
  return {
    id: uuidv4(),
    date: new Date().toISOString(),
    type: 'reminder',
    content: `Sent reminder for ${expiringItems.length} expiring item(s).`,
    read: false,
  };
};

