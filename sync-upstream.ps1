# sync-upstream.ps1
# Keeps this fork (deepseek-harness-hung) in sync with the upstream
# deepseek-ai/deepseek-harness repo, then pushes the result to origin.
#
# Behaviour:
#   - git fetch upstream
#   - fast-forward-only merge of upstream/master into the current branch
#     (never creates a merge commit, never auto-resolves conflicts)
#   - push the branch to origin (only when the ff-only merge succeeded)
#
# If the local branch has diverged from upstream, the ff-only merge aborts
# and nothing is pushed, so your local commits are never clobbered.

$ErrorActionPreference = 'Stop'
$Repo = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "[sync-upstream] repo: $Repo"
Set-Location $Repo

# 1. Make sure we have a branch checked out.
$branch = git symbolic-ref --short HEAD 2>$null
if (-not $branch) {
    Write-Warning "[sync-upstream] HEAD is detached; checking out master."
    git checkout master
    $branch = 'master'
}
Write-Host "[sync-upstream] branch: $branch"

# 2. Fetch upstream.
git fetch upstream

# 3. Fast-forward-only merge of upstream/master into the current branch.
#    --ff-only guarantees we never create a merge commit or resolve conflicts.
git merge --ff-only "upstream/master"
if ($LASTEXITCODE -ne 0) {
    Write-Warning "[sync-upstream] fast-forward merge aborted (local branch diverged). Nothing was pushed."
    exit 1
}

# 4. Push to origin so the GitHub fork reflects the update.
git push origin "$branch"
if ($LASTEXITCODE -ne 0) {
    Write-Warning "[sync-upstream] push to origin failed (network/auth?). Local branch is up to date."
    exit 1
}

Write-Host "[sync-upstream] done: $branch is up to date with upstream/master and pushed to origin."