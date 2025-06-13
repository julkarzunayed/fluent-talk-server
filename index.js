const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send(`FluentTalk server is cooking`)
});

app.listen(port, () => {
    console.log(`Fluent-Talk is running on port ${port}`);
})