const express = require('express');

const router = express.Router();

// Define the GET /hello endpoint
router.get('/hello', (req, res) => {
    res.json({ message: 'Hello, World!' });
});

module.exports = router;

