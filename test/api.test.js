const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');

let server;
let baseURL;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseURL = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

async function request(path, options = {}) {
  const response = await fetch(`${baseURL}${path}`, options);
  return {
    status: response.status,
    body: await response.json(),
    cookie: response.headers.get('set-cookie')
  };
}

test('public catalog and searches return matching books', async () => {
  const allBooks = await request('/');
  const byISBN = await request('/isbn/1');
  const byAuthor = await request('/author/jane%20austen');
  const byTitle = await request('/title/pride%20and%20prejudice');

  assert.equal(allBooks.status, 200);
  assert.equal(Object.keys(allBooks.body).length, 10);
  assert.equal(byISBN.body['1'].title, 'Things Fall Apart');
  assert.equal(byAuthor.body['8'].author, 'Jane Austen');
  assert.equal(byTitle.body['8'].title, 'Pride and Prejudice');
});

test('malformed JSON is reported as a client error', async () => {
  const result = await request('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{username:invalid}'
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'Invalid JSON body');
});

test('users can add, update, and delete only their own reviews', async () => {
  const firstUser = `reader-${Date.now()}`;
  const secondUser = `${firstUser}-other`;
  const firstPassword = 'password123';

  const registration = await request('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: firstUser, password: firstPassword })
  });
  assert.equal(registration.status, 201);

  const login = await request('/customer/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: firstUser, password: firstPassword })
  });
  assert.equal(login.status, 200);

  const sessionWrite = await request('/customer/auth/review/2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: login.cookie
    },
    body: JSON.stringify({ review: 'Session-authenticated review.' })
  });
  assert.equal(sessionWrite.status, 201);
  assert.equal(sessionWrite.body.reviews[firstUser], 'Session-authenticated review.');

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${login.body.token}`
  };
  const anonymousWrite = await request('/customer/auth/review/1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ review: 'No token' })
  });
  assert.equal(anonymousWrite.status, 401);

  const added = await request('/customer/auth/review/1', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ review: 'A strong opening novel.' })
  });
  assert.equal(added.status, 201);
  assert.equal(added.body.reviews[firstUser], 'A strong opening novel.');

  const otherRegistration = await request('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: secondUser, password: firstPassword })
  });
  assert.equal(otherRegistration.status, 201);
  const otherLogin = await request('/customer/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: secondUser, password: firstPassword })
  });
  const otherHeaders = { Authorization: `Bearer ${otherLogin.body.token}` };
  const forbiddenUpdate = await request('/customer/auth/review/1', {
    method: 'PUT',
    headers: { ...otherHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ review: 'Attempt to overwrite another user' })
  });
  assert.equal(forbiddenUpdate.status, 404);

  const forbiddenDelete = await request('/customer/auth/review/1', {
    method: 'DELETE',
    headers: otherHeaders
  });
  assert.equal(forbiddenDelete.status, 404);

  const updated = await request('/customer/auth/review/1', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ review: 'Updated review.' })
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.reviews[firstUser], 'Updated review.');

  const deleted = await request('/customer/auth/review/1', {
    method: 'DELETE',
    headers: authHeaders
  });
  assert.equal(deleted.status, 200);
  assert.deepEqual(deleted.body.reviews, {});
});

test('concurrent users can add separate reviews to the same book', async () => {
  const usernames = [`parallel-${Date.now()}-a`, `parallel-${Date.now()}-b`];
  const tokens = await Promise.all(usernames.map(async (username) => {
    const credentials = { username, password: 'parallelpass123' };
    const registration = await request('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    assert.equal(registration.status, 201);

    const login = await request('/customer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    return login.body.token;
  }));

  const writes = await Promise.all(tokens.map((token, index) => request('/customer/auth/review/3', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ review: `Concurrent review ${index}` })
  })));
  const reviews = await request('/review/3');

  assert.deepEqual(writes.map((write) => write.status), [201, 201]);
  assert.equal(Object.keys(reviews.body).length, 2);
  assert.deepEqual(Object.keys(reviews.body).sort(), usernames.sort());
});