import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';

dayjs.extend(duration);

function categorizePRs(pullRequests) {
  const mergedPRs = [];
  const declinedPRs = [];
  const openPRs = [];

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

export function generateReport(pullRequests) {
  if (pullRequests.length === 0) {
    return {
      message: 'No PRs in the given timeframe.',
      totalPRs: 0,
      mergedPRs: 0,
      declinedPRs: 0,
      openPRs: 0,
      data: null,
    };
  }

  const { mergedPRs, declinedPRs, openPRs } = categorizePRs(pullRequests);
  const totalPRs = pullRequests.length;

  // If no merged PRs, still return counts
  if (mergedPRs.length === 0) {
    return {
      message: 'No merged PRs in the given timeframe.',
      totalPRs,
      mergedPRs: 0,
      declinedPRs: declinedPRs.length,
      openPRs: openPRs.length,
      data: null,
    };
  }

  // Use your existing logic on merged PRs only

  // Time to merge (hours)
  const mergeTimes = mergedPRs.map(pr =>
    dayjs(pr.merged_at).diff(dayjs(pr.created_at), 'hours', true)
  );
  const avgTimeToMerge = average(mergeTimes);

  // Lines changed per PR
  const linesChanged = mergedPRs.map(pr => {
    return (pr.additions || 0) + (pr.deletions || 0);
  });
  const avgLinesChanged = average(linesChanged);

  // Reviews, approvals, and participation
  let totalReviews = 0;
  let approvals = 0;
  const reviewerStats = {};
  let prsWithNoApprovals = 0;
  let prsWithNoReviews = 0;
  const timeToFirstReviews = [];

  mergedPRs.forEach(pr => {
    const reviews = pr.reviews || [];
    totalReviews += reviews.length;

    if (reviews.length === 0) {
      prsWithNoReviews++;
      prsWithNoApprovals++;
    } else {
      const prApprovals = reviews.filter(r => r.state === 'APPROVED').length;
      if (prApprovals === 0) {
        prsWithNoApprovals++;
      }
      const firstReview = reviews
        .map(r => dayjs(r.submitted_at))
        .sort((a, b) => a - b)[0];
      if (firstReview) {
        timeToFirstReviews.push(firstReview.diff(dayjs(pr.created_at), 'hours', true));
      }
    }

    reviews.forEach(review => {
      if (!review.user || !review.user.login) return;
      const user = review.user.login;
      if (!reviewerStats[user]) reviewerStats[user] = { approvals: 0, total: 0 };

      reviewerStats[user].total++;
      if (review.state === 'APPROVED') {
        reviewerStats[user].approvals++;
        approvals++;
      }
    });
  });

  const avgReviewsPerPR = totalReviews / mergedPRs.length;
  const avgTimeToFirstReview = average(timeToFirstReviews);

  const topReviewers = Object.entries(reviewerStats)
    .sort((a, b) => b[1].approvals - a[1].approvals)
    .slice(0, 5)
    .map(([user, stats]) => ({
      user,
      approvals: stats.approvals,
      reviews: stats.total,
    }));

  return {
    totalPRs,
    mergedPRs: mergedPRs.length,
    declinedPRs: declinedPRs.length,
    openPRs: openPRs.length,
    avgTimeToMerge: avgTimeToMerge.toFixed(2),
    avgLinesChanged: avgLinesChanged.toFixed(2),
    avgReviewsPerPR: avgReviewsPerPR.toFixed(2),
    avgTimeToFirstReview: avgTimeToFirstReview.toFixed(2),
    totalApprovals: approvals,
    prsWithNoReviews,
    prsWithNoApprovals,
    topReviewers,
  };
}

function average(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
