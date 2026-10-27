# Applying Repository Labels to GitHub

This guide explains how the maintainer can sync the standardized label taxonomy from `.github/labels.yml` to the GitHub repository using the official [GitHub CLI (`gh`)](https://cli.github.com/).

> **Note**: Antigravity does not execute remote GitHub API calls. The maintainer executes these commands locally when ready.

---

## Prerequisites
Ensure the GitHub CLI is installed and authenticated with `repo` admin scope:
```bash
gh auth login
```

---

## Method 1: Using GitHub CLI and a Node Script

To apply the labels defined in `.github/labels.yml` to your repository:

```bash
# Clone or navigate to the repository
cd path/to/StackDoctor

# Run this quick script to sync labels using gh
node -e '
const fs = require("fs");
const yaml = require("yaml");
const { execSync } = require("child_process");

const labels = yaml.parse(fs.readFileSync(".github/labels.yml", "utf8"));
for (const label of labels) {
  try {
    console.log(`Syncing label: "${label.name}"`);
    execSync(`gh label create "${label.name}" --color "${label.color}" --description "${label.description}" --force`, { stdio: "inherit" });
  } catch (err) {
    console.warn(`Could not sync label "${label.name}":`, err.message);
  }
}
'
```

---

## Method 2: Using `github-label-sync` (npm tool)

If you prefer using an automated npm CLI:

```bash
npx github-label-sync --access-token "$GITHUB_TOKEN" --labels .github/labels.yml poshiyaharsh/StackDoctor
```

---

## Method 3: Manual Creation via Web UI

1. Go to your repository on GitHub: `https://github.com/poshiyaharsh/StackDoctor`.
2. Click **Issues > Labels**.
3. Create the labels with the names, hex colors, and descriptions specified in `.github/labels.yml`.
