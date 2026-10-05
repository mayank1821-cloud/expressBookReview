const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const books = require('./books.json');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'local-development-jwt-secret';
const SESSION_SECRET = process.env.SESSION_SECRET || 'local-development-session-secret';
const users = new Map();

app.use(express.json());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }
}));

function findBooks(field, value) {
  const query = value.toLocaleLowerCase();
  return Object.fromEntries(Object.entries(books).filter(([, book]) =>
    book[field].toLocaleLowerCase().includes(query)
  ));
}

function authenticate(req, res, next) {
  const authorization = req.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme === 'Bearer' && token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      return next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  if (req.session.username) {
    req.user = { username: req.session.username };
    return next();
  }

  return res.status(401).json({ error: 'Authentication required' });
}

function getBook(isbn, res) {
  const book = books[isbn];
  if (!book) {
    res.status(404).json({ error: 'Book not found' });
    return null;
  }
  return book;
}

app.get('/', (req, res) => res.json(books));

app.get('/isbn/:isbn', (req, res) => {
  const book = getBook(req.params.isbn, res);
  if (book) res.json({ [req.params.isbn]: book });
});

app.get('/author/:author', (req, res) => {
  res.json(findBooks('author', req.params.author));
});

app.get('/title/:title', (req, res) => {
  res.json(findBooks('title', req.params.title));
});

app.get('/review/:isbn', (req, res) => {
  const book = getBook(req.params.isbn, res);
  if (book) res.json(book.reviews);
});

app.post('/register', async (req, res) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const password = req.body.password;

  if (!username || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'A username and password of at least 8 characters are required' });
  }
  if (users.has(username.toLowerCase())) {
    return res.status(409).json({ error: 'Username is already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  users.set(username.toLowerCase(), { username, passwordHash });
  return res.status(201).json({ message: 'User registered successfully', username });
});

async function login(req, res) {
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const password = req.body.password;
  const user = users.get(username.toLowerCase());

  if (!user || typeof password !== 'string' || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  req.session.username = user.username;
  const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '1h' });
  return res.json({ message: 'Login successful', username: user.username, token });
}

app.post('/customer/login', login);
app.post('/login', login);

app.post('/customer/auth/review/:isbn', authenticate, (req, res) => {
  const book = getBook(req.params.isbn, res);
  if (!book) return;

  const review = typeof req.body.review === 'string' ? req.body.review.trim() : '';
  if (!review) return res.status(400).json({ error: 'A non-empty review is required' });
  if (Object.prototype.hasOwnProperty.call(book.reviews, req.user.username)) {
    return res.status(409).json({ error: 'You already reviewed this book; use PUT to update it' });
  }

  book.reviews[req.user.username] = review;
  return res.status(201).json({ message: 'Review added successfully', reviews: book.reviews });
});

app.put('/customer/auth/review/:isbn', authenticate, (req, res) => {
  const book = getBook(req.params.isbn, res);
  if (!book) return;

  const review = typeof req.body.review === 'string' ? req.body.review.trim() : '';
  if (!review) return res.status(400).json({ error: 'A non-empty review is required' });
  if (!Object.prototype.hasOwnProperty.call(book.reviews, req.user.username)) {
    return res.status(404).json({ error: 'Your review was not found' });
  }

  book.reviews[req.user.username] = review;
  return res.json({ message: 'Review updated successfully', reviews: book.reviews });
});

app.delete('/customer/auth/review/:isbn', authenticate, (req, res) => {
  const book = getBook(req.params.isbn, res);
  if (!book) return;
  if (!Object.prototype.hasOwnProperty.call(book.reviews, req.user.username)) {
    return res.status(404).json({ error: 'Your review was not found' });
  }

  delete book.reviews[req.user.username];
  return res.json({ message: 'Review deleted successfully', reviews: book.reviews });
});

app.use((err, req, res, next) => {
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500
    ? err.status
    : 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 400 ? 'Invalid JSON body' : 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Book review API listening on http://localhost:${PORT}`));
}

module.exports = app;