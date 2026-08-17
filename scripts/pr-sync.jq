# GraphQL PR nodes (array, shape of pr-sync's PR_NODE_FIELDS) → one SQL upsert statement per PR.
# args: $repo (Org/repo), $me (reviewer login), $bots (comma-separated authors to auto-skip on first sight)
def q: if . == null then "NULL" else "'" + (tostring | gsub("'"; "''")) + "'" end;
def dt: if . == null or . == "" then "NULL" else "datetime(" + q + ")" end;
def n: if . == null then "NULL" else tostring end;
def head_commit: (.commits.nodes // [])[0].commit;
def checks:
  (head_commit.statusCheckRollup.contexts.nodes // []) as $r
  | if ($r | length) == 0 then "NONE"
    elif any($r[]; ((.conclusion // .state // "") | IN("FAILURE", "ERROR", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE"))) then "FAILURE"
    elif any($r[]; ((.__typename == "CheckRun" and .status != "COMPLETED") or ((.state // "") | IN("PENDING", "EXPECTED")))) then "PENDING"
    else "SUCCESS" end;
def my_review:
  [ (.reviews.nodes // [])[] | select((.author.login // "") == $me and ((.state // "") | IN("APPROVED", "CHANGES_REQUESTED", "COMMENTED"))) ]
  | sort_by(.submittedAt) | last;
def last_other_activity:
  ([ (.reviews.nodes // [])[]  | select((.author.login // "") != $me) | .submittedAt ]
   + [ (.comments.nodes // [])[] | select((.author.login // "") != $me) | .createdAt ])
  | map(select(. != null)) | max;
def bot_skip: (.author.login // "") as $a | if (($bots | split(",")) | index($a)) != null then "'9999-12-31 00:00:00'" else "NULL" end;

.[]
| my_review as $mr
| "INSERT INTO prs (repo, number, title, author, url, base_ref, head_ref, head_sha, is_draft, state, mergeable, checks, review_decision, additions, deletions, changed_files, gh_created_at, gh_updated_at, last_commit_at, last_comment_at, my_review_state, my_review_sha, my_review_at, skip_until, synced_at) VALUES ("
  + ($repo | q) + ", " + (.number | tostring) + ", " + (.title | q) + ", " + (.author.login | q) + ", " + (.url | q) + ", "
  + (.baseRefName | q) + ", " + (.headRefName | q) + ", " + (.headRefOid | q) + ", " + (if .isDraft then "1" else "0" end) + ", 'open', "
  + (.mergeable | q) + ", " + (checks | q) + ", " + (.reviewDecision | q) + ", "
  + (.additions | n) + ", " + (.deletions | n) + ", " + (.changedFiles | n) + ", "
  + (.createdAt | dt) + ", " + (.updatedAt | dt) + ", " + (head_commit.committedDate | dt) + ", " + (last_other_activity | dt) + ", "
  + ($mr.state | q) + ", " + ($mr.commit.oid | q) + ", " + ($mr.submittedAt | dt) + ", " + bot_skip + ", CURRENT_TIMESTAMP)"
  + " ON CONFLICT(repo, number) DO UPDATE SET title = excluded.title, author = excluded.author, url = excluded.url, base_ref = excluded.base_ref, head_ref = excluded.head_ref, head_sha = excluded.head_sha, is_draft = excluded.is_draft, state = 'open', mergeable = excluded.mergeable, checks = excluded.checks, review_decision = excluded.review_decision, additions = excluded.additions, deletions = excluded.deletions, changed_files = excluded.changed_files, gh_created_at = excluded.gh_created_at, gh_updated_at = excluded.gh_updated_at, last_commit_at = excluded.last_commit_at, last_comment_at = excluded.last_comment_at, my_review_state = excluded.my_review_state, my_review_sha = excluded.my_review_sha, my_review_at = excluded.my_review_at, synced_at = CURRENT_TIMESTAMP;"
