// services/github.js
import axios from 'axios';
import dayjs from 'dayjs';
import dotenv from 'dotenv';
import { logInfo, logError } from './../utils/logger.js';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter.js';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore.js';

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

dotenv.config();
const GITHUB_API = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// ... (Keep headers and validateDateRange as is) ...

const headers = GITHUB_TOKEN
    ? { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', }
    : {};

function validateDateRange(from, to) {
    // ... (Keep existing implementation) ...
    const diffDays = to.diff(from, 'day');
    if (diffDays > 180) throw new Error('Date range too large. Maximum allowed is 10 weeks.');
}

/**
 * Fetch PRs (Open and Closed) updated within range.
 * Filter Merged PRs (by merge date) and Open PRs (by creation date).
 */
export async function fetchPRs(owner, repo, from, to) {
    logInfo(`Fetching PRs for ${owner}/${repo} from ${from.format('YYYY-MM-DD')} to ${to.format('YYYY-MM-DD')}`);
    validateDateRange(from, to);

    // CHANGED: state=all to get both open and closed
    const url = `${GITHUB_API}/repos/${owner}/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=100`;

    try {
        const response = await axios.get(url, { headers });
        const all = response.data;

        const relevantPRs = all.filter(pr => {
            const mergedAt = pr.merged_at ? dayjs(pr.merged_at) : null;
            const createdAt = dayjs(pr.created_at);
            const isMergedInRange = mergedAt && mergedAt.isSameOrAfter(from) && mergedAt.isSameOrBefore(to);

            // We consider an Open PR relevant if it was created within the selected window
            // OR if you want ALL currently open PRs regardless of creation, remove the date check below.
            // For specific sprint reports, checking creation date is standard.
            const isOpenInRange = pr.state === 'open' && createdAt.isSameOrAfter(from) && createdAt.isSameOrBefore(to);

            return isMergedInRange || isOpenInRange;
        });

        logInfo(`Found ${relevantPRs.length} relevant PRs (Merged or Open)`);
        return relevantPRs;
    } catch (error) {
        if (error.response) {
            const status = error.response.status;
            if (status === 404) {
                throw new Error(`Repository "${owner}/${repo}" not found. Please check the URL or your permissions.`);
            } else if (status === 403 || status === 429) {
                throw new Error(`GitHub API Rate Limit exceeded. Please add a GITHUB_TOKEN to .env or wait.`);
            } else if (status === 401) {
                throw new Error(`Invalid GitHub Token. Please check your .env file.`);
            }
        }
        throw new Error(error.message || "Failed to connect to GitHub");
    }
}

// ... (Keep fetchReviews as is) ...
export async function fetchReviews(owner, repo, prNumber) {
    // ... (Keep existing implementation) ...
    const url = `${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}/reviews`;
    try {
        const res = await axios.get(url, { headers });
        return res.data;
    } catch (err) {
        logError(`Failed to fetch reviews for PR #${prNumber}`);
        return [];
    }
}

/**
 * Fetch PRs with their reviews.
 */
export async function fetchPRsWithReviews(owner, repo, from, to) {
    // CHANGED: Call fetchPRs instead of fetchMergedPRs
    const prs = await fetchPRs(owner, repo, from, to);
    const enriched = [];

    for (const pr of prs) {
        const reviews = await fetchReviews(owner, repo, pr.number);
        enriched.push({ ...pr, reviews });
    }

    return enriched;
}