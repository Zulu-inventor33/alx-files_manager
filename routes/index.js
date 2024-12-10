// eslint-disable-next-line no-unused-vars
import { Express } from 'express'; // Importing the Express module for routing functionality.
import AppController from '../controllers/AppController'; // Importing the main controller for application status and stats.
import AuthController from '../controllers/AuthController'; // Controller for handling authentication actions.
import UsersController from '../controllers/UsersController'; // Controller for user-related actions such as creating and fetching user data.
import FilesController from '../controllers/FilesController'; // Controller for managing file uploads and related actions.
import { basicAuthenticate, xTokenAuthenticate } from '../middlewares/auth'; // Importing authentication middleware for different levels of security.
import { APIError, errorResponse } from '../middlewares/error'; // Importing error handling utilities to format error responses properly.

/**
 * This function sets up all the API routes with their corresponding handlers in the provided Express app.
 * @param {Express} api - The Express application instance to inject the routes into.
 */
const injectRoutes = (api) => {
  // App-related routes
  api.get('/status', AppController.getStatus); // Route to check the status of the server.
  api.get('/stats', AppController.getStats); // Route to retrieve server statistics.

  // Authentication routes
  api.get('/connect', basicAuthenticate, AuthController.getConnect); // Route to authenticate a user using basic auth.
  api.get('/disconnect', xTokenAuthenticate, AuthController.getDisconnect); // Route to disconnect a user using token-based auth.

  // User-related routes
  api.post('/users', UsersController.postNew); // Route to create a new user.
  api.get('/users/me', xTokenAuthenticate, UsersController.getMe); // Route to fetch the authenticated user's data.

  // File-related routes
  api.post('/files', xTokenAuthenticate, FilesController.postUpload); // Route to upload a file.
  api.get('/files/:id', xTokenAuthenticate, FilesController.getShow); // Route to get details of a specific file.
  api.get('/files', xTokenAuthenticate, FilesController.getIndex); // Route to list all files.
  api.put('/files/:id/publish', xTokenAuthenticate, FilesController.putPublish); // Route to publish a file.
  api.put('/files/:id/unpublish', xTokenAuthenticate, FilesController.putUnpublish); // Route to unpublish a file.
  api.get('/files/:id/data', FilesController.getFile); // Route to fetch the raw data of a file.

  // Catch-all route to handle undefined endpoints with an error message.
  api.all('*', (req, res, next) => {
    errorResponse(new APIError(404, `Cannot ${req.method} ${req.url}`), req, res, next); // Handle any unrecognized routes with a 404 error.
  });

  // Error handling middleware, ensuring that all errors are properly formatted and sent in the response.
  api.use(errorResponse);
};

export default injectRoutes; // Exporting the function to be used in the server setup.

