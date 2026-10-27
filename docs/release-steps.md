# StackDoctor v0.1.0 Release Execution Guide

This document contains the step-by-step instructions for the maintainer to execute the official v0.1.0 release.

> **CRITICAL**: Do NOT run these steps until you are ready to publish packages publicly to npm and GitHub Releases. All automated CI checks, security scans, license audits, and package packing dry-runs have passed.

---

## Step 1: Set Up npm Automation Token

1. Log in to [npmjs.com](https://www.npmjs.com/).
2. Navigate to **Access Tokens > Generate New Token > Automation**.
3. Copy the generated token string.

---

## Step 2: Configure Protected GitHub Environment

1. In your GitHub repository (`poshiyaharsh/StackDoctor`), go to **Settings > Environments**.
2. Click **New environment** and enter name: `npm-publish`.
3. Under **Deployment protection rules**:
   - Check **Required reviewers** and add your GitHub username.
4. Under **Environment secrets**:
   - Click **Add secret**.
   - Name: `NPM_TOKEN`
   - Value: Paste your npm automation token from Step 1.
5. Save the secret.

---

## Step 3: Trigger the Release

### Option A: Tag-Triggered Release (Recommended)
From your terminal on `main`:
```bash
# 1. Ensure working directory is clean and up to date
git checkout main
git pull origin main

# 2. Create the annotated release tag
git tag -a v0.1.0 -m "Release v0.1.0: StackDoctor initial public release"

# 3. Push the tag to GitHub
git push origin v0.1.0
```

### Option B: Manual GitHub Actions Dispatch
1. Go to the **Actions** tab in GitHub.
2. Select the **Release** workflow (`.github/workflows/release.yml`).
3. Click **Run workflow**, enter `v0.1.0`, and click **Run**.

---

## Step 4: Approve the Deployment

1. The release workflow will run the complete CI test suite first.
2. When the verification job succeeds, GitHub Actions will pause and prompt for deployment approval to the `npm-publish` environment.
3. Review and approve the deployment.
4. The workflow will:
   - Build the distribution bundle.
   - Publish `stackdoctor@0.1.0` to npm with cryptographic provenance signing.
   - Create a draft release on GitHub with release notes from `RELEASE_NOTES_0.1.0.md`.

---

## Step 5: Publish the GitHub Release Draft

1. Go to **Releases** on your GitHub repository.
2. Review the auto-generated draft release.
3. Click **Publish release**.
4. Verify package installation:
   ```bash
   npx stackdoctor@latest --version
   ```
