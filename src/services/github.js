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

if (!GITHUB_TOKEN) {
    console.warn('[WARN] GITHUB_TOKEN not loaded. Check your .env file.');
}

const headers = GITHUB_TOKEN
    ? { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', }
    : {};


/**
 * Validate that the date range does not exceed 4 weeks.
 */
function validateDateRange(from, to) {
    const diffDays = to.diff(from, 'day');
    if (diffDays > 180) {
        console.log(
            `[DEBUG] Validating date range: from=${from.format('YYYY-MM-DD')}, to=${to.format('YYYY-MM-DD')}, diff=${to.diff(from, 'day')} days`
        );

        throw new Error('Date range too large. Maximum allowed is 10 weeks.');
    }
}

/**
 * Fetch PRs in a closed state updated within range.
 * Filter only merged PRs within date range.
 */
export async function fetchMergedPRs(owner, repo, from, to) {
    logInfo(`Fetching merged PRs for ${owner}/${repo} from ${from.format('YYYY-MM-DD')} to ${to.format('YYYY-MM-DD')}`);
    validateDateRange(from, to);

    const url = `${GITHUB_API}/repos/${owner}/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100`;
    try {
        const response = await axios.get(url, { headers });
        const all = response.data;

        const merged = all.filter(pr =>
            pr.merged_at &&
            dayjs(pr.merged_at).isSameOrAfter(from) &&
            dayjs(pr.merged_at).isSameOrBefore(to)
        );

        logInfo(`Found ${merged.length} merged PRs`);
        return merged;
    } catch (error) {
        logError('Error fetching PRs:', error.message);
        throw error;
    }
}
/**
 * Fetch all reviews for a single PR.
 */
export async function fetchReviews(owner, repo, prNumber) {
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
    const mergedPRs = await fetchMergedPRs(owner, repo, from, to);
    const enriched = [];

    for (const pr of mergedPRs) {
        const reviews = await fetchReviews(owner, repo, pr.number);
        enriched.push({ ...pr, reviews });
    }

    return enriched;
}