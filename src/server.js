import express from 'express';
import dotenv from 'dotenv';
import reportRoute from './routes/report.js';

dotenv.config();
const token = process.env.GITHUB_TOKEN;
console.log('Loaded token:', token?.slice(0, 5));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use('/api', reportRoute);

app.listen(PORT, () => {
    console.log(`✅ API server running on http://localhost:${PORT}`);
});
