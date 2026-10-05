const axios = require('axios');

const API_URL = process.env.BOOK_API_URL || 'http://localhost:5000';

async function getAllBooks() {
  const response = await axios.get(`${API_URL}/`);
  return response.data;
}

async function getBooksByISBN(isbn) {
  const response = await axios.get(`${API_URL}/isbn/${encodeURIComponent(isbn)}`);
  return response.data;
}

async function getBooksByAuthor(author) {
  const response = await axios.get(`${API_URL}/author/${encodeURIComponent(author)}`);
  return response.data;
}

async function getBooksByTitle(title) {
  const response = await axios.get(`${API_URL}/title/${encodeURIComponent(title)}`);
  return response.data;
}

module.exports = { getAllBooks, getBooksByISBN, getBooksByAuthor, getBooksByTitle };

if (require.main === module) {
  Promise.all([
    getAllBooks(),
    getBooksByISBN('1'),
    getBooksByAuthor('Jane Austen'),
    getBooksByTitle('Pride and Prejudice')
  ])
    .then(([allBooks, byISBN, byAuthor, byTitle]) => {
      console.log('All books:', allBooks);
      console.log('ISBN 1:', byISBN);
      console.log('Jane Austen:', byAuthor);
      console.log('Pride and Prejudice:', byTitle);
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}