/* eslint-disable no-unused-vars */
import fs from 'fs';
import readline from 'readline';
import { promisify } from 'util';
import mimeMessage from 'mime-message';
import { gmail_v1 as gmailV1, google } from 'googleapis';

// Scopes required for Gmail API access
const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];
// Path where the user's tokens are stored
const TOKEN_PATH = 'token.json';
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

/**
 * Prompts the user for authorization and stores the obtained token.
 * After receiving the token, the callback function is executed with the OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client OAuth2 client for token retrieval.
 * @param {getEventsCallback} callback Function to execute with the authorized client.
 */
async function obtainNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  
  console.log('Please authorize the app by visiting this URL:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  rl.question('Enter the code from the URL here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) {
        console.error('Error fetching access token:', err);
        return;
      }
      oAuth2Client.setCredentials(token);
      writeFileAsync(TOKEN_PATH, JSON.stringify(token))
        .then(() => {
          console.log('Token has been stored at', TOKEN_PATH);
          callback(oAuth2Client);
        })
        .catch((writeErr) => console.error('Error writing token to file:', writeErr));
    });
  });
}

/**
 * Initializes an OAuth2 client with the provided credentials and executes the callback.
 * If no token is found, it triggers the process to get a new token.
 * @param {Object} credentials OAuth2 credentials for the client.
 * @param {function} callback Function to execute with the authorized OAuth2 client.
 */
async function initializeAuthorization(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  
  console.log('Starting client authorization...');
  
  // Attempt to read the stored token, if available.
  await readFileAsync(TOKEN_PATH)
    .then((token) => {
      oAuth2Client.setCredentials(JSON.parse(token));
      callback(oAuth2Client);
    }).catch(async () => obtainNewToken(oAuth2Client, callback));
  
  console.log('Client authorization completed');
}

/**
 * Sends an email using the authorized OAuth2 client and Gmail API.
 * @param {google.auth.OAuth2} auth Authorized OAuth2 client.
 * @param {gmailV1.Schema$Message} mail The email message to send.
 */
function sendEmail(auth, mail) {
  const gmail = google.gmail({ version: 'v1', auth });
  
  gmail.users.messages.send({
    userId: 'me',
    requestBody: mail,
  }, (err, _res) => {
    if (err) {
      console.error(`API returned an error: ${err.message || err.toString()}`);
      return;
    }
    console.log('Email successfully sent');
  });
}

/**
 * A class for handling email-related operations with Gmail API.
 */
export default class Mailer {
  /**
   * Verifies whether the user has valid credentials.
   */
  static verifyAuthorization() {
    readFileAsync('credentials.json')
      .then(async (content) => {
        await initializeAuthorization(JSON.parse(content), (auth) => {
          if (auth) {
            console.log('Authorization successful');
          }
        });
      })
      .catch((err) => {
        console.error('Error loading client credentials:', err);
      });
  }

  /**
   * Constructs an email message in MIME format.
   * @param {String} dest The recipient's email address.
   * @param {String} subject The subject of the email.
   * @param {String} message The HTML body of the email.
   * @returns {Object} The MIME encoded message ready to be sent.
   */
  static createMessage(dest, subject, message) {
    const senderEmail = process.env.GMAIL_SENDER;
    const messageData = {
      type: 'text/html',
      encoding: 'UTF-8',
      from: senderEmail,
      to: [dest],
      cc: [],
      bcc: [],
      replyTo: [],
      date: new Date(),
      subject,
      body: message,
    };

    if (!senderEmail) {
      throw new Error('Sender email is not configured');
    }
    if (mimeMessage.validMimeMessage(messageData)) {
      const mimeMessage = mimeMessage.createMimeMessage(messageData);
      return { raw: mimeMessage.toBase64SafeString() };
    }
    throw new Error('Invalid MIME message format');
  }

  /**
   * Sends an email after constructing the MIME message.
   * @param {Object} mail The MIME message to send.
   */
  static dispatchMail(mail) {
    readFileAsync('credentials.json')
      .then(async (content) => {
        await initializeAuthorization(
          JSON.parse(content),
          (auth) => sendEmail(auth, mail),
        );
      })
      .catch((err) => {
        console.error('Error loading client credentials:', err);
      });
  }
}
