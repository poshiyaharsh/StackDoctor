# Installation

## Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0

## Getting Started

```bash
# Clone the repository
git clone https://github.com/poshiyaharsh/StackDoctor.git
cd StackDoctor

# Install dependencies
npm install

# Build the monorepo packages
npm run build

# Link the CLI locally
npm link --workspace apps/cli
```

Once linked, the `stackdoctor` command is available in your shell:

```bash
stackdoctor scan [path]
```
