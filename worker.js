/* eslint-disable import/no-named-as-default */
import { writeFile } from 'fs';
import { promisify } from 'util';
import Queue from 'bull/lib/queue';
import imgThumbnail from 'image-thumbnail';
import mongoDBCore from 'mongodb/lib/core';
import dbClient from './utils/db';
import Mailer from './utils/mailer';

const writeFileAsync = promisify(writeFile);
const fileProcessingQueue = new Queue('thumbnail generation');
const emailSendingQueue = new Queue('email dispatch');

/**
 * Creates a resized version of an image, generating a thumbnail of a specified width.
 * @param {String} filePath The path to the original image file.
 * @param {number} size The desired width of the generated thumbnail.
 * @returns {Promise<void>}
 */
const createThumbnail = async (filePath, size) => {
  const buffer = await imgThumbnail(filePath, { width: size });
  console.log(`Creating thumbnail for file: ${filePath}, width: ${size}`);
  return writeFileAsync(`${filePath}_${size}`, buffer);
};

// Queue to process image thumbnail creation jobs
fileProcessingQueue.process(async (job, done) => {
  const { fileId, userId } = job.data;

  if (!fileId) {
    throw new Error('File ID is required');
  }
  if (!userId) {
    throw new Error('User ID is required');
  }

  console.log(`Processing job for file: ${job.data.name || 'unknown'}`);
  
  const file = await (await dbClient.filesCollection())
    .findOne({
      _id: new mongoDBCore.BSON.ObjectId(fileId),
      userId: new mongoDBCore.BSON.ObjectId(userId),
    });
  
  if (!file) {
    throw new Error('File not found');
  }

  const thumbnailSizes = [500, 250, 100];
  Promise.all(thumbnailSizes.map((size) => createThumbnail(file.localPath, size)))
    .then(() => {
      done();
    });
});

// Queue to handle user email dispatch
emailSendingQueue.process(async (job, done) => {
  const { userId } = job.data;

  if (!userId) {
    throw new Error('User ID is required');
  }

  const user = await (await dbClient.usersCollection())
    .findOne({ _id: new mongoDBCore.BSON.ObjectId(userId) });

  if (!user) {
    throw new Error('User not found');
  }

  console.log(`Sending welcome email to: ${user.email}`);

  try {
    const subject = 'Welcome to ALX-Files_Manager by B3zaleel';
    const emailBody = [
      '<div>',
      '<h3>Hello {{user.name}},</h3>',
      'Welcome to <a href="https://github.com/B3zaleel/alx-files_manager">ALX-Files_Manager</a>, ',
      'a simple file management API developed with Node.js by ',
      '<a href="https://github.com/B3zaleel">Bezaleel Olakunori</a>. ',
      'We hope this platform serves your needs well.',
      '</div>',
    ].join('');
    
    Mailer.sendMail(Mailer.buildMessage(user.email, subject, emailBody));
    done();
  } catch (err) {
    done(err);
  }
});
