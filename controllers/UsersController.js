/* eslint-disable import/no-named-as-default */
import dbClient from '../../utils/db';

describe('UserController Tests', () => {
  const sampleUser = {
    email: 'beloxxi@blues.com',
    password: 'melody1982',
  };

  before(function (done) {
    this.timeout(10000); // Set a timeout for DB connection
    dbClient.usersCollection()
      .then((usersCollection) => {
        usersCollection.deleteMany({ email: sampleUser.email })
          .then(() => done())
          .catch((deleteErr) => done(deleteErr));
      }).catch((connectErr) => done(connectErr));
    setTimeout(done, 5000); // Ensures the DB is ready
  });

  describe('POST: /users endpoint', () => {
    it('Should fail if email is missing but password is provided', function (done) {
      this.timeout(5000); // Set timeout for this test case
      request.post('/users')
        .send({
          password: sampleUser.password,
        })
        .expect(400)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          expect(res.body).to.deep.equal({ error: 'Missing email' });
          done();
        });
    });

    it('Should fail if password is missing but email is provided', function (done) {
      this.timeout(5000);
      request.post('/users')
        .send({
          email: sampleUser.email,
        })
        .expect(400)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          expect(res.body).to.deep.equal({ error: 'Missing password' });
          done();
        });
    });

    it('Should succeed when both email and password are provided', function (done) {
      this.timeout(5000);
      request.post('/users')
        .send({
          email: sampleUser.email,
          password: sampleUser.password,
        })
        .expect(201)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          expect(res.body.email).to.equal(sampleUser.email);
          expect(res.body.id.length).to.be.greaterThan(0); // Ensure id is created
          done();
        });
    });

    it('Should fail if the user already exists in the database', function (done) {
      this.timeout(5000);
      request.post('/users')
        .send({
          email: sampleUser.email,
          password: sampleUser.password,
        })
        .expect(400)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          expect(res.body).to.deep.equal({ error: 'Already exist' });
          done();
        });
    });
  });

});

