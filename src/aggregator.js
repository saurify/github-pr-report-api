import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';

dayjs.extend(duration);

function categorizePRs(pullRequests) {
  const mergedPRs = [];
  const declinedPRs = [];
  const openPRs = [];

  if (!Array.isArray(pullRequests)) return { mergedPRs, declinedPRs, openPRs };

  pullRequests.forEach(pr => {
    if (pr.merged_at) {
      mergedPRs.push(pr);
    } else if (pr.state === 'closed' && !pr.merged_at) {
      declinedPRs.push(pr);
    } else if (pr.state === 'open') {
      openPRs.push(pr);
    }
  });

  return { mergedPRs, declinedPRs, openPRs };
}

// Helper: Safe Average to prevent NaN
function safeAverage(arr) {
  if (!arr || arr.length === 0) return 0;
  const sum = arr.reduce((a, b) => a + b, 0);
  return sum / arr.length;
}

// Helper: Safe format
function formatStat(value) {
    return value ? value.toFixed(2) : "0.00";
}

export function generateReport(pullRequests) {
  // 1. Handle Null/Empty Input
  if (!pullRequests || pullRequests.length === 0) {
    return {
      totalPRs: 0, mergedPRs: 0, declinedPRs: 0, openPRs: 0,
      avgOpenPrAge: "0.00", avgTimeToMerge: "0.00", avgLinesChanged: "0.00",
      avgReviewsPerPR: "0.00", avgTimeToFirstReview: "0.00",
      totalApprovals: 0, prsWithNoReviews: 0, prsWithNoApprovals: 0,
      topReviewers: [],
    };
  }

  const { mergedPRs, declinedPRs, openPRs } = categorizePRs(pullRequests);
  const totalPRs = pullRequests.length;

  // 2. Open PR Stats
  const now = dayjs();
  const openPrAges = openPRs.map(pr => now.diff(dayjs(pr.created_at), 'hours', true));
  const avgOpenPrAge = safeAverage(openPrAges);

  // 3. Merged PR Stats
  const mergeTimes = mergedPRs.map(pr =>
    dayjs(pr.merged_at).diff(dayjs(pr.created_at), 'hours', true)
  );
  const avgTimeToMerge = safeAverage(mergeTimes);

  const linesChanged = mergedPRs.map(pr => (pr.additions || 0) + (pr.deletions || 0));
  const avgLinesChanged = safeAverage(linesChanged);

  // 4. Review Stats (Safe Checks)
  let totalReviews = 0;
  let approvals = 0;
  const reviewerStats = {};
  let prsWithNoReviews = 0;
  let prsWithNoApprovals = 0;
  const timeToFirstReviews = [];

  const processReviews = (pr) => {
    // Guard against null reviews
    const reviews = Array.isArray(pr.reviews) ? pr.reviews : [];
    totalReviews += reviews.length;

    if (reviews.length === 0) {
      prsWithNoReviews++;
      prsWithNoApprovals++;
    } else {
      const prApprovals = reviews.filter(r => r.state === 'APPROVED').length;
      if (prApprovals === 0) prsWithNoApprovals++;
      
      // Filter invalid dates
      const validReviews = reviews.filter(r => r.submitted_at);
      if (validReviews.length > 0) {
          const firstReview = validReviews
            .map(r => dayjs(r.submitted_at))
            .sort((a, b) => a - b)[0];
          
          if (firstReview) {
            timeToFirstReviews.push(firstReview.diff(dayjs(pr.created_at), 'hours', true));
          }
      }
    }

    reviews.forEach(review => {
        if (!review.user || !review.user.login) return;
        const user = review.user.login;
        if (!reviewerStats[user]) {
          reviewerStats[user] = { approvals: 0, total: 0, avatar_url: review.user.avatar_url || null };
        }
        reviewerStats[user].total++;
        if (review.state === 'APPROVED') {
          reviewerStats[user].approvals++;
          approvals++;
        }
    });
  };

  mergedPRs.forEach(processReviews);

  // Calculate Averages safely
  const avgReviewsPerPR = mergedPRs.length > 0 ? (totalReviews / mergedPRs.length) : 0;
  const avgTimeToFirstReview = safeAverage(timeToFirstReviews);

  const topReviewers = Object.entries(reviewerStats)
    .sort((a, b) => b[1].approvals - a[1].approvals)
    .slice(0, 5)
    .map(([user, stats]) => ({
      user,
      approvals: stats.approvals,
      reviews: stats.total,
      avatar_url: stats.avatar_url
    }));

  return {
    totalPRs,
    mergedPRs: mergedPRs.length,
    declinedPRs: declinedPRs.length,
    openPRs: openPRs.length,
    avgOpenPrAge: formatStat(avgOpenPrAge),
    avgTimeToMerge: formatStat(avgTimeToMerge),
    avgLinesChanged: formatStat(avgLinesChanged),
    avgReviewsPerPR: formatStat(avgReviewsPerPR),
    avgTimeToFirstReview: formatStat(avgTimeToFirstReview),
    totalApprovals: approvals,
    prsWithNoReviews,
    prsWithNoApprovals,
    topReviewers,
  };
}