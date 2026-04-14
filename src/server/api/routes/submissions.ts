import express from 'express';
import bodyParser from 'body-parser';

const router = express.Router();

// Middleware to parse JSON bodies
router.use(bodyParser.json());

// Fake in-memory storage for submissions (simulating a database)
let submissions = [];

// POST endpoint to handle form submissions
router.post('/api/submissions', (req, res) => {
    const submission = req.body;
    submissions.push(submission);
    res.status(201).json({ message: 'Submission received', submission });
});

// GET endpoint to fetch all submissions
router.get('/api/submissions', (req, res) => {
    res.json(submissions);
});

export default router;
