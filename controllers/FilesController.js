/* eslint-disable import/no-named-as-default */
/* eslint-disable no-unused-vars */
import { tmpdir } from 'os';
import { promisify } from 'util';
import Queue from 'bull/lib/queue';
import { v4 as uuidv4 } from 'uuid';
import {
  mkdir, writeFile, stat, existsSync, realpath,
} from 'fs';
import { join as joinPath } from 'path';
import { Request, Response } from 'express';
import { contentType } from 'mime-types';
import mongoDBCore from 'mongodb/lib/core';
import dbClient from '../utils/db';
import { getUserFromXToken } from '../utils/auth';

const VALID_FILE_TYPES = {
  folder: 'folder',
  file: 'file',
  image: 'image',
};
const ROOT_FOLDER_ID = 0;
const DEFAULT_ROOT_FOLDER = 'files_manager';
const mkDirAsync = promisify(mkdir);
const writeFileAsync = promisify(writeFile);
const statAsync = promisify(stat);
const realpathAsync = promisify(realpath);
const MAX_FILES_PER_PAGE = 20;
const fileQueue = new Queue('thumbnail generation');
const NULL_ID = Buffer.alloc(24, '0').toString('utf-8');
const isValidId = (id) => {
  const size = 24;
  let i = 0;
  const charRanges = [
    [48, 57], // 0 - 9
    [97, 102], // a - f
    [65, 70], // A - F
  ];
  if (typeof id !== 'string' || id.length !== size) {
    return false;
  }
  while (i < size) {
    const c = id[i];
    const code = c.charCodeAt(0);

    if (!charRanges.some((range) => code >= range[0] && code <= range[1])) {
      return false;
    }
    i += 1;
  }
  return true;
};

export default class FilesController {
  /**
   * Uploads a file.
   * @param {Request} req The Express request object.
   * @param {Response} res The Express response object.
   */
  static async postUpload(req, res) {
    const user = await getUserFromXToken(req);
    const { name, type, parentId = ROOT_FOLDER_ID, isPublic = false, data: base64Data } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    if (!type || !Object.values(VALID_FILE_TYPES).includes(type)) {
      return res.status(400).json({ error: 'Invalid file type' });
    }
    if (!base64Data && type !== VALID_FILE_TYPES.folder) {
      return res.status(400).json({ error: 'Missing file data' });
    }

    if (parentId !== ROOT_FOLDER_ID && !isValidId(parentId)) {
      const parentFile = await (await dbClient.filesCollection()).findOne({
        _id: new mongoDBCore.BSON.ObjectId(parentId),
        type: VALID_FILE_TYPES.folder,
      });

      if (!parentFile) {
        return res.status(400).json({ error: 'Parent folder not found or invalid' });
      }
    }

    const baseDir = process.env.FOLDER_PATH?.trim() || joinPath(tmpdir(), DEFAULT_ROOT_FOLDER);
    const newFile = {
      userId: user._id,
      name,
      type,
      isPublic,
      parentId: parentId === ROOT_FOLDER_ID ? '0' : new mongoDBCore.BSON.ObjectId(parentId),
    };

    await mkDirAsync(baseDir, { recursive: true });

    if (type !== VALID_FILE_TYPES.folder) {
      const localPath = joinPath(baseDir, uuidv4());
      await writeFileAsync(localPath, Buffer.from(base64Data, 'base64'));
      newFile.localPath = localPath;
    }

    const result = await (await dbClient.filesCollection()).insertOne(newFile);
    const fileId = result.insertedId.toString();

    if (type === VALID_FILE_TYPES.image) {
      const jobName = `Thumbnail generation [${user._id}-${fileId}]`;
      fileQueue.add({ userId: user._id.toString(), fileId, name: jobName });
    }

    res.status(201).json({
      id: fileId,
      userId: user._id,
      name,
      type,
      isPublic,
      parentId: parentId === ROOT_FOLDER_ID ? 0 : parentId,
    });
  }

  static async getShow(req, res) {
    const user = await getUserFromXToken(req);
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    const file = await (await dbClient.filesCollection())
      .findOne({ _id: new mongoDBCore.BSON.ObjectId(id), userId: user._id });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.status(200).json({
      id,
      userId: user._id,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId === ROOT_FOLDER_ID ? 0 : file.parentId.toString(),
    });
  }

  /**
   * Retrieves files associated with a specific user.
   * @param {Request} req The Express request object.
   * @param {Response} res The Express response object.
   */
  static async getIndex(req, res) {
    const user = await getUserFromXToken(req);
    const { parentId = ROOT_FOLDER_ID, page = 0 } = req.query;

    if (parentId !== ROOT_FOLDER_ID && !isValidId(parentId)) {
      return res.status(400).json({ error: 'Invalid parent folder ID' });
    }

    const filesFilter = {
      userId: user._id,
      parentId: parentId === ROOT_FOLDER_ID ? '0' : new mongoDBCore.BSON.ObjectId(parentId),
    };

    const files = await (await dbClient.filesCollection())
      .aggregate([
        { $match: filesFilter },
        { $sort: { _id: -1 } },
        { $skip: page * MAX_FILES_PER_PAGE },
        { $limit: MAX_FILES_PER_PAGE },
        {
          $project: {
            _id: 0,
            id: '$_id',
            userId: '$userId',
            name: '$name',
            type: '$type',
            isPublic: '$isPublic',
            parentId: { $cond: { if: { $eq: ['$parentId', '0'] }, then: 0, else: '$parentId' } },
          },
        },
      ]).toArray();

    res.status(200).json(files);
  }

  static async putPublish(req, res) {
    const user = await getUserFromXToken(req);
    const { id } = req.params;

    const file = await (await dbClient.filesCollection())
      .findOne({ _id: new mongoDBCore.BSON.ObjectId(id), userId: user._id });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    await (await dbClient.filesCollection()).updateOne(
      { _id: new mongoDBCore.BSON.ObjectId(id), userId: user._id },
      { $set: { isPublic: true } }
    );

    res.status(200).json({
      id,
      userId: user._id,
      name: file.name,
      type: file.type,
      isPublic: true,
      parentId: file.parentId === ROOT_FOLDER_ID ? 0 : file.parentId.toString(),
    });
  }

  static async putUnpublish(req, res) {
    const user = await getUserFromXToken(req);
    const { id } = req.params;

    const file = await (await dbClient.filesCollection())
      .findOne({ _id: new mongoDBCore.BSON.ObjectId(id), userId: user._id });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    await (await dbClient.filesCollection()).updateOne(
      { _id: new mongoDBCore.BSON.ObjectId(id), userId: user._id },
      { $set: { isPublic: false } }
    );

    res.status(200).json({
      id,
      userId: user._id,
      name: file.name,
      type: file.type,
      isPublic: false,
      parentId: file.parentId === ROOT_FOLDER_ID ? 0 : file.parentId.toString(),
    });
  }

  /**
   * Retrieves the content of a file.
   * @param {Request} req The Express request object.
   * @param {Response} res The Express response object.
   */
  static async getFile(req, res) {
    const user = await getUserFromXToken(req);
    const { id } = req.params;
    const size = req.query.size || null;

    const file = await (await dbClient.filesCollection())
      .findOne({ _id: new mongoDBCore.BSON.ObjectId(id) });

    if (!file || (!file.isPublic && file.userId.toString() !== user._id.toString())) {
      return res.status(404).json({ error: 'File not found or unauthorized' });
    }

    if (file.type === VALID_FILE_TYPES.folder) {
      return res.status(400).json({ error: 'A folder doesn\'t have content' });
    }

    let filePath = file.localPath;
    if (size) {
      filePath = `${file.localPath}_${size}`;
    }

    if (existsSync(filePath)) {
      const fileInfo = await statAsync(filePath);
      if (!fileInfo.isFile()) {
        return res.status(404).json({ error: 'File not found' });
      }
    } else {
      return res.status(404).json({ error: 'File not found' });
    }

    const absoluteFilePath = await realpathAsync(filePath);
    res.setHeader('Content-Type', contentType(file.name) || 'text/plain; charset=utf-8');
    res.status(200).sendFile(absoluteFilePath);
  }
}

