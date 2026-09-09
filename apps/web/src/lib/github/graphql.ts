/**
 * GraphQL documents. UI components never import these directly —
 * they go through queries.ts / features.
 */

export const VIEWER_QUERY = /* GraphQL */ `
  query GityViewer {
    viewer {
      login
      name
      avatarUrl
      url
    }
    rateLimit {
      limit
      remaining
      resetAt
    }
  }
`;

export const ORGS_QUERY = /* GraphQL */ `
  query GityOrgs($after: String) {
    viewer {
      organizations(first: 100, after: $after) {
        nodes {
          login
          name
          avatarUrl
          description
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
    rateLimit {
      limit
      remaining
      resetAt
    }
  }
`;

export const REPOS_QUERY = /* GraphQL */ `
  query GityRepos($after: String) {
    viewer {
      repositories(
        first: 100
        after: $after
        affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
        ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        nodes {
          id
          name
          nameWithOwner
          description
          isPrivate
          isArchived
          isFork
          primaryLanguage {
            name
            color
          }
          stargazerCount
          forkCount
          defaultBranchRef {
            name
          }
          pushedAt
          updatedAt
          url
          owner {
            login
            avatarUrl
          }
          pullRequests(states: OPEN) {
            totalCount
          }
          issues(states: OPEN) {
            totalCount
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
    rateLimit {
      limit
      remaining
      resetAt
    }
  }
`;

export const REPO_CI_QUERY = /* GraphQL */ `
  query GityRepoCi($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      defaultBranchRef {
        target {
          ... on Commit {
            statusCheckRollup {
              state
            }
          }
        }
      }
    }
    rateLimit {
      limit
      remaining
      resetAt
    }
  }
`;

/** Per-repo open PRs with review decisions (batched per repo, paginated). */
export const REPO_PRS_QUERY = /* GraphQL */ `
  query GityRepoPrs($owner: String!, $name: String!, $after: String) {
    repository(owner: $owner, name: $name) {
      pullRequests(
        first: 100
        after: $after
        states: OPEN
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        nodes {
          id
          number
          title
          isDraft
          author {
            login
            avatarUrl
          }
          reviewDecision
          reviewRequests(first: 5) {
            totalCount
          }
          createdAt
          updatedAt
          additions
          deletions
          changedFiles
          url
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
    rateLimit {
      limit
      remaining
      resetAt
    }
  }
`;

export const CONTRIBUTIONS_QUERY = /* GraphQL */ `
  query GityContributions($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
    rateLimit {
      limit
      remaining
      resetAt
    }
  }
`;

/** Recent merged/closed PR & issue activity authored by the viewer (for streak + overview). */
export const SEARCH_ISSUES_QUERY = /* GraphQL */ `
  query GitySearch($q: String!, $after: String) {
    search(query: $q, type: ISSUE, first: 100, after: $after) {
      issueCount
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        __typename
        ... on PullRequest {
          id
          number
          title
          state
          isDraft
          merged
          mergedAt
          closedAt
          createdAt
          updatedAt
          author {
            login
            avatarUrl
          }
          repository {
            nameWithOwner
            owner {
              login
            }
          }
          additions
          deletions
          changedFiles
          url
          reviewDecision
          reviewRequests(first: 5) {
            totalCount
          }
        }
        ... on Issue {
          id
          number
          title
          state
          createdAt
          updatedAt
          closedAt
          author {
            login
            avatarUrl
          }
          repository {
            nameWithOwner
            owner {
              login
            }
          }
          assignees(first: 10) {
            nodes {
              login
            }
          }
          labels(first: 10) {
            nodes {
              name
              color
            }
          }
          comments {
            totalCount
          }
          url
        }
      }
    }
    rateLimit {
      limit
      remaining
      resetAt
    }
  }
`;
