# Express Book Review API

A beginner-friendly REST API for the IBM book-review assignment. The course catalog is keyed by the identifiers used by its `/isbn/:isbn` route (`1` through `10`); replace `books.json` with the supplied course JSON if your class repository provides a different catalog.

## Run

```powershell
npm install
Copy-Item .env.example .env
npm start
```

For local testing, the example secret values are sufficient. Change both secrets before deploying. The starter keeps registered users and reviews in memory; they reset when the server restarts. Passwords are hashed with bcrypt, and review endpoints accept either the session cookie established at login or a JWT bearer token.

## Routes

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/` | Public | List all books |
| GET | `/isbn/:isbn` | Public | Find a book by catalog identifier |
| GET | `/author/:author` | Public | Search author names (case-insensitive substring) |
| GET | `/title/:title` | Public | Search titles (case-insensitive substring) |
| GET | `/review/:isbn` | Public | List reviews for a book |
| POST | `/register` | Public | Register `{ "username", "password" }` |
| POST | `/customer/login` | Public | Login and return a JWT; also creates a session |
| POST | `/customer/auth/review/:isbn` | Authenticated | Add `{ "review" }` |
| PUT | `/customer/auth/review/:isbn` | Authenticated | Update your own review |
| DELETE | `/customer/auth/review/:isbn` | Authenticated | Delete your own review |

`POST /login` is also available as a login alias. Usernames are case-insensitive. Each username can maintain one review per book; review creation, update, and deletion are handled synchronously in Node's event loop so concurrent requests do not block on network calls.

## cURL checks (PowerShell)

Run the API in one terminal, then use these commands in another:

```powershell
curl.exe http://localhost:5000/
curl.exe http://localhost:5000/isbn/1
curl.exe http://localhost:5000/author/Jane%20Austen
curl.exe http://localhost:5000/title/Pride%20and%20Prejudice
curl.exe http://localhost:5000/review/1
'{"username":"reader1","password":"password123"}' | curl.exe -X POST http://localhost:5000/register -H 'Content-Type: application/json' --data-binary '@-'
$login = '{"username":"reader1","password":"password123"}' | curl.exe -sS -X POST http://localhost:5000/customer/login -H 'Content-Type: application/json' --data-binary '@-'
$token = ($login | ConvertFrom-Json).token
```

Use the JWT returned by login for protected requests:

```powershell
'{"review":"A thoughtful and memorable book."}' | curl.exe -X POST http://localhost:5000/customer/auth/review/1 -H 'Content-Type: application/json' -H "Authorization: Bearer $token" --data-binary '@-'
'{"review":"Updated: a thoughtful and memorable book."}' | curl.exe -X PUT http://localhost:5000/customer/auth/review/1 -H 'Content-Type: application/json' -H "Authorization: Bearer $token" --data-binary '@-'
curl.exe -X DELETE http://localhost:5000/customer/auth/review/1 -H "Authorization: Bearer $token"
```

Run the four Axios examples after the server is running:

```powershell
node general.js
```

## Assignment submission

The upstream URL named in the course prompt currently responds with GitHub 404, and this workspace did not arrive with a clone. This project is therefore a local implementation, not evidence of a fork. Fork the course repository in your GitHub account when it is available, then push this implementation and submit your own public repository and `general.js` URL. Do not represent this local folder as a fork.