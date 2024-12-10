/* eslint-disable import/no-named-as-default */
import dbClient from '../../utils/db';

describe('AuthController Tests', () => {
  const testUser = {
    email: 'kaido@beast.com',
    password: 'hyakuju_no_kaido_wano',
  };
  let authToken = '';

  before(function (done) {
    this.timeout(10000); // Set timeout for DB connection and user setup
    dbClient.usersCollection()
      .then((usersCollection) => {
        usersCollection.deleteMany({ email: testUser.email })
          .then(() => {
            request.post('/users')
              .send({
                email: testUser.email,
                password: testUser.password,
              })
              .expect(201)
              .end((reqErr, res) => {
                if (reqErr) {
                  return done(reqErr);
                }
                expect(res.body.email).to.eql(testUser.email);
                expect(res.body.id.length).to.be.greaterThan(0); // Ensure ID is generated
                done();
              });
          })
          .catch((deleteErr) => done(deleteErr));
      }).catch((connErr) => done(connErr));
  });

  describe('GET: /connect Endpoint', () => {
    it('Should fail if "Authorization" header is missing', function (done) {
      this.timeout(5000);
      request.get('/connect')
        .expect(401)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          expect(res.body).to.deep.eql({ error: 'Unauthorized' });
          done();
        });
    });

    it('Should fail for a non-existent user', function (done) {
      this.timeout(5000);
      request.get('/connect')
        .auth('foo@bar.com', 'raboof', { type: 'basic' })
        .expect(401)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          expect(res.body).to.deep.eql({ error: 'Unauthorized' });
          done();
        });
    });

    it('Should fail when email is correct but password is wrong', function (done) {
      this.timeout(5000);
      request.get('/connect')
        .auth(testUser.email, 'raboof', { type: 'basic' })
        .expect(401)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          expect(res.body).to.deep.eql({ error: 'Unauthorized' });
          done();
        });
    });

    it('Should fail with an incorrect email but valid password', function (done) {
      this.timeout(5000);
      request.get('/connect')
        .auth('zoro@strawhat.com', testUser.password, { type: 'basic' })
        .expect(401)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          expect(res.body).to.deep.eql({ error: 'Unauthorized' });
          done();
        });
    });

    it('Should succeed for an existing user with correct credentials', function (done) {
      this.timeout(5000);
      request.get('/connect')
        .auth(testUser.email, testUser.password, { type: 'basic' })
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          expect(res.body.token).to.exist;
          expect(res.body.token.length).to.be.greaterThan(0); // Ensure token is returned
          authToken = res.body.token;
          done();
        });
    });
  });

  describe('GET: /disconnect Endpoint', () => {
    it('Should fail when "X-Token" header is missing', function (done) {
      this.timeout(5000);
      request.get('/disconnect')
        .expect(401)
        .end((reqErr, res) => {
          if (reqErr) {
            return done(reqErr);
          }
          expect(res.body).to.deep.eql({ error: 'Unauthorized' });
          done();
        });
    });

    it('Should fail for a non-existent user when "X-Token" is invalid', function (done) {
      this.timeout(5000);
      request.get('/disconnect')
        .set('X-Token', 'raboof')
        .expect(401)
        .end((reqErr, res) => {
          if (reqErr) {
            return done(reqErr);
          }
          expect(res.body).to.deep.eql({ error: 'Unauthorized' });
          done();
        });
    });

    it('Should succeed when "X-Token" is valid', function (done) {
      request.get('/disconnect')
        .set('X-Token', authToken)
        .expect(204)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          expect(res.body).to.deep.eql({});
          expect(res.text).to.eql('');
          expect(res.headers['content-type']).to.not.exist; // Ensure no content type
          expect(res.headers['content-length']).to.not.exist; // Ensure no content length
          done();
        });
    });
  });
});

